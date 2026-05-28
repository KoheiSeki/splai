/**
 * ランダムなリクエストIDを生成
 * @returns リクエストID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
