import axios, { type AxiosInstance } from "axios";

const FASTLY_API_SERVICE="xxxxxx";
const FASTLY_API_TOKEN="xxxxx";

export type APIResponse = [null, null] | [Error];

export default class AclAPIService {
  private wsClient: AxiosInstance;

  constructor() {
    this.wsClient = axios.create({
      baseURL: 'https://api.fastly.com/service/',
      headers: {
        'Fastly-Key': FASTLY_API_TOKEN,
        'Accept': 'application/json'
      }
    });
  };

  /**
   *
   */
  async getACL(version: number) {
    try  {
      const {data} = await this.wsClient.get(`${FASTLY_API_SERVICE}/version/${version}/acl`);
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
      const data = await this.wsClient.get(`${FASTLY_API_SERVICE}/acl/${acl_id}/entries`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }

  }
}
