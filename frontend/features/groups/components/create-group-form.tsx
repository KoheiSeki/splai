'use client';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { createGroup } from '@/features/groups/api';
import { setMemberId } from '@/lib/auth/member-storage';

type FormState = { error: string | null };

export function CreateGroupForm() {
  const router = useRouter();

  // 入力は controlled(state は通常通り)
  const [name, setName] = useState('');
  const [members, setMembers] = useState(['', '']);

  // action: 前 state と payload を受け取り、新 state を返す reducer 風関数。
  // useActionState が内部で startTransition 相当の処理をラップしており、
  // 呼び出し側は `submit(payload)` するだけで isPending / state が連動する。
  const [state, submit, isPending] = useActionState<
    FormState,
    { name: string; memberNames: string[] }
  >(
    async (_prev, payload) => {
      try {
        const res = await createGroup(payload);
        if (res.creatorMemberId) {
          setMemberId(res.id, res.creatorMemberId);
        }
        router.push(`/g/${res.id}`);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const memberNames = members.map((s) => s.trim()).filter((s) => s.length > 0);
    // useActionState は内部で transition を張るので、ここで `await` しない。
    // 結果は state(state.error)と isPending 経由で UI に反映される。
    submit({ name: name.trim(), memberNames });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md w-full">
      <label className="flex flex-col gap-1">
        <span className="font-jp-display text-xs tracking-widest">GROUP NAME</span>
        <input
          className="border-2 border-ink p-2 bg-paper font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          disabled={isPending}
        />
      </label>

      <fieldset className="flex flex-col gap-1" disabled={isPending}>
        <legend className="font-jp-display text-xs tracking-widest">MEMBERS</legend>
        {members.map((m, i) => (
          <input
            key={i}
            className="border-2 border-ink p-2 bg-paper font-mono"
            value={m}
            onChange={(e) =>
              setMembers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
            }
            placeholder={`Member ${i + 1}`}
            maxLength={50}
          />
        ))}
        <button
          type="button"
          className="font-mono text-xs underline self-start"
          onClick={() => setMembers((p) => [...p, ''])}
        >
          + add member
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="bg-ink text-paper font-display p-3 disabled:opacity-50"
      >
        {isPending ? '...' : 'CREATE'}
      </button>

      {state.error && (
        <p role="alert" className="text-red font-mono text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
