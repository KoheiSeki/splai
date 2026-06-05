/**
 * 共有用メッセージ組み立ての純粋関数。
 * Web Share API / LINE share / clipboard fallback / OGP すべてから利用される。
 */

export type ShareMessage = {
  title: string;
  text: string;
  url: string;
};

/**
 * appUrl 末尾の `/` を除去してから `/g/{groupId}` を連結する。
 */
export function buildShareUrl(appUrl: string, groupId: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/g/${groupId}`;
}

const MAX_TEXT_LEN = 200; // 280 - URL(最長 80 字) - 改行(2 字) - 余裕

/**
 * 共有メッセージを組み立てる処理
 * @param opts - グループ名 / アプリURL / グループID
 * @returns title / text / url
 */
export function buildShareMessage(opts: {
  groupName: string;
  appUrl: string;
  groupId: string;
}): ShareMessage {
  const url = buildShareUrl(opts.appUrl, opts.groupId);
  const title = `${opts.groupName} — SPLAI`;
  const trimmedName =
    opts.groupName.length > 100 ? `${opts.groupName.slice(0, 99)}…` : opts.groupName;
  const text = `${trimmedName} の割り勘、SPLAI で記録中。一緒に登録しよう。`;
  const finalText = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN - 1) + '…' : text;
  return { title, text: finalText, url };
}
