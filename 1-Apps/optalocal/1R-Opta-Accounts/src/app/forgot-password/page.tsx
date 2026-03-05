'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { OptaLogo } from '@/components/OptaLogo';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/update-password`,
            });
            if (resetError) throw resetError;
            setSent(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-transparent">
            <motion.div
                initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                className="w-full max-w-sm"
            >
                {/* Logo */}
                <div className="flex flex-col items-center mb-8 pb-1">
                    <OptaLogo size={64} layout="vertical" className="mb-6 drop-shadow-md" logoSrc="/opta-accounts-mark.svg" suffix="ACCOUNTS" />
                    <h1 className="text-xl font-semibold text-opta-text-primary tracking-tight">Reset your password</h1>
                    <p className="text-sm text-opta-text-secondary mt-2 text-center">
                        {sent
                            ? "Check your inbox for a reset link."
                            : "Enter your email address and we'll send you a reset link."}
                    </p>
                </div>

                {!sent ? (
                    <div className="obsidian rounded-2xl p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-xs text-opta-text-muted mb-1.5">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    autoFocus
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-lg bg-opta-elevated border border-opta-border text-opta-text-primary text-sm font-mono placeholder:text-opta-text-muted focus:outline-none focus:border-opta-primary/60 transition-colors"
                                    placeholder="you@example.com"
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <p className="text-xs text-opta-neon-red font-mono">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-opta-primary text-white text-sm font-semibold hover:bg-opta-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="obsidian rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                        <CheckCircle size={36} className="text-opta-neon-green" />
                        <p className="text-sm text-opta-text-secondary">
                            A password reset link has been sent to <strong className="text-opta-text-primary">{email}</strong>.
                            Check your inbox — it may take a minute.
                        </p>
                    </div>
                )}

                <p className="text-center text-sm text-opta-text-secondary mt-6">
                    <Link
                        href="/sign-in"
                        className="inline-flex items-center gap-1.5 text-opta-primary hover:text-opta-primary-glow transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to sign in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
