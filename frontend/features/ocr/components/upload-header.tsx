// frontend/features/ocr/components/upload-header.tsx
//
// セクション上部のステータスヘッダ。状態ラベル(NEW SCAN / UPLOADING / PROCESSING /
// FAILED / TIMED OUT)+ 右側に経過秒タイマー + step dots。

import { StepDots } from './icons';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'failed' | 'timedOut';

const LABELS: Record<UploadStatus, string> = {
  idle: 'NEW SCAN',
  uploading: 'UPLOADING',
  processing: 'PROCESSING',
  failed: 'FAILED',
  timedOut: 'TIMED OUT',
};

type Props = {
  status: UploadStatus;
  /** AI active(uploading | processing)時のみ表示する経過秒。 */
  elapsedSec: number;
};

export function UploadHeader({ status, elapsedSec }: Props) {
  const isAiActive = status === 'uploading' || status === 'processing';

  return (
    <header className="flex items-baseline justify-between border-b-2 border-ink px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <p
          className={`font-jp-display text-[10px] tracking-[0.3em] ${
            isAiActive ? 'text-red' : 'text-ink/60'
          }`}
        >
          RECEIPT · OCR
        </p>
        <h3 className={`font-display text-lg leading-none ${isAiActive ? 'text-red' : ''}`}>
          {LABELS[status]}
        </h3>
      </div>
      {isAiActive && (
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-xs text-red tabular-nums"
            role="status"
            aria-live="polite"
          >
            {String(elapsedSec).padStart(2, '0')}s
          </span>
          <StepDots />
        </div>
      )}
    </header>
  );
}
