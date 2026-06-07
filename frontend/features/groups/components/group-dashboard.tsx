'use client';

import { useGroup } from '@/features/groups/use-group';
import { useMemberStorage } from '@/hooks/use-member-storage';

import { MemberSelect } from './member-select';
import { PaymentForm } from '@/features/payments/components/payment-form';
import { PaymentList } from '@/features/payments/components/payment-list';
import { SettlementView } from '@/features/settlement/components/settlement-view';
import { useState } from 'react';
import { ShareSection } from '@/features/share/components/share-section';
import { PaymentChat } from '@/features/ai/components/payment-chat';

type Props = { groupId: string };

export function GroupDashboard({ groupId }: Props) {
  const { memberId, setMemberId } = useMemberStorage(groupId);
  const { data, isPending, reload } = useGroup(groupId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<{
    payerId: string;
    amount: number;
    description: string;
    shareMemberIds: string[];
  } | null>(null);

  const [tab, setTab] = useState<'form' | 'chat'>('form');

  const onChange = () => {
    void reload();
    setRefreshKey((k) => k + 1);
  };

  // ロード中
  if (isPending && !data) return <p className="font-mono p-8">loading...</p>;
  // グループが見つからない場合
  if (!data)
    return <p className="font-mono p-8">グループが見つかりません。URL を確認してください。</p>;

  // データはある、memberId なし → MemberSelect で「あなたは誰?」
  if (!memberId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <MemberSelect groupId={groupId} members={data.members} onSelect={setMemberId} />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h1 className="font-jp-display text-2xl">{data.name}</h1>
        <p className="font-mono text-xs">{data.members.length}名</p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('form')}
            className={`font-mono text-xs px-2 py-1 ${tab === 'form' ? 'bg-ink text-paper' : 'border border-ink'}`}
          >
            FORM
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`font-mono text-xs px-2 py-1 ${tab === 'chat' ? 'bg-ink text-paper' : 'border border-ink'}`}
          >
            AI CHAT
          </button>
        </div>
        {tab === 'chat' ? (
          <PaymentChat
            groupId={groupId}
            members={data.members}
            onDraft={(d) => {
              setDraft(d);
              setTab('form'); // 入力後はフォームに切り替えて確認させる
            }}
          />
        ) : (
          <PaymentForm
            groupId={groupId}
            memberId={memberId}
            members={data.members}
            onCreated={onChange}
            draft={draft ?? undefined}
          />
        )}

        <PaymentList
          groupId={groupId}
          memberId={memberId}
          members={data.members}
          payments={data.payments}
          onChange={onChange}
        />
        <SettlementView
          groupId={groupId}
          memberId={memberId}
          members={data.members}
          refreshKey={refreshKey}
        />
        <ShareSection groupId={data.id} groupName={data.name} />
      </section>
    </main>
  );
}
