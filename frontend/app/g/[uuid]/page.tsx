import { use } from 'react';

import { GroupDashboard } from '@/features/groups/components/group-dashboard';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const { uuid } = await params;
  // 注: backend に X-Member-Id を渡せないので、ここではグループ名を取れない。
  //     Task 9 と同じく generic な title / description を返す。
  //     将来的に「メタ情報のみ返す公開 endpoint」を作れば差し替え可能。
  return {
    title: 'SPLAI — 割り勘、終わってます',
    description: '友達と割り勘を記録・清算するアプリ。',
    openGraph: {
      type: 'website',
      title: 'SPLAI',
      description: '割り勘、終わってます。',
      // og:image は opengraph-image.tsx が自動的に設定
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SPLAI',
      description: '割り勘、終わってます。',
    },
    alternates: {
      canonical: `/g/${uuid}`,
    },
  };
}

export default function GroupPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  return <GroupDashboard groupId={uuid} />;
}
