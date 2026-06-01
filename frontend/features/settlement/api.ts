'use client';

import { getSettlementApiGroupsGroupIdSettlementGet } from '@/lib/api/gen/clients/settlementController/getSettlementApiGroupsGroupIdSettlementGet';
import type { GetSettlementApiGroupsGroupIdSettlementGetQueryResponse } from '@/lib/api/gen/types/settlementController/GetSettlementApiGroupsGroupIdSettlementGet';

// kubb 生成型を feature 内で短くエイリアス。型の単一情報源は OpenAPI(backend)。
export type Settlement = GetSettlementApiGroupsGroupIdSettlementGetQueryResponse;

/**
 * 清算結果(送金リスト + ネット収支)を取得する。
 * @param groupId - グループ ID
 * @param memberId - リクエスト元メンバー ID(X-Member-Id ヘッダ)
 */
export async function getSettlement(groupId: string, memberId: string): Promise<Settlement> {
  return getSettlementApiGroupsGroupIdSettlementGet(groupId, {
    'X-Member-Id': memberId,
  });
}
