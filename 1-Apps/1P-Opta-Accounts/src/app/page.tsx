import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Root page — redirects based on auth state.
 * Authed users → /profile, unauthed → /sign-in.
 */
export default async function Home() {
  const supabase = await createClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect('/profile');
  }

  redirect('/sign-in');
}
