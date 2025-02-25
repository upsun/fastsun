import APIService from '../base/api';
import type VclEntity from './vcl.interface';
import type VclContentEntity from './vcl.interface';

export default class VclAPIService extends APIService {
  constructor(service_id: string, token: string) {
    super(service_id, token);
  }

  async getVersions(): Promise<VclEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/version`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async validate(version_id: string) {
    try {
      const response = await this.wsClient.get(
        `service/${this.service_id}/version/${version_id}/validate`,
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async activate(version_id: string) {
    try {
      const response = await this.wsClient.put(
        `service/${this.service_id}/version/${version_id}/activate`,
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getVCL(version_id: string): Promise<[VclContentEntity, VclContentEntity]> {
    try {
      const responseHtml = await this.wsClient.get(
        `service/${this.service_id}/version/${version_id}/generated_vcl/content`,
      );
      const responseRaw = await this.wsClient.get(
        `service/${this.service_id}/version/${version_id}/generated_vcl`,
      );
      return [responseRaw.data, responseHtml.data];
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
