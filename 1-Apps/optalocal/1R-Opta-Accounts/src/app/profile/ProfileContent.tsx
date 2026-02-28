"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { LogOut, Shield, Mail, Phone, ExternalLink, Key } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/supabase/auth-actions";
import { OptaRing } from "@/components/OptaRing";
import { SecurityApiHooks } from "@/components/profile/SecurityApiHooks";

interface ProfileContentProps {
  user: User;
}

const OPTA_APPS = [
  {
    name: "Opta Local",
    url: "https://lmx.optalocal.com",
    desc: "LMX Dashboard",
  },
  { name: "Opta Init", url: "https://init.optalocal.com", desc: "Setup Guide" },
  {
    name: "Opta Life",
    url: "https://life.opta.app",
    desc: "Life Optimization",
  },
];

export function ProfileContent({ user }: ProfileContentProps) {
  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    user.phone ??
    "Opta User";

  const provider = user.app_metadata?.provider ?? "email";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <OptaRing size={64} className="mb-6" />
          <h1 className="text-xl font-semibold text-opta-text-primary">
            Your Opta Account
          </h1>
        </div>

        {/* Profile Card */}
        <div className="glass-strong rounded-2xl p-6 mb-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-6">
            {user.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url as string}
                alt=""
                width={48}
                height={48}
                className="rounded-full border border-opta-border"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-opta-primary/20 border border-opta-primary/30 flex items-center justify-center">
                <span className="text-opta-primary font-semibold text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-medium text-opta-text-primary">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-opta-text-secondary">
                <Shield size={12} />
                <span className="capitalize">{provider}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {user.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail
                  size={14}
                  className="text-opta-text-muted flex-shrink-0"
                />
                <span className="text-opta-text-secondary">{user.email}</span>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone
                  size={14}
                  className="text-opta-text-muted flex-shrink-0"
                />
                <span className="text-opta-text-secondary">{user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-opta-text-muted text-xs font-mono flex-shrink-0">
                ID
              </span>
              <span className="text-opta-text-muted font-mono text-xs truncate">
                {user.id}
              </span>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <Link
          href="/keys"
          className={cn(
            "glass rounded-2xl p-5 mb-4 flex items-center gap-4 group",
            "hover:border-opta-primary/20 transition-colors block",
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-opta-primary/10 flex items-center justify-center flex-shrink-0">
            <Key size={18} className="text-opta-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-opta-text-primary">
              Manage API Keys
            </p>
            <p className="text-xs text-opta-text-muted">
              Cloud-synced keys for all your Opta apps
            </p>
          </div>
          <ExternalLink
            size={14}
            className="text-opta-text-muted group-hover:text-opta-primary transition-colors flex-shrink-0"
          />
        </Link>

        {/* Opta Apps */}
        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-medium text-opta-text-secondary mb-3">
            Your Opta Apps
          </h2>
          <div className="space-y-2">
            {OPTA_APPS.map((app) => (
              <a
                key={app.name}
                href={app.url}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg",
                  "hover:bg-white/[0.03] transition-colors group",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-opta-text-primary">
                    {app.name}
                  </p>
                  <p className="text-xs text-opta-text-muted">{app.desc}</p>
                </div>
                <ExternalLink
                  size={14}
                  className="text-opta-text-muted group-hover:text-opta-primary transition-colors"
                />
              </a>
            ))}
          </div>
        </div>

        <SecurityApiHooks />

        {/* Sign Out */}
        <motion.button
          type="button"
          onClick={() => signOut()}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
            "glass-subtle text-opta-text-secondary text-sm font-medium",
            "hover:text-opta-neon-red hover:border-opta-neon-red/20 transition-colors",
          )}
        >
          <LogOut size={14} />
          Sign out
        </motion.button>
      </motion.div>
    </div>
  );
}
