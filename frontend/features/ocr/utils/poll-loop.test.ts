import { describe, expect, it, vi } from 'vitest';
import { pollOcrJob } from '@/features/ocr/utils/poll-loop';
import { OcrJobResponse } from '@/lib/api/gen/types';

const baseJob: OcrJobResponse = {
  id: 'j1',
  groupId: 'g1',
  status: 'pending',
  result: null,
  errorMessage: null,
  paymentId: null,
};

describe('pollOcrJob', () => {
  it('returns completed on succeeded and stops fetching', async () => {
    const fetcher = vi
      .fn<typeof pollOcrJob extends never ? never : (id: string) => Promise<OcrJobResponse>>()
      .mockResolvedValueOnce({ ...baseJob, status: 'pending' })
      .mockResolvedValueOnce({ ...baseJob, status: 'processing' })
      .mockResolvedValueOnce({
        ...baseJob,
        status: 'succeeded',
        result: { merchantName: 'A', totalAmount: 1000, rawText: 'x' },
      });
    const updates: string[] = [];

    const out = await pollOcrJob({
      jobId: 'j1',
      fetcher,
      onUpdate: (j) => updates.push(j.status),
      intervalMs: 1, // テストは短く
    });

    expect(out.kind).toBe('completed');
    expect(updates).toEqual(['pending', 'processing', 'succeeded']);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('returns completed on failed (errorMessage 経路)', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({
      ...baseJob,
      status: 'failed',
      errorMessage: 'no text',
    });

    const out = await pollOcrJob({ jobId: 'j1', fetcher, onUpdate: () => {}, intervalMs: 1 });
    expect(out.kind).toBe('completed');
    if (out.kind === 'completed') {
      expect(out.job.status).toBe('failed');
      expect(out.job.errorMessage).toBe('no text');
    }
  });

  it('returns timed_out after maxAttempts', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ...baseJob, status: 'processing' });

    const out = await pollOcrJob({
      jobId: 'j1',
      fetcher,
      onUpdate: () => {},
      intervalMs: 1,
      maxAttempts: 3,
    });

    expect(out.kind).toBe('timed_out');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('aborts cleanly when signal is triggered mid-poll', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ...baseJob, status: 'pending' })
      .mockResolvedValue({ ...baseJob, status: 'processing' });

    const ctrl = new AbortController();
    const promise = pollOcrJob({
      jobId: 'j1',
      fetcher,
      onUpdate: () => {},
      intervalMs: 50,
      signal: ctrl.signal,
    });
    // 1 回目の fetch 完了後、interval 中に abort
    await new Promise((r) => setTimeout(r, 10));
    ctrl.abort();
    const out = await promise;
    expect(out.kind).toBe('aborted');
  });
});
