import { ShareInput } from '@/lib/api/gen';

export type MemberShareRow = {
  memberId: string;
  name: string;
  included: boolean;
  amount: number;
};

/** 初期 rows を組み立てるための member 最小形(各 component の `Member` と structurally compatible)。 */
type MemberInput = { id: string; name: string };

/**
 * 支払い参加メンバーの合計金額を計算する関数
 * @param rows メンバーごとの共有金額
 * @returns 参加しているメンバーの合計金額
 */
export function sumIncludedAmounts(rows: MemberShareRow[]): number {
  return rows.filter((r) => r.included).reduce((sum, r) => sum + r.amount, 0); // 0 は初期値
}

/**
 * 合計金額を均等に分配する関数
 * @param total 合計金額
 * @param rows メンバーごとの共有金額
 * @returns 参加しているメンバーの共有金額
 */
export function distributeEqual(total: number, rows: MemberShareRow[]): MemberShareRow[] {
  // 参加しているメンバーがいない場合はそのまま返す
  const included = rows.filter((r) => r.included);
  if (included.length === 0) return rows;

  const base = Math.floor(total / included.length);
  const remainder = total - base * included.length;

  let firstApplied = false;

  return rows.map((r) => {
    if (!r.included) return { ...r, amount: 0 };
    const extra = !firstApplied ? remainder : 0;
    firstApplied = true;
    return { ...r, amount: base + extra };
  });
}

/**
 * 支払い参加メンバーの金額を ShareInputDTO に変換する関数
 * @param rows メンバーごとの共有金額
 * @returns Sh
 * areInput[]
 */
export function toAmountShareInputs(rows: MemberShareRow[]): ShareInput[] {
  return rows
    .filter((r) => r.included && r.amount > 0)
    .map((r) => ({
      memberId: r.memberId,
      shareType: 'amount' as const,
      shareValue: r.amount,
    }));
}

/**
 * 共有金額が支払い金額と一致するかどうかを判定する関数
 * @param rows メンバーごとの共有金額
 * @param paymentAmount 支払い金額
 * @returns 共有金額が支払い金額と一致するかどうか
 */
export function isShareEditorValid(rows: MemberShareRow[], paymentAmount: number): boolean {
  if (rows.filter((r) => r.included).length === 0) return false;
  return sumIncludedAmounts(rows) === paymentAmount;
}

/**
 * 初期 rows を組み立てる(全員 included + 均等割。draftIds があれば該当のみ included)。
 *
 * - `draftIds` が null:全員 `included: true`(Phase 1 互換)
 * - `draftIds` が配列:該当 memberId のみ `included: true`(AI CHAT draft 経由)
 * - `amount` を `distributeEqual` で included メンバーへ配分(余りは先頭に集約)
 *
 * 純粋関数(React 依存なし)。`PaymentForm` / `OcrConfirmForm` 等から共有利用する。
 */
export function buildInitialRows(
  members: MemberInput[],
  amount: number,
  draftIds: string[] | null,
): MemberShareRow[] {
  const includedSet = draftIds ? new Set(draftIds) : null;
  const base: MemberShareRow[] = members.map((m) => ({
    memberId: m.id,
    name: m.name,
    included: includedSet ? includedSet.has(m.id) : true,
    amount: 0,
  }));
  return distributeEqual(amount, base);
}
