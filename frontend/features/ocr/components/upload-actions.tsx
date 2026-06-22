// frontend/features/ocr/components/upload-actions.tsx
//
// IDLE 状態の picker。SPLAI editorial brutalist の "タイポ主役 + 脇役 emoji"。
//   - 視覚の主役は `SCAN` / `FILES`(Archivo Black、tracking 広め)
//   - 補助シンボルは 📷 / 📁(text-base、右上に小さく配置)
//   - 非対称レイアウト(タイポは左下、emoji は右上)で編集デザイン感
//   - brutalist shadow:4px → 2px(hover)→ 0 + 2px translate(active)

type Props = {
  onPickCamera: () => void;
  onPickFile: () => void;
};

const BUTTON_BASE = `
  bg-paper border-2 border-ink p-4 min-h-[100px]
  flex flex-col justify-between gap-3 text-left
  hover:bg-ink hover:text-paper
  active:translate-x-[2px] active:translate-y-[2px]
  transition-all duration-100
  shadow-[4px_4px_0_var(--color-ink)]
  hover:shadow-[2px_2px_0_var(--color-ink)]
  active:shadow-none
`;

export function UploadActions({ onPickCamera, onPickFile }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        {/* PRIMARY:撮影(モバイルでカメラ直起動) */}
        <button type="button" onClick={onPickCamera} className={BUTTON_BASE}>
          <div className="flex items-start justify-between gap-2">
            <span className="font-display text-2xl tracking-[0.2em] leading-none">SCAN</span>
            <span className="text-base leading-none" aria-hidden>
              📷
            </span>
          </div>
          <span className="font-jp-display text-[10px] tracking-[0.3em]">レシートを撮影</span>
        </button>

        {/* SECONDARY:gallery / disk から選択 */}
        <button type="button" onClick={onPickFile} className={BUTTON_BASE}>
          <div className="flex items-start justify-between gap-2">
            <span className="font-display text-base tracking-[0.2em] leading-none">FILES</span>
            <span className="text-sm leading-none" aria-hidden>
              📁
            </span>
          </div>
          <span className="font-jp-display text-[10px] tracking-[0.25em]">画像から選択</span>
        </button>
      </div>

      <p className="font-mono text-[10px] text-ink/55 text-center tracking-[0.25em]">
        JPEG · PNG · WEBP · MAX 10MB
      </p>
    </div>
  );
}
