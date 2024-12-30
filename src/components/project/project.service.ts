import APIService from '../base/api';
import axios, { type AxiosInstance } from 'axios';

import type ActivityEntity from './project.interface';
import type UserEntity from './project.interface';
import type ProjectEntity from './project.interface';

export default class ProjectAPIService extends APIService {
  protected wsClientStat: AxiosInstance;

  constructor(service_id: string, token: string) {
    super(service_id, token);

    this.wsClientStat = axios.create({
      baseURL: 'https://rt.fastly.com/v1/channel/',
      headers: {
        'Fastly-Key': token,
        Accept: 'application/json',
      },
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
      const response = await this.wsClient.get(`user/${user_id}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getProject(): Promise<ProjectEntity> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/details`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getStat() {
    try {
      const response = await this.wsClientStat.get(
        `${this.service_id}/ts/${Math.floor(new Date().valueOf() / 1000)}`,
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
