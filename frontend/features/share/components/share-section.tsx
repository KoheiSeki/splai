'use client';

import { startTransition, useActionState, useState } from 'react';

import { rewriteShareMessage, type Tone } from '@/features/ai/api';
import { ShareButton } from '@/features/share/components/share-button';
import { LineShareButton } from '@/features/share/components/line-share-button';
import { QrCode } from '@/features/share/components/qr-code';
import { buildShareMessage } from '@/features/share/utils/message';
import { env } from '@/lib/env';

type Props = { groupId: string; groupName: string };

export function ShareSection({ groupId, groupName }: Props) {
  const baseMessage = buildShareMessage({
    groupName,
    appUrl: env.NEXT_PUBLIC_APP_URL!,
    groupId,
  });

  const [textOverride, setTextOverride] = useState<string | null>(null);
  const message = textOverride ? { ...baseMessage, text: textOverride } : baseMessage;

  const [_, runRewrite, isRewriting] = useActionState<{ error: string | null }, Tone>(
    async (_prev, tone) => {
      try {
        const res = await rewriteShareMessage({ text: message.text, tone });
        setTextOverride(res.rewritten);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-4">
      <h3 className={`font-jp-display text-sm tracking-widest ${isRewriting ? 'text-red' : ''}`}>
        SHARE {isRewriting && '— rewriting...'}
      </h3>

      <p className="font-mono text-xs break-all">{message.url}</p>
      <p className="font-jp-editorial text-sm">{message.text}</p>

      <div className="flex flex-wrap gap-2">
        <ShareButton message={message} />
        <LineShareButton url={message.url} text={message.text} />
      </div>

      {/* AI tone ボタン群 */}
      <div className="flex flex-wrap gap-2 border-t border-rule-grey pt-2">
        <span className="font-mono text-xs self-center">tone:</span>
        {(['casual', 'polite', 'playful'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => startTransition(() => runRewrite(t))}
            disabled={isRewriting}
            className={`font-mono text-xs px-2 py-1 border border-ink ${
              isRewriting ? 'text-red' : ''
            }`}
          >
            {t}
          </button>
        ))}
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
