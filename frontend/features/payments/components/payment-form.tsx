'use client';
import { useActionState, useState } from 'react';

import { createPayment } from '@/features/payments/api';
import {
  buildInitialRows,
  isShareEditorValid,
  MemberShareRow,
  toAmountShareInputs,
} from '../utils/shares';
import { MemberShareEditor } from './member-share-editor';

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

export function PaymentForm({ groupId, memberId, members, onCreated, draft }: Props) {
  const [description, setDescription] = useState(draft?.description ?? '');
  const [payerId, setPayerId] = useState(draft?.payerId ?? members[0]?.id ?? '');
  const [amount, setAmount] = useState<number>(draft?.amount ?? 0);
  const [rows, setRows] = useState<MemberShareRow[]>(() =>
    buildInitialRows(members, draft?.amount ?? 0, draft?.shareMemberIds ?? null),
  );

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prevState, _formData) => {
      const trimmedDescription = description.trim();
      if (!trimmedDescription) return { error: '内容を入力してください' };
      if (!payerId) return { error: '支払者を選択してください' };
      if (amount <= 0) return { error: '金額は 1 円以上で入力してください' };
      if (!isShareEditorValid(rows, amount)) {
        return {
          error:
            '分担合計が支払額と一致しません(参加者を 1 人以上選び、合計を支払額に揃えてください)',
        };
      }

      try {
        await createPayment(groupId, memberId, {
          payerId,
          amount,
          description: trimmedDescription,
          shares: toAmountShareInputs(rows),
        });
        onCreated();
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : '登録に失敗しました' };
      }
    },
    { error: null },
  );

  const sharesValid = isShareEditorValid(rows, amount);
  const canSubmit = sharesValid && description.trim().length > 0 && payerId !== '' && amount > 0;

  // 共通の input/select base class:罫線下線スタイル(editorial underline input)
  const fieldBase =
    'border-0 border-b-2 border-ink/20 focus:border-ink bg-transparent font-mono py-2 ' +
    'placeholder:text-ink/25 focus:outline-none transition-colors ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <form action={formAction} className="flex flex-col w-full border-2 border-ink p-4">
      {/* ─────────── HEADER(box の中なので border-b は細線で) ─────────── */}
      <header className="pb-3 mb-4 border-b border-rule-grey">
        <p className="font-jp-display text-[10px] tracking-[0.3em] text-ink/60">
          BILL · 支払い登録
        </p>
        <h2 className="font-display text-2xl mt-1.5 leading-none">ADD PAYMENT</h2>
      </header>

      {/* ─────────── TITLE ─────────── */}
      <label className="flex flex-col gap-1.5 pb-5 border-b border-rule-grey">
        <span className="font-jp-display text-[11px] tracking-[0.25em]">
          TITLE <span className="text-ink/50 ml-1">— 内容</span>
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例:居酒屋"
          maxLength={500}
          required
          disabled={isPending}
          className={`${fieldBase} text-base`}
        />
      </label>

      {/* ─────────── PAYER + AMOUNT(編集的 split) ─────────── */}
      <div className="grid grid-cols-[1fr_1.4fr] gap-5 py-5 border-b border-rule-grey">
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="font-jp-display text-[11px] tracking-[0.25em]">
            PAID BY <span className="text-ink/50 ml-1">— 支払者</span>
          </span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            disabled={isPending}
            className={`${fieldBase} text-base appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%230a0a0a' stroke-width='1.5'/></svg>")] bg-no-repeat bg-[right_0.25rem_center] pr-5`}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="font-jp-display text-[11px] tracking-[0.25em]">
            AMOUNT <span className="text-ink/50 ml-1">— 支払い総額 / JPY</span>
          </span>
          <div className="flex items-baseline gap-1.5 border-b-2 border-ink/20 focus-within:border-ink transition-colors">
            <span className="font-display text-2xl text-ink/30 leading-none pb-1">¥</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount === 0 ? '' : amount}
              onChange={(e) => setAmount(Number.parseInt(e.target.value, 10) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              disabled={isPending}
              className="flex-1 min-w-0 border-0 bg-transparent font-display text-3xl leading-none py-1 text-right placeholder:text-ink/20 focus:outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </label>
      </div>

      {/* ─────────── SHARES(最後のセクションは下罫線なし、submit と密着) ─────────── */}
      <section className="py-5">
        <p className="font-jp-display text-[11px] tracking-[0.25em] mb-3">
          SHARES <span className="text-ink/50 ml-1">— 誰がいくら払う</span>
        </p>
        <MemberShareEditor
          rows={rows}
          onChange={setRows}
          paymentAmount={amount}
          disabled={isPending}
        />
      </section>

      {/* ─────────── ERROR(editorial left rule) ─────────── */}
      {state.error && (
        <p
          role="alert"
          className="border-l-4 border-ink pl-3 py-2 mt-5 font-jp-display text-sm leading-snug"
        >
          {state.error}
        </p>
      )}

      {/* ─────────── SUBMIT ─────────── */}
      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="
          mt-6 bg-ink text-paper font-display text-base tracking-[0.2em] py-4
          hover:bg-ink/85 active:bg-ink
          disabled:bg-paper disabled:text-ink/30 disabled:border-2 disabled:border-rule-grey
          disabled:cursor-not-allowed transition-colors
          flex items-center justify-center gap-3
        "
      >
        {isPending ? (
          <span className="font-mono">···</span>
        ) : (
          <>
            <span>ADD PAYMENT</span>
            <span aria-hidden>→</span>
          </>
        )}
      </button>
    </form>
  );
}
