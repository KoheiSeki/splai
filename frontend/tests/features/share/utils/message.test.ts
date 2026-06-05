import { buildShareMessage, buildShareUrl } from '@/features/share/utils/message';
import { describe, expect, it } from 'vitest';

describe('buildShareUrl', () => {
  it('joins app URL and group id without double slash', () => {
    expect(buildShareUrl('https://splai.app', 'abc-123')).toBe('https://splai.app/g/abc-123');
  });

  it('strips trailing slash from app URL defensively', () => {
    expect(buildShareUrl('https://splai.app/', 'abc-123')).toBe('https://splai.app/g/abc-123');
  });
});

describe('buildShareMessage', () => {
  it('produces title / text / url for Web Share API', () => {
    const msg = buildShareMessage({
      groupName: '渋谷飲み会',
      appUrl: 'https://splai.app',
      groupId: 'abc-123',
    });
    expect(msg.title).toBe('渋谷飲み会 — SPLAI');
    expect(msg.text).toContain('渋谷飲み会');
    expect(msg.text).toContain('SPLAI');
    expect(msg.url).toBe('https://splai.app/g/abc-123');
  });

  it('keeps message under 280 chars (X / SMS friendly)', () => {
    const msg = buildShareMessage({
      groupName: 'A'.repeat(100), // 名前が長くても全体が 280 字以内に収まる
      appUrl: 'https://splai.app',
      groupId: 'abc-123',
    });
    expect(`${msg.text}\n${msg.url}`.length).toBeLessThanOrEqual(280);
  });
});
