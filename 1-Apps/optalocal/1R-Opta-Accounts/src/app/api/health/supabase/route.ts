import { NextResponse } from 'next/server';
import { runSupabaseHealthCheck } from './health';

export async function GET(request: Request) {
  const { payload, status } = await runSupabaseHealthCheck(request);
  return NextResponse.json(payload, { status });
}
