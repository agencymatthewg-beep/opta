import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConnectionsContent } from './ConnectionsContent';

export default async function ConnectionsPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/sign-in');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return <ConnectionsContent />;
}
