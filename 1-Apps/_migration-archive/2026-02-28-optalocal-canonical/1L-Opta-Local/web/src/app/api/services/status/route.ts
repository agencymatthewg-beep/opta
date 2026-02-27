import { NextResponse } from 'next/server';
import { daemonAdminRequest } from '@/lib/daemon-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await daemonAdminRequest('/v3/services/status', {
      method: 'GET',
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
