import axios from 'axios';

export async function testAcquiaAuth(apiKey: string, apiSecret: string) {
  console.log('🧪 DETAILED ACQUIA AUTH DEBUG...');

  // Comprehensive credential validation
  console.log('\n🔍 CREDENTIAL ANALYSIS:');
  console.log('Raw API Key:', JSON.stringify(apiKey));
  console.log('Raw API Secret:', JSON.stringify(apiSecret));
  console.log('API Key length:', apiKey.length);
  console.log('API Secret length:', apiSecret.length);
  
  // Check for hidden characters
  const apiKeyBytes = [...apiKey].map(c => c.charCodeAt(0));
  const apiSecretBytes = [...apiSecret].map(c => c.charCodeAt(0));
  console.log('API Key char codes:', apiKeyBytes);
  console.log('API Secret char codes (first 20):', apiSecretBytes.slice(0, 20));

  // Clean the credentials
  const cleanApiKey = apiKey.trim().replace(/\s/g, '');
  const cleanApiSecret = apiSecret.trim().replace(/\s/g, '');

  console.log('\n🧹 CLEANED CREDENTIALS:');
  console.log('Cleaned API Key:', cleanApiKey);
  console.log('Cleaned API Secret (first 20):', cleanApiSecret.substring(0, 20) + '...');
  console.log('API Key UUID format?:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanApiKey));
  console.log('API Secret base64-like?:', /^[A-Za-z0-9+/]+=*$/.test(cleanApiSecret));

  // Test the specific endpoint that's most likely to work
  const endpoint = 'https://accounts.acquia.com/api/auth/oauth/token';

  console.log(`\n🎯 TESTING PRIMARY ENDPOINT: ${endpoint}`);

  // Method 1: Form parameters with extensive debugging
  console.log('\n📝 Method 1: Form Parameters (Enhanced Debug)');
  try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
    formData.append('client_id', cleanApiKey);
    formData.append('client_secret', cleanApiSecret);
    
    const requestBody = formData.toString();
    console.log('📤 Exact request body:', requestBody);
    console.log('📤 Request body length:', requestBody.length);

    const requestConfig = {
      method: 'POST' as const,
        url: endpoint,
      data: requestBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        'User-Agent': 'Acquia-Test/1.0',
        'Cache-Control': 'no-cache'
        },
        timeout: 30000,
        validateStatus: () => true,
    };
      
    console.log('📤 Full request config:', JSON.stringify(requestConfig, null, 2));

    const response = await axios(requestConfig);

    console.log('📥 Complete response:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   Headers:', JSON.stringify(response.headers, null, 2));
    console.log('   Data:', JSON.stringify(response.data, null, 2));

      if (response.status === 200 && response.data?.access_token) {
      console.log('✅ SUCCESS!');
        return {
          success: true,
          method: 'form_params',
          token: response.data.access_token,
          data: response.data
        };
      }

    // Check for specific error messages
    if (response.data?.error) {
      console.log('🔍 API Error Details:', response.data.error);
      if (response.data.error_description) {
        console.log('🔍 Error Description:', response.data.error_description);
  }
    }
  
    } catch (error) {
    console.log('❌ Form method error:', error);
      if (axios.isAxiosError(error)) {
      console.log('🔍 Axios error details:');
      console.log('   Response status:', error.response?.status);
      console.log('   Response data:', JSON.stringify(error.response?.data, null, 2));
      console.log('   Request config:', JSON.stringify(error.config, null, 2));
  }
    }
  
  // Method 2: Try with different client_id formats
  console.log('\n🔄 Method 2: Testing Different Client ID Formats');
  const clientIdVariations = [
    cleanApiKey,
    cleanApiKey.toLowerCase(),
    cleanApiKey.toUpperCase(),
    cleanApiKey.replace(/-/g, ''), // Remove dashes
  ];

  for (let i = 0; i < clientIdVariations.length; i++) {
    const clientId = clientIdVariations[i];
    console.log(`\n🔧 Variation ${i + 1}: ${clientId}`);

    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', clientId);
      formData.append('client_secret', cleanApiSecret);

      const response = await axios({
      method: 'POST',
        url: endpoint,
        data: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
          'User-Agent': 'Acquia-Test/1.0'
        },
        timeout: 30000,
        validateStatus: () => true,
      });

      console.log(`📥 Variation ${i + 1} response:`, {
        status: response.status,
        data: response.data
      });
      
      if (response.status === 200 && response.data?.access_token) {
        console.log(`✅ SUCCESS with variation ${i + 1}!`);
        return {
          success: true,
          method: 'form_params_variation',
          variation: i + 1,
          client_id_used: clientId,
          token: response.data.access_token,
          data: response.data
        };
      }
    } catch (error) {
      console.log(`❌ Variation ${i + 1} error:`, error instanceof Error ? error.message : String(error));
      }
    }

  // Method 3: Basic Auth with various credential formats
  console.log('\n🔐 Method 3: Basic Auth Variations');
  for (let i = 0; i < clientIdVariations.length; i++) {
    const clientId = clientIdVariations[i];
    console.log(`\n🔧 Basic Auth Variation ${i + 1}: ${clientId}`);

    try {
      const credentials = Buffer.from(`${clientId}:${cleanApiSecret}`).toString('base64');

      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: 'grant_type=client_credentials',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Acquia-Test/1.0'
        },
        timeout: 30000,
        validateStatus: () => true,
      });

      console.log(`📥 Basic Auth Variation ${i + 1} response:`, {
        status: response.status,
        data: response.data
      });

      if (response.status === 200 && response.data?.access_token) {
        console.log(`✅ SUCCESS with Basic Auth variation ${i + 1}!`);
  return {
          success: true,
          method: 'basic_auth_variation',
          variation: i + 1,
          client_id_used: clientId,
          token: response.data.access_token,
          data: response.data
        };
}
    } catch (error) {
      console.log(`❌ Basic Auth Variation ${i + 1} error:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Method 4: Test credential generation
  console.log('\n🧪 Method 4: Credential Generation Test');
  console.log('Testing if we can reproduce your working curl command...');

  // This should exactly match what curl would send
  const curlEquivalent = {
    client_id: cleanApiKey,
    client_secret: cleanApiSecret,
    base64: Buffer.from(`${cleanApiKey}:${cleanApiSecret}`).toString('base64')
  };

  console.log('🔍 Curl equivalent data:');
  console.log('   client_id:', curlEquivalent.client_id);
  console.log('   client_secret (first 10):', curlEquivalent.client_secret.substring(0, 10) + '...');
  console.log('   base64 (first 20):', curlEquivalent.base64.substring(0, 20) + '...');

  return {
    success: false,
    error: 'All methods failed',
    debug_info: {
      original_api_key: apiKey,
      cleaned_api_key: cleanApiKey,
      api_secret_length: cleanApiSecret.length,
      tested_variations: clientIdVariations
    }
  };
}
