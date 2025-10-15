import axios, { type AxiosInstance } from 'axios';

/**
 * API wrapper to call CDN (Fastly).
 */
export default abstract class APIService {
  protected wsClient: AxiosInstance;
  protected service_id: string;
  protected headers: object;
  protected baseUrl: string;

  constructor(service_id: string, token: string) {
    this.service_id = service_id;

    if (import.meta.env.VITE_PROXY_USE == 'true') {
      this.baseUrl = 'api/'; // Proxy Access
    } else {
      this.baseUrl = 'https://api.fastly.com/'; // Direct Access
    }

    this.headers = {
      'Fastly-Key': token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    };

    // Axios
    this.wsClient = axios.create({
      baseURL: this.baseUrl,
      headers: this.headers,
    });
  }
}
