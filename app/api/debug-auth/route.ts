import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get credentials from environment
  const apiKey = process.env.ACQUIA_API_KEY;
  const apiSecret = process.env.ACQUIA_API_SECRET;
  const authUrl = process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api';
  
  // Check if credentials exist
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ 
      error: 'Missing API credentials', 
      envVars: {
        ACQUIA_API_KEY: apiKey ? `${apiKey.substring(0, 5)}...` : 'not set',
        ACQUIA_API_SECRET: apiSecret ? `${apiSecret.substring(0, 5)}...` : 'not set',
        ACQUIA_AUTH_BASE_URL: authUrl
      }
    }, { status: 400 });
  }
  
  try {
    // Attempt authentication with debug info
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    console.log('📝 Encoded credentials (first 10 chars):', credentials.substring(0, 10) + '...');
    
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    
    // Try authentication
    const response = await fetch(`${authUrl}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        message: 'Authentication successful',
        token_type: data.token_type,
        expires_in: data.expires_in,
        token_preview: data.access_token ? `${data.access_token.substring(0, 10)}...` : null
      });
    } else {
      return NextResponse.json({ 
        error: 'Authentication failed', 
        status: response.status,
        data,
        request_details: {
          url: `${authUrl}/auth/oauth/token`,
          api_key_preview: apiKey.substring(0, 5) + '...',
          api_key_length: apiKey.length,
          credentials_preview: credentials.substring(0, 10) + '...'
        }
      }, { status: response.status });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to authenticate', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}