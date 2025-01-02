import axios, { type AxiosInstance } from 'axios';
// import * as Fastly from "fastly";

export default abstract class APIService {
  protected wsClient: AxiosInstance;
  protected service_id: string;
  protected headers: Object;
  protected baseUrl: string;
  protected requestMode: RequestMode = 'cors';

  constructor(service_id: string, token: string) {
    this.service_id = service_id;

    // Common (fetch)
    if (import.meta.env.DEV) {
      this.baseUrl = 'https://api.fastly.com/';  // Direct Access
    } else {
      this.baseUrl = 'api/';  // Proxy Access
    }

    this.headers = {
      'Fastly-Key': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    };


    // Axios
    this.wsClient = axios.create({
      baseURL: this.baseUrl,
      headers: this.headers,
    });

    // // Fastly Client
    // Fastly.ApiClient.instance.authenticate(token);
  }

  get() {

  }
}
