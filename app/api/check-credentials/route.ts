import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.ACQUIA_API_KEY;
  const apiSecret = process.env.ACQUIA_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Missing credentials' });
  }

  return NextResponse.json({
    api_key_analysis: {
      value: apiKey,
      length: apiKey.length,
      format: {
        is_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey),
        has_dashes: apiKey.includes('-'),
        is_alphanumeric_only: /^[a-z0-9-]+$/i.test(apiKey)
      }
    },
    api_secret_analysis: {
      length: apiSecret.length,
      preview: apiSecret.substring(0, 10) + '...',
      format: {
        is_base64_like: /^[A-Za-z0-9+/]+=*$/.test(apiSecret),
        ends_with_equals: apiSecret.endsWith('='),
        has_special_chars: /[+/=]/.test(apiSecret)
      }
    },
    recommendations: [
      'Verify these are Cloud API credentials (not Site Factory or other Acquia services)',
      'Check that the API application has the correct permissions',
      'Ensure the credentials are for the production Acquia Cloud API'
    ]
  });
}