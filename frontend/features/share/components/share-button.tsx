'use client';

import { useState } from 'react';

import type { ShareMessage } from '@/features/share/utils/message';

type Props = {
  message: ShareMessage;
};

export function ShareButton({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    // Web Share API が使える(かつ HTTPS / トリガが user gesture 内)なら優先
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(message);
        return;
      } catch (e) {
        // ユーザーが share シートを閉じた場合は AbortError → 何もしない
        if (e instanceof Error && e.name === 'AbortError') return;
        // それ以外のエラーは clipboard fallback に進む
      }
    }
    // fallback: clipboard
    try {
      await navigator.clipboard.writeText(message.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={onClick} className="bg-ink text-paper font-display p-2">
        SHARE
      </button>
      {copied && (
        <p role="status" className="font-mono text-xs">
          URL をコピーしました
        </p>
      )}
      {error && (
        <p role="alert" className="font-mono text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
