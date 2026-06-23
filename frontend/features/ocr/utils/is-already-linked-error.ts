import { AxiosError } from 'axios';

export function isOcrJobAlreadyLinkedError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 409) return false;
  const body = error.response.data as { type?: string } | undefined;
  return typeof body?.type === 'string' && body.type.endsWith('/ocr-job-already-linked');
}
