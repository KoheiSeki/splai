import { OcrJobResponse } from '@/lib/api/gen';

export type PollOptions = {
  jobId: string;
  fetcher: (jobId: string) => Promise<OcrJobResponse>;
  onUpdate: (job: OcrJobResponse) => void;
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
};

export type PollOutcome =
  | { kind: 'completed'; job: OcrJobResponse }
  | { kind: 'timed_out'; lastJob: OcrJobResponse | null }
  | { kind: 'aborted' };

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 15;

/**
 * OcrJob の状態を定期取得し、`succeeded` / `failed` で終了する純粋関数。
 *
 * - 1 回目は **即時** fetch(待たない)→ 既に終わっている job を即座に返せる
 * - 以降は `intervalMs` 間隔
 * - `maxAttempts` で打ち切り → `timed_out`
 * - `signal.abort()` で中断 → `aborted`
 *
 * React に依存しないので vitest で素直にテストできる。
 */
export async function pollOcrJob(opts: PollOptions): Promise<PollOutcome> {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastJob: OcrJobResponse | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) return { kind: 'aborted' };
    if (attempt > 0) {
      const aborted = await sleepWithAbort(intervalMs, opts.signal);
      if (aborted) return { kind: 'aborted' };
    }
    const job = await opts.fetcher(opts.jobId);
    if (opts.signal?.aborted) return { kind: 'aborted' };
    lastJob = job;
    opts.onUpdate(job);
    if (job.status === 'succeeded' || job.status === 'failed') {
      return { kind: 'completed', job };
    }
  }
  return { kind: 'timed_out', lastJob };
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
