import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const endpoint = searchParams.get('endpoint') || 'visits'; // 'visits' or 'views'

  if (!subscriptionUuid) {
    return NextResponse.json({ error: 'subscriptionUuid required' }, { status: 400 });
  }

  if (!process.env.ACQUIA_API_SECRET) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!,
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    // Get the access token using the public method
    const token = await apiService.getAccessToken();
    const baseUrl = process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api';
    const fullUrl = `${baseUrl}/subscriptions/${subscriptionUuid}/metrics/usage/${endpoint}-by-application`;

    console.log('🔍 Making debug request to:', fullUrl);

    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
      },
    });

    const rawData = await response.json();

    return NextResponse.json({
      url: fullUrl,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      rawResponse: rawData,
      responseKeys: Object.keys(rawData),
      embeddedKeys: rawData._embedded ? Object.keys(rawData._embedded) : null,
      dataStructureAnalysis: analyzeDataStructure(rawData)
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug request failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function analyzeDataStructure(data: any, path = ''): any {
  if (Array.isArray(data)) {
    return {
      type: 'array',
      length: data.length,
      firstItem: data.length > 0 ? analyzeDataStructure(data[0], `${path}[0]`) : null,
      sampleItems: data.slice(0, 3).map((item, i) => analyzeDataStructure(item, `${path}[${i}]`))
    };
  } else if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    const analysis: any = {
      type: 'object',
      keys: keys,
      keyCount: keys.length
    };
    
    // Analyze first few keys
    keys.slice(0, 5).forEach(key => {
      analysis[key] = analyzeDataStructure(data[key], `${path}.${key}`);
    });
    
    return analysis;
  } else {
    return {
      type: typeof data,
      value: data
    };
  }
}

// Also export POST method if you want to test with POST requests
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Use GET method' }, { status: 405 });
}
