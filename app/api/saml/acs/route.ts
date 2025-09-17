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
    
    console.log('🔍 Processing SAML response with manual decryption...')
    
    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    console.log('📋 Full SAML Response (first 1000 chars):')
    console.log(decodedResponse.substring(0, 1000) + '...')
    
    // Extract issuer
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    console.log('🏷️ Issuer in SAML Response:', issuerMatch?.[1])
    
    // Look for encrypted assertion
    const encryptedAssertionMatch = decodedResponse.match(/<saml2:EncryptedAssertion[^>]*>([\s\S]*?)<\/saml2:EncryptedAssertion>/)
    
    if (encryptedAssertionMatch) {
      console.log('🔒 Found encrypted assertion - attempting decryption')
      
      try {
        // Extract the encrypted key and data
        const encryptedKeyMatch = decodedResponse.match(/<xenc:CipherValue[^>]*>([^<]+)<\/xenc:CipherValue>/)
        const encryptedDataMatches = decodedResponse.match(/<xenc:CipherValue[^>]*>([^<]+)<\/xenc:CipherValue>/g)
        
        if (!encryptedKeyMatch || !encryptedDataMatches || encryptedDataMatches.length < 2) {
          throw new Error('Could not find encrypted key or data in response')
        }
        
        const encryptedKey = encryptedKeyMatch[1]
        const encryptedData = encryptedDataMatches[1] // Second CipherValue is usually the data
        
        console.log('🔑 Found encrypted key (first 100 chars):', encryptedKey.substring(0, 100) + '...')
        console.log('💾 Found encrypted data (first 100 chars):', encryptedData.substring(0, 100) + '...')
        
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
        
        // Create AES cipher
        const key = forge.util.createBuffer(decryptedKeyBytes)
        const decipher = forge.cipher.createDecipher('AES-CBC', key)
        
        // Extract IV (first 16 bytes)
        const iv = encryptedDataBytes.substring(0, 16)
        const cipherText = encryptedDataBytes.substring(16)
        
        decipher.start({ iv: iv })
        decipher.update(forge.util.createBuffer(cipherText))
        decipher.finish()
        
        const decryptedAssertion = decipher.output.data
        console.log('✅ Successfully decrypted assertion!')
        console.log('📜 Decrypted assertion:', decryptedAssertion)
        
        // Parse the decrypted assertion for attributes
        const nameIDMatch = decryptedAssertion.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)
        const attributePattern = /<saml2:Attribute[^>]*Name="([^"]+)"[^>]*>[\s\S]*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/g
        const attributes: { [key: string]: string } = {}
        
        let attributeMatch
        while ((attributeMatch = attributePattern.exec(decryptedAssertion)) !== null) {
          const [, attrName, attrValue] = attributeMatch
          attributes[attrName] = attrValue
          console.log(`✅ Found decrypted attribute: ${attrName} = ${attrValue}`)
        }
        
        const user = {
          id: nameIDMatch?.[1] || 'decrypted-user',
          email: attributes['mail'] || attributes['email'] || 'unknown@stanford.edu',
          name: attributes['displayName'] || attributes['cn'] || 'Stanford User',
          firstName: attributes['givenName'],
          lastName: attributes['sn'],
          sunetId: attributes['uid'] || 'unknown-sunet',
          affiliation: attributes['eduPersonAffiliation'],
          // Debug info
          detectedIssuer: issuerMatch?.[1],
          decryptionSuccessful: true,
          allAttributes: attributes,
        }
        
        console.log('👤 Final decrypted user data:', user)
        
        const baseUrl = 'https://churro-test.stanford.edu'
        const redirectUrl = new URL('/auth/test', baseUrl)
        redirectUrl.searchParams.set('saml_success', 'true')
        redirectUrl.searchParams.set('user', JSON.stringify(user))
        
        return Response.redirect(redirectUrl.toString(), 302)
        
      } catch (decryptionError) {
        console.error('❌ Decryption failed:', decryptionError)
        
        // Fall back to encrypted response
        const user = {
          id: 'decryption-failed',
          email: 'decryption-failed@stanford.edu',
          name: 'Decryption Failed',
          sunetId: 'decryption-failed',
          detectedIssuer: issuerMatch?.[1],
          decryptionError: String(decryptionError),
          hasEncryptedAssertion: true,
        }
        
        const baseUrl = 'https://churro-test.stanford.edu'
        const redirectUrl = new URL('/auth/test', baseUrl)
        redirectUrl.searchParams.set('saml_success', 'true')
        redirectUrl.searchParams.set('user', JSON.stringify(user))
        
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