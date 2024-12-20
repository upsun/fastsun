import APIService from "../base/api";

export default class DomainAPIService extends APIService {

  constructor(service_id: String, token: String) {
    super(service_id, token);
  };

  async getDomains(version_id: Number) {
    try  {
      const {data} = await this.wsClient.get(`service/${this.service_id}/version/${version_id}/domain`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }
}
