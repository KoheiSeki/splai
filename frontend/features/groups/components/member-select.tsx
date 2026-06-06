'use client';
import { startTransition, useActionState, useState } from 'react';

import { addMemberApiGroupsGroupIdMembersPost } from '@/lib/api/gen/clients/membersController/addMemberApiGroupsGroupIdMembersPost';

type Props = {
  groupId: string;
  members: { id: string; name: string }[];
  onSelect: (memberId: string) => void;
};

type AddState = { error: string | null };

export function MemberSelect({ groupId, members, onSelect }: Props) {
  const [newName, setNewName] = useState('');

  const [state, addMember, isPending] = useActionState<AddState, string>(
    async (_prev, name) => {
      // 「あなたは誰?」の段階ではまだ X-Member-Id が無い → 暫定で 1 人目の id を借りる戦略。
      // MVP では members[0] を一時的な actor として使う(設計書 §6.3 のハイブリッド)。
      const actor = members[0]?.id;
      if (!actor) {
        // メンバーが 1 人もいない初期状態(memberNames=[] で作成したケース)。
        // POST /members は X-Member-Id 必須なので、Phase 5 で「初回限定の wildcard」を検討。
        return {
          error:
            '初期メンバーが居ません。Landing からメンバー名を 1 名以上入れて作成し直してください。',
        };
      }
      try {
        // kubb は OpenAPI の Header パラメータ(X-Member-Id)を第 3 positional 引数として独立させる。
        // axios config の `headers` ではなく直接ヘッダオブジェクトを渡す。
        const res = await addMemberApiGroupsGroupIdMembersPost(
          groupId,
          { name },
          { 'X-Member-Id': actor },
        );
        onSelect(res.id);
        setNewName('');
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    // React 19: async action の dispatch は startTransition 内から呼ぶ
    startTransition(() => {
      addMember(trimmed);
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm w-full">
      <h2 className="font-jp-display text-xl">ユーザーを選択してください</h2>

      {members.length > 0 && (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className="border-2 border-ink p-2 w-full text-left font-mono"
                disabled={isPending}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="border-t border-rule-grey pt-3 flex flex-col gap-2">
        <p className="font-mono text-xs">ユーザーがいない場合は新規追加:</p>
        <input
          className="border-2 border-ink p-2 bg-paper font-mono"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !newName.trim()}
          className="bg-ink text-paper font-display p-2 disabled:opacity-50"
        >
          {isPending ? '...' : 'ADD ME'}
        </button>
        {state.error && (
          <p role="alert" className="text-red font-mono text-xs">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
