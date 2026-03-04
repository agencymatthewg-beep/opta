"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { upsertSyncFile } from "@/lib/supabase/vault-actions";
import { OptaLogo } from "@/components/OptaLogo";

interface RulesContentProps {
    initialContent: string;
}

export function RulesContent({ initialContent }: RulesContentProps) {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
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

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        const result = await upsertSyncFile('non-negotiables.md', content);
        setIsSaving(false);

        if (!result.ok) {
            showToast(result.error ?? "Failed to save rules.", "error");
            return;
        }

        showToast("Global rules synced successfully.", "success");
        setIsDirty(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    }, [content, showToast]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                className="w-full max-w-3xl flex flex-col items-center h-[85vh]"
            >
                {/* Header */}
                <div className="flex flex-col items-center mb-6 flex-shrink-0">
                    <OptaLogo
                        size={48}
                        showText={false}
                        logoSrc="/opta-accounts-mark.svg"
                        className="mb-4"
                    />
                    <h1 className="text-xl font-semibold text-opta-text-primary">
                        Sync Vault
                    </h1>
                    <p className="text-sm text-opta-text-secondary mt-1 max-w-lg text-center">
                        Define your <code>non-negotiables.md</code> below. These instructions are automatically injected into every AI context across all your Opta Local apps to enforce your preferences.
                    </p>
                </div>

                {/* Back link */}
                <div className="w-full flex justify-between items-center mb-4 flex-shrink-0">
                    <Link
                        href="/profile"
                        className={cn(
                            "inline-flex items-center gap-1.5 text-xs text-opta-text-muted",
                            "hover:text-opta-text-secondary transition-colors",
                        )}
                    >
                        <ArrowLeft size={12} />
                        Back to profile
                    </Link>

                    <motion.button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        whileHover={{ scale: isDirty && !isSaving ? 1.02 : 1 }}
                        whileTap={{ scale: isDirty && !isSaving ? 0.98 : 1 }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                            isDirty
                                ? "bg-opta-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                                : "glass-subtle text-opta-text-muted cursor-not-allowed",
                            isSaved && "bg-opta-neon-green/20 text-opta-neon-green border border-opta-neon-green/30 shadow-none"
                        )}
                    >
                        {isSaved ? <Check size={14} /> : <Save size={14} />}
                        {isSaving ? "Saving..." : isSaved ? "Synced" : "Save Changes"}
                    </motion.button>
                </div>

                {/* Editor Area */}
                <div className="w-full flex-grow relative obsidian rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                    {/* Very basic textarea acting as a markdown editor. A full Monaco editor could be implemented later if fully requested, but this serves the immediate need. */}
                    <textarea
                        className="w-full flex-grow bg-transparent p-6 text-sm text-opta-text-secondary font-mono focus:outline-none focus:ring-0 resize-none leading-relaxed placeholder:text-opta-text-muted/40"
                        placeholder="# My AI Non-Negotiables

1. Always use TypeScript strict mode.
2. Ensure you format all responses with GitHub Flavored Markdown.
3. Only use modern React server components where appropriate."
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            setIsDirty(true);
                        }}
                    />
                </div>

            </motion.div>

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
