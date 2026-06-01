'use client';
import { useState, useTransition } from 'react';

import { deletePayment } from '@/features/payments/api';

type Payment = {
  id: string;
  payerId: string;
  amount: number;
  description: string;
  paidAt: string;
};

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  payments: Payment[];
  onChange: () => void;
};

export function PaymentList({ groupId, memberId, members, payments, onChange }: Props) {
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  // 「どの id が削除処理中か」を追跡(per-item pending 表示のため)。
  // useTransition で startTransition を併用することで concurrent rendering 安全に
  // setDeleting と onChange の更新をまとめる。
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete(paymentId: string) {
    if (!confirm('この支払いを削除しますか?')) return;
    setDeletingId(paymentId);
    startTransition(async () => {
      try {
        await deletePayment(paymentId, groupId, memberId);
        onChange();
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (payments.length === 0) {
    return <p className="font-mono text-xs text-rule-grey">No payments yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-rule-grey">
      {payments.map((p) => (
        <li key={p.id} className="py-2 flex items-baseline justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-jp-display text-sm">{p.description || '(no description)'}</span>
            <span className="font-mono text-xs text-rule-grey">
              {memberName(p.payerId)} · {new Date(p.paidAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-base">¥{p.amount.toLocaleString()}</span>
            <button
              onClick={() => onDelete(p.id)}
              // 別行の削除中は他の行も無効化(連続クリック誤操作防止)
              disabled={isPending}
              className="font-mono text-xs underline text-rule-grey"
            >
              {deletingId === p.id ? '...' : 'delete'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
