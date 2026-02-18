"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
            queryParams: {
                access_type: "offline",
                prompt: "consent",
            },
            scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify",
        },
    });

    if (error) {
        throw error;
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
}
