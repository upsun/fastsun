import APIService from "../base/api";

export default class ProjectAPIService extends APIService {

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

  async getActivities() {
    try  {
      const {data} = await this.wsClient.get(
        `events?service_id=${this.service_id}&page%5Bsize%5D=20&sort=-created_at&event_type%5Bnot%5D%5B%5D=rule_status.delete_all&event_type%5Bnot%5D%5B%5D=rule_status.update&event_type%5Bnot%5D%5B%5D=rule_status.upsert&event_type%5Bnot%5D%5B%5D=waf.ruleset.deploy_failure&event_type%5Bnot%5D%5B%5D=waf.configuration_set_update&event_type%5Bnot%5D%5B%5D=waf.owasp.create&event_type%5Bnot%5D%5B%5D=waf.owasp.update`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async getUser(user_id: string) {
    try  {
      const {data} = await this.wsClient.get(`user/${user_id}`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }

  async getProject() {
    try  {
      const {data} = await this.wsClient.get(`service/${this.service_id}/details`);
      return [null, data];
    } catch (error) {
      console.error(error);
      return [error];
    }
  }
}
