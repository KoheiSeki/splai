'use client';

import {
  distributeEqual,
  sumIncludedAmounts,
  type MemberShareRow,
} from '@/features/payments/utils/shares';

type Props = {
  rows: MemberShareRow[];
  onChange: (next: MemberShareRow[]) => void;
  paymentAmount: number;
  /** 親フォーム submit 中に編集を抑止する。 */
  disabled?: boolean;
};

export function MemberShareEditor({ rows, onChange, paymentAmount, disabled = false }: Props) {
  const total = sumIncludedAmounts(rows);
  const diff = total - paymentAmount;
  const matched = diff === 0 && paymentAmount > 0;
  const includedCount = rows.filter((r) => r.included).length;

  const setRow = (idx: number, patch: Partial<MemberShareRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const equalize = () => {
    onChange(distributeEqual(paymentAmount, rows));
  };

  // ledger fill ratio:0–100% に clamp(超過分は別表示)
  const fillRatio = paymentAmount > 0 ? Math.min(total / paymentAmount, 1) : 0;

  return (
    <div>
      {/* ─────────── ROWS(ledger 風) ─────────── */}
      <ul className="border-t border-ink/15 divide-y divide-ink/10">
        {rows.map((row, idx) => (
          <li
            key={row.memberId}
            className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5 transition-opacity ${
              row.included ? '' : 'opacity-40'
            }`}
          >
            {/* checkbox(SPLAI brand:角ばった custom check) */}
            <label className="relative flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={row.included}
                disabled={disabled}
                onChange={(e) =>
                  setRow(idx, {
                    included: e.target.checked,
                    amount: e.target.checked ? row.amount : 0,
                  })
                }
                aria-label={`${row.name} を分担に含める`}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="
                  w-4 h-4 border-2 border-ink bg-paper
                  flex items-center justify-center
                  peer-checked:bg-ink peer-checked:text-paper
                  peer-disabled:opacity-40 peer-disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {row.included && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className="stroke-paper"
                    strokeWidth="2"
                    fill="none"
                  >
                    <path d="M1.5 5l2.5 2.5L8.5 2" />
                  </svg>
                )}
              </span>
            </label>

            {/* name */}
            <span className="font-mono text-sm truncate">{row.name}</span>

            {/* amount input(右寄せ underline) */}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={row.amount === 0 ? '' : row.amount}
              disabled={!row.included || disabled}
              onChange={(e) => setRow(idx, { amount: Number.parseInt(e.target.value, 10) || 0 })}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              aria-label={`${row.name} の負担額`}
              className="
                w-24 text-right font-mono py-1 px-1 bg-transparent
                border-0 border-b border-ink/20 focus:border-ink
                focus:outline-none transition-colors
                placeholder:text-ink/25
                disabled:opacity-40 disabled:cursor-not-allowed
                [appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none
              "
            />
            <span className="font-jp-display text-[10px] tracking-[0.2em] text-ink/50">JPY</span>
          </li>
        ))}
      </ul>

      {/* ─────────── LEDGER FOOTER ─────────── */}
      <div className="mt-3 pt-3 border-t-2 border-ink">
        {/* progress track(視覚的進捗) */}
        <div className="relative h-[3px] bg-rule-grey/50 mb-3" aria-hidden>
          <div
            className={`absolute inset-y-0 left-0 transition-all ${
              matched ? 'bg-ink' : 'bg-ink/40'
            }`}
            style={{ width: `${fillRatio * 100}%` }}
          />
          {/* 100% 目印 */}
          <div className="absolute inset-y-[-2px] right-0 w-px bg-ink" />
        </div>

        {/* sum vs payment(右寄せ ledger) */}
        <div className="flex items-baseline justify-between gap-4">
          <button
            type="button"
            onClick={equalize}
            disabled={disabled || includedCount === 0 || paymentAmount <= 0}
            className="
              font-jp-display text-[11px] tracking-[0.25em]
              underline underline-offset-4 decoration-1
              hover:text-ink/70 disabled:no-underline
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors
            "
          >
            ⇄ EVEN SPLIT
          </button>

          <div className="flex items-baseline gap-2 font-mono text-sm">
            <span className="font-jp-display text-[10px] tracking-[0.25em] text-ink/60 mr-1">
              SUM
            </span>
            <span className={matched ? 'font-display text-base' : ''}>
              ¥{total.toLocaleString()}
            </span>
            <span className="text-ink/30 mx-0.5">/</span>
            <span>¥{paymentAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 差分 / 警告(editorial left-rule) */}
        {!matched && includedCount > 0 && paymentAmount > 0 && (
          <p className="mt-3 border-l-2 border-ink pl-3 flex items-baseline gap-2.5">
            <span className="font-jp-display text-[10px] tracking-[0.25em] text-ink/60">
              {diff > 0 ? 'OVER' : 'SHORT'}
            </span>
            <span className="font-display text-lg leading-none">
              {diff > 0 ? '+' : '−'}¥{Math.abs(diff).toLocaleString()}
            </span>
            <span className="font-jp-display text-[11px] text-ink/60 ml-auto">
              {diff > 0 ? '超過' : '不足'}
            </span>
          </p>
        )}

        {includedCount === 0 && (
          <p className="mt-3 border-l-2 border-ink pl-3 font-jp-display text-xs">
            参加者を 1 人以上選択してください
          </p>
        )}
      </div>
    </div>
  );
}
