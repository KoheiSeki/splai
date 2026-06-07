import { describe, expect, it } from 'vitest';

import { parseSseStreamBody } from '@/features/ai/api';

/** sse-starlette が返す典型形式(CRLF 区切り) */
const CRLF_SSE_BODY =
  'event: text_delta\r\n' +
  'data: {"text": "了解"}\r\n' +
  '\r\n' +
  'event: done\r\n' +
  'data: {}\r\n' +
  '\r\n';

describe('parseSseStreamBody', () => {
  it('parses sse-starlette CRLF events', () => {
    const events = parseSseStreamBody(CRLF_SSE_BODY);
    expect(events).toEqual([{ type: 'text_delta', text: '了解' }, { type: 'done' }]);
  });

  it('parses error events from upstream failures', () => {
    const body =
      'event: error\r\n' + 'data: {"message": "upstream API error: budget exceeded"}\r\n' + '\r\n';

    const events = parseSseStreamBody(body);
    expect(events).toEqual([{ type: 'error', message: 'upstream API error: budget exceeded' }]);
  });
});
