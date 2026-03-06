"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Lock,
  Shield,
  Key,
  FileText,
  ChevronRight,
  Check,
  ArrowRight,
  Zap,
  CloudOff,
  Cloud,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DeviceFlowCard } from "@/components/providers/DeviceFlowCard";
import { AnthropicSetupCard } from "@/components/providers/AnthropicSetupCard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncPrefs {
  rules: boolean;
  keys: boolean;
}

interface OnboardingWizardProps {
  displayName: string;
}

// ─── Step transitions ─────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 48 : -48,
    opacity: 0,
    filter: "blur(4px)",
  }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    x: dir > 0 ? -48 : 48,
    opacity: 0,
    filter: "blur(4px)",
  }),
};

const spring = { type: "spring" as const, stiffness: 220, damping: 26 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function PrivacyBadge({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-opta-primary/5 border border-opta-primary/10 text-xs text-opta-text-muted">
      <Lock size={11} className="text-opta-primary flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === step - 1 ? 20 : 6,
            backgroundColor:
              i < step - 1
                ? "#8b5cf6"
                : i === step - 1
                  ? "#8b5cf6"
                  : "rgba(139,92,246,0.2)",
          }}
          transition={spring}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

interface SyncToggleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gain: string;
  lose: string;
  privacy: string;
  enabled: boolean;
  onToggle: () => void;
}

