import APIService from '../base/api';
import axios, { type AxiosInstance } from 'axios';
import { validateServiceId, validateToken, validateApiParam, createSecureSearchParams } from '@/utils/securityUtils';

import type ActivityEntity from './project.interface';
import type UserEntity from './project.interface';
import type ProjectEntity from './project.interface';

export default class ProjectAPIService extends APIService {
  protected wsClientRt: AxiosInstance;
  protected baseUrlRt: string;

  constructor(service_id: string, token: string) {
    // Validate inputs before calling super
    const validatedServiceId = validateServiceId(service_id);
    const validatedToken = validateToken(token);

    if (!validatedServiceId || !validatedToken) {
      throw new Error('Invalid service credentials provided');
    }

    super(validatedServiceId, validatedToken);

    if (import.meta.env.VITE_PROXY_USE == 'true') {
      this.baseUrlRt = 'rt/'; // Proxy Access
    } else {
      this.baseUrlRt = 'https://rt.fastly.com/'; // Direct Access
    }

    this.wsClientRt = axios.create({
      baseURL: this.baseUrlRt,
      headers: this.headers,
    });
  }

  async getActivities(): Promise<ActivityEntity[]> {
    try {
      const response = await this.wsClient.get(
        `events?service_id=${this.service_id}&page%5Bsize%5D=20&sort=-created_at&event_type%5Bnot%5D%5B%5D=rule_status.delete_all&event_type%5Bnot%5D%5B%5D=rule_status.update&event_type%5Bnot%5D%5B%5D=rule_status.upsert&event_type%5Bnot%5D%5B%5D=waf.ruleset.deploy_failure&event_type%5Bnot%5D%5B%5D=waf.configuration_set_update&event_type%5Bnot%5D%5B%5D=waf.owasp.create&event_type%5Bnot%5D%5B%5D=waf.owasp.update`,
      );
      return response.data.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getUser(user_id: string): Promise<UserEntity> {
    try {
      // Validate user ID parameter
      const validatedUserId = validateApiParam(user_id);
      if (!validatedUserId) {
        throw new Error('Invalid user ID parameter');
      }

      const response = await this.wsClient.get(`user/${validatedUserId}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getProject(): Promise<ProjectEntity> {
    try {
      //// Fastly client
      // const apiInstance = new Fastly.ServiceApi();
      // const options = {
      //   service_id: this.service_id,
      // };
      // const response = await apiInstance.getServiceDetail(options);
      // return response

      //// Fetch
      // const options = { method:'GET', mode:this.requestMode, headers:this.headers } as RequestInit;
      // const url = this.baseUrl + `service/${this.service_id}/details`;
      // const response = await fetch(url, options);
      // const data = await response.json();
      // return data;

      //// Axios
      const response = await this.wsClient.get(`service/${this.service_id}/details`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getStat() {
    try {
      const response = await this.wsClientRt.get(
        `v1/channel/${this.service_id}/ts/${Math.floor(new Date().valueOf() / 1000)}`,
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getHistoricalData(from: string, to: string, res: string) {
    try {
      // Validate all parameters to prevent injection
      const validatedFrom = validateApiParam(from);
      const validatedTo = validateApiParam(to);
      const validatedRes = validateApiParam(res);

      if (!validatedFrom || !validatedTo || !validatedRes) {
        throw new Error('Invalid parameters for historical data request');
      }

      // Use secure URL building
      const params = createSecureSearchParams({
        from: validatedFrom,
        to: validatedTo,
        by: validatedRes,
      });

      const response = await this.wsClient.get(`stats/service/${this.service_id}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
