import { ImageResponse } from 'next/og';

import { getGroupApiGroupsGroupIdGet } from '@/lib/api/gen/clients/groupsController/getGroupApiGroupsGroupIdGet';

// Edge runtime は ImageResponse のために必須
export const runtime = 'edge';

// SNS 標準サイズ(1.91:1 比、Twitter / Facebook 共通)
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// このルートは認可なしの公開 endpoint(SNS クローラからアクセスされるため)。
// backend は X-Member-Id 必須の `GET /api/groups/{id}` しかないので、
// Phase 2 では「グループ名が取れなかった場合は generic な画像を返す」方針にする。
// (Phase 5 で公開 metadata endpoint を作る選択肢もあり)

async function fetchGroupName(groupId: string): Promise<string | null> {
  // SNS クローラ向けには backend 呼ばずに groupId だけで OG 画像を作る方針。
  // 必要であれば Phase 後半で「メタ情報のみ返す公開 endpoint」を追加する。
  return null;
}

export default async function OpengraphImage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const groupName = await fetchGroupName(uuid);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: '#F4F1E8', // paper
        color: '#0A0A0A', // ink
      }}
    >
      {/* 上部: ロゴ */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'system-ui',
          fontWeight: 900,
          fontSize: 96,
        }}
      >
        SPL[AI].
      </div>

      {/* 中央: グループ名 or generic タグライン */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {groupName ? (
          <div style={{ fontSize: 64, fontFamily: 'system-ui', fontWeight: 700 }}>{groupName}</div>
        ) : (
          <div style={{ fontSize: 56, fontFamily: 'system-ui', fontWeight: 700 }}>
            割り勘、終わってます。
          </div>
        )}
      </div>

      {/* 下部: 罫線 + URL ヒント */}
      <div
        style={{
          borderTop: '4px solid #0A0A0A',
          paddingTop: 24,
          fontSize: 28,
          fontFamily: 'monospace',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>splai.app</span>
        <span>/g/{uuid.slice(0, 8)}…</span>
      </div>
    </div>,
    { ...size },
  );
}
