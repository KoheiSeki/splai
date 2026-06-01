'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  MEMBER_ID_CHANGED_EVENT,
  clearMemberId,
  getMemberId,
  setMemberId,
} from '@/lib/auth/member-storage';

/**
 * localStorage 上の member_id を React と同期する hook。
 *
 * `useSyncExternalStore` を使うことで:
 * - useEffect + setState の cascading render(React 19 の no-set-state-in-effect)を回避
 * - 別タブからの変更も storage イベントで反映
 * - 同一タブ内の変更は CustomEvent `splai:member-id-changed` で反映
 * - SSR 中は安全に null を返す(getServerSnapshot)
 */
export function useMemberStorage(groupId: string) {
  // subscribe: 外部ストアの変更通知を購読する関数
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    // 別タブでの localStorage 変更
    window.addEventListener('storage', onChange);
    // 同一タブでの set/clear(member-storage が dispatch する)
    window.addEventListener(MEMBER_ID_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(MEMBER_ID_CHANGED_EVENT, onChange);
    };
  }, []);

  // getSnapshot: 現在値を返す純粋関数(render 中に呼ばれる、O(1))
  const getSnapshot = useCallback(() => getMemberId(groupId), [groupId]);

  // getServerSnapshot: SSR / hydration 中の fallback
  const getServerSnapshot = useCallback(() => null, []);

  const memberId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (id: string) => {
      setMemberId(groupId, id);
      // useSyncExternalStore が CustomEvent を検知して再 render するので、
      // ここで個別に setState する必要はない。
    },
    [groupId],
  );

  const clear = useCallback(() => {
    clearMemberId(groupId);
  }, [groupId]);

  return { memberId, setMemberId: set, clearMemberId: clear };
}
