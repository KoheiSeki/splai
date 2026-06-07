'use client';
import { startTransition, useActionState, useState } from 'react';

import { createPayment } from '@/features/payments/api';

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  onCreated: () => void;
  draft?: {
    payerId: string;
    amount: number;
    description: string;
    shareMemberIds: string[]; // ← 等分対象
  };
};

type FormState = { error: string | null };

type Payload = {
  payerId: string;
  amount: number;
  description: string;
};

export function PaymentForm({ groupId, memberId, members, onCreated, draft }: Props) {
  const [payerId, setPayerId] = useState(draft?.payerId ?? memberId);
  const [amount, setAmount] = useState(draft ? String(draft.amount) : '');
  const [description, setDescription] = useState(draft?.description ?? '');

  const [state, submit, isPending] = useActionState<FormState, Payload>(
    async (_prev, payload) => {
      try {
        await createPayment(groupId, memberId, {
          payerId: payload.payerId,
          amount: payload.amount,
          description: payload.description,
          shares: members.map((m) => ({
            memberId: m.id,
            shareType: 'equal',
            shareValue: 1.0,
          })),
        });
        // 成功: 入力欄をリセットして親に通知
        setAmount('');
        setDescription('');
        onCreated();
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) return;
    // React 19: async action の dispatch は startTransition 内から呼ぶ
    startTransition(() => {
      submit({ payerId, amount: amt, description });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-2 border-ink p-4">
      <h3 className="font-jp-display text-sm tracking-widest">PAYMENT</h3>

      <fieldset className="contents" disabled={isPending}>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs">PAYER</span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="border-2 border-ink p-1 bg-paper font-mono"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs">AMOUNT (JPY)</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-2 border-ink p-1 bg-paper font-mono"
            required
            min={1}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs">DESCRIPTION</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-2 border-ink p-1 bg-paper font-mono"
            maxLength={500}
          />
        </label>
      </fieldset>

      <p className="font-mono text-xs text-rule-grey">
        Phase 1 は均等割固定。比率/金額指定は Phase 1 終盤で追加。
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="bg-ink text-paper font-display p-2 disabled:opacity-50"
      >
        {isPending ? '...' : 'ADD'}
      </button>

      {state.error && (
        <p role="alert" className="text-red font-mono text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
