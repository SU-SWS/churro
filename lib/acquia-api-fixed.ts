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
    console.log('\n🔍 PARSING APPLICATION/ENVIRONMENT DATA');
    console.log('📊 Response structure:', Object.keys(responseData));
    
    let extractedData: any[] = [];
    
    // Extract the array from the response
    if (responseData._embedded) {
      const embeddedKeys = Object.keys(responseData._embedded);
      console.log('🔍 _embedded keys:', embeddedKeys);
      
      for (const key of embeddedKeys) {
        if (Array.isArray(responseData._embedded[key])) {
          extractedData = responseData._embedded[key];
          console.log(`✅ Using _embedded.${key} with ${extractedData.length} items`);
          break;
        }
      }
    } else if (Array.isArray(responseData)) {
      extractedData = responseData;
      console.log(`✅ Using direct array with ${extractedData.length} items`);
    }

    if (extractedData.length === 0) {
      console.warn('⚠️ No data found in response');
      return [];
    }

    // Show structure of a few items to understand the format
    console.log('\n🔍 ANALYZING ITEM STRUCTURES:');
    extractedData.slice(0, 3).forEach((item, index) => {
      console.log(`\n📋 Item ${index} complete structure:`);
      console.log(JSON.stringify(item, null, 2));
      console.log(`📋 Item ${index} keys:`, Object.keys(item));
      console.log(`📋 Item ${index} key types:`, Object.keys(item).map(key => `${key}: ${typeof item[key]} ${Array.isArray(item[key]) ? `(array[${item[key].length}])` : ''}`));
    });

    const parsedData: (VisitsData | ViewsData)[] = [];
    extractedData.forEach((item: any, index: number) => {
      console.log(`\n🏢 === PROCESSING APPLICATION ${index} ===`);
      console.log(`📋 All available keys in item ${index}:`, Object.keys(item));
      
      // Extract application info with exhaustive field checking
      let applicationUuid = '';
      let applicationName = '';
      
      // Check every possible field name for UUID
      const possibleUuidFields = [
        'applicationUuid', 'application_uuid', 'appUuid', 'app_uuid',
        'uuid', 'id', 'identifier', 'key', 'reference', 'ref',
        'application', 'app'
      ];
      
      console.log(`🔍 Searching for UUID in these fields:`, possibleUuidFields);
      for (const field of possibleUuidFields) {
        if (item.hasOwnProperty(field) && item[field]) {
          console.log(`  🔍 Checking field '${field}': ${JSON.stringify(item[field])}`);
          if (typeof item[field] === 'string') {
            applicationUuid = item[field];
            console.log(`  ✅ Found UUID in '${field}': ${applicationUuid}`);
            break;
          } else if (typeof item[field] === 'object' && item[field].uuid) {
            applicationUuid = item[field].uuid;
            console.log(`  ✅ Found nested UUID in '${field}.uuid': ${applicationUuid}`);
            break;
          }
        }
      }
      
      // Check every possible field name for application name
      const possibleNameFields = [
        'applicationName', 'application_name', 'appName', 'app_name',
        'name', 'title', 'label', 'displayName', 'display_name'
      ];
      
      console.log(`🔍 Searching for name in these fields:`, possibleNameFields);
      for (const field of possibleNameFields) {
        if (item.hasOwnProperty(field) && item[field]) {
          console.log(`  🔍 Checking field '${field}': ${JSON.stringify(item[field])}`);
          if (typeof item[field] === 'string') {
            applicationName = item[field];
            console.log(`  ✅ Found name in '${field}': ${applicationName}`);
            break;
          }
        }
      }
      
      // If we still don't have UUID, check if any field contains a UUID-like string
      if (!applicationUuid) {
        console.log(`⚠️ No UUID found in standard fields, checking all string fields for UUID pattern...`);
        Object.keys(item).forEach(key => {
          const value = item[key];
          if (typeof value === 'string' && value.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
            console.log(`  🔍 Found UUID pattern in '${key}': ${value}`);
            if (!applicationUuid) {
              applicationUuid = value;
              console.log(`  ✅ Using '${key}' as applicationUuid: ${applicationUuid}`);
            }
          }
        });
      }
      
      // If we still don't have a name, generate one
      if (!applicationName) {
        if (applicationUuid) {
          applicationName = `App ${applicationUuid.substring(0, 8)}`;
        } else {
          applicationName = `Unknown App ${index}`;
        }
      }
      
      console.log(`🆔 Final Application UUID: ${applicationUuid || 'NOT FOUND'}`);
      console.log(`📝 Final Application name: ${applicationName}`);
      
      // Check if this item has environments
      let environments: any[] = [];
      const possibleEnvFields = ['environments', 'environment', 'envs', 'env'];
      
      for (const field of possibleEnvFields) {
        if (item[field] && Array.isArray(item[field])) {
          environments = item[field];
          console.log(`🌍 Found ${environments.length} environments in field '${field}'`);
          break;
        }
      }
      
      if (environments.length > 0) {
        // Process each environment
        environments.forEach((env: any, envIndex: number) => {
          console.log(`\n  🌍 Environment ${envIndex}:`);
          console.log(`      Keys:`, Object.keys(env));
          
          let environmentUuid = '';
          let environmentName = '';
          
          // Extract environment info
          for (const field of ['uuid', 'environmentUuid', 'environment_uuid', 'id']) {
            if (env[field] && typeof env[field] === 'string') {
              environmentUuid = env[field];
              console.log(`      🆔 Environment UUID from '${field}': ${environmentUuid}`);
              break;
            }
          }
          
          for (const field of ['name', 'environmentName', 'environment_name']) {
            if (env[field] && typeof env[field] === 'string') {
              environmentName = env[field];
              console.log(`      📝 Environment name from '${field}': ${environmentName}`);
              break;
            }
          }
          
          if (!environmentName && environmentUuid) {
            environmentName = `Env ${environmentUuid.substring(0, 8)}`;
          }
          
          // Process environment datapoints
          this.processDatapoints(env, applicationUuid, applicationName, environmentUuid, environmentName, dataType, parsedData, `env-${envIndex}`);
        });
      } else {
        // No environments - process application-level datapoints
        console.log(`📊 No environments found, checking for application-level data`);
        this.processDatapoints(item, applicationUuid, applicationName, '', 'Application Total', dataType, parsedData, 'app-level');
      }
    });

    console.log(`\n✅ PARSING COMPLETE`);
    console.log(`📊 Total records created: ${parsedData.length}`);
    
    // Summary statistics
    const totalValue = parsedData.reduce((sum, item) => {
      return sum + (dataType === 'visits' ? (item as VisitsData).visits : (item as ViewsData).views);
    }, 0);
    
    const applicationSummary = parsedData.reduce((acc, item) => {
      const appKey = item.applicationUuid || 'unknown';
      if (!acc[appKey]) {
        acc[appKey] = {
          name: item.applicationName,
          uuid: item.applicationUuid,
          environments: new Set(),
          totalValue: 0,
          datapoints: 0
        };
      }
      acc[appKey].environments.add(item.environmentName || 'Unknown');
      acc[appKey].totalValue += (dataType === 'visits' ? (item as VisitsData).visits : (item as ViewsData).views);
      acc[appKey].datapoints += 1;
      return acc;
    }, {} as Record<string, any>);
    
    console.log(`📊 Total ${dataType}: ${totalValue.toLocaleString()}`);
    console.log(`📊 Applications summary:`);
    Object.entries(applicationSummary).forEach(([key, summary]: [string, any]) => {
      console.log(`  • ${summary.name} (${summary.uuid?.substring(0, 8) || 'no-uuid'}...): ${summary.totalValue} ${dataType}, ${summary.environments.size} environments, ${summary.datapoints} datapoints`);
    });
    
    return parsedData;
  }

  private processDatapoints(
    source: any,
    applicationUuid: string,
    applicationName: string,
    environmentUuid: string,
    environmentName: string,
    dataType: 'visits' | 'views',
    parsedData: (VisitsData | ViewsData)[],
    context: string
  ) {
    let datapoints: any[] = [];
    
    // Look for datapoints in various possible fields
    const possibleDataFields = ['datapoints', 'data', 'metrics', 'values', 'points'];
    
    for (const field of possibleDataFields) {
      if (source[field] && Array.isArray(source[field])) {
        datapoints = source[field];
        console.log(`    📈 Found ${datapoints.length} datapoints in field '${field}' (${context})`);
        break;
      }
    }
    
    if (datapoints.length === 0) {
      console.log(`    ⚠️ No datapoints found in ${context}`);
      return;
    }
    
    datapoints.forEach((datapoint: any, dpIndex: number) => {
      console.log(`      📍 Datapoint ${dpIndex} (${context}):`, JSON.stringify(datapoint, null, 2));
      
      let date = '';
      let value = 0;
      
      // Handle array format: ["2025-06-23T00:00:00+00:00", "0"]
      if (Array.isArray(datapoint) && datapoint.length >= 2) {
        date = datapoint[0];
        value = parseInt(datapoint[1]) || 0;
        console.log(`        📅 Date (from array): ${date}`);
        console.log(`        🔢 Value (from array): ${value}`);
      }
      // Handle object format (fallback)
      else if (typeof datapoint === 'object') {
        if (datapoint.datetime || datapoint.date || datapoint.timestamp) {
          date = datapoint.datetime || datapoint.date || datapoint.timestamp;
        }
        if (typeof datapoint.value === 'number') {
          value = datapoint.value;
        } else if (typeof datapoint.value === 'string') {
          value = parseInt(datapoint.value) || 0;
        }
        console.log(`        📅 Date (from object): ${date}`);
        console.log(`        🔢 Value (from object): ${value}`);
      }
      
      // Create record for this datapoint
      if (date && (applicationUuid || environmentUuid)) {
        const baseData = {
          applicationUuid: applicationUuid || 'unknown',
          applicationName: applicationName || 'Unknown App',
          environmentUuid,
          environmentName,
          date
        };
        
        if (dataType === 'visits') {
          const visitData: VisitsData = {
            ...baseData,
            visits: value
          };
          parsedData.push(visitData);
          console.log(`        ✅ Created visits record: ${value} visits for ${applicationName || 'Unknown'}`);
        } else {
          const viewData: ViewsData = {
            ...baseData,
            views: value
          };
          parsedData.push(viewData);
          console.log(`        ✅ Created views record: ${value} views for ${applicationName || 'Unknown'}`);
        }
      } else {
        console.log(`        ⚠️ Skipping datapoint - missing data (date: ${!!date}, uuid: ${!!(applicationUuid || environmentUuid)})`);
      }
    });
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
        const resolution = dataType === 'visits' ? 'day' : 'month';
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