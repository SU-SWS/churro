import { NextRequest, NextResponse } from 'next/server';
import AcquiaApiServiceFixed from '@/lib/acquia-api-fixed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subscriptionUuid = searchParams.get('subscriptionUuid');
  const endpoint = searchParams.get('endpoint') || 'views';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

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

    const token = await apiService.getAccessToken();
    const baseUrl = process.env.ACQUIA_API_BASE_URL || 'https://cloud.acquia.com/api';
    
    // Build URL with date parameters if provided
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const fullUrl = `${baseUrl}/subscriptions/${subscriptionUuid}/metrics/usage/${endpoint}-by-application${params.toString() ? `?${params.toString()}` : ''}`;

    console.log('🔍 Making comprehensive debug request to:', fullUrl);

    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
      },
    });

    const rawData = await response.json();

    // Comprehensive analysis function
    function analyzeStructure(obj: any, path: string = '', maxDepth: number = 5): any {
      if (maxDepth <= 0) return { type: typeof obj, note: 'max_depth_reached' };
      
      if (obj === null) return { type: 'null' };
      if (obj === undefined) return { type: 'undefined' };
      
      if (Array.isArray(obj)) {
        return {
          type: 'array',
          length: obj.length,
          isEmpty: obj.length === 0,
          firstItems: obj.slice(0, 3).map((item, i) => ({
            index: i,
            analysis: analyzeStructure(item, `${path}[${i}]`, maxDepth - 1)
          })),
          allItemTypes: [...new Set(obj.map(item => Array.isArray(item) ? 'array' : typeof item))]
        };
      }
      
      if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        const analysis: any = {
          type: 'object',
          keyCount: keys.length,
          isEmpty: keys.length === 0,
          keys: keys
        };
        
        // Analyze each key
        keys.forEach(key => {
          analysis[key] = analyzeStructure(obj[key], `${path}.${key}`, maxDepth - 1);
        });
        
        return analysis;
      }
      
      return {
        type: typeof obj,
        value: typeof obj === 'string' ? obj.substring(0, 100) + (obj.length > 100 ? '...' : '') : obj
      };
    }

    const structureAnalysis = analyzeStructure(rawData);

    // Look for any arrays or data structures that might contain our data
    function findArraysAndData(obj: any, path: string = ''): any[] {
      const results: any[] = [];
      
      if (Array.isArray(obj)) {
        results.push({
          path,
          type: 'array',
          length: obj.length,
          sample: obj.slice(0, 2)
        });
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;
          results.push(...findArraysAndData(obj[key], fullPath));
        });
      }
      
      return results;
    }

    const foundArrays = findArraysAndData(rawData);

    // Check for any UUID-like strings anywhere in the response
    function findUUIDs(obj: any, path: string = ''): any[] {
      const results: any[] = [];
      const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
      
      if (typeof obj === 'string' && uuidPattern.test(obj)) {
        results.push({ path, value: obj });
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          results.push(...findUUIDs(item, `${path}[${index}]`));
        });
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;
          results.push(...findUUIDs(obj[key], fullPath));
        });
      }
      
      return results;
    }

    const foundUUIDs = findUUIDs(rawData);

    // Check for any numeric data that might be metrics
    function findNumericData(obj: any, path: string = ''): any[] {
      const results: any[] = [];
      
      if (typeof obj === 'number') {
        results.push({ path, value: obj });
      } else if (typeof obj === 'string' && !isNaN(Number(obj))) {
        results.push({ path, value: obj, note: 'numeric_string' });
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          results.push(...findNumericData(item, `${path}[${index}]`));
        });
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;
          results.push(...findNumericData(obj[key], fullPath));
        });
      }
      
      return results;
    }

    const foundNumbers = findNumericData(rawData);

    return NextResponse.json({
      request: {
        url: fullUrl,
        method: 'GET',
        hasDateRange: !!(from || to),
        dateRange: { from, to }
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      },
      analysis: {
        topLevelKeys: Object.keys(rawData),
        structureAnalysis,
        foundArrays,
        foundUUIDs,
        foundNumbers: foundNumbers.slice(0, 20), // Limit to first 20 to avoid huge responses
        totalNumericValues: foundNumbers.length
      },
      rawResponse: rawData,
      searchTargets: {
        lookingFor: 'datapoints, metadata, applications with UUIDs',
        targetUUID: '3e02ea73-76fa-4a88-91d7-3476aca3cf07'
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug request failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}