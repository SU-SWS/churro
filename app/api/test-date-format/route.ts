import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const endpoint = searchParams.get('endpoint') || 'views';

  if (!subscriptionUuid) {
    return NextResponse.json({ error: 'subscriptionUuid required' }, { status: 400 });
  }

  try {
    const apiService = new AcquiaApiServiceFixed({
      baseUrl: process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api',
      authUrl: process.env.ACQUIA_AUTH_BASE_URL || 'https://accounts.acquia.com/api',
      apiKey: process.env.ACQUIA_API_KEY!,
      apiSecret: process.env.ACQUIA_API_SECRET!,
    });

    const token = await apiService.getAccessToken();

    // Test different URL formats
    const baseUrl = `https://cloud.acquia.com/api/subscriptions/${subscriptionUuid}/metrics/usage/${endpoint}-by-application`;
    
    const testUrls = [];
    
    if (from && to) {
      // Format 1: Our current format
      const filter1 = `from=${from}T00:00:00.000Z,to=${to}T23:59:59.000Z`;
      testUrls.push({
        name: 'Current format',
        url: `${baseUrl}?filter=${encodeURIComponent(filter1)}&resolution=day`,
        filter: filter1
      });
      
      // Format 2: Your working example format
      const filter2 = `from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z`;
      testUrls.push({
        name: 'Working example format',
        url: `${baseUrl}?filter=${encodeURIComponent(filter2)}&resolution=day`,
        filter: filter2
      });
    } else {
      // No date filter
      testUrls.push({
        name: 'No date filter',
        url: `${baseUrl}?resolution=day`,
        filter: 'none'
      });
    }

    const results = [];

    for (const testUrl of testUrls) {
      try {
        console.log(`Testing: ${testUrl.url}`);
        
        const response = await fetch(testUrl.url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': '*/*',
          },
        });

        const data = await response.json();
        
        const itemCount = data._embedded?.items?.length || 0;
        let dateRange = 'no data';
        
        if (itemCount > 0 && data._embedded.items[0].datapoints?.length > 0) {
          const datapoints = data._embedded.items[0].datapoints;
          const firstDate = Array.isArray(datapoints[0]) ? datapoints[0][0] : 'unknown';
          const lastDate = Array.isArray(datapoints[datapoints.length - 1]) ? datapoints[datapoints.length - 1][0] : 'unknown';
          dateRange = `${firstDate} to ${lastDate}`;
        }

        results.push({
          ...testUrl,
          status: response.status,
          itemCount,
          dateRange,
          success: response.status === 200
        });
      } catch (error) {
        results.push({
          ...testUrl,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
      }
    }

    return NextResponse.json({
      message: 'Date format testing results',
      requestedRange: { from, to },
      results
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}