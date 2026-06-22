import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { isOcrJobAlreadyLinkedError } from './is-already-linked-error';

const mk409 = (type: string) =>
  new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, null, {
    status: 409,
    statusText: 'Conflict',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { type, title: 'OCR Job Already Linked', status: 409 },
  });

describe('isOcrJobAlreadyLinkedError', () => {
  it('returns true for 409 with ocr-job-already-linked type', () => {
    expect(isOcrJobAlreadyLinkedError(mk409('/ocr-job-already-linked'))).toBe(true);
    expect(isOcrJobAlreadyLinkedError(mk409('https://example.com/ocr-job-already-linked'))).toBe(
      true,
    );
  });
  it('returns false for other 409 types', () => {
    expect(isOcrJobAlreadyLinkedError(mk409('/some-other-error'))).toBe(false);
  });
  it('returns false for non-AxiosError', () => {
    expect(isOcrJobAlreadyLinkedError(new Error('boom'))).toBe(false);
    expect(isOcrJobAlreadyLinkedError(null)).toBe(false);
  });
});
