import APIService from "../base/api";

export type APIResponse = [null, null] | [Error];

export default class AclAPIService extends APIService {

  constructor(service_id: String, token: String) {
    super(service_id, token);
  };

  /**
   *
   */
  async getACL(version: Number) {
    try  {
      const {data} = await this.wsClient.get(`service/${this.service_id}/version/${version}/acl`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  /**
   * https://www.fastly.com/documentation/reference/api/acls/acl-entry/
   * /service/service_id/acl/acl_id/entries
   */
  async getACLEntry(acl_id: string) {
    try {
      const data = await this.wsClient.get(`service/${this.service_id}/acl/${acl_id}/entries`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }

  }
}
