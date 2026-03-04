import { NextResponse } from 'next/server';
import { buildAdminOpsSnapshot } from '../../lib/adminOps';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await buildAdminOpsSnapshot();
    return NextResponse.json(snapshot, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        actions: [],
        statusProbe: {
          source: 'status-api',
          status: 'unknown',
          checkedAt: new Date().toISOString(),
          error: 'Unable to assemble admin operations snapshot.',
        },
        featureRegistry: {
          source: 'feature-audit:error',
          topGaps: [],
          error: 'Unable to load feature registry snapshot.',
        },
      },
      { status: 200 }
    );
  }
}
