/**
 * kubb 生成 client が呼び出す HTTP 実行関数。
 *
 * kubb の `pluginClient` は各 endpoint に対して関数を生成し、その内部で
 * `import('../../kubb-client').default(config)` を呼び出す。本ファイルは
 * その「default export = HTTP を実行する関数」の責務を担う。
 *
 * SPLAI では env 検証・X-Request-Id 付与・ロギングを既存の axios apiClient に
 * 集約しているため、ここではその apiClient に config をブリッジするだけ。
 */
import type { AxiosError, AxiosRequestConfig } from 'axios';

import { apiClient } from './api-client';

export type RequestConfig<TData = unknown> = AxiosRequestConfig<TData> & {
  url: string;
  method:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS'
    | 'get'
    | 'post'
    | 'put'
    | 'patch'
    | 'delete'
    | 'head'
    | 'options';
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers?: AxiosRequestConfig['headers'];
};

export type ResponseErrorConfig<TError = unknown> = AxiosError<TError>;

export type Client<TData = unknown, TError = unknown, TVariables = unknown> = (
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>> & { error?: ResponseErrorConfig<TError> };

// kubb 生成コードは `client<TData, TError, TVariables>(...)` の 3 引数で呼ぶため、
// 全パラメータを受けられるシグネチャにする。TError は kubb 側の型整合のために
// 受け取るだけで本体では未使用。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const client = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
): Promise<ResponseConfig<TData>> => {
  const response = await apiClient.request<TData, ResponseConfig<TData>>({
    ...config,
    headers: { ...config.headers },
  });
  return response;
};

export default client;
