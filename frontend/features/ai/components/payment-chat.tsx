'use client';

import { startTransition, useActionState, useState } from 'react';

import { streamChatPayment } from '@/features/ai/api';

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  members: Member[];
  onDraft: (draft: {
    payerId: string;
    amount: number;
    description: string;
    shareMemberIds: string[];
  }) => void;
};

type State = { transcript: string; error: string | null };

export function PaymentChat({ groupId, members, onDraft }: Props) {
  const [text, setText] = useState('');

  const [state, submit, isPending] = useActionState<State, string>(
    async (_prev, userText) => {
      let transcript = '';
      try {
        for await (const event of streamChatPayment({
          groupId,
          text: userText,
          members: members.map((m) => ({ id: m.id, name: m.name })),
        })) {
          if (event.type === 'text_delta') {
            transcript += event.text;
          } else if (event.type === 'tool_use' && event.name === 'register_payment') {
            const input = event.input as Record<string, unknown>;
            onDraft({
              payerId: String(input.payer_member_id),
              amount: Number(input.amount),
              description: String(input.description),
              shareMemberIds: (input.share_member_ids as string[]) ?? [],
            });
          } else if (event.type === 'error') {
            return { transcript, error: event.message };
          }
        }
        return { transcript, error: null };
      } catch (e) {
        return {
          transcript,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    { transcript: '', error: null },
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(() => {
      submit(text.trim());
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-2 border-ink p-4">
      {/* AI 動作中は --red を発色させる(設計書 §12.3 のルール) */}
      <h3 className={`font-jp-display text-sm tracking-widest ${isPending ? 'text-red' : ''}`}>
        AI INPUT {isPending && '— working...'}
      </h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 居酒屋 12000 円、A が払って 3 人で割って"
        className="border-2 border-ink p-2 bg-paper font-mono min-h-24"
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending || !text.trim()}
        className={`font-display p-2 disabled:opacity-50 ${
          isPending ? 'bg-red text-paper' : 'bg-ink text-paper'
        }`}
      >
        {isPending ? 'AI が考え中...' : 'AI に登録してもらう'}
      </button>

      {state.transcript && (
        <p className="font-mono text-xs text-rule-grey whitespace-pre-wrap">{state.transcript}</p>
      )}

      {state.error && (
        <p role="alert" className="text-red font-mono text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
