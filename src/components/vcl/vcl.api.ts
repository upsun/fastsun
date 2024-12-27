import APIService from "../base/api";

export default class VclAPIService extends APIService {

  constructor(service_id: string, token: string) {
    super(service_id, token);
  };

  async getVersions() {
    try  {
      const {data} = await this.wsClient.get(`service/${this.service_id}/version`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async validate(version_id: string) {
    try  {
      const {data} = await this.wsClient.get(`service/${this.service_id}/version/${version_id}/validate`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async activate(version_id: string) {
    try  {
      const {data} = await this.wsClient.put(`service/${this.service_id}/version/${version_id}/activate`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async getVCL(version_id: string)
  {
    try  {
      const responseHtml = await this.wsClient.get(`service/${this.service_id}/version/${version_id}/generated_vcl/content`);
      const responseRaw = await this.wsClient.get(`service/${this.service_id}/version/${version_id}/generated_vcl`);
      return [responseRaw.data, responseHtml.data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }
}
