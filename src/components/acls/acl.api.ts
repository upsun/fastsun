import axios, { type AxiosInstance } from "axios";

export type APIResponse = [null, null] | [Error];

export default class AclAPIService {
  private wsClient: AxiosInstance;
  private service_id: String

  constructor(service_id: String, token: String) {
    this.service_id = service_id;
    this.wsClient = axios.create({
      baseURL: 'https://api.fastly.com/service/',
      headers: {
        'Fastly-Key': token,
        'Accept': 'application/json'
      }
    });
  };

  /**
   *
   */
  async getACL(version: Number) {
    try  {
      const {data} = await this.wsClient.get(`${this.service_id}/version/${version}/acl`);
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
      const data = await this.wsClient.get(`${this.service_id}/acl/${acl_id}/entries`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }

  }
}
