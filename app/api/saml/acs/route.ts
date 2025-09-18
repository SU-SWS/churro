import { NextRequest, NextResponse } from 'next/server'
import forge from 'node-forge'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 SAML callback received')

    const formData = await request.formData()
    const samlResponse = formData.get('SAMLResponse') as string

    if (!samlResponse) {
      throw new Error('No SAML response received')
    }

    console.log('🔍 Processing SAML response with decryption...')

    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')

    // Extract issuer
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    console.log('🏷️ Issuer in SAML Response:', issuerMatch?.[1])

    // Look for encrypted assertion
    const encryptedAssertionMatch = decodedResponse.match(/<saml2:EncryptedAssertion[^>]*>([\s\S]*?)<\/saml2:EncryptedAssertion>/)

    if (encryptedAssertionMatch) {
      console.log('🔒 Found encrypted assertion - attempting decryption')

      try {
        // Extract all CipherValue elements
        const cipherValues = []
        const cipherPattern = /<xenc:CipherValue[^>]*>([^<]+)<\/xenc:CipherValue>/g
        let match
        while ((match = cipherPattern.exec(decodedResponse)) !== null) {
          cipherValues.push(match[1])
        }

        if (cipherValues.length < 2) {
          throw new Error(`Expected 2 CipherValues, found ${cipherValues.length}`)
        }

        const encryptedKey = cipherValues[0]
        const encryptedData = cipherValues[1]

        // Get our private key
        const privateKeyPem = process.env.SAML_SP_PRIVATE_KEY
        if (!privateKeyPem) {
          throw new Error('SAML_SP_PRIVATE_KEY environment variable not set')
        }

        console.log('🔐 Loading private key for decryption...')
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)

        // Decrypt the symmetric key
        console.log('🔓 Decrypting symmetric key...')
        const encryptedKeyBytes = forge.util.decode64(encryptedKey)
        const decryptedKeyBytes = privateKey.decrypt(encryptedKeyBytes, 'RSA-OAEP')

        console.log('✅ Successfully decrypted symmetric key')

        // Decrypt the assertion data
        console.log('🔓 Decrypting assertion data...')
        const encryptedDataBytes = forge.util.decode64(encryptedData)

        // Create decipher
        const decipher = forge.cipher.createDecipher('AES-CBC', decryptedKeyBytes)

        // Extract IV (first 16 bytes for AES)
        const ivLength = 16
        const iv = encryptedDataBytes.substring(0, ivLength)
        const cipherText = encryptedDataBytes.substring(ivLength)

        decipher.start({ iv: iv })
        decipher.update(forge.util.createBuffer(cipherText))

        if (!decipher.finish()) {
          throw new Error('Failed to decrypt assertion')
        }

        const decryptedAssertion = decipher.output.toString()
        console.log('✅ Successfully decrypted assertion!')

        // Parse the decrypted assertion for attributes
        const nameIDMatch = decryptedAssertion.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)

        const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
        const attributes: { [key: string]: string } = {}

        let attributeMatch
        while ((attributeMatch = attributePattern.exec(decryptedAssertion)) !== null) {
          const [, attrName, attrValue] = attributeMatch
          attributes[attrName] = attrValue
          console.log(`✅ Found attribute: ${attrName} = ${attrValue}`)
        }

        // Map Stanford attributes using official ARP mapping
        const user = {
          id: nameIDMatch?.[1] || 'unknown-id',

          // Core Stanford Identity Attributes
          sunetId: attributes['urn:oid:0.9.2342.19200300.100.1.1'], // uid
          email: attributes['urn:oid:0.9.2342.19200300.100.1.3'], // mail
          eduPersonPrincipalName: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'], // eduPersonPrincipalName

          // Name Attributes
          firstName: attributes['urn:oid:2.5.4.42'], // givenName
          lastName: attributes['urn:oid:2.5.4.4'], // sn (surname)
          displayName: attributes['urn:oid:2.16.840.1.113730.3.1.241'], // displayName
          name: attributes['urn:oid:2.16.840.1.113730.3.1.241'] || // Use displayName if available
                `${attributes['urn:oid:2.5.4.42'] || ''} ${attributes['urn:oid:2.5.4.4'] || ''}`.trim() ||
                'Stanford User',

          // Affiliation Attributes
          eduPersonAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'], // eduPersonAffiliation
          eduPersonScopedAffiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.9'], // eduPersonScopedAffiliation
          suAffiliation: attributes['suAffiliation'], // Stanford-specific affiliation

          // Legacy 'affiliation' field for backward compatibility
          affiliation: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.1'] ||
                      attributes['suAffiliation'],

          // Stanford-specific Attributes
          eduPersonEntitlement: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.7'], // Privilege groups
          eduPersonOrcid: attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.16'], // ORCID ID

          // Identity Attributes
          subjectId: attributes['urn:oasis:names:tc:SAML:attribute:subject-id'], // Persistent identifier
          pairwiseId: attributes['urn:oasis:names:tc:SAML:attribute:pairwise-id'], // SP-specific identifier
          persistentId: attributes['persistentId'], // Legacy persistent ID

          // System Attributes
          detectedIssuer: issuerMatch?.[1],
          decryptionSuccessful: true,
          authenticationTime: new Date().toISOString(),

          // All raw attributes for debugging/reference
          allAttributes: attributes,
        }

        console.log('👤 Final Stanford user data:', user)

        const baseUrl = 'https://churro-test.stanford.edu'
        const redirectUrl = new URL('/auth/test', baseUrl)
        redirectUrl.searchParams.set('saml_success', 'true')
        redirectUrl.searchParams.set('user', JSON.stringify(user))

        return Response.redirect(redirectUrl.toString(), 302)

      } catch (decryptionError) {
        console.error('❌ Decryption failed:', decryptionError)

        const baseUrl = 'https://churro-test.stanford.edu'
        const redirectUrl = new URL('/auth/test', baseUrl)
        redirectUrl.searchParams.set('saml_error', String(decryptionError))

        return Response.redirect(redirectUrl.toString(), 302)
      }
    } else {
      throw new Error('No encrypted assertion found in response')
    }

  } catch (error) {
    console.error('❌ SAML callback error:', error)

    const baseUrl = 'https://churro-test.stanford.edu'
    const redirectUrl = new URL('/auth/test', baseUrl)
    redirectUrl.searchParams.set('saml_error', String(error))

    return Response.redirect(redirectUrl.toString(), 302)
  }
}