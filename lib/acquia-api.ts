import axios from 'axios';

/**
 * Generates a unique string key for caching based on the request parameters.
 */
const generateCacheKey = (parts: (string | undefined | null)[]): string => {
  return parts.filter(Boolean).map(part => encodeURIComponent(part as string)).join(':');
};

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

export interface Application {
  uuid: string;
  name: string;
  subscription?: {
    uuid: string;
    name: string;
  };
  environments?: {
    uuid: string;
    name: string;
  }[];
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
    this.config = config;

    // console.log('🔧 Initializing Acquia API Service...');
  }
  setProgressCallback(callback: (progress: FetchProgress) => void) {
    this.progressCallback = callback;
  }

  private reportProgress(progress: FetchProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    // console.log('📊 Progress:', progress);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    // Debug credentials
    /* console.log('🔐 Debug API Key:', {
      value: this.config.apiKey ? `${this.config.apiKey.substring(0, 8)}...` : 'missing',
      length: this.config.apiKey?.length || 0,
      hasQuotes: this.config.apiKey?.startsWith('"') && this.config.apiKey?.endsWith('"')
    });

    console.log('🔐 Debug API Secret:', {
      preview: this.config.apiSecret ? `${this.config.apiSecret.substring(0, 8)}...` : 'missing',
      length: this.config.apiSecret?.length || 0,
      hasQuotes: this.config.apiSecret?.startsWith('"') && this.config.apiSecret?.endsWith('"')
    });*/

    // Clean the credentials - remove any quotes that might be present
    let cleanApiKey = this.config.apiKey.replace(/^"|"$/g, '').trim();
    const cleanApiSecret = this.config.apiSecret.replace(/^"|"$/g, '').trim();

    // Check if API key appears to be base64 encoded (common issue in some environments)
    // If it starts with base64-like characters and doesn't look like a UUID, try decoding
    if (cleanApiKey && !cleanApiKey.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) &&
        cleanApiKey.match(/^[A-Za-z0-9+/]+=*$/)) {
      try {
        const decodedKey = Buffer.from(cleanApiKey, 'base64').toString('utf-8');
        // Check if decoded value looks like a UUID
        if (decodedKey.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // console.log('🔧 Detected base64-encoded API key, using decoded value');
          cleanApiKey = decodedKey;
        }
      } catch (error) {
        // If decoding fails, use original value
        // console.log('⚠️ Failed to decode suspected base64 API key, using original value');
      }
    }
    /**
    console.log('🔐 Using cleaned credentials:', {
      keyLength: cleanApiKey.length,
      secretLength: cleanApiSecret.length
    });
    */

    const authUrl = `${this.config.authUrl}/auth/oauth/token`;

    // Try different authentication methods
    const authMethods = [
      // Method 1: Basic Auth
      async () => {
        console.log('🔐 Trying Basic Auth method...');
        const credentials = Buffer.from(`${cleanApiKey}:${cleanApiSecret}`).toString('base64');
      const response = await axios({
        method: 'POST',
        url: authUrl,
        headers: {
            'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
        },
          data: 'grant_type=client_credentials',
        timeout: this.AUTH_TIMEOUT,
        validateStatus: () => true,
      });

        // console.log('📥 Basic Auth response status:', response.status);
      if (response.status === 200 && response.data?.access_token) {
          return response.data.access_token;
        }
        throw new Error(`Basic Auth failed: ${response.status} - ${JSON.stringify(response.data)}`);
        },

      // Method 2: Form parameters
      async () => {
        console.log('🔐 Trying Form Parameters method...');
        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', cleanApiKey);
        formData.append('client_secret', cleanApiSecret);

        const response = await axios({
          method: 'POST',
          url: authUrl,
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': '*/*',
            },
          data: formData.toString(),
          timeout: this.AUTH_TIMEOUT,
          validateStatus: () => true,
          });

        // console.log('📥 Form Parameters response status:', response.status);
        if (response.status === 200 && response.data?.access_token) {
          return response.data.access_token;
        }
        throw new Error(`Form Parameters failed: ${response.status} - ${JSON.stringify(response.data)}`);
      },

      // Method 3: Use correct client ID format (if UUID is in different format)
      async () => {
        console.log('🔐 Trying with alternate client ID format...');

        // Try with a UUID format if the key is not already in UUID format
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanApiKey);
        const clientId = isUuid
          ? cleanApiKey
          : 'deed5eaf-98ba-4924-8747-1fb1fbd00bd3'; // fallback to known working UUID

        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', clientId);
        formData.append('client_secret', cleanApiSecret);

        const response = await axios({
          method: 'POST',
          url: authUrl,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': '*/*',
          },
          data: formData.toString(),
          timeout: this.AUTH_TIMEOUT,
          validateStatus: () => true,
        });

        // console.log('📥 Alternate client ID response status:', response.status);
        if (response.status === 200 && response.data?.access_token) {
          return response.data.access_token;
    }
        throw new Error(`Alternate client ID failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
    ];

    // Try each authentication method
    let lastError: Error | null = null;
    for (const method of authMethods) {
    try {
        const token = await method();
        this.accessToken = token;
        console.log('✅ Successfully authenticated!');
        return token;
    } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn('⚠️ Auth method failed:', lastError.message);
        // Continue to next method
    }
  }

    // If we get here, all methods failed
    console.error('❌ All authentication methods failed');
    throw lastError || new Error('Failed to authenticate with Acquia API');
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
          // console.log('🔄 Token expired, retrying...');
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

  async getApplications(): Promise<Application[]> {
    // Temporarily disable caching to debug
    try {
      console.log(`🔍 Fetching all applications from API`);
      const response = await this.makeAuthenticatedRequest('/applications');
      console.log('✅ Applications API Response Status:', response.status);

      let applications: Application[] = [];

      if (response.data._embedded?.items) {
        applications = response.data._embedded.items.map((item: any) => ({
          uuid: item.uuid,
          name: item.name || `App ${item.uuid.substring(0, 8)}`,
          subscription: item.subscription ? {
            uuid: item.subscription.uuid,
            name: item.subscription.name
          } : undefined,
          environments: item._embedded?.environments?.map((env: any) => ({
            uuid: env.uuid,
            name: env.name
          }))
        }));

        console.log(`✅ Extracted ${applications.length} applications`);
      } else {
        console.warn('⚠️ No applications found in response');
      }

      return applications;
    } catch (error) {
      console.error('❌ Error fetching applications:', error);
      throw error;
    }
  }

  private buildFilterParam(from?: string, to?: string): string {
    if (!from && !to) {
      // console.log('📅 No date range specified, API will return default data');
      return '';
    }

    // console.log(`📅 Building filter for date range: ${from} to ${to}`);

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

      // console.log(`📅 Formatted ${dateStr} (end=${isEndDate}) -> ${isoDate}`);
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
    // console.log(`📅 Final filter parameter: ${filterString}`);
    return filterString;
  }

  private parseApplicationData(responseData: any, dataType: 'visits' | 'views'): VisitsData[] | ViewsData[] {
    // console.log('\n🔍 PARSING ACQUIA API RESPONSE - CORRECT ASSOCIATION');
    // console.log('📊 Response top-level keys:', Object.keys(responseData));

    if (!responseData._embedded) {
      console.warn('⚠️ No _embedded found in response');
      return [];
    }

    // console.log('📊 _embedded keys:', Object.keys(responseData._embedded));

    if (!responseData._embedded.items || !Array.isArray(responseData._embedded.items)) {
      console.warn('⚠️ No _embedded.items array found in response');
      return [];
    }

    const items = responseData._embedded.items;
    // console.log(`📋 Found ${items.length} items in _embedded.items`);

    const parsedVisitsData: VisitsData[] = [];
    const parsedViewsData: ViewsData[] = [];

    items.forEach((item: any, itemIndex: number) => {
      // console.log(`\n🏢 === PROCESSING ITEM ${itemIndex} (One Application) ===`);
      // console.log(`📋 Item structure: hasDatapoints=${!!item.datapoints}, datapointsCount=${item.datapoints?.length || 0}, hasMetadata=${!!item.metadata}, metadataKeys=${item.metadata ? JSON.stringify(Object.keys(item.metadata)) : '[]'}`);
      // FIRST: Extract the application metadata for this entire item
      let applicationUuid = '';
      let applicationName = '';
      let environmentUuids: string[] = [];
      let environmentNames: string[] = [];

      // console.log(`📋 Extracting metadata for item ${itemIndex}...`);

      // Get application info from metadata.application.uuids[0]
      if (item.metadata?.application?.uuids && Array.isArray(item.metadata.application.uuids)) {
        applicationUuid = item.metadata.application.uuids[0] || '';
        // console.log(`  🆔 Application UUID: ${applicationUuid}`);
      } else {
        // console.log(`  ❌ No application UUID found in metadata for item ${itemIndex}`);
        if (item.metadata) {
          // console.log(`  🔍 Available metadata: ${JSON.stringify(item.metadata, null, 2)}`);
        } else {
          // console.log(`  🔍 No metadata available`);
        }
      }

      // Get application name from metadata.application.names[0]
      if (item.metadata?.application?.names && Array.isArray(item.metadata.application.names)) {
        applicationName = item.metadata.application.names[0] || '';
        // console.log(`  📝 Application name: ${applicationName}`);
      }

      // If no name found, generate one from UUID
      if (!applicationName && applicationUuid) {
        applicationName = `App ${applicationUuid.substring(0, 8)}`;
        // console.log(`  📝 Generated application name: ${applicationName}`);
      }

      // Get environment info if available
      if (item.metadata?.environment) {
        if (item.metadata.environment.uuids && Array.isArray(item.metadata.environment.uuids)) {
          environmentUuids = item.metadata.environment.uuids;
          // console.log(`  🌍 Environment UUIDs (${environmentUuids.length}): ${JSON.stringify(environmentUuids)}`);
        }

        if (item.metadata.environment.names && Array.isArray(item.metadata.environment.names)) {
          environmentNames = item.metadata.environment.names;
          // console.log(`  🌍 Environment names (${environmentNames.length}): ${JSON.stringify(environmentNames)}`);
        }
      }

      // SECOND: Process ALL datapoints for this ONE application
      if (!item.datapoints || !Array.isArray(item.datapoints)) {
        // console.log(`  ⚠️ No datapoints found for application ${applicationUuid} (item ${itemIndex})`);
        return; // Skip this item
      }

      // console.log(`  📈 Processing ${item.datapoints.length} datapoints for application: ${applicationName} (${applicationUuid})`);

      item.datapoints.forEach((datapoint: any, dpIndex: number) => {
        // console.log(`    📍 Datapoint ${dpIndex} for ${applicationName}: ${JSON.stringify(datapoint, null, 2)}`);
        let date = '';
        let value = 0;

        // Handle array format: ["2025-04-15T00:00:00+00:00", "1124"]
        if (Array.isArray(datapoint) && datapoint.length >= 2) {
          date = datapoint[0];
          // Handle both string and number values
          value = typeof datapoint[1] === 'string' ? parseInt(datapoint[1]) || 0 : datapoint[1] || 0;
          // console.log(`      📅 Date: ${date}`);
          // console.log(`      🔢 Value: ${value} ${dataType}`);
        }
        // Handle object format (fallback)
        else if (typeof datapoint === 'object') {
          date = datapoint.datetime || datapoint.date || datapoint.timestamp || '';
          value = parseInt(datapoint.value) || parseInt(datapoint[dataType]) || 0;
          // console.log(`      📅 Date (object): ${date}`);
          // console.log(`      🔢 Value (object): ${value} ${dataType}`);
        } else {
          // console.log(`      ⚠️ Unexpected datapoint format: ${typeof datapoint}, ${String(datapoint)}`);
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
            // console.log(`      ✅ Created visits record: ${value} visits for ${applicationName} on ${date}`);
      } else {
            const viewData: ViewsData = {
              ...baseData,
              views: value
            };
            parsedViewsData.push(viewData);
            // console.log(`      ✅ Created views record: ${value} views for ${applicationName} on ${date}`);
      }
        } else {
          // console.log(`      ⚠️ Skipping datapoint - missing required data:`);
          // console.log(`        - applicationUuid: ${applicationUuid || 'MISSING'}`);
          // console.log(`        - date: ${date || 'MISSING'}`);
        }
      });

      // console.log(`  📊 Completed processing ${item.datapoints.length} datapoints for ${applicationName}`);
    });

    // Return the correct array based on dataType
    const parsedData = dataType === 'visits' ? parsedVisitsData : parsedViewsData;

    // console.log(`\n✅ PARSING COMPLETE`);
    // console.log(`📊 Total ${dataType} records created: ${parsedData.length}`);

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

    // console.log(`📊 Total ${dataType}: ${totalValue.toLocaleString()}`);
    // console.log(`📊 Applications found: ${Object.keys(applicationSummary).length}`);
    Object.entries(applicationSummary).forEach(([uuid, summary]: [string, any]) => {
      // console.log(`  • ${summary.name} (${uuid.substring(0, 8)}...): ${summary.totalValue.toLocaleString()} ${dataType}, ${summary.datapoints} datapoints`);
    });
    return parsedData;
  }

  private async fetchAllPages<T extends VisitsData | ViewsData>(
    baseEndpoint: string,
    dataType: 'visits' | 'views',
    subscriptionUuid: string,
    from?: string,
    to?: string,
    resolution?: string
  ): Promise<T[]> {
    // Temporarily disable caching to debug
    let allData: T[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let hasMorePages = true;

    const filterParam = this.buildFilterParam(from, to);

    while (hasMorePages) {
      try {
        const params = new URLSearchParams();
        if (filterParam) {
          params.append('filter', filterParam);
        }
        if (resolution) {
          params.append('resolution', resolution);
        }
        if (currentPage > 1) {
          params.append('page', currentPage.toString());
        }

        const fullEndpoint = `${baseEndpoint}?${params.toString()}`;
        console.log(`🔍 Fetching ${dataType} page ${currentPage}:`, fullEndpoint);

        const startTime = Date.now();
        const response = await this.makeAuthenticatedRequest(fullEndpoint);
        const endTime = Date.now();

        console.log(`✅ Request completed in ${endTime - startTime}ms`);

        const pageData = this.parseApplicationData(response.data, dataType) as T[];
        allData = allData.concat(pageData);

        // Check pagination
        const pageInfo = response.data.page;
        if (pageInfo) {
          totalPages = pageInfo.totalPages || pageInfo.total_pages || 1;
          hasMorePages = currentPage < totalPages;
        } else {
          const links = response.data._links;
          hasMorePages = !!(links && links.next);
        }

        currentPage++;
        if (currentPage > 100) {
          console.warn('⚠️ Stopping after 100 pages to prevent infinite loop');
          break;
        }

        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`❌ Error fetching page ${currentPage}:`, error);
        throw error;
      }
    }

    console.log(`🎉 Successfully fetched ${allData.length} ${dataType} records from ${currentPage - 1} pages`);
    return allData;
  }

  async getVisitsDataByApplication(subscriptionUuid: string, from?: string, to?: string, resolution?: string): Promise<VisitsData[]> {
    const baseEndpoint = `/subscriptions/${subscriptionUuid}/metrics/usage/visits-by-application`;
    return this.fetchAllPages<VisitsData>(baseEndpoint, 'visits', subscriptionUuid, from, to, resolution);
  }

  async getViewsDataByApplication(subscriptionUuid: string, from?: string, to?: string, resolution?: string): Promise<ViewsData[]> {
    const baseEndpoint = `/subscriptions/${subscriptionUuid}/metrics/usage/views-by-application`;
    return this.fetchAllPages<ViewsData>(baseEndpoint, 'views', subscriptionUuid, from, to, resolution);
  }
}

export default AcquiaApiServiceFixed;