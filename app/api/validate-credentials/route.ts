import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.ACQUIA_API_KEY;
  const apiSecret = process.env.ACQUIA_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return NextResponse.json({
      error: 'Missing credentials',
      found_api_key: !!apiKey,
      found_api_secret: !!apiSecret
    });
  }
  
  // Detailed credential analysis
  const analysis = {
    api_key: {
      value: apiKey,
      length: apiKey.length,
      has_whitespace: /\s/.test(apiKey),
      is_uuid_format: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey),
      char_codes: Array.from(apiKey).map(c => c.charCodeAt(0)),
    },
    api_secret: {
      value_preview: apiSecret.substring(0, 20) + '...',
      length: apiSecret.length,
      has_whitespace: /\s/.test(apiSecret),
      is_base64_like: /^[A-Za-z0-9+/]+=*$/.test(apiSecret),
      ends_with_equals: apiSecret.endsWith('='),
      char_codes_sample: Array.from(apiSecret.substring(0, 20)).map(c => c.charCodeAt(0)),
    }
  };
  
  return NextResponse.json({
    message: 'Credential Analysis',
    analysis
  });
}