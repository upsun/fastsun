import APIService from "../base/api";

export default class PurgeAPIService extends APIService {

  constructor(service_id: string, token: string) {
    super(service_id, token);
  };

  async purgeAll() {
    try  {
      const {data} = await this.wsClient.post(`service/${this.service_id}/purge_all`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async purgeUrl(url: string) {
    try  {
      const {data} = await this.wsClient.post(`purge/${url}`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }
}
