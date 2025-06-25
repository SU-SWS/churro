export function debugCredentials(apiKey: string, apiSecret: string) {
  console.log('🔍 CREDENTIAL DEBUG ANALYSIS:');
  console.log('');
  
  // Show what we received
  console.log('📥 Received API Key:', JSON.stringify(apiKey));
  console.log('📥 Received API Secret preview:', JSON.stringify(apiSecret.substring(0, 20) + '...'));
  console.log('');
  
  // Show lengths
  console.log('📏 API Key length:', apiKey.length);
  console.log('📏 API Secret length:', apiSecret.length);
  console.log('');
  
  // Show what the correct UUID should look like
  console.log('✅ Expected format - UUID client_id: deed5eaf-98ba-4924-8747-1fb1fbd00bd3');
  console.log('❌ Incorrect value found: 60L4E7s0AsSQCpSAs9zcb7RQwlIPD3lI78uYQRtjslLt4bOYuEige7qdoyMQtLfmfgTkoXJKJaqF');
  console.log('');
  
  // Test if the incorrect value is some transformation of the correct one
  const correctClientId = 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3';
  const incorrectValue = '60L4E7s0AsSQCpSAs9zcb7RQwlIPD3lI78uYQRtjslLt4bOYuEige7qdoyMQtLfmfgTkoXJKJaqF';
  
  console.log('🧪 Testing transformations:');
  console.log('Base64 of correct UUID:', Buffer.from(correctClientId).toString('base64'));
  console.log('Base64 of UUID:secret:', Buffer.from(`${correctClientId}:${apiSecret}`).toString('base64').substring(0, 70) + '...');
  console.log('');
  
  // Check if the received apiKey matches either
  console.log('🔍 Value comparison:');
  console.log('API Key === correct UUID:', apiKey === correctClientId);
  console.log('API Key === incorrect value:', apiKey === incorrectValue);
  console.log('API Key starts with incorrect value:', apiKey.startsWith(incorrectValue.substring(0, 20)));
  console.log('');
  
  // Check character by character for the first 20 characters
  console.log('🔤 Character-by-character comparison (first 20):');
  for (let i = 0; i < Math.min(20, apiKey.length); i++) {
    const char = apiKey[i];
    const code = char.charCodeAt(0);
    console.log(`Position ${i}: '${char}' (code: ${code})`);
  }
  
  return {
    received_api_key: apiKey,
    expected_api_key: correctClientId,
    matches_expected: apiKey === correctClientId,
    api_key_length: apiKey.length,
    api_secret_length: apiSecret.length
  };
}