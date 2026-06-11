'use client';

import { useEffect, useState } from 'react';

import type { ShareMessage } from '@/features/share/utils/message';

type Props = {
  message: ShareMessage;
};

const FEEDBACK_TIMEOUT_MS = 2000;

export function ShareButton({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), FEEDBACK_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function onClick() {
    setError(null);
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(message);
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        // それ以外は clipboard fallback に進む
      }
    }
    try {
      await navigator.clipboard.writeText(message.url);
      setCopied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ボタン自体は固定幅。フィードバックは button の下に絶対配置して
  // ボタンの横幅・周辺レイアウトを動かさない。
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        className="w-40 bg-ink text-paper font-display p-2 tracking-[0.2em] hover:bg-ink/85 transition-colors"
      >
        SHARE
      </button>
      {(copied || error) && (
        <p
          role={error ? 'alert' : 'status'}
          className="absolute top-full left-0 mt-1 font-mono text-xs whitespace-nowrap"
        >
          {error ?? 'URL をコピーしました'}
        </p>
      )}
    </div>
  );
}
