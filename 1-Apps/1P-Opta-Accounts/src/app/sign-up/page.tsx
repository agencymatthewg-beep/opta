import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/allowed-redirects';
import { AuthForm } from '@/components/AuthForm';

interface SignUpPageProps {
  searchParams: Promise<{
    next?: string;
    redirect_to?: string;
  }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  // If already authed, redirect
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect(sanitizeRedirect(params.redirect_to ?? params.next));
    }
  }

  const redirectAfter = params.redirect_to ?? params.next;

  return <AuthForm mode="sign-up" redirectAfter={redirectAfter} />;
}
