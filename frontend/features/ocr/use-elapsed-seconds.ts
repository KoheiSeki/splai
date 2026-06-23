// frontend/features/ocr/use-elapsed-seconds.ts
//
// `active` が true の間だけ経過秒をカウントするフック。
// false に変わったら 0 にリセット(render 中の prev 比較で effect 内同期 setState を回避)。

'use client';

import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 250;

export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  // active の on/off を render 中に検出してリセット
  // (React 公式パターン:Storing information from previous renders)
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setSeconds(0);
  }

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active]);

  return seconds;
}
