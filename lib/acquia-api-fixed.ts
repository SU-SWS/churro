import axios from 'axios';

export interface VisitsData {
  applicationUuid: string;
  applicationName?: string;
  environmentUuid?: string;
  environmentName?: string;
  visits: number;
  date: string;
}

export interface ViewsData {
  applicationUuid: string;
  applicationName?: string;
  environmentUuid?: string;
  environmentName?: string;
  views: number;
  date: string;
}

export interface AcquiaApiConfig {
  baseUrl: string;
  authUrl: string;
  apiKey: string;
  apiSecret: string;
}

export interface FetchProgress {
  step: string;
  currentPage?: number;
  totalPages?: number;
  itemsCollected?: number;
}

class AcquiaApiServiceFixed {
  private config: AcquiaApiConfig;
  private accessToken: string | null = null;
  private readonly AUTH_TIMEOUT = 120000;
  private readonly API_TIMEOUT = 120000;
  private progressCallback?: (progress: FetchProgress) => void;

  constructor(config: AcquiaApiConfig) {
    this.config = {
      ...config,
      apiKey: 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3'
    };
    
    console.log('🔧 Initializing FIXED Acquia API Service with corrected date handling...');
  }

  setProgressCallback(callback: (progress: FetchProgress) => void) {
    this.progressCallback = callback;
  }

