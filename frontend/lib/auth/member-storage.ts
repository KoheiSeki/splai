/**
 * グループ単位のメンバー ID を localStorage で保持(設計書 §2)。
 * キー: g_<group_id>
 *
 * 書き込み(set / clear)時には CustomEvent `splai:member-id-changed` を
 * window に dispatch する。同一タブ内の `useSyncExternalStore` 利用側が
 * これを subscribe して再 render する。
 *
 * 別タブからの変更は標準の `storage` イベントが飛ぶので、subscriber 側で
 * 両方を listen する必要がある(`hooks/use-member-storage.ts` 参照)。
 */
const KEY_PREFIX = 'g_';

/** localStorage 変更を同一タブに通知するための CustomEvent 名。 */
export const MEMBER_ID_CHANGED_EVENT = 'splai:member-id-changed';

/**
 * グループ ID に対応するメンバー ID を取得(設計書 §2)。
 * @param groupId - グループ ID
 * @returns - メンバー ID
 */
export function getMemberId(groupId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${KEY_PREFIX}${groupId}`);
}

/**
 * グループ ID に対応するメンバー ID を設定(設計書 §2)。
 * 同一タブ内の subscriber に通知するため CustomEvent を dispatch する。
 * @param groupId - グループ ID
 * @param memberId - メンバー ID
 */
export function setMemberId(groupId: string, memberId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${KEY_PREFIX}${groupId}`, memberId);
  window.dispatchEvent(new Event(MEMBER_ID_CHANGED_EVENT));
}

/**
 * グループ ID に対応するメンバー ID をクリア(設計書 §2)。
 * 同一タブ内の subscriber に通知するため CustomEvent を dispatch する。
 * @param groupId - グループ ID
 */
export function clearMemberId(groupId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${KEY_PREFIX}${groupId}`);
  window.dispatchEvent(new Event(MEMBER_ID_CHANGED_EVENT));
}
