import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (!process.env.ACQUIA_API_KEY || !process.env.ACQUIA_API_SECRET) {
    return NextResponse.json(
      { error: 'Missing API credentials in environment variables' },
      { status: 500 }
    );
  }
  
  const apiKey = process.env.ACQUIA_API_KEY;
  const apiSecret = process.env.ACQUIA_API_SECRET;
  
  // Generate curl commands for testing
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const curlCommands = {
    basic_auth_accounts: `curl -X POST "https://accounts.acquia.com/api/auth/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "Authorization: Basic ${credentials}" \\
  -H "Accept: application/json" \\
  -d "grant_type=client_credentials"`,
  
    form_params_accounts: `curl -X POST "https://accounts.acquia.com/api/auth/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "Accept: application/json" \\
  -d "grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}"`,
  
    basic_auth_cloud: `curl -X POST "https://cloud.acquia.com/api/auth/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "Authorization: Basic ${credentials}" \\
  -H "Accept: application/json" \\
  -d "grant_type=client_credentials"`,
  
    form_params_cloud: `curl -X POST "https://cloud.acquia.com/api/auth/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "Accept: application/json" \\
  -d "grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}"`
  };
  
  return NextResponse.json({
    message: 'Test these curl commands in your terminal to see which one works',
    credentials_info: {
      api_key: apiKey,
      api_secret_length: apiSecret.length,
      api_secret_preview: apiSecret.substring(0, 10) + '...',
      base64_credentials_preview: credentials.substring(0, 20) + '...'
    },
    curl_commands: curlCommands
  });
}