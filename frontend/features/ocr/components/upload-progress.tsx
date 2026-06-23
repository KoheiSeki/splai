// frontend/features/ocr/components/upload-progress.tsx
//
// UPLOADING / PROCESSING の進捗 UI。
// - 実進捗は取れないので elapsed / 30s 比率を bar 幅に。95% でクランプ。
// - bar は bg-red、右端に ink-tick で 100% 位置を示す。

const MAX_POLL_SECONDS = 30;

type Props = {
  phase: 'uploading' | 'processing';
  elapsedSec: number;
};

export function UploadProgress({ phase, elapsedSec }: Props) {
  const progressPct = Math.min((elapsedSec / MAX_POLL_SECONDS) * 100, 95);

  return (
    <div className="flex flex-col gap-4 py-2">
      <p className="font-jp-display text-sm">
        {phase === 'uploading' ? '画像をアップロード中…' : 'OCR で文字を読み取っています…'}
      </p>

      <div className="relative h-2 bg-rule-grey/40">
        <div
          className="absolute inset-y-0 left-0 bg-red transition-[width] duration-500 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
        <div className="absolute inset-y-[-3px] right-0 w-px bg-ink" />
      </div>

      <p className="font-mono text-[10px] text-ink/55 tracking-[0.2em] flex items-baseline justify-between">
        <span>0s</span>
        <span>最大 {MAX_POLL_SECONDS}s で結果が返ります</span>
        <span>{MAX_POLL_SECONDS}s</span>
      </p>
    </div>
  );
}
