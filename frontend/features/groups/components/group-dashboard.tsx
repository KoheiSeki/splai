'use client';

import { useGroup } from '@/features/groups/use-group';
import { useMemberStorage } from '@/hooks/use-member-storage';

import { MemberSelect } from './member-select';
import { PaymentForm } from '@/features/payments/components/payment-form';
// 後の Task で追加されるコンポーネント:
// import { PaymentForm } from '@/features/payments/components/payment-form';
// import { PaymentList } from '@/features/payments/components/payment-list';
// import { SettlementView } from '@/features/settlement/components/settlement-view';

type Props = { groupId: string };

export function GroupDashboard({ groupId }: Props) {
  const { memberId, setMemberId } = useMemberStorage(groupId);
  const { data, isPending, reload } = useGroup(groupId, memberId);

  // メンバー未選択
  if (!memberId) {
    if (isPending) return <p className="font-mono p-8">loading...</p>;
    if (!data) {
      // データが無い = まだ取得していない。public 取得 endpoint がないので
      // Phase 1 では「最低 1 人のメンバーがいる」前提に倒す
      return <p className="font-mono p-8">グループが見つかりません。URL を確認してください。</p>;
    }
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <MemberSelect groupId={groupId} members={data.members} onSelect={setMemberId} />
      </main>
    );
  }

  // ダッシュボード
  if (isPending || !data) return <p className="font-mono p-8">loading...</p>;

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h1 className="font-jp-display text-2xl">{data.name}</h1>
        <p className="font-mono text-xs">{data.members.length}名</p>
      </header>

      {/* Phase 1 後続 Task で埋めていく */}
      <section className="flex flex-col gap-4">
        <PaymentForm
          groupId={groupId}
          memberId={memberId}
          members={data.members}
          onCreated={reload}
        />
      </section>
    </main>
  );
}
