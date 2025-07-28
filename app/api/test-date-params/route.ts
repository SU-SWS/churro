import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  
  // Test the exact URL format
  const baseUrl = 'https://cloud.acquia.com/api';
  
  // Build filter exactly as the API expects
  let filterParts: string[] = [];
  
  if (from) {
    const fromDate = from.includes('T') ? from : `${from}T00:00:00.000Z`;
    filterParts.push(`from=${fromDate}`);
  }
  
  if (to) {
    const toDate = to.includes('T') ? to : `${to}T23:59:59.000Z`;
    filterParts.push(`to=${toDate}`);
  }
  
  const filterParam = filterParts.join(',');
  
  const testUrls = {
    visits: `${baseUrl}/subscriptions/${subscriptionUuid}/metrics/usage/visits-by-application?filter=${encodeURIComponent(filterParam)}&resolution=day`,
    views: `${baseUrl}/subscriptions/${subscriptionUuid}/metrics/usage/views-by-application?filter=${encodeURIComponent(filterParam)}&resolution=month`,
    
    // Compare with your working examples
    yourExampleViews: `${baseUrl}/subscriptions/0bc0f7c5-b96a-43c9-b74f-3dd3810a5245/metrics/usage/views-by-application?filter=from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z&resolution=month`,
    yourExampleVisits: `${baseUrl}/subscriptions/0bc0f7c5-b96a-43c9-b74f-3dd3810a5245/metrics/usage/visits-by-application?filter=from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z&resolution=day`
  };
  
  return NextResponse.json({
    input: { from, to, subscriptionUuid },
    filterParam,
    encodedFilter: encodeURIComponent(filterParam),
    testUrls,
    comparison: {
      ourFormat: filterParam,
      expectedFormat: 'from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z',
      matches: filterParam === 'from=2025-04-01T00:00:00.000Z,to=2025-04-30T23:59:59.000Z'
    }
  });
}