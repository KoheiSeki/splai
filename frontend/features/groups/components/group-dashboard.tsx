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
import { OcrJobResponse } from '@/features/ocr/api';
import { OcrConfirmForm } from '@/features/ocr/components/ocr-confirm-form';
import { ReceiptUpload } from '@/features/ocr/components/receipt-upload';

type Props = { groupId: string };
type Tab = 'form' | 'chat' | 'ocr';

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

  const [tab, setTab] = useState<Tab>('form');
  const [ocrDraft, setOcrDraft] = useState<OcrJobResponse | null>(null);

  const onChange = () => {
    void reload();
    setRefreshKey((k) => k + 1);
  };

  // tab を切り替えたら ocrDraft はリセット(別タブで確認画面を残さない)
  const switchTab = (next: Tab) => {
    if (next !== 'ocr') setOcrDraft(null);
    setTab(next);
  };

  // 登録成功 → group reload + ocrDraft クリア + form タブに戻る
  const handleOcrCreated = () => {
    setOcrDraft(null);
    setTab('form');
    onChange();
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
          {(['form', 'chat', 'ocr'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`font-mono text-xs px-2 py-1 ${
                tab === t ? 'bg-ink text-paper' : 'border border-ink'
              }`}
            >
              {t === 'form' ? 'FORM' : t === 'chat' ? 'AI CHAT' : 'OCR'}
            </button>
          ))}
        </div>

        {tab === 'form' && (
          <PaymentForm
            groupId={groupId}
            memberId={memberId}
            members={data.members}
            onCreated={onChange}
            draft={draft ?? undefined}
          />
        )}

        {tab === 'chat' && (
          <PaymentChat
            groupId={groupId}
            members={data.members}
            onDraft={(d) => {
              setDraft(d);
              setTab('form');
            }}
          />
        )}

        {tab === 'ocr' && (
          <div className="flex flex-col gap-4">
            <ReceiptUpload groupId={groupId} memberId={memberId} onSucceeded={setOcrDraft} />
            {ocrDraft && (
              <OcrConfirmForm
                groupId={groupId}
                memberId={memberId}
                members={data.members}
                draft={ocrDraft}
                onCreated={handleOcrCreated}
                onCancel={() => setOcrDraft(null)}
              />
            )}
          </div>
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
