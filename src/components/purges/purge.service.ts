import APIService from "../base/api";

export default class PurgeAPIService extends APIService {

  constructor(service_id: string, token: string) {
    super(service_id, token);
  };

  async purgeAll() {
    try  {
      const response = await this.wsClient.post(`service/${this.service_id}/purge_all`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async purgeUrl(url: string) {
    try  {
      const response = await this.wsClient.post(`purge/${url}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
