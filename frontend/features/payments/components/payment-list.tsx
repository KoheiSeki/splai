'use client';
import { useEffect, useState, useTransition } from 'react';

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

const CONFIRM_TIMEOUT_MS = 3000;

export function PaymentList({ groupId, memberId, members, payments, onChange }: Props) {
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 確認モードに入ってから一定時間で自動取消し:誤タップ後の無操作で
  // 危険な状態(armed)が残らないようにする。
  useEffect(() => {
    if (!confirmingId) return;
    const timer = window.setTimeout(() => setConfirmingId(null), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingId]);

  function handleDeleteClick(paymentId: string) {
    if (confirmingId !== paymentId) {
      // 1 度目:確認モード(arm)。即削除はしない。
      setConfirmingId(paymentId);
      return;
    }
    // 2 度目:実削除。
    setConfirmingId(null);
    setDeletingId(paymentId);
    startTransition(async () => {
      try {
        await deletePayment(groupId, paymentId, memberId);
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
      {payments.map((p) => {
        const armed = confirmingId === p.id;
        const deleting = deletingId === p.id;
        return (
          <li key={p.id} className="py-2 flex items-baseline justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="font-jp-display text-sm truncate">
                {p.description || '(no description)'}
              </span>
              <span className="font-mono text-xs text-rule-grey">
                {memberName(p.payerId)} · {new Date(p.paidAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
            <div className="flex items-baseline gap-3 shrink-0">
              <span className="font-mono text-base">¥{p.amount.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => handleDeleteClick(p.id)}
                disabled={isPending}
                aria-label={
                  armed ? `${p.description} を削除する(確認済み)` : `${p.description} を削除`
                }
                className={`
                  font-mono text-xs px-1.5 py-0.5 transition-all w-[7ch] text-center
                  ${
                    armed
                      ? 'border border-ink bg-paper text-ink font-bold underline-offset-2'
                      : 'text-rule-grey underline hover:text-ink'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                {deleting ? '...' : armed ? '本当に?' : 'delete'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
