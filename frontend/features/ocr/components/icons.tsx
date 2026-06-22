// frontend/features/ocr/components/icons.tsx
//
// OCR 関連のアニメーション信号。
// 静的なピクトグラム(カメラ・画像など)は **typography + emoji** に置き換えたので、
// 本ファイルには残していない(SVG 線画は SPLAI editorial brutalist の "タイポ主役"
// の方針と相容れないため)。

/**
 * 階段状に光る 3 点ドット。SPLAI brutalist の進捗信号。
 * `animate-pulse` を 180ms 刻みで遅延させて sequential 感を出す。
 */
export function StepDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      <span
        className="w-1.5 h-1.5 bg-red animate-pulse"
        style={{ animationDelay: '0ms', animationDuration: '900ms' }}
      />
      <span
        className="w-1.5 h-1.5 bg-red animate-pulse"
        style={{ animationDelay: '180ms', animationDuration: '900ms' }}
      />
      <span
        className="w-1.5 h-1.5 bg-red animate-pulse"
        style={{ animationDelay: '360ms', animationDuration: '900ms' }}
      />
    </span>
  );
}
