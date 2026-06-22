'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadReceipt, type OcrJobResponse } from '@/features/ocr/api';
import { useOcrJobPoll } from '@/features/ocr/use-ocr-job-poll';

type Props = {
  groupId: string;
  memberId: string;
  /** OCR 成功時に親(OcrConfirmForm の親)へジョブを渡す。 */
  onSucceeded: (job: OcrJobResponse) => void;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export function ReceiptUpload({ groupId, memberId, onSucceeded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const poll = useOcrJobPoll(jobId);

  // succeeded を 1 度だけ親へ通知
  const succeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (poll.job?.status === 'succeeded' && succeededRef.current !== poll.job.id) {
      succeededRef.current = poll.job.id;
      onSucceeded(poll.job);
    }
  }, [poll.job, onSucceeded]);

  const failed = poll.job?.status === 'failed';
  const isAiActive = isUploading || poll.isPolling; // ← `--red` 発色の条件
  const elapsedHint = poll.isPolling ? 'OCR 処理中…' : isUploading ? 'アップロード中…' : null;

  const handleFile = async (file: File) => {
    setUploadError(null);
    succeededRef.current = null;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(`対応していない形式: ${file.type}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`画像が 10MB を超えています(${Math.round(file.size / 1024 / 1024)}MB)`);
      return;
    }

    setIsUploading(true);
    setJobId(null); // 既存 polling を停止
    try {
      const res = await uploadReceipt(groupId, memberId, file);
      setJobId(res.jobId);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = () => {
    setJobId(null);
    setUploadError(null);
    inputRef.current?.click();
  };

  return (
    <section
      className={`
        border-2 p-4 flex flex-col gap-3 transition-colors
        ${isAiActive ? 'border-red bg-red/5' : 'border-ink bg-paper'}
      `}
    >
      <header className="flex items-baseline justify-between">
        <h3 className={`font-jp-display text-sm tracking-widest ${isAiActive ? 'text-red' : ''}`}>
          RECEIPT — レシート画像
        </h3>
        {elapsedHint && (
          <span className="font-mono text-xs text-red" role="status">
            {elapsedHint}
          </span>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        capture="environment"
        disabled={isAiActive}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // 同じファイルを再選択できるように value をリセット
          e.target.value = '';
        }}
        className="
          font-mono text-sm
          file:mr-3 file:py-2 file:px-3 file:border-2 file:border-ink file:bg-paper
          file:font-display file:tracking-[0.15em]
          file:cursor-pointer file:hover:bg-ink file:hover:text-paper
          file:disabled:opacity-40
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      />

      {/* upload エラー(クライアント側の MIME / サイズ違反 + ネットワークエラー)*/}
      {uploadError && (
        <p role="alert" className="border-l-2 border-ink pl-3 font-jp-display text-xs">
          {uploadError}
        </p>
      )}

      {/* polling のフェッチエラー(404 等)*/}
      {poll.fetchError && (
        <p role="alert" className="border-l-2 border-ink pl-3 font-jp-display text-xs">
          状態取得に失敗しました:{poll.fetchError}
        </p>
      )}

      {/* timeout */}
      {poll.timedOut && (
        <div className="border-l-2 border-ink pl-3 flex flex-col gap-1">
          <p className="font-jp-display text-xs">
            30 秒経っても OCR が完了しません。再試行してください。
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="font-mono text-xs underline self-start"
          >
            別の画像を選ぶ
          </button>
        </div>
      )}

      {/* OCR 失敗(server side OCRFailed)*/}
      {failed && poll.job && (
        <div className="border-l-2 border-ink pl-3 flex flex-col gap-1">
          <p className="font-jp-display text-xs">
            OCR に失敗:{poll.job.errorMessage ?? '(理由不明)'}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="font-mono text-xs underline self-start"
          >
            別の画像を選ぶ
          </button>
        </div>
      )}
    </section>
  );
}
