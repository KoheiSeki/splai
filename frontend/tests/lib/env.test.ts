import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('throws when required env var is missing', () => {
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it('returns parsed env when all required vars are present', () => {
    const result = parseEnv({
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
    expect(result.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:8000');
  });
});
