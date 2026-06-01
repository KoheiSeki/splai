'use client';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { getGroupApiGroupsGroupIdGet } from '@/lib/api/gen/clients/groupsController/getGroupApiGroupsGroupIdGet';
import type { GetGroupApiGroupsGroupIdGetQueryResponse } from '@/lib/api/gen/types/groupsController/GetGroupApiGroupsGroupIdGet';

// kubb 生成型を feature 内で短くエイリアスして UI から使いやすく。
// 型の単一情報源は OpenAPI(backend) → 重複定義しない。
export type GroupData = GetGroupApiGroupsGroupIdGetQueryResponse;

/**
 * グループ情報を取得する hook。
 *
 * - HTTP 呼び出しは **kubb 生成 client**(`getGroupApiGroupsGroupIdGet`)経由。
 *   X-Member-Id header は型付き第 2 引数として要求されるので、忘れると compile error。
 * - `useTransition` で setState を transition 内に閉じ込め、
 *   `react-hooks/no-set-state-in-effect` 警告を回避。
 *
 * 戻り値:
 * - `data`: 取得結果(初回ロード前は null)
 * - `error`: 直近の取得失敗の例外(成功すると null クリア)
 * - `isPending`: 再取得中かどうか
 * - `reload()`: 手動再取得トリガ。mutation 後に呼ぶ
 */
export function useGroup(groupId: string, memberId: string | null) {
  const [data, setData] = useState<GroupData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    if (!memberId) return;
    startTransition(async () => {
      try {
        const res = await getGroupApiGroupsGroupIdGet(groupId, {
          'X-Member-Id': memberId,
        });
        setData(res);
        setError(null);
      } catch (e) {
        setError(e);
      }
    });
  }, [groupId, memberId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, isPending, error, reload };
}
