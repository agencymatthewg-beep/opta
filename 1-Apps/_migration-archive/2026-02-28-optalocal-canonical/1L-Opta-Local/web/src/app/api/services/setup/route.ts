import { NextResponse } from 'next/server';
import { daemonAdminRequest } from '@/lib/daemon-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let payload: unknown = {};

  try {
    const rawBody = await request.text();
    if (rawBody) {
      payload = JSON.parse(rawBody) as unknown;
    }
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  try {
    const response = await daemonAdminRequest('/v3/services/setup', {
      method: 'POST',
      json: payload,
    });

    return NextResponse.json(response.body, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach local daemon' },
      { status: 502 },
    );
  }
}
