import APIService from '../base/api';
import type DomainEntity from './domain.interface';

export default class DomainAPIService extends APIService {
  constructor(service_id: string, token: string) {
    super(service_id, token);
  }

  async getDomains(version_id: number): Promise<DomainEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/version/${version_id}/domain`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
