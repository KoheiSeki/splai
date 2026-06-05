import { ShareButton } from '@/features/share/components/share-button';
import { LineShareButton } from '@/features/share/components/line-share-button';
import { QrCode } from '@/features/share/components/qr-code';
import { buildShareMessage } from '@/features/share/utils/message';
import { env } from '@/lib/env';

type Props = {
  groupId: string;
  groupName: string;
};

/**
 * グループ URL を共有する Section。
 * - Web Share API ボタン(モバイル / PWA で native dialog)
 * - LINE 共有ボタン
 * - QR コード(対面共有用)
 *
 * `env.NEXT_PUBLIC_APP_URL` は Phase 2 で required に昇格済(lib/env.ts)。
 */
export function ShareSection({ groupId, groupName }: Props) {
  // env.NEXT_PUBLIC_APP_URL は zod で url 検証済 + required(Phase 2 から)
  const message = buildShareMessage({
    groupName,
    appUrl: env.NEXT_PUBLIC_APP_URL!, // required なので non-null 確定
    groupId,
  });

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-4">
      <h3 className="font-jp-display text-sm tracking-widest">SHARE</h3>

      <p className="font-mono text-xs break-all">{message.url}</p>

      <div className="flex flex-wrap gap-2">
        <ShareButton message={message} />
        <LineShareButton url={message.url} text={message.text} />
      </div>

      <details className="font-mono text-xs">
        <summary className="cursor-pointer">QR コード</summary>
        <div className="mt-2">
          <QrCode value={message.url} />
        </div>
      </details>
    </section>
  );
}