function SyncToggleCard({
  icon,
  title,
  description,
  gain,
  lose,
  privacy,
  enabled,
  onToggle,
}: SyncToggleCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-4 transition-colors",
        enabled ? "border-opta-primary/20" : "border-opta-border",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-opta-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-opta-text-primary">{title}</p>
          <p className="text-xs text-opta-text-muted mt-0.5">{description}</p>
        </div>
        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "relative w-10 h-5.5 rounded-full flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opta-primary/50",
            enabled ? "bg-opta-primary" : "bg-opta-border",
          )}
          aria-pressed={enabled}
        >
          <motion.div
            animate={{ x: enabled ? 20 : 2 }}
            transition={spring}
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
          />
        </button>
      </div>

      {/* Gain / Lose */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2 text-xs">
          <Cloud size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
          <span className="text-opta-text-secondary">
            <span className="text-emerald-400 font-medium">With sync: </span>
            {gain}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <CloudOff
            size={11}
            className="text-amber-400 mt-0.5 flex-shrink-0"
          />
          <span className="text-opta-text-secondary">
            <span className="text-amber-400 font-medium">Without: </span>
            {lose}
          </span>
        </div>
      </div>

      {/* Privacy note */}
      <div className="flex items-center gap-1.5 text-xs text-opta-text-muted">
        <Lock size={10} className="text-opta-primary flex-shrink-0" />
        <span>{privacy}</span>
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard({ displayName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [syncPrefs, setSyncPrefs] = useState<SyncPrefs>({
    rules: true,
    keys: true,
  });
  const [saving, setSaving] = useState(false);

  const TOTAL_STEPS = 4;

  function advance() {
    setDir(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function finish() {
    setSaving(true);
    const supabase = createClient();
    await supabase?.auth.updateUser({
      data: {
        onboarding_complete: true,
        sync_prefs: syncPrefs,
      },
    });
    router.push("/profile");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <ProgressDots step={step} total={TOTAL_STEPS} />
          <p className="text-center text-xs text-opta-text-muted mt-2">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            {step === 1 && (
              <StepWelcome name={displayName} onNext={advance} />
            )}
            {step === 2 && (
              <StepSync
                prefs={syncPrefs}
                onToggle={(key) =>
                  setSyncPrefs((p) => ({ ...p, [key]: !p[key] }))
                }
                onNext={advance}
                onBack={back}
              />
            )}
            {step === 3 && (
              <StepProviders onNext={advance} onBack={back} />
            )}
            {step === 4 && (
              <StepDone
                prefs={syncPrefs}
                saving={saving}
                onFinish={finish}
                onBack={back}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({
  name,
  onNext,
}: {
  name: string;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-opta-primary/10 border border-opta-primary/20 flex items-center justify-center mx-auto mb-5">
          <Zap size={24} className="text-opta-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-opta-text-primary tracking-tight mb-2">
          Welcome, {name}
        </h1>
        <p className="text-sm text-opta-text-secondary">
          Your Opta account is ready. Let&apos;s take 60 seconds to set it up.
        </p>
      </div>

      {/* What you get */}
      <div className="glass rounded-xl p-5 space-y-4">
        {[
          {
            icon: <Shield size={15} className="text-opta-primary" />,
            title: "One identity, every device",
            desc: "Sign in anywhere — your config follows you automatically.",
          },
          {
            icon: <Key size={15} className="text-opta-primary" />,
            title: "Centralised API keys",
            desc: "Store AI provider keys once; sync to CLI and desktop without re-entry.",
          },
          {
            icon: <FileText size={15} className="text-opta-primary" />,
            title: "Consistent AI behaviour",
            desc: "Your non-negotiables and rules sync across all Opta apps.",
          },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-opta-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-opta-text-primary">
                {item.title}
              </p>
              <p className="text-xs text-opta-text-muted mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Core privacy statement */}
      <div className="rounded-xl border border-opta-primary/15 bg-opta-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={13} className="text-opta-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-opta-primary uppercase tracking-wider">
            Zero Knowledge
          </p>
        </div>
        <p className="text-xs text-opta-text-secondary leading-relaxed">
          Opta cannot access your AI conversations, code, model weights, or
          any content you process locally. Only the configuration you
          explicitly choose to sync passes through our infrastructure —
          and it is encrypted end-to-end before it leaves your device.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-opta-primary text-white text-sm font-medium hover:bg-opta-primary/90 transition-colors"
      >
        Get started <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ─── Step 2: Sync ─────────────────────────────────────────────────────────────

function StepSync({
  prefs,
  onToggle,
  onNext,
  onBack,
}: {
  prefs: SyncPrefs;
  onToggle: (key: keyof SyncPrefs) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-opta-text-primary tracking-tight mb-1">
          Configure sync
        </h2>
        <p className="text-sm text-opta-text-muted">
          Choose what travels with your account. You can change this anytime.
        </p>
      </div>

      <PrivacyBadge message="All synced data is AES-256 encrypted. Opta sees only ciphertext — never the content." />

      <SyncToggleCard
        icon={<FileText size={15} className="text-opta-primary" />}
        title="AI Rules"
        description="Sync your non-negotiables.md across all Opta apps and devices"
        gain="Your AI behaviour rules apply automatically on every device running Opta CLI or Code."
        lose="Rules are device-local only — you must copy them manually to each machine."
        privacy="The content of your rules file is encrypted. Opta cannot read your instructions."
        enabled={prefs.rules}
        onToggle={() => onToggle("rules")}
      />

      <SyncToggleCard
        icon={<Key size={15} className="text-opta-primary" />}
        title="API Keys"
        description="Sync AI provider keys (Anthropic, OpenAI, Gemini, etc.) to your devices"
        gain="Sign in on any device and your provider keys are ready — no re-entry required."
        lose="You must enter API keys separately on each device or copy them manually."
        privacy="Keys are AES-256 encrypted. Opta cannot decrypt or use them on your behalf."
        enabled={prefs.keys}
        onToggle={() => onToggle("keys")}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-xl glass text-sm text-opta-text-secondary hover:text-opta-text-primary transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-opta-primary text-white text-sm font-medium hover:bg-opta-primary/90 transition-colors"
        >
          Save preferences <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Providers ────────────────────────────────────────────────────────

function StepProviders({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-opta-text-primary tracking-tight mb-1">
          Connect AI providers
        </h2>
        <p className="text-sm text-opta-text-muted">
          Optional — connect now or skip and add later from{" "}
          <a href="/connections" className="text-opta-primary hover:underline">
            Connected Services
          </a>
          .
        </p>
      </div>

      <PrivacyBadge message="All tokens are AES-256 encrypted. Opta cannot read or use your credentials." />

      {/* GitHub Copilot — Device Flow (no redirect) */}
      <DeviceFlowCard />

      {/* Anthropic — paste-in setup token */}
      <AnthropicSetupCard />

      {/* Google Gemini CLI — full OAuth redirect */}
      <div className="glass rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#4285F4]/15 flex items-center justify-center flex-shrink-0 text-[#4285F4] font-bold text-sm">
          G
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-opta-text-primary">Google Gemini CLI</p>
          <p className="text-xs text-opta-text-muted">OAuth via your Google account</p>
        </div>
        <a
          href="/api/oauth/gemini-cli/start?return_to=/onboarding"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0",
            "bg-opta-primary/15 text-opta-primary border border-opta-primary/25",
            "hover:bg-opta-primary/25 transition-colors",
          )}
        >
          Connect
          <ArrowRight size={10} />
        </a>
      </div>

      <div className="glass rounded-xl p-4 flex items-start gap-3">
        <BookOpen size={14} className="text-opta-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-xs text-opta-text-muted leading-relaxed">
          API keys for OpenAI, Anthropic, and Gemini can also be added at{" "}
          <a href="/keys" className="text-opta-primary hover:underline font-mono">
            /keys
          </a>{" "}
          or via{" "}
          <span className="text-opta-primary font-mono">opta key add</span> in the CLI.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-2.5 rounded-xl glass text-sm text-opta-text-secondary hover:text-opta-text-primary transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-opta-primary text-white text-sm font-medium hover:bg-opta-primary/90 transition-colors"
        >
          Continue <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({
  prefs,
  saving,
  onFinish,
  onBack,
}: {
  prefs: SyncPrefs;
  saving: boolean;
  onFinish: () => void;
  onBack: () => void;
}) {
  const summaryItems = [
    {
      label: "AI Rules sync",
      enabled: prefs.rules,
      detail: prefs.rules
        ? "non-negotiables.md will sync across devices"
        : "Rules are device-local — add later in Account settings",
    },
    {
      label: "API Key sync",
      enabled: prefs.keys,
      detail: prefs.keys
        ? "Provider keys sync automatically to all devices"
        : "Keys are device-local — add them via /keys or CLI",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5"
        >
          <Check size={24} className="text-emerald-400" />
        </motion.div>
        <h2 className="text-xl font-semibold text-opta-text-primary tracking-tight mb-1">
          All set
        </h2>
        <p className="text-sm text-opta-text-muted">
          Here&apos;s how your account is configured. You can change anything
          from your account page.
        </p>
      </div>

      {/* Config summary */}
      <div className="glass rounded-xl p-4 space-y-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                item.enabled
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-opta-border/40 text-opta-text-muted",
              )}
            >
              {item.enabled ? (
                <Check size={11} />
              ) : (
                <CloudOff size={11} />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-opta-text-primary">
                {item.label}
              </p>
              <p className="text-xs text-opta-text-muted mt-0.5">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Final privacy statement */}
      <div className="rounded-xl border border-opta-primary/15 bg-opta-primary/5 p-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-opta-primary" />
          <p className="text-xs font-semibold text-opta-primary uppercase tracking-wider">
            Your privacy guarantee
          </p>
        </div>
        <p className="text-xs text-opta-text-muted leading-relaxed">
          Opta has zero visibility into your AI usage, code, conversations, or
          model weights — now and always. Only encrypted configuration passes
          through our systems. You can audit, export, or delete your data at
          any time from your account.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl glass text-sm text-opta-text-secondary hover:text-opta-text-primary transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <motion.button
          type="button"
          onClick={onFinish}
          disabled={saving}
          whileHover={{ scale: saving ? 1 : 1.01 }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
          transition={spring}
          className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-opta-primary text-white text-sm font-medium hover:bg-opta-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? (
            <>Saving…</>
          ) : (
            <>
              Open my account <ArrowRight size={15} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