  private reportProgress(progress: FetchProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    console.log('📊 Progress:', progress);
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const authUrl = `${this.config.authUrl}/auth/oauth/token`;
    
    try {
      const response = await axios({
        method: 'POST',
        url: authUrl,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
        },
        data: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': this.config.apiKey,
          'client_secret': this.config.apiSecret
        }).toString(),
        timeout: this.AUTH_TIMEOUT,
        validateStatus: () => true,
      });
      
      if (response.status === 200 && response.data?.access_token) {
        const accessToken = response.data.access_token;
        
        if (typeof accessToken === 'string' && accessToken.length > 0) {
          this.accessToken = accessToken;
          console.log('✅ Successfully authenticated!');
          return accessToken;
        } else {
          throw new Error('Invalid access token format received from API');
        }
      }
      
      throw new Error(`Authentication failed: ${response.status} - ${JSON.stringify(response.data)}`);
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  private async makeAuthenticatedRequest(endpoint: string) {
    const token = await this.getAccessToken();
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    
    try {
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*',
        },
        timeout: this.API_TIMEOUT,
      });
      
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.log('🔄 Token expired, retrying...');
          this.accessToken = null;
          
          const newToken = await this.getAccessToken();
          return axios.get(fullUrl, {
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Accept': '*/*',
            },
            timeout: this.API_TIMEOUT,
          });
        }
      }
      
      throw error;
    }
  }

  private buildFilterParam(from?: string, to?: string): string {
    if (!from && !to) {
      console.log('📅 No date range specified, API will return default data');
      return '';
    }

    console.log(`📅 Building filter for date range: ${from} to ${to}`);

    // Convert YYYY-MM-DD format to the exact format the API expects
    const formatDateForApi = (dateStr: string, isEndDate: boolean = false): string => {
      // If it's already in the correct ISO format, return as-is
      if (dateStr.includes('T') && dateStr.includes('Z')) {
        return dateStr;
      }

      // Convert YYYY-MM-DD to the exact format Acquia expects
      let isoDate: string;
      if (dateStr.includes('T')) {
        // Already has time component, just ensure it ends with Z
        isoDate = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
      } else {
        // Simple date format, add appropriate time
        if (isEndDate) {
          // For end date, use end of day
          isoDate = `${dateStr}T23:59:59.000Z`;
        } else {
          // For start date, use beginning of day
          isoDate = `${dateStr}T00:00:00.000Z`;
        }
      }

      console.log(`📅 Formatted ${dateStr} (end=${isEndDate}) -> ${isoDate}`);
      return isoDate;
    };

    let filterParts: string[] = [];

    if (from) {
      const fromDate = formatDateForApi(from, false);
      filterParts.push(`from=${fromDate}`);
    }

    if (to) {
      const toDate = formatDateForApi(to, true);
      filterParts.push(`to=${toDate}`);
    }

    const filterString = filterParts.join(',');
    console.log(`📅 Final filter parameter: ${filterString}`);
    return filterString;
  }

  private parseApplicationData(responseData: any, dataType: 'visits' | 'views'): VisitsData[] | ViewsData[] {
    console.log('\n🔍 PARSING ACQUIA API RESPONSE - CORRECT ASSOCIATION');
    console.log('📊 Response top-level keys:', Object.keys(responseData));
    
    if (!responseData._embedded) {
      console.warn('⚠️ No _embedded found in response');
      return [];
    }

    console.log('📊 _embedded keys:', Object.keys(responseData._embedded));

    if (!responseData._embedded.items || !Array.isArray(responseData._embedded.items)) {
      console.warn('⚠️ No _embedded.items array found in response');
      return [];
    }

    const items = responseData._embedded.items;
    console.log(`📋 Found ${items.length} items in _embedded.items`);

    const parsedVisitsData: VisitsData[] = [];
    const parsedViewsData: ViewsData[] = [];

    items.forEach((item: any, itemIndex: number) => {
      console.log(`\n🏢 === PROCESSING ITEM ${itemIndex} (One Application) ===`);
      console.log(`📋 Item structure: hasDatapoints=${!!item.datapoints}, datapointsCount=${item.datapoints?.length || 0}, hasMetadata=${!!item.metadata}, metadataKeys=${item.metadata ? JSON.stringify(Object.keys(item.metadata)) : '[]'}`);
      // FIRST: Extract the application metadata for this entire item
      let applicationUuid = '';
      let applicationName = '';
      let environmentUuids: string[] = [];
      let environmentNames: string[] = [];
      
      console.log(`📋 Extracting metadata for item ${itemIndex}...`);

      // Get application info from metadata.application.uuids[0]
      if (item.metadata?.application?.uuids && Array.isArray(item.metadata.application.uuids)) {
        applicationUuid = item.metadata.application.uuids[0] || '';
        console.log(`  🆔 Application UUID: ${applicationUuid}`);
      } else {
        console.log(`  ❌ No application UUID found in metadata for item ${itemIndex}`);
        if (item.metadata) {
          console.log(`  🔍 Available metadata: ${JSON.stringify(item.metadata, null, 2)}`);
        } else {
          console.log(`  🔍 No metadata available`);
        }
      }

      // Get application name from metadata.application.names[0]
      if (item.metadata?.application?.names && Array.isArray(item.metadata.application.names)) {
        applicationName = item.metadata.application.names[0] || '';
        console.log(`  📝 Application name: ${applicationName}`);
      }
      
      // If no name found, generate one from UUID
      if (!applicationName && applicationUuid) {
        applicationName = `App ${applicationUuid.substring(0, 8)}`;
        console.log(`  📝 Generated application name: ${applicationName}`);
      }

      // Get environment info if available
      if (item.metadata?.environment) {
        if (item.metadata.environment.uuids && Array.isArray(item.metadata.environment.uuids)) {
          environmentUuids = item.metadata.environment.uuids;
          console.log(`  🌍 Environment UUIDs (${environmentUuids.length}): ${JSON.stringify(environmentUuids)}`);
        }

        if (item.metadata.environment.names && Array.isArray(item.metadata.environment.names)) {
          environmentNames = item.metadata.environment.names;
          console.log(`  🌍 Environment names (${environmentNames.length}): ${JSON.stringify(environmentNames)}`);
        }
      }

      // SECOND: Process ALL datapoints for this ONE application
      if (!item.datapoints || !Array.isArray(item.datapoints)) {
        console.log(`  ⚠️ No datapoints found for application ${applicationUuid} (item ${itemIndex})`);
        return; // Skip this item
      }

      console.log(`  📈 Processing ${item.datapoints.length} datapoints for application: ${applicationName} (${applicationUuid})`);

      item.datapoints.forEach((datapoint: any, dpIndex: number) => {
        console.log(`    📍 Datapoint ${dpIndex} for ${applicationName}: ${JSON.stringify(datapoint, null, 2)}`);
        let date = '';
        let value = 0;

        // Handle array format: ["2025-04-15T00:00:00+00:00", "1124"]
        if (Array.isArray(datapoint) && datapoint.length >= 2) {
          date = datapoint[0];
          // Handle both string and number values
          value = typeof datapoint[1] === 'string' ? parseInt(datapoint[1]) || 0 : datapoint[1] || 0;
          console.log(`      📅 Date: ${date}`);
          console.log(`      🔢 Value: ${value} ${dataType}`);
        }
        // Handle object format (fallback)
        else if (typeof datapoint === 'object') {
          date = datapoint.datetime || datapoint.date || datapoint.timestamp || '';
          value = parseInt(datapoint.value) || parseInt(datapoint[dataType]) || 0;
          console.log(`      📅 Date (object): ${date}`);
          console.log(`      🔢 Value (object): ${value} ${dataType}`);
        } else {
          console.log(`      ⚠️ Unexpected datapoint format: ${typeof datapoint}, ${String(datapoint)}`);
          return; // Skip this datapoint
        }

        // Create record for this datapoint - ALL belong to the SAME application
        if (applicationUuid && date) {
          // Use the first environment or create a general record
          const environmentUuid = environmentUuids[0] || '';
          const environmentName = environmentNames[0] || (environmentUuid ? `Env ${environmentUuid.substring(0, 8)}` : 'All Environments');
          const baseData = {
            applicationUuid,
            applicationName,
            environmentUuid,
            environmentName,
            date
          };

          if (dataType === 'visits') {
            const visitData: VisitsData = {
              ...baseData,
              visits: value
            };
            parsedVisitsData.push(visitData);
            console.log(`      ✅ Created visits record: ${value} visits for ${applicationName} on ${date}`);
      } else {
            const viewData: ViewsData = {
              ...baseData,
              views: value
            };
            parsedViewsData.push(viewData);
            console.log(`      ✅ Created views record: ${value} views for ${applicationName} on ${date}`);
      }
        } else {
          console.log(`      ⚠️ Skipping datapoint - missing required data:`);
          console.log(`        - applicationUuid: ${applicationUuid || 'MISSING'}`);
          console.log(`        - date: ${date || 'MISSING'}`);
        }
      });

      console.log(`  📊 Completed processing ${item.datapoints.length} datapoints for ${applicationName}`);
    });

    // Return the correct array based on dataType
    const parsedData = dataType === 'visits' ? parsedVisitsData : parsedViewsData;

    console.log(`\n✅ PARSING COMPLETE`);
    console.log(`📊 Total ${dataType} records created: ${parsedData.length}`);

    // Enhanced summary statistics
    const totalValue = parsedData.reduce((sum, item) => {
      return sum + (dataType === 'visits' ? (item as VisitsData).visits : (item as ViewsData).views);
    }, 0);
    
    const applicationSummary = parsedData.reduce((acc, item) => {
      const appKey = item.applicationUuid;
      if (!acc[appKey]) {
        acc[appKey] = {
          name: item.applicationName,
          uuid: item.applicationUuid,
          environments: new Set(),
          totalValue: 0,
          datapoints: 0,
          dateRange: { min: item.date, max: item.date }
        };
      }
      acc[appKey].environments.add(item.environmentName || 'Unknown');
      acc[appKey].totalValue += (dataType === 'visits' ? (item as VisitsData).visits : (item as ViewsData).views);
      acc[appKey].datapoints += 1;

      // Track date range
      if (item.date < acc[appKey].dateRange.min) acc[appKey].dateRange.min = item.date;
      if (item.date > acc[appKey].dateRange.max) acc[appKey].dateRange.max = item.date;

      return acc;
    }, {} as Record<string, any>);

    console.log(`📊 SUMMARY:`);
    console.log(`   Total ${dataType}: ${totalValue.toLocaleString()}`);
    console.log(`   Unique applications: ${Object.keys(applicationSummary).length}`);
    console.log(`   Total datapoints: ${parsedData.length}`);

    console.log(`📊 PER-APPLICATION BREAKDOWN:`);
    Object.entries(applicationSummary).forEach(([uuid, summary]: [string, any]) => {
      console.log(`   • ${summary.name}`);
      console.log(`     UUID: ${uuid}`);
      console.log(`     ${dataType}: ${summary.totalValue.toLocaleString()}`);
      console.log(`     Datapoints: ${summary.datapoints}`);
      console.log(`     Date range: ${summary.dateRange.min} to ${summary.dateRange.max}`);
      console.log(`     Environments: ${summary.environments.size}`);
    });
    
    return parsedData;
  }

  private async fetchAllPages<T extends VisitsData | ViewsData>(
    baseEndpoint: string,
    dataType: 'visits' | 'views',
    subscriptionUuid: string,
    from?: string,
    to?: string
  ): Promise<T[]> {
    let allData: T[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let hasMorePages = true;

    // Build the filter parameter with corrected date formatting
    const filterParam = this.buildFilterParam(from, to);
    console.log(`🔍 Date range requested: ${from} to ${to}`);
    console.log(`🔍 Filter parameter: ${filterParam}`);

    while (hasMorePages) {
      try {
        const params = new URLSearchParams();

        // Add filter parameter if we have date range
        if (filterParam) {
          params.append('filter', filterParam);
          console.log(`📅 Added filter parameter to request`);
        } else {
          console.log(`⚠️ No filter parameter - API will return default date range`);
        }

        // Add resolution parameter (day for visits, month for views as per your examples)
        // const resolution = dataType === 'visits' ? 'day' : 'month';
        const resolution = 'day';
        params.append('resolution', resolution);
        console.log(`📊 Using resolution: ${resolution}`);

        // Add pagination if needed
        if (currentPage > 1) {
          params.append('page', currentPage.toString());
        }

        const fullEndpoint = `${baseEndpoint}?${params.toString()}`;
    this.reportProgress({ 
          step: `Fetching ${dataType} data (page ${currentPage})...`,
          currentPage,
          totalPages: totalPages > 1 ? totalPages : undefined,
      itemsCollected: allData.length
    });

        console.log(`📡 Making request to: ${fullEndpoint}`);
        console.log(`📡 Full URL parameters:`, params.toString());

        const startTime = Date.now();
        const response = await this.makeAuthenticatedRequest(fullEndpoint);
        const endTime = Date.now();

        console.log(`✅ Request completed in ${endTime - startTime}ms`);
        console.log(`📊 Response status: ${response.status}`);

        // Log some response details to debug date issues
        if (response.data._embedded?.items?.length > 0) {
          const firstItem = response.data._embedded.items[0];
          if (firstItem.datapoints?.length > 0) {
            const firstDatapoint = firstItem.datapoints[0];
            const lastDatapoint = firstItem.datapoints[firstItem.datapoints.length - 1];
            console.log(`📅 API returned data from ${firstDatapoint[0]} to ${lastDatapoint[0]}`);
            console.log(`📊 Total datapoints in first item: ${firstItem.datapoints.length}`);
  }
        }

        const pageData = this.parseApplicationData(response.data, dataType) as T[];

        // Log date range of parsed data
        if (pageData.length > 0) {
          const dates = pageData.map(item => item.date).filter(Boolean).sort();
          if (dates.length > 0) {
            console.log(`📅 Parsed data date range: ${dates[0]} to ${dates[dates.length - 1]}`);
}
    }

        allData = allData.concat(pageData);

        // Check pagination
        const pageInfo = response.data.page;
        if (pageInfo) {
          totalPages = pageInfo.totalPages || pageInfo.total_pages || 1;
          hasMorePages = currentPage < totalPages;
          console.log(`📄 Pagination: page ${currentPage} of ${totalPages}`);
        } else {
          const links = response.data._links;
          hasMorePages = !!(links && links.next);
          if (links?.next) {
            console.log(`📄 Found next link: ${links.next.href}`);
          } else {
            console.log(`📄 No more pages found`);
          }
        }

        currentPage++;
        if (currentPage > 100) {
          console.warn('⚠️ Stopping after 100 pages to prevent infinite loop');
          break;
        }

        if (hasMorePages) {
          console.log('⏱️ Waiting 500ms before next request...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`❌ Error fetching page ${currentPage}:`, error);

        if (error instanceof Error && error.message.includes('timeout')) {
          throw new Error(`Request timed out after ${this.API_TIMEOUT / 1000} seconds. Try a smaller date range or check your network connection.`);
        }

        throw error;
      }
    }

    this.reportProgress({
      step: `Completed! Collected ${allData.length} ${dataType} records.`,
      currentPage: currentPage - 1,
      totalPages,
      itemsCollected: allData.length
    });

    console.log(`🎉 Successfully fetched ${allData.length} ${dataType} records from ${currentPage - 1} pages`);

    // Final summary of date range
    if (allData.length > 0) {
      const dates = allData.map(item => item.date).filter(Boolean).sort();
      if (dates.length > 0) {
        console.log(`📅 Final data covers: ${dates[0]} to ${dates[dates.length - 1]}`);
      }
    }

    return allData;
  }

  async getVisitsDataByApplication(subscriptionUuid: string, from?: string, to?: string): Promise<VisitsData[]> {
    const baseEndpoint = `/subscriptions/${subscriptionUuid}/metrics/usage/visits-by-application`;
    console.log(`🚶 Fetching visits data with resolution=day for date range: ${from || 'no start'} to ${to || 'no end'}`);
    return this.fetchAllPages<VisitsData>(baseEndpoint, 'visits', subscriptionUuid, from, to);
  }

  async getViewsDataByApplication(subscriptionUuid: string, from?: string, to?: string): Promise<ViewsData[]> {
    const baseEndpoint = `/subscriptions/${subscriptionUuid}/metrics/usage/views-by-application`;
    console.log(`👁️ Fetching views data with resolution=month for date range: ${from || 'no start'} to ${to || 'no end'}`);
    return this.fetchAllPages<ViewsData>(baseEndpoint, 'views', subscriptionUuid, from, to);
  }
}

export default AcquiaApiServiceFixed;