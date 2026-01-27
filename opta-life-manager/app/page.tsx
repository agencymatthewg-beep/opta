import { auth } from "@/auth";
import Dashboard from "@/components/Dashboard";

export default async function Page() {
    let session;
    try {
        session = await auth();
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
