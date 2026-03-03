import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'guides-manifest.json');

export async function GET() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ published: [], draft: [] }, { status: 500 });
  }
}
