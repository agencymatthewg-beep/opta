import { NextResponse } from 'next/server';
import { MANAGED_WEBSITES } from '../../lib/websites';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'opta-admin',
    managedWebsites: MANAGED_WEBSITES.length,
    checkedAt: new Date().toISOString(),
  });
}
