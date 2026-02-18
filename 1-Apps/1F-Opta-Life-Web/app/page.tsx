import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";
import { Session } from "next-auth";

export const dynamic = 'force-dynamic';

export default async function Page() {
    let session: Session | null = null;
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
            session = {
                user: {
                    name: data.session.user.user_metadata?.name || data.session.user.email?.split("@")[0],
                    email: data.session.user.email,
                    image: data.session.user.user_metadata?.avatar_url,
                },
                expires: new Date(data.session.expires_at || 0).toISOString(),
            } as Session;
        }
    } catch (e) {
        console.error("Auth error:", e);
        session = null;
    }

    return (
        <div className="min-h-screen text-text-primary selection:bg-primary selection:text-white">
            <Dashboard session={session} />
        </div>
    );
}
