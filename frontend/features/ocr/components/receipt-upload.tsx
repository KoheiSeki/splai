// frontend/features/ocr/components/receipt-upload.tsx
//
// レシートアップロード + 状態切替の orchestration。実 UI は子コンポーネントに分離:
//   - UploadHeader   ステータスラベル + 経過秒 + step dots
//   - UploadActions  IDLE 時の picker(SCAN / FILES)
//   - UploadProgress UPLOADING / PROCESSING の進捗バー
//   - UploadFeedback FAILED / TIMED OUT / UPLOAD ERROR の警告
//
// 純粋関数:
//   - validateImageFile  MIME / サイズ検証
//   - useElapsedSeconds  active 中だけ秒カウント
//   - useOcrJobPoll      job_id をポーリングして status を取得

'use client';

import { useEffect, useRef, useState } from 'react';

import { uploadReceipt, type OcrJobResponse } from '@/features/ocr/api';
import { useElapsedSeconds } from '@/features/ocr/use-elapsed-seconds';
import { useOcrJobPoll } from '@/features/ocr/use-ocr-job-poll';
import { ALLOWED_IMAGE_ACCEPT, validateImageFile } from '@/features/ocr/utils/validate-image-file';

import { UploadActions } from './upload-actions';
import { UploadFeedback } from './upload-feedback';
import { UploadHeader, type UploadStatus } from './upload-header';
import { UploadProgress } from './upload-progress';

type Props = {
  groupId: string;
  memberId: string;
  /** OCR 成功時に親(OcrConfirmForm の親)へジョブを渡す。 */
  onSucceeded: (job: OcrJobResponse) => void;
};

export function ReceiptUpload({ groupId, memberId, onSucceeded }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const poll = useOcrJobPoll(jobId);

  // succeeded を 1 度だけ親へ通知(同じ job_id で重複しない)
  const succeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (poll.job?.status === 'succeeded' && succeededRef.current !== poll.job.id) {
      succeededRef.current = poll.job.id;
      onSucceeded(poll.job);
    }
  }, [poll.job, onSucceeded]);

  const failed = poll.job?.status === 'failed';
  const isAiActive = isUploading || poll.isPolling;
  const elapsedSec = useElapsedSeconds(isAiActive);

  const status: UploadStatus = isUploading
    ? 'uploading'
    : poll.isPolling
      ? 'processing'
      : failed
        ? 'failed'
        : poll.timedOut
          ? 'timedOut'
          : 'idle';

  const showActions = status === 'idle' && !uploadError;

  const handleFile = async (file: File) => {
    setUploadError(null);
    succeededRef.current = null;

    const v = validateImageFile(file);
    if (v) {
      setUploadError(v.reason);
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
    succeededRef.current = null;
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerFile = () => fileInputRef.current?.click();

  return (
    <section
      className={`
        border-2 transition-colors
        ${isAiActive ? 'border-red bg-red/5' : 'border-ink bg-paper'}
      `}
    >
      <UploadHeader status={status} elapsedSec={elapsedSec} />

      <div className="p-4">
        {showActions && <UploadActions onPickCamera={triggerCamera} onPickFile={triggerFile} />}

        {(status === 'uploading' || status === 'processing') && (
          <UploadProgress phase={status} elapsedSec={elapsedSec} />
        )}

        {status === 'failed' && poll.job && (
          <UploadFeedback
            kind="failed"
            message={poll.job.errorMessage ?? 'OCR に失敗しました'}
            onRetry={handleRetry}
          />
        )}

        {status === 'timedOut' && (
          <UploadFeedback
            kind="timedOut"
            message="30 秒経っても完了しませんでした。"
            onRetry={handleRetry}
          />
        )}

        {uploadError && !isAiActive && (
          <UploadFeedback kind="error" message={uploadError} onRetry={handleRetry} />
        )}

        {poll.fetchError && (
          <p role="alert" className="mt-3 border-l-4 border-ink pl-3 py-1 font-jp-display text-xs">
            状態取得に失敗しました:{poll.fetchError}
          </p>
        )}
      </div>

      {/* Hidden inputs:ref から trigger、ネイティブ UI は出さない */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // 同じファイル再選択を許可
          if (f) void handleFile(f);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />
    </section>
  );
}
