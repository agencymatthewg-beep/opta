import NextAuth from "next-auth"

declare module "next-auth" {
    interface Session {
        accessToken?: string
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        accessToken?: string
    }
}
