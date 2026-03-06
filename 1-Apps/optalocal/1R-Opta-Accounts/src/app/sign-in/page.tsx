import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/allowed-redirects';
import { AuthForm } from '@/components/AuthForm';
import {
  isValidCliHandoff,
  isValidCliState,
  parseCliCallbackPort,
  peekCliHandoff,
} from '@/lib/cli/handoff';

interface SignInPageProps {
  searchParams: Promise<{
    next?: string;
    redirect_to?: string;
    mode?: string;
    port?: string;
    state?: string;
    return_to?: string;
    handoff?: string;
    proof?: string;
    error?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const cliPort = parseCliCallbackPort(params.port);
  const cliState = params.state?.trim() ?? '';
  const cliHandoff = params.handoff?.trim() ?? '';
  const cliProof = params.proof?.trim() ?? '';
  const cliRecord =
    params.mode === 'cli' &&
    cliPort &&
    isValidCliState(cliState) &&
    (cliHandoff.length === 0 || isValidCliHandoff(cliHandoff))
      ? peekCliHandoff({
          state: cliState,
          port: cliPort,
          handoff: cliHandoff.length > 0 ? cliHandoff : null,
          proof: cliProof.length > 0 ? cliProof : null,
        })
      : null;

  // If already authed, redirect
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // If CLI mode, redirect to CLI callback
      if (params.mode === 'cli' && cliRecord) {
        const callbackParams = new URLSearchParams({
          port: String(cliRecord.port),
          state: cliRecord.state,
        });
        if (cliRecord.returnTo) {
          callbackParams.set('return_to', cliRecord.returnTo);
        }
        if (cliRecord.handoff) {
          callbackParams.set('handoff', cliRecord.handoff);
        }
        if (cliProof.length > 0) {
          callbackParams.set('proof', cliProof);
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
    params.mode === 'cli' && cliRecord
      ? {
        port: String(cliRecord.port),
        state: cliRecord.state,
        returnTo: cliRecord.returnTo ?? undefined,
        handoff: cliRecord.handoff ?? undefined,
        proof: cliProof.length > 0 ? cliProof : undefined,
      }
      : undefined;

  return <AuthForm mode="sign-in" redirectAfter={redirectAfter} cliMode={cliMode} />;
}
