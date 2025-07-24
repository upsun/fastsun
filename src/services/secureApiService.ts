import { useCredentialsStore } from '@/stores/credentialsStore';

class SecureApiService {
  private getCredentials() {
    const credentialsStore = useCredentialsStore();
    return {
      serviceId: credentialsStore.getServiceId(),
      serviceToken: credentialsStore.getServiceToken(),
    };
  }

  private getHeaders(): Record<string, string> {
    const { serviceToken } = this.getCredentials();
    return {
      'Fastly-Token': serviceToken,
      'Content-Type': 'application/json',
    };
  }

  private getBaseUrl(): string {
    const { serviceId } = this.getCredentials();
    return `https://api.fastly.com/service/${serviceId}`;
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const { serviceId, serviceToken } = this.getCredentials();

    if (!serviceId || !serviceToken) {
      throw new Error('Service credentials not available');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.getBaseUrl()}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Specific API methods
  async getProject() {
    return this.makeRequest('');
  }

  async getVersions() {
    return this.makeRequest('/version');
  }

  async getVersion(versionNumber: number) {
    return this.makeRequest(`/version/${versionNumber}`);
  }

  async getDomains(versionNumber: number) {
    return this.makeRequest(`/version/${versionNumber}/domain`);
  }

  async getAcls(versionNumber: number) {
    return this.makeRequest(`/version/${versionNumber}/acl`);
  }

  async getAclEntries(versionNumber: number, aclId: string) {
    return this.makeRequest(`/version/${versionNumber}/acl/${aclId}/entries`);
  }

  async getVcl(versionNumber: number) {
    return this.makeRequest(`/version/${versionNumber}/vcl`);
  }

  async getStats(field: string = '', from?: string, to?: string, by?: string) {
    const { serviceId } = this.getCredentials();
    let url = `https://api.fastly.com/stats/service/${serviceId}`;

    if (field) url += `/${field}`;

    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (by) params.append('by', by);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.makeRequest(url);
  }

  async purgeAll() {
    return this.makeRequest('/purge_all', { method: 'POST' });
  }

  async purgeByKey(key: string) {
    const { serviceId } = this.getCredentials();
    return this.makeRequest(`https://api.fastly.com/service/${serviceId}/purge/${key}`, {
      method: 'POST',
    });
  }
}

// Singleton instance
export const apiService = new SecureApiService();
export default SecureApiService;
