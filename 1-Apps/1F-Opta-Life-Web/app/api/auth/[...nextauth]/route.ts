// DEPRECATED: NextAuth handlers no longer used
// Supabase Auth is now handling authentication
// This route is kept for backward compatibility but will redirect to Supabase

import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ error: "NextAuth is deprecated. Please use Supabase auth." }, { status: 410 });
}

export async function POST() {
    return NextResponse.json({ error: "NextAuth is deprecated. Please use Supabase auth." }, { status: 410 });
}
