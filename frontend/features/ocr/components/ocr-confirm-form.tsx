'use client';

import { useActionState, useState } from 'react';

import { createPayment } from '@/features/payments/api';
import { MemberShareEditor } from '@/features/payments/components/member-share-editor';
import {
  buildInitialRows,
  isShareEditorValid,
  MemberShareRow,
  toAmountShareInputs,
} from '@/features/payments/utils/shares';
import type { OcrJobResponse } from '@/features/ocr/api';
import { isOcrJobAlreadyLinkedError } from '@/features/ocr/utils/is-already-linked-error';

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  /** Task 10 の polling で succeeded になった OcrJob。 */
  draft: OcrJobResponse;
  onCreated: () => void;
  /** 「やめる」を押したとき(任意)。 */
  onCancel?: () => void;
};

type FormState = { error: string | null };

export function OcrConfirmForm({ groupId, memberId, members, draft, onCreated, onCancel }: Props) {
  // OCR 結果を初期値として state に取り込む(以降は編集可能)
  const initialDescription = draft.result?.merchantName ?? '';
  const initialAmount = draft.result?.totalAmount ?? 0;

  const [description, setDescription] = useState(initialDescription);
  const [payerId, setPayerId] = useState(memberId); // 撮影者 = 立替者を default
  const [amount, setAmount] = useState<number>(initialAmount);
  const [rows, setRows] = useState<MemberShareRow[]>(() =>
    buildInitialRows(members, initialAmount, null),
  );

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, _formData) => {
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
          ocrJobId: draft.id, // ← OCR 経路のキモ
        });
        onCreated();
        return { error: null };
      } catch (e) {
        // 409 OcrJobAlreadyLinked = 既に同じ ocrJob で登録済み = ユーザー視点では成功
        if (isOcrJobAlreadyLinkedError(e)) {
          onCreated();
          return { error: null };
        }
        return { error: e instanceof Error ? e.message : '登録に失敗しました' };
      }
    },
    { error: null },
  );

  const sharesValid = isShareEditorValid(rows, amount);
  const canSubmit = sharesValid && description.trim().length > 0 && payerId !== '' && amount > 0;

  const rawText = draft.result?.rawText ?? '';

  return (
    <form action={formAction} className="flex flex-col w-full border-2 border-ink p-4">
      <header className="pb-3 mb-4 border-b border-rule-grey">
        <p className="font-jp-display text-[10px] tracking-[0.3em] text-ink/60">
          RECEIPT · OCR 結果を確認
        </p>
        <h2 className="font-display text-2xl mt-1.5 leading-none">CONFIRM PAYMENT</h2>
      </header>

      {/* TITLE(OCR の merchantName が初期値) */}
      <label className="flex flex-col gap-1.5 pb-5 border-b border-rule-grey">
        <span className="font-jp-display text-[11px] tracking-[0.25em]">
          TITLE <span className="text-ink/50 ml-1">— 店名 / 内容</span>
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例:居酒屋A"
          maxLength={500}
          required
          disabled={isPending}
          className="border-0 border-b-2 border-ink/20 focus:border-ink bg-transparent font-mono py-2 text-base placeholder:text-ink/25 focus:outline-none transition-colors disabled:opacity-40"
        />
      </label>

      {/* PAYER + AMOUNT */}
      <div className="grid grid-cols-[1fr_1.4fr] gap-5 py-5 border-b border-rule-grey">
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="font-jp-display text-[11px] tracking-[0.25em]">
            PAID BY <span className="text-ink/50 ml-1">— 支払者</span>
          </span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            disabled={isPending}
            className="border-0 border-b-2 border-ink/20 focus:border-ink bg-transparent font-mono py-2 text-base focus:outline-none disabled:opacity-40"
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
            AMOUNT <span className="text-ink/50 ml-1">— 合計 / JPY</span>
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

      {/* SHARES — 手動と同じ editor */}
      <section className="py-5 border-b border-rule-grey">
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

      {/* RAW TEXT(検証用、開閉可能) */}
      {rawText && (
        <details className="py-3 font-mono text-xs">
          <summary className="cursor-pointer font-jp-display text-[11px] tracking-[0.25em] text-ink/60">
            RAW TEXT — OCR 読み取り結果を見る
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-ink/70 bg-rule-grey/20 p-2">{rawText}</pre>
        </details>
      )}

      {/* エラー(editorial left-rule、--red は使わない) */}
      {state.error && (
        <p
          role="alert"
          className="border-l-4 border-ink pl-3 py-2 mt-3 font-jp-display text-sm leading-snug"
        >
          {state.error}
        </p>
      )}

      {/* SUBMIT + CANCEL */}
      <div className="flex flex-col gap-2 mt-4">
        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="
            bg-ink text-paper font-display text-base tracking-[0.2em] py-4
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
              <span>CONFIRM &amp; SAVE</span>
              <span aria-hidden>→</span>
            </>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="font-mono text-xs underline self-center disabled:opacity-40"
          >
            やめる
          </button>
        )}
      </div>
    </form>
  );
}
