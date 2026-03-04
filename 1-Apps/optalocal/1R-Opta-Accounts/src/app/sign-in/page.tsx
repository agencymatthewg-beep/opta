import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/allowed-redirects';
import { AuthForm } from '@/components/AuthForm';

interface SignInPageProps {
  searchParams: Promise<{
    next?: string;
    redirect_to?: string;
    mode?: string;
    port?: string;
    state?: string;
    return_to?: string;
    handoff?: string;
    error?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  // If already authed, redirect
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // If CLI mode, redirect to CLI callback
      if (params.mode === 'cli' && params.port && params.state) {
        const callbackParams = new URLSearchParams({
          port: params.port,
          state: params.state,
        });
        if (params.return_to) {
          callbackParams.set('return_to', params.return_to);
        }
        if (params.handoff) {
          callbackParams.set('handoff', params.handoff);
        }
        redirect(`/cli/callback?${callbackParams.toString()}`);
      }
      // Otherwise redirect to destination
      const destination = sanitizeRedirect(
        params.redirect_to ?? params.next,
      );
      redirect(destination);
    }
  }

  // Determine redirect target
  const redirectAfter = params.redirect_to ?? params.next;

  // CLI browser auth mode
  const cliMode =
    params.mode === 'cli' && params.port && params.state
      ? {
        port: params.port,
        state: params.state,
        returnTo: params.return_to,
        handoff: params.handoff,
      }
      : undefined;

  return <AuthForm mode="sign-in" redirectAfter={redirectAfter} cliMode={cliMode} />;
}
