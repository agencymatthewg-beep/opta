import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Extend the JWT type to include our custom fields
declare module "next-auth" {
    interface Session {
        accessToken?: string
        error?: string
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        accessToken?: string
        refreshToken?: string
        expiresAt?: number
        error?: string
    }
}

async function refreshAccessToken(token: any) {
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw refreshedTokens
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        }
    } catch (error) {
        console.error("Error refreshing access token:", error)
        return {
            ...token,
            error: "RefreshAccessTokenError",
        }
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                Google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    authorization: {
                        params: {
                            scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify",
                            access_type: "offline",
                            prompt: "consent",
                        },
                    },
                }),
            ]
            : []),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // Initial sign in - store all tokens
            if (account) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: account.expires_at,
                }
            }

            // Return token if not expired (with 5 min buffer)
            const expiresAt = token.expiresAt as number | undefined
            if (expiresAt && Date.now() < (expiresAt * 1000) - 300000) {
                return token
            }

            // Token expired, try to refresh
            if (token.refreshToken) {
                return refreshAccessToken(token)
            }

            return token
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken as string | undefined
            session.error = token.error as string | undefined
            return session
        },
    },
})
