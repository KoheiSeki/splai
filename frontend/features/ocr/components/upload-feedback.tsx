// frontend/features/ocr/components/upload-feedback.tsx
//
// FAILED / TIMED OUT / UPLOAD ERROR の警告ブロック。
// editorial left-rule + キッカーラベル + retry ボタン(border-2 の brutalist 系)。
// --red は使わない(AI 起動状態ではないため、ブランド規則 §12.3)。

type Props = {
  kind: 'failed' | 'timedOut' | 'error';
  message: string;
  onRetry?: () => void;
};

const KICKERS: Record<Props['kind'], string> = {
  failed: 'FAILED',
  timedOut: 'TIMED OUT',
  error: 'ERROR',
};

export function UploadFeedback({ kind, message, onRetry }: Props) {
  return (
    <div className="flex flex-col gap-3 border-l-4 border-ink pl-3 py-1">
      <div>
        <p className="font-jp-display text-[10px] tracking-[0.3em] text-ink/60">{KICKERS[kind]}</p>
        <p role="alert" className="font-jp-display text-sm leading-snug mt-1">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="
            self-start font-mono text-xs px-3 py-1.5 border-2 border-ink
            hover:bg-ink hover:text-paper transition-colors
          "
        >
          ↻ もう一度試す
        </button>
      )}
    </div>
  );
}
