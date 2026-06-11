'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';

import { rewriteShareMessage, type Tone } from '@/features/ai/api';
import { ShareButton } from '@/features/share/components/share-button';
import { QrCode } from '@/features/share/components/qr-code';
import { buildShareMessage } from '@/features/share/utils/message';
import { env } from '@/lib/env';

type Props = { groupId: string; groupName: string };

const TONES: Tone[] = ['casual', 'polite', 'playful'];
const COPY_FEEDBACK_MS = 2000;

export function ShareSection({ groupId, groupName }: Props) {
  const baseMessage = buildShareMessage({
    groupName,
    appUrl: env.NEXT_PUBLIC_APP_URL!,
    groupId,
  });

  // text は編集可能(AI rewrite はドラフトとして書き込む)。
  // 初期値は base、ユーザーが直接編集すると tone は no longer applied になる。
  const [text, setText] = useState(baseMessage.text);
  const [appliedTone, setAppliedTone] = useState<Tone | null>(null);
  const message = { ...baseMessage, text };
  const hasOverride = text !== baseMessage.text;

  const [_state, runRewrite, isRewriting] = useActionState<{ error: string | null }, Tone>(
    async (_prev, tone) => {
      try {
        // 常に **base** から rewrite(連鎖適用にしない:tone を切り替えても安定)。
        const res = await rewriteShareMessage({ text: baseMessage.text, tone });
        setText(res.rewritten);
        setAppliedTone(tone);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // ユーザーが手で編集したら、いずれの tone とも一致しなくなる。
    if (appliedTone !== null) setAppliedTone(null);
  };

  const handleReset = () => {
    setText(baseMessage.text);
    setAppliedTone(null);
  };

  // URL コピー用の独立したフィードバック
  const [urlCopied, setUrlCopied] = useState(false);
  useEffect(() => {
    if (!urlCopied) return;
    const t = window.setTimeout(() => setUrlCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [urlCopied]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(message.url);
      setUrlCopied(true);
    } catch {
      // 失敗時は静かに無視(ShareButton 側に fallback あり)
    }
  };

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-4">
      {/* HEADER */}
      <header className="flex items-baseline justify-between">
        <h3 className="font-jp-display text-sm tracking-widest">SHARE</h3>
        {isRewriting && (
          <span className="font-mono text-xs text-red" role="status">
            rewriting...
          </span>
        )}
      </header>

      {/* MESSAGE BLOCK:textarea + AI tone を 1 ブロックに統合 */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-jp-display text-[10px] tracking-[0.25em] text-ink/60">
            MESSAGE <span className="text-ink/40 ml-1">— 編集できます</span>
          </span>
          <textarea
            value={text}
            onChange={handleTextChange}
            disabled={isRewriting}
            rows={4}
            className="
              w-full font-jp-editorial text-sm leading-relaxed
              border border-rule-grey focus:border-ink
              bg-paper p-2.5 resize-y
              focus:outline-none transition-colors
              disabled:opacity-60
            "
          />
        </label>

        {/* AI tone:textarea の直下、関係性を視覚化 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-jp-display text-[10px] tracking-[0.25em] text-ink/60">AI TONE</span>
          {TONES.map((t) => {
            const active = appliedTone === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => startTransition(() => runRewrite(t))}
                disabled={isRewriting || active}
                aria-pressed={active}
                className={`
                  font-mono text-xs px-2 py-1 border border-ink transition-colors
                  ${active ? 'bg-ink text-paper' : 'hover:bg-ink/5'}
                  ${isRewriting && !active ? 'text-red' : ''}
                  disabled:cursor-not-allowed
                `}
              >
                {t}
              </button>
            );
          })}
          {hasOverride && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isRewriting}
              className="ml-auto font-mono text-xs underline underline-offset-4 decoration-1 hover:text-ink/70 disabled:opacity-40"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* URL + コピーアイコン */}
      <div className="border-t border-rule-grey pt-3 flex items-start gap-2">
        <p className="font-mono text-xs text-ink/60 break-all flex-1 leading-relaxed">
          {message.url}
        </p>
        <button
          type="button"
          onClick={handleCopyUrl}
          aria-label="招待リンクをコピー"
          className="shrink-0 font-mono text-xs px-2 py-1 border border-ink hover:bg-ink/5 transition-colors w-[6ch] text-center"
        >
          {urlCopied ? '✓' : 'copy'}
        </button>
      </div>

      {/* SHARE ボタン(固定幅、フィードバックは絶対配置) */}
      <div className="pt-1">
        <ShareButton message={message} />
      </div>

      {/* QR(他端末からスキャン用) */}
      <details className="font-mono text-xs">
        <summary className="cursor-pointer">QR コード</summary>
        <div className="mt-2">
          <QrCode value={message.url} />
        </div>
      </details>
    </section>
  );
}
