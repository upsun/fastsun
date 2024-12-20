import axios, { type AxiosInstance } from "axios";

export default abstract class APIService {
  protected wsClient: AxiosInstance;
  protected service_id: String

  constructor(service_id: String, token: String) {
    this.service_id = service_id;
    this.wsClient = axios.create({
      baseURL: 'https://api.fastly.com/',
      headers: {
        'Fastly-Key': token,
        'Accept': 'application/json'
      }
    });
  };
}
