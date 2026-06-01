import { beforeEach, describe, expect, it } from 'vitest';

import { getMemberId, setMemberId, clearMemberId } from '@/lib/auth/member-storage';

describe('member-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no member id stored for group', () => {
    expect(getMemberId('group-1')).toBeNull();
  });

  it('stores and retrieves member id per group', () => {
    setMemberId('group-1', 'member-a');
    setMemberId('group-2', 'member-b');
    expect(getMemberId('group-1')).toBe('member-a');
    expect(getMemberId('group-2')).toBe('member-b');
  });

  it('clears member id for specific group', () => {
    setMemberId('group-1', 'member-a');
    clearMemberId('group-1');
    expect(getMemberId('group-1')).toBeNull();
  });
});
