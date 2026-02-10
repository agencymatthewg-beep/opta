import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// ============================================================================
// Mobile Authentication API
// ============================================================================

/**
 * GET /api/mobile/auth/verify
 * Verify the current session is valid for mobile access
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.accessToken) {
            return NextResponse.json(
                { error: "Not authenticated", authenticated: false },
                { status: 401 }
            );
        }

        if (session.error === "RefreshAccessTokenError") {
            return NextResponse.json(
                { error: "Session expired. Please sign in again.", authenticated: false },
                { status: 401 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                name: session.user?.name,
                email: session.user?.email,
                image: session.user?.image,
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
            const session = await auth();

            if (!session?.accessToken) {
                return NextResponse.json(
                    { valid: false, error: "No active session" },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                valid: true,
                expiresAt: null, // Session managed by NextAuth
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
