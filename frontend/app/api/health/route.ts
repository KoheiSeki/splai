import { apiClient } from '@/lib/api-client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await apiClient.get('/health');
    return NextResponse.json(res.data);
  } catch (err) {
    return NextResponse.json(
      { frontend: 'ok', backend: 'unreachable', error: String(err) },
      { status: 502 },
    );
  }
}
