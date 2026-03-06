import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from './OnboardingWizard';

/**
 * Onboarding gate — shown once after new account creation.
 *
 * - Unauthenticated: bounced to /sign-in
 * - Already completed onboarding: skip to /profile
 * - New user: render the wizard
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/sign-in');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (user.user_metadata?.onboarding_complete) redirect('/profile');

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'there';

  return <OnboardingWizard displayName={displayName} />;
}
