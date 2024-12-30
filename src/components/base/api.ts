import axios, { type AxiosInstance } from 'axios';

// axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';
// axios.defaults.withCredentials = true
// axios.defaults.withXSRFToken = true;

export default abstract class APIService {
  protected wsClient: AxiosInstance;
  protected service_id: string;

  constructor(service_id: string, token: string) {
    this.service_id = service_id;
    this.wsClient = axios.create({
      baseURL: 'https://api.fastly.com/',
      headers: {
        'Fastly-Key': token,
        // 'Access-Control-Allow-Origin': '*',
        Accept: 'application/json',
      },
    });
  }
}
