'use client';
import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';

import { getSettlement, type Settlement } from '@/features/settlement/api';
import { explainSettlement } from '@/features/ai/api';

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  refreshKey: number;
};

export function SettlementView({ groupId, memberId, members, refreshKey }: Props) {
  const [data, setData] = useState<Settlement | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isPending, startTransition] = useTransition();

  // すべての setState を transition の async コールバック内に閉じ込めることで、
  // effect 本体での同期 setState を排除し、React 19 の
  // `react-hooks/no-set-state-in-effect` 警告を回避する。
  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getSettlement(groupId, memberId);
        setData(res);
        setError(null);
      } catch (e) {
        setError(e);
      }
    });
  }, [groupId, memberId]);

  const [explainState, runExplain, isExplaining] = useActionState<
    { text: string | null; error: string | null },
    void
  >(
    async () => {
      if (!data) return { text: null, error: null };
      try {
        const res = await explainSettlement({
          members: members.map((m) => ({ id: m.id, name: m.name })),
          transfers: data.transfers,
          netBalances: data.netBalances,
        });
        return { text: res.explanation, error: null };
      } catch (e) {
        return { text: null, error: e instanceof Error ? e.message : String(e) };
      }
    },
    { text: null, error: null },
  );

  // groupId / memberId / refreshKey のいずれかが変わったら再取得。
  // refreshKey は親が支払い登録/削除後にインクリメントすることで再 fetch を促すトリガ。
  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const name = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  // 初回ロード中(まだデータが無い)は loading 表示。
  // データ取得済みの再 fetch 中は古いデータを表示し続ける(stale-while-revalidate)。
  if (isPending && !data) return <p className="font-mono text-xs">loading...</p>;
  if (error) return <p className="font-mono text-xs text-ink">error: {String(error)}</p>;
  if (!data) return null;

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-3">
      <h3 className="font-jp-display text-sm tracking-widest">SETTLEMENT</h3>
      {data.transfers.length === 0 ? (
        <p className="font-mono text-xs">清算済み(送金不要)</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.transfers.map((t, i) => (
            <li key={i} className="font-mono text-sm">
              {name(t.fromId)} → {name(t.toId)} : ¥{t.amount.toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <details className="font-mono text-xs">
        <summary className="cursor-pointer">net balances</summary>
        <ul>
          {Object.entries(data.netBalances).map(([mid, bal]) => (
            <li key={mid}>
              {name(mid)}: {bal > 0 ? '+' : ''}
              {bal.toLocaleString()}
            </li>
          ))}
        </ul>
      </details>
      <div className="border-t border-rule-grey pt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => startTransition(() => runExplain())}
          disabled={isExplaining}
          className={`font-mono text-xs underline self-start ${isExplaining ? 'text-red' : ''}`}
        >
          {isExplaining ? 'AI 解説中...' : 'AI に解説してもらう'}
        </button>
        {explainState.text && (
          <p className="font-jp-editorial text-sm whitespace-pre-wrap">{explainState.text}</p>
        )}
        {explainState.error && (
          <p role="alert" className="text-ink font-mono text-xs">
            {explainState.error}
          </p>
        )}
      </div>
    </section>
  );
}
