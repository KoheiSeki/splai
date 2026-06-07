'use client';

import { env } from '@/lib/env';
import { generateRequestId } from '@/lib/request-id';

export type ChatPaymentInput = {
  groupId: string;
  text: string;
  members: { id: string; name: string }[];
};

export type ChatPaymentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* streamChatPayment(
  input: ChatPaymentInput,
  signal?: AbortSignal,
): AsyncGenerator<ChatPaymentEvent> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/api/ai/chat-payment`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Request-Id': generateRequestId(),
    },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`AI gateway HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      // sse-starlette は `\r\n` 区切り。`\n\n` だけ探すとイベント境界を検出できない。
      buffer += normalizeSseChunk(decoder.decode(value, { stream: true }));
    }

    yield* drainSseBufferEvents(buffer, (next) => {
      buffer = next;
    });

    if (done) {
      yield* flushSseBufferTail(buffer);
      return;
    }
  }
}

/** sse-starlette / uvicorn が返す CRLF を LF に正規化する */
function normalizeSseChunk(chunk: string): string {
  return chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function* drainSseBufferEvents(
  buffer: string,
  setBuffer: (next: string) => void,
): Generator<ChatPaymentEvent> {
  let rest = buffer;
  let idx;
  while ((idx = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, idx).trim();
    rest = rest.slice(idx + 2);
    const event = parseSseBlock(block);
    if (event) yield event;
  }
  setBuffer(rest);
}

function* flushSseBufferTail(buffer: string): Generator<ChatPaymentEvent> {
  const tail = buffer.trim();
  if (!tail) return;
  const event = parseSseBlock(tail);
  if (event) yield event;
}

/** テスト用: SSE 本文全体をパースする */
export function parseSseStreamBody(body: string): ChatPaymentEvent[] {
  let buffer = normalizeSseChunk(body);
  const events: ChatPaymentEvent[] = [];
  for (const event of drainSseBufferEvents(buffer, (next) => {
    buffer = next;
  })) {
    events.push(event);
  }
  events.push(...flushSseBufferTail(buffer));
  return events;
}

function parseSseBlock(block: string): ChatPaymentEvent | null {
  let eventName = '';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }

  if (!eventName) return null;

  let payload: Record<string, unknown> = {};
  if (dataLines.length > 0) {
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      payload = {};
    }
  }

  switch (eventName) {
    case 'text_delta':
      return { type: 'text_delta', text: String(payload.text ?? '') };
    case 'tool_use':
      return {
        type: 'tool_use',
        name: String(payload.name ?? ''),
        input: (payload.input as Record<string, unknown>) ?? {},
      };
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', message: String(payload.message ?? 'unknown') };
    default:
      return null;
  }
}
