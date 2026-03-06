"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Terminal, Server, Globe, Monitor, Shield, Code2, BookOpen,
  ArrowRight, Cpu, Layers, Network, UserRound, Activity
} from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { OptaRing } from "@/components/shared/OptaRing";
import { navigation } from "@/lib/content";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const sectionIcons: Record<string, React.ElementType> = {
  "getting-started": BookOpen,
  ecosystem: Network,
  accounts: UserRound,
  cli: Terminal,
  daemon: Server,
  lmx: Cpu,
  "local-web": Globe,
  "code-desktop": Monitor,
  "browser-automation": Layers,
  status: Activity,
  security: Shield,
  developer: Code2,
  "feature-status": BookOpen,
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative py-12 sm:py-16 lg:py-20 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="max-w-4xl mx-auto text-center relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
            >
              <OptaRing size={48} className="mx-auto mb-4 sm:mb-6 hidden sm:block" />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-moonlight mb-3 sm:mb-4">
                Opta Help
              </h1>
              <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-6 sm:mb-8">
                Operating documentation for deploying, governing, and scaling
                Opta across local and hybrid runtime environments.
              </p>
              <p className="text-sm text-text-muted max-w-2xl mx-auto mb-6">
                Canonical activation model: establish runtime policy (local LMX or cloud),
                activate Opta AI, then execute through Opta CLI or Opta Code under
                daemon-governed operational state.
              </p>
              <p className="text-xs text-text-muted max-w-2xl mx-auto mb-6">
                Docs pages now support platform-aware rendering. Switch between macOS and Windows
                views to see the exact commands, paths, and lifecycle controls for your environment.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="/docs/getting-started/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-all"
                >
                  Activate Opta
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/docs/cli/"
                  className="inline-flex items-center gap-2 px-6 py-3 glass-subtle hover:bg-white/5 text-text-secondary hover:text-text-primary rounded-lg font-medium transition-all"
                >
                  CLI Reference
                </Link>
                <a
                  href="https://learn.optalocal.com"
                  className="inline-flex items-center gap-2 px-6 py-3 glass-subtle hover:bg-primary/10 border border-primary/20 text-primary hover:text-white rounded-lg font-medium transition-all"
                >
                  User Guides ↗
                </a>
                <Link
                  href="/docs/getting-started/lan-setup/"
                  className="inline-flex items-center gap-2 px-6 py-3 glass-subtle hover:bg-white/5 text-text-secondary hover:text-text-primary rounded-lg font-medium transition-all"
                >
                  Runtime + Connection Setup
                </Link>
                <Link
                  href="/docs/cli/chat-and-do/"
                  className="inline-flex items-center gap-2 px-6 py-3 glass-subtle hover:bg-white/5 text-text-secondary hover:text-text-primary rounded-lg font-medium transition-all"
                >
                  Chat + Autonomous Modes
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section Grid */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navigation.map((section, i) => {
              const Icon = sectionIcons[section.slug] || BookOpen;
              return (
                <motion.div
                  key={section.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: i * 0.05 }}
                >
                <Link
                  href={section.items[0].href}
                  className="block doc-embed-block surface-embedded-soft rounded-xl p-6 h-full transition-all hover:bg-primary/10"
                >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon size={20} className="text-primary" />
                      </div>
                      <h2 className="text-base font-semibold text-text-primary">{section.title}</h2>
                    </div>
                    <p className="text-sm text-text-muted mb-4">
                      {section.items[0].description}
                    </p>
                    <ul className="space-y-1">
                      {section.items.slice(1).map((item) => (
                        <li key={item.href} className="text-xs text-text-muted flex items-center gap-1.5">
                          <ArrowRight size={10} className="text-primary/50" />
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Stack Overview */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-moonlight mb-2">The Opta Local Stack</h2>
            <p className="text-text-secondary">
              Runtime strategy feeds Opta AI, then execution is orchestrated through daemon,
              CLI, and desktop operator surfaces
            </p>
          </div>
          <div className="glass doc-embed-block rounded-xl p-6 font-mono text-sm space-y-3">
            <div className="text-text-secondary">
              <span className="text-neon-blue">Cloud models</span> / <span className="text-neon-amber">Opta LMX local runtime</span>
              <span className="text-text-muted ml-4"># Runtime source</span>
            </div>
            <div className="pl-8 text-text-muted">&#9474;</div>
            <div className="text-text-secondary">
              <span className="text-neon-purple">Opta AI</span>
              <span className="text-text-muted ml-4"># Optimizer core</span>
            </div>
            <div className="pl-8 text-text-muted">&#9474;</div>
            <div className="text-text-secondary pl-4">
              <span className="text-neon-green">opta daemon</span>
              <span className="text-text-muted ml-2">127.0.0.1:&lt;port&gt;</span>
              <span className="text-text-muted ml-4"># Activation + session orchestration</span>
            </div>
            <div className="pl-8 text-text-muted">&#9474; HTTP v3 REST + WebSocket streaming</div>
            <div className="text-text-secondary pl-4">
              <span className="text-neon-cyan">opta chat</span> / <span className="text-neon-cyan">opta tui</span> / <span className="text-neon-cyan">opta do</span>
              <span className="text-text-muted ml-4"># Opta CLI surface</span>
            </div>
            <div className="pl-8 text-text-muted">&#9474;</div>
            <div className="text-text-secondary pl-4">
              <span className="text-neon-purple">Opta Code Desktop</span>
              <span className="text-text-muted ml-2">Tauri desktop + daemon bridge</span>
              <span className="text-text-muted ml-4"># Opta Code surface</span>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
