import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Mobile Authentication API
// ============================================================================

/**
 * GET /api/mobile/auth/verify
 * Verify the current session is valid for mobile access
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json(
                { error: "Not authenticated", authenticated: false },
                { status: 401 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                name: user.user_metadata?.name || user.email?.split("@")[0],
                email: user.email,
                image: user.user_metadata?.avatar_url || null,
            },
        });
    } catch (error) {
        console.error("Auth verification error:", error);
        return NextResponse.json(
            { error: "Authentication check failed", authenticated: false },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mobile/auth/token
 * Exchange credentials or validate token for mobile session
 * This endpoint is for future mobile-specific auth flows
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === "validate") {
            const supabase = await createClient();
            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error || !session) {
                return NextResponse.json(
                    { valid: false, error: "No active session" },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                valid: true,
                expiresAt: session.expires_at || null,
            });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Auth token error:", error);
        return NextResponse.json(
            { error: "Token operation failed" },
            { status: 500 }
        );
    }
}
