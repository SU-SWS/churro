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
    
    console.log('🔍 Processing SAML response with improved decryption...')
    
    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')
    
    // Extract issuer
    const issuerMatch = decodedResponse.match(/<saml2:Issuer[^>]*>([^<]+)<\/saml2:Issuer>/)
    console.log('🏷️ Issuer in SAML Response:', issuerMatch?.[1])
    
    // Look for encrypted assertion
    const encryptedAssertionMatch = decodedResponse.match(/<saml2:EncryptedAssertion[^>]*>([\s\S]*?)<\/saml2:EncryptedAssertion>/)
    
    if (encryptedAssertionMatch) {
      console.log('🔒 Found encrypted assertion - attempting improved decryption')
      
      try {
        // Extract encryption method
        const encMethodMatch = decodedResponse.match(/<xenc:EncryptionMethod Algorithm="([^"]+)"/i)
        const encryptionAlgorithm = encMethodMatch?.[1] || 'http://www.w3.org/2001/04/xmlenc#aes128-cbc'
        console.log('🔐 Encryption Algorithm:', encryptionAlgorithm)
        
        // Extract all CipherValue elements more precisely
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
        
        console.log('🔑 Encrypted key (first 50 chars):', encryptedKey.substring(0, 50) + '...')
        console.log('💾 Encrypted data (first 50 chars):', encryptedData.substring(0, 50) + '...')
        
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
        
        console.log('✅ Successfully decrypted symmetric key, length:', decryptedKeyBytes.length)
        
        // Decrypt the assertion data
        console.log('🔓 Decrypting assertion data...')
        const encryptedDataBytes = forge.util.decode64(encryptedData)
        
        // Determine cipher type based on algorithm
        let cipherType = 'AES-CBC'
        if (encryptionAlgorithm.includes('aes256')) {
          cipherType = 'AES-CBC'
        } else if (encryptionAlgorithm.includes('aes128')) {
          cipherType = 'AES-CBC'
        }
        
        console.log('🔐 Using cipher type:', cipherType)
        console.log('🔐 Key length:', decryptedKeyBytes.length)
        console.log('🔐 Encrypted data length:', encryptedDataBytes.length)
        
        // Create decipher
        const decipher = forge.cipher.createDecipher(cipherType, decryptedKeyBytes)
        
        // Extract IV (typically first 16 bytes for AES)
        const ivLength = 16 // AES block size
        const iv = encryptedDataBytes.substring(0, ivLength)
        const cipherText = encryptedDataBytes.substring(ivLength)
        
        console.log('🔐 IV length:', iv.length)
        console.log('🔐 Cipher text length:', cipherText.length)
        
        decipher.start({ iv: iv })
        decipher.update(forge.util.createBuffer(cipherText))
        
        if (!decipher.finish()) {
          throw new Error('Failed to decrypt assertion - decipher.finish() returned false')
        }
        
        const decryptedAssertion = decipher.output.toString()
        console.log('✅ Successfully decrypted assertion!')
        console.log('📜 Decrypted assertion (first 500 chars):', decryptedAssertion.substring(0, 500))
        
        // Parse the decrypted assertion for attributes
        const nameIDMatch = decryptedAssertion.match(/<saml2:NameID[^>]*>([^<]+)<\/saml2:NameID>/)
        console.log('👤 Found NameID:', nameIDMatch?.[1])
        
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
          encryptionAlgorithm: encryptionAlgorithm,
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
        console.error('Decryption error stack:', decryptionError instanceof Error ? decryptionError.stack : 'No stack')
        
        // Fall back to encrypted response info
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