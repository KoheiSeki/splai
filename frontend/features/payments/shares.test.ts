import { describe, expect, it } from 'vitest';
import { distributeEqual, sumIncludedAmounts } from '@/features/payments/utils/shares';

describe('shares', () => {
  it('distributeEqual splits evenly with no remainder', () => {
    // 1000 / 2 = 500 余り 0 → 全員 500
    const rows = distributeEqual(1000, [
      { memberId: 'a', name: 'A', included: true, amount: 0 },
      { memberId: 'b', name: 'B', included: true, amount: 0 },
      { memberId: 'c', name: 'C', included: false, amount: 0 },
    ]);
    expect(sumIncludedAmounts(rows)).toBe(1000);
    expect(rows[0]).toEqual(expect.objectContaining({ memberId: 'a', amount: 500 }));
    expect(rows[1]).toEqual(expect.objectContaining({ memberId: 'b', amount: 500 }));
    expect(rows[2]).toEqual(expect.objectContaining({ memberId: 'c', amount: 0 }));
  });

  it('distributeEqual puts the remainder on the first included member', () => {
    // 1000 / 3 = 333 余り 1 → 先頭に +1 が乗る
    const rows = distributeEqual(1000, [
      { memberId: 'a', name: 'A', included: true, amount: 0 },
      { memberId: 'b', name: 'B', included: true, amount: 0 },
      { memberId: 'c', name: 'C', included: true, amount: 0 },
    ]);
    expect(sumIncludedAmounts(rows)).toBe(1000);
    expect(rows[0]).toEqual(expect.objectContaining({ memberId: 'a', amount: 334 }));
    expect(rows[1]).toEqual(expect.objectContaining({ memberId: 'b', amount: 333 }));
    expect(rows[2]).toEqual(expect.objectContaining({ memberId: 'c', amount: 333 }));
  });

  it('distributeEqual skips excluded members and pushes remainder to the first included one', () => {
    // a を除外、b/c の 2 人で 101 円を割る → 51, 50
    const rows = distributeEqual(101, [
      { memberId: 'a', name: 'A', included: false, amount: 0 },
      { memberId: 'b', name: 'B', included: true, amount: 0 },
      { memberId: 'c', name: 'C', included: true, amount: 0 },
    ]);
    expect(sumIncludedAmounts(rows)).toBe(101);
    expect(rows[0]).toEqual(expect.objectContaining({ memberId: 'a', amount: 0 }));
    expect(rows[1]).toEqual(expect.objectContaining({ memberId: 'b', amount: 51 }));
    expect(rows[2]).toEqual(expect.objectContaining({ memberId: 'c', amount: 50 }));
  });
});
