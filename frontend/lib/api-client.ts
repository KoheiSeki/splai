import axios, { AxiosError } from 'axios';
import { env } from './env';
import { generateRequestId } from './request-id';

export const apiClient = axios.create({
  baseURL: env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const requestId = generateRequestId();
  config.headers['X-Request-ID'] = requestId;
  if (typeof window !== 'undefined') {
    console.debug(`[req ${requestId}] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const requestId = response.config.headers['X-Request-ID'];
    if (typeof window !== 'undefined') {
      console.debug(`[res ${requestId}] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    const requestId = error.config?.headers?.['X-Request-ID'];
    if (typeof window !== 'undefined') {
      console.warn(
        `[err ${requestId}] ${error.response?.status ?? 'NETWORK'} ${error.config?.url}`,
      );
    }
    return Promise.reject(error);
  },
);
