// frontend/features/ocr/utils/validate-image-file.ts
//
// クライアント側でレシート画像をアップロードする前に MIME / サイズを検証する純粋関数。
// 不正なファイルは upload を発行せずローカルで弾く(無駄なリクエスト・課金を防ぐ)。

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB(設計書 §9.1)

export type ValidationError = { reason: string };

/** OK なら null、NG なら理由を返す(throw しない)。 */
export function validateImageFile(file: File): ValidationError | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { reason: `対応していない形式:${file.type || '不明'}` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { reason: `画像が 10MB を超えています(${mb}MB)` };
  }
  return null;
}
