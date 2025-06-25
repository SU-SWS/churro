import axios from 'axios';

export interface VisitsData {
  date: string;
  visits: number;
  applicationUuid: string;
}

export interface ViewsData {
  date: string;
  views: number;
  applicationUuid: string;
}

export interface AcquiaApiConfig {
  baseUrl: string;
  authUrl: string;
  apiKey: string;
  apiSecret: string;
}

class AcquiaApiService {
  private config: AcquiaApiConfig;
  private accessToken: string | null = null;

  constructor(config: AcquiaApiConfig) {
    this.config = config;
    console.log('🔧 Initializing Acquia API Service...');
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const cleanApiKey = this.config.apiKey.trim();
    const cleanApiSecret = this.config.apiSecret.trim();
    
    console.log('🔐 Attempting authentication with corrected headers...');
    const authUrl = `${this.config.authUrl}/auth/oauth/token`;

    // Try the methods most likely to work based on the header error
    const authMethods = [
      {
        name: 'Form parameters, no Accept header',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': cleanApiKey,
          'client_secret': cleanApiSecret
        }).toString()
      },
      {
        name: 'Form parameters, Accept */*',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
        },
        data: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': cleanApiKey,
          'client_secret': cleanApiSecret
        }).toString()
      },
      {
        name: 'Basic Auth, no Accept header',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${cleanApiKey}:${cleanApiSecret}`).toString('base64')}`
        },
        data: 'grant_type=client_credentials'
      }
    ];

    for (const method of authMethods) {
      try {
        console.log(`🔍 Trying: ${method.name}`);

        const response = await axios({
          method: 'POST',
          url: authUrl,
          headers: method.headers,
          data: method.data,
          timeout: 30000,
          validateStatus: () => true,
        });

        console.log(`📥 ${method.name} response:`, response.status, response.data);

        if (response.status === 200 && response.data?.access_token) {
          this.accessToken = response.data.access_token;
          console.log(`✅ Successfully authenticated using: ${method.name}`);
          return this.accessToken;
        }
    } catch (error) {
        console.log(`❌ ${method.name} failed:`, error instanceof Error ? error.message : String(error));
    }
  }

    throw new Error('Failed to authenticate with any method');
  }

  private async makeAuthenticatedRequest(endpoint: string) {
    const token = await this.getAccessToken();
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    
    console.log(`🔗 Making authenticated request to: ${fullUrl}`);
    try {
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*', // Use the working Accept header
        },
        timeout: 30000,
      });
      
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('🔄 Token expired, clearing and retrying...');
        this.accessToken = null;

        const newToken = await this.getAccessToken();
        return axios.get(fullUrl, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Accept': '*/*',
          },
          timeout: 30000,
        });
    }

      throw error;
  }
}

  async getVisitsData(subscriptionUuid: string, applicationUuid: string, from?: string, to?: string): Promise<VisitsData[]> {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      const endpoint = `/subscriptions/${subscriptionUuid}/usage/visits-by-application/${applicationUuid}${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log(`📊 Fetching visits data with endpoint: ${endpoint}`);
      
      const response = await this.makeAuthenticatedRequest(endpoint);
      
      console.log('✅ Visits API Response Status:', response.status);
      console.log('✅ Visits API Response Data:', JSON.stringify(response.data, null, 2));
      
      return response.data._embedded?.visits || response.data.visits || [];
    } catch (error) {
      console.error('❌ Error fetching visits data:', error);
      throw error;
    }
  }

  async getViewsData(subscriptionUuid: string, applicationUuid: string, from?: string, to?: string): Promise<ViewsData[]> {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      const endpoint = `/subscriptions/${subscriptionUuid}/usage/views-by-application/${applicationUuid}${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log(`📈 Fetching views data with endpoint: ${endpoint}`);
      
      const response = await this.makeAuthenticatedRequest(endpoint);
      
      console.log('✅ Views API Response Status:', response.status);
      console.log('✅ Views API Response Data:', JSON.stringify(response.data, null, 2));
      
      return response.data._embedded?.views || response.data.views || [];
    } catch (error) {
      console.error('❌ Error fetching views data:', error);
      throw error;
    }
  }
}

export default AcquiaApiService;