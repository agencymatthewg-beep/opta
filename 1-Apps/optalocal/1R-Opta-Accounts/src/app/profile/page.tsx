import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileContent } from './ProfileContent';

export default async function ProfilePage() {
  const supabase = await createClient();

  if (!supabase) redirect('/sign-in');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return <ProfileContent user={user} />;
}
