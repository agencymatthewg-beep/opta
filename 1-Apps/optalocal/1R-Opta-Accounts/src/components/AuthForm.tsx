"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OAuthButtons } from "./OAuthButtons";
import { PasswordForm } from "./PasswordForm";
import { OptaLogo } from "./OptaLogo";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  redirectAfter?: string;
  cliMode?: {
    port: string;
    state: string;
  };
}

export function AuthForm({ mode, redirectAfter, cliMode }: AuthFormProps) {
  const effectiveRedirect = cliMode
    ? `/cli/callback?port=${cliMode.port}&state=${cliMode.state}`
    : redirectAfter;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-sm"
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <OptaLogo size={64} layout="vertical" className="mb-6" logoSrc="/opta-accounts-logo-final.svg" suffix="ACCOUNTS" />
          <h1 className="text-xl font-semibold text-opta-text-primary">
            {mode === "sign-in"
              ? "Sign in to Opta"
              : "Create your Opta account"}
          </h1>
          {cliMode && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "mt-2 text-xs px-3 py-1 rounded-full",
                "bg-opta-neon-cyan/10 text-opta-neon-cyan border border-opta-neon-cyan/20",
              )}
            >
              Signing in for Opta CLI
            </motion.p>
          )}
        </div>

        {/* Auth Card */}
        <div className="glass-strong rounded-2xl p-6">
          {/* OAuth Buttons */}
          <OAuthButtons redirectAfter={effectiveRedirect} />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-opta-border" />
            <span className="text-xs text-opta-text-muted uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-opta-border" />
          </div>

          {/* Password Form */}
          <PasswordForm mode={mode} redirectAfter={effectiveRedirect} />
        </div>

        {/* Toggle link */}
        <p className="text-center text-sm text-opta-text-secondary mt-6">
          {mode === "sign-in" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link
                href={`/sign-up${redirectAfter ? `?next=${encodeURIComponent(redirectAfter)}` : ""}`}
                className="text-opta-primary hover:text-opta-primary-glow transition-colors"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href={`/sign-in${redirectAfter ? `?next=${encodeURIComponent(redirectAfter)}` : ""}`}
                className="text-opta-primary hover:text-opta-primary-glow transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
