"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, ClipboardPaste } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PROVIDERS,
  detectProvider,
  type ApiKeyProvider,
} from "@/lib/provider-detection";
import {
  type ApiKey,
  upsertApiKey,
  deleteApiKey,
  verifyApiKey,
} from "@/lib/supabase/key-actions";
import { KeyCard } from "@/components/KeyCard";
import { AddKeySheet } from "@/components/AddKeySheet";
import { OptaRing } from "@/components/OptaRing";

interface KeysContentProps {
  initialKeys: ApiKey[];
}

export function KeysContent({ initialKeys }: KeysContentProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const handleSave = useCallback(
    async (provider: ApiKeyProvider, keyValue: string, label?: string) => {
      const result = await upsertApiKey(provider, keyValue, label);
      if (!result.ok) {
        showToast(result.error ?? "Failed to save key.", "error");
        return;
      }
      showToast(
        `${PROVIDERS.find((p) => p.id === provider)?.name} key saved.`,
        "success",
      );
      setSheetOpen(false);
      // Refresh keys from server
      const { getApiKeys } = await import("@/lib/supabase/key-actions");
      setKeys(await getApiKeys());
    },
    [showToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await deleteApiKey(id);
      if (!result.ok) {
        showToast(result.error ?? "Failed to delete key.", "error");
        return;
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
      showToast("Key deleted.", "success");
    },
    [showToast],
  );

  const handleVerify = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await verifyApiKey(id);
      if (result.valid) {
        showToast("Key verified successfully.", "success");
        const { getApiKeys } = await import("@/lib/supabase/key-actions");
        setKeys(await getApiKeys());
      } else {
        showToast(result.error ?? "Key verification failed.", "error");
      }
      return result.valid;
    },
    [showToast],
  );

  const keysByProvider = PROVIDERS.map((provider) => ({
    provider,
    key: keys.find((k) => k.provider === provider.id && k.isActive) ?? null,
  }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <OptaRing size={48} className="mb-4" />
          <h1 className="text-xl font-semibold text-opta-text-primary">
            API Keys
          </h1>
          <p className="text-sm text-opta-text-secondary mt-1">
            Manage keys across all your Opta apps
          </p>
        </div>

        {/* Back link */}
        <Link
          href="/profile"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-opta-text-muted",
            "hover:text-opta-text-secondary transition-colors mb-4",
          )}
        >
          <ArrowLeft size={12} />
          Back to profile
        </Link>

        {/* Smart Paste Hero */}
        <motion.button
          type="button"
          onClick={() => setSheetOpen(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "w-full glass-strong rounded-2xl p-6 mb-6",
            "flex flex-col items-center gap-3 cursor-pointer",
            "hover:border-opta-primary/30 transition-colors",
          )}
        >
          <div className="flex items-center gap-2 text-opta-primary">
            <ClipboardPaste size={18} />
            <span className="text-sm font-medium">Paste Any API Key</span>
          </div>
          <p className="text-xs text-opta-text-muted text-center">
            Smart detection identifies the provider automatically
          </p>
        </motion.button>

        {/* Provider Grid */}
        <div className="space-y-2">
          {keysByProvider.map(({ provider, key }, i) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 24,
                delay: i * 0.04,
              }}
            >
              <KeyCard
                provider={provider}
                apiKey={key}
                onAdd={() => setSheetOpen(true)}
                onDelete={handleDelete}
                onVerify={handleVerify}
              />
            </motion.div>
          ))}
        </div>

        {/* Add Key Button */}
        <motion.button
          type="button"
          onClick={() => setSheetOpen(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mt-4",
            "glass-subtle text-opta-text-secondary text-sm font-medium",
            "hover:text-opta-primary transition-colors",
          )}
        >
          <Plus size={14} />
          Add Key
        </motion.button>
      </motion.div>

      {/* Add Key Sheet */}
      <AddKeySheet
        key={sheetOpen ? "open" : "closed"}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        existingProviders={keys.map((k) => k.provider)}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
              "glass-strong rounded-lg px-4 py-2.5 text-sm",
              toast.type === "success"
                ? "text-opta-neon-green"
                : "text-opta-neon-red",
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
