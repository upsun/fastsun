import APIService from '../base/api';
import type AclItemEntity from './acl.interface';
import type AclEntity from './acl.interface';

export type APIResponse = [null, null] | [Error];

export default class AclAPIService extends APIService {
  constructor(service_id: string, token: string) {
    super(service_id, token);
  }

  /**
   *
   */
  async getACL(version: number): Promise<AclEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/version/${version}/acl`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * https://www.fastly.com/documentation/reference/api/acls/acl-entry/
   * /service/{service_id}/acl/{acl_id}/entries
   */
  async getACLEntry(acl_id: string): Promise<AclItemEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/acl/${acl_id}/entries`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateAclEntry(acl_id: string, updated: AclItemEntity[]): Promise<AclItemEntity[]> {
    try {
      const dto = JSON.stringify({ entries: updated });
      const response = await this.wsClient.patch(`service/${this.service_id}/acl/${acl_id}/entries`, dto);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
