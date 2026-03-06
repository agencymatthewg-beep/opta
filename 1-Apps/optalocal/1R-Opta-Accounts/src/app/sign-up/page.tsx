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

  // CLI flows carry a /cli/callback destination — honour it directly.
  // All other sign-ups land on /onboarding so new users get the setup wizard.
  const incoming = params.redirect_to ?? params.next ?? '';
  const redirectAfter = incoming.startsWith('/cli/') ? incoming : incoming || '/onboarding';

  return <AuthForm mode="sign-up" redirectAfter={redirectAfter} />;
}
