import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSyncFile } from '@/lib/supabase/vault-actions';
import { RulesContent } from './RulesContent';

export const metadata = {
    title: 'Global Rules | Opta Accounts',
    description: 'Manage your synchronized global AI rules',
};

export default async function RulesPage() {
    const supabase = await createClient();
    if (!supabase) {
        redirect('/auth/login?next=/rules');
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login?next=/rules');
    }

    // Fetch the user's current non-negotiables.md content
    const file = await getSyncFile('non-negotiables.md');

    return <RulesContent initialContent={file?.content ?? ''} />;
}
