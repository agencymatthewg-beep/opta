import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getApiKeys } from '@/lib/supabase/key-actions';
import { KeysContent } from './KeysContent';

export default async function KeysPage() {
  const supabase = await createClient();

  if (!supabase) redirect('/sign-in');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const keys = await getApiKeys();

  return <KeysContent initialKeys={keys} />;
}
