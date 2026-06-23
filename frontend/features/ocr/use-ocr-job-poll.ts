'use client';

import { useEffect, useState } from 'react';

import { getOcrJob, type OcrJobResponse } from '@/features/ocr/api';
import { pollOcrJob } from '@/features/ocr/utils/poll-loop';

export type OcrPollState = {
  /** 最新の job 状態(なければ null = 未取得 or 未開始)。 */
  job: OcrJobResponse | null;
  /** 進行中(pending / processing 中)。UI で `--red` を発色するスイッチに使う。 */
  isPolling: boolean;
  /** 30s 経っても succeeded / failed に到達しなかった。 */
  timedOut: boolean;
  /** 通信エラー(404 含む。failed ステータスはここではなく `job.errorMessage`)。 */
  fetchError: string | null;
};

export function useOcrJobPoll(jobId: string | null): OcrPollState {
  const [job, setJob] = useState<OcrJobResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // jobId 変更を検出して render 中に state をリセット(React 公式パターン
  // "Storing information from previous renders"):
  //   https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // - useEffect 内で setState すると lint(setState-in-effect)に引っかかる
  // - render 中の setState は同フレーム内で React がまとめて処理し追加 commit は発生しない
  const [prevJobId, setPrevJobId] = useState(jobId);
  if (prevJobId !== jobId) {
    setPrevJobId(jobId);
    setJob(null);
    setTimedOut(false);
    setFetchError(null);
  }

  useEffect(() => {
    if (!jobId) return;
    const ctrl = new AbortController();

    void (async () => {
      try {
        const out = await pollOcrJob({
          jobId,
          fetcher: getOcrJob,
          onUpdate: (j) => setJob(j),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (out.kind === 'timed_out') setTimedOut(true);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setFetchError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => ctrl.abort();
  }, [jobId]);

  const isPolling =
    job !== null &&
    (job.status === 'pending' || job.status === 'processing') &&
    !timedOut &&
    !fetchError;

  return { job, isPolling, timedOut, fetchError };
}
