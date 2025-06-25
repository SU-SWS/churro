import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get all environment variables that start with ACQUIA_
  const acquiaVars = Object.keys(process.env)
    .filter(key => key.startsWith('ACQUIA_'))
    .reduce((obj, key) => {
      const value = process.env[key] || '';
      obj[key] = {
        exists: !!value,
        length: value.length,
        preview: value.length > 20 ? value.substring(0, 20) + '...' : value,
        full_value: key === 'ACQUIA_API_KEY' ? value : '[hidden]' // Only show full API key
      };
      return obj;
    }, {} as Record<string, any>);

  return NextResponse.json({
    message: 'Environment Variables Check',
    variables: acquiaVars,
    expected_api_key: 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3',
    api_key_matches: process.env.ACQUIA_API_KEY === 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3'
  });
}