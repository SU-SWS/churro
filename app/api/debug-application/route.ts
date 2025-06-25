import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const applicationUuid = searchParams.get('applicationUuid');
  const endpoint = searchParams.get('endpoint') || 'views'; // 'visits' or 'views'

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

    // Get the access token
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

    // Extract applications and their details
    const applications: any[] = [];
    
    if (rawData._embedded?.metadata) {
      rawData._embedded.metadata.forEach((metaItem: any, index: number) => {
        if (metaItem.uuids && Array.isArray(metaItem.uuids)) {
          metaItem.uuids.forEach((appUuid: string, appIndex: number) => {
            const appInfo = {
              uuid: appUuid,
              name: metaItem.names?.[appIndex] || `App ${appUuid.substring(0, 8)}`,
              metadataIndex: index,
              environments: [],
              totalDatapoints: 0,
              sampleDatapoints: [] as any[]
            };

            // Add environment info if available
            if (metaItem.ids && Array.isArray(metaItem.ids)) {
              metaItem.ids.forEach((envId: string, envIndex: number) => {
                appInfo.environments.push({
                  id: envId,
                  name: metaItem.environmentNames?.[envIndex] || metaItem.environment_names?.[envIndex] || `Env ${envId.substring(0, 8)}`
                });
              });
            }

            applications.push(appInfo);
          });
        }
      });
    }

    // Count datapoints and get samples
    if (rawData._embedded?.datapoints) {
      applications.forEach(app => {
        app.totalDatapoints = rawData._embedded.datapoints.length;
        app.sampleDatapoints = rawData._embedded.datapoints.slice(0, 5);
      });
    }

    // Find the specific application if requested
    let specificApplication = null;
    if (applicationUuid) {
      specificApplication = applications.find(app => app.uuid === applicationUuid);
    }

    return NextResponse.json({
      url: fullUrl,
      status: response.status,
      totalApplications: applications.length,
      totalDatapoints: rawData._embedded?.datapoints?.length || 0,
      applications: applications,
      specificApplication: specificApplication,
      searchedFor: applicationUuid,
      rawMetadata: rawData._embedded?.metadata || [],
      sampleDatapoints: rawData._embedded?.datapoints?.slice(0, 10) || []
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug request failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}