import axios, { type AxiosInstance } from 'axios';
// import * as Fastly from "fastly";

//axios.defaults.headers.common['Access-Control-Allow-Origin'] = 'http://localhost:8080';
// axios.defaults.withCredentials = true
// axios.defaults.withXSRFToken = true;

export default abstract class APIService {
  protected wsClient: AxiosInstance;
  protected service_id: string;
  protected headers: Object;
  protected baseUrl: string;
  protected requestMode: RequestMode = 'cors';

  constructor(service_id: string, token: string) {
    this.service_id = service_id;

    // Common (fetch)
    this.baseUrl = 'https://api.fastly.com/';
    this.headers = {
      'Fastly-Key': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      //'Access-Control-Allow-Origin': '*',
      //'Access-Control-Allow-Origin': 'http://localhost:8080/',
      //'Access-Control-Allow-Methods': 'GET'
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
