import { useCredentialsStore } from '@/stores/credentialsStore';
import { validateServiceId, validateToken, validateApiParam, createSecureSearchParams } from '@/utils/securityUtils';

class SecureApiService {
  private getCredentials() {
    const credentialsStore = useCredentialsStore();
    const serviceId = credentialsStore.getServiceId();
    const serviceToken = credentialsStore.getServiceToken();

    // Validate credentials before using them
    const validatedServiceId = validateServiceId(serviceId);
    const validatedServiceToken = validateToken(serviceToken);

    if (!validatedServiceId || !validatedServiceToken) {
      throw new Error('Invalid service credentials');
    }

    return {
      serviceId: validatedServiceId,
      serviceToken: validatedServiceToken,
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

    // Validate field parameter
    if (field) {
      const validatedField = validateApiParam(field);
      if (!validatedField) {
        throw new Error('Invalid field parameter');
      }
      url += `/${validatedField}`;
    }

    // Create secure search params
    const params: Record<string, unknown> = {};
    if (from) {
      const validatedFrom = validateApiParam(from);
      if (validatedFrom) params.from = validatedFrom;
    }
    if (to) {
      const validatedTo = validateApiParam(to);
      if (validatedTo) params.to = validatedTo;
    }
    if (by) {
      const validatedBy = validateApiParam(by);
      if (validatedBy) params.by = validatedBy;
    }

    const secureParams = createSecureSearchParams(params);
    if (secureParams.toString()) {
      url += `?${secureParams.toString()}`;
    }

    return this.makeRequest(url);
  }

  async purgeAll() {
    return this.makeRequest('/purge_all', { method: 'POST' });
  }

  async purgeByKey(key: string) {
    const { serviceId } = this.getCredentials();

    // Validate the purge key to prevent injection
    const validatedKey = validateApiParam(key);
    if (!validatedKey) {
      throw new Error('Invalid purge key');
    }

    return this.makeRequest(`https://api.fastly.com/service/${serviceId}/purge/${validatedKey}`, {
      method: 'POST',
    });
  }
}

// Singleton instance
export const apiService = new SecureApiService();
export default SecureApiService;
