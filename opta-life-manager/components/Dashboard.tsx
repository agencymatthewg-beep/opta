"use client";

import { useState, useEffect } from "react";
import { Session } from "next-auth";
import {
  CheckCircle2,
  Calendar,
  Mail,
  Search,
  Cloud,
  Newspaper,
  Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasks } from "@/contextsHooks/TaskContext";
import { SignIn, SignOut } from "@/components/AuthButtons";
import { CalendarWidget } from "@/components/CalendarWidget";
import { GmailWidget } from "@/components/GmailWidget";
import { OptaRing } from "@/components/OptaRing";
import { getSystemBriefing } from "@/lib/ai-summary";
import { CommandOverlay } from "@/components/CommandOverlay";
import { OptaBriefingWidget } from "@/components/OptaBriefingWidget";
import { TodoistWidget } from "@/components/TodoistWidget";
import { WeatherWidget } from "@/components/WeatherWidget";
import { NewsWidget } from "@/components/NewsWidget";
import { SmartInsightsWidget } from "@/components/SmartInsightsWidget";
import { motion, Variants } from "framer-motion";
import { MagneticButton } from "@/components/MagneticButton";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 30, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 70, // Slightly softer spring
      damping: 18,   // More damped for "weight"
      mass: 1.2      // More mass feels more expensive
    },
  },
};

export default function Dashboard({ session }: { session: Session | null }) {
  const [date, setDate] = useState<Date | null>(null);
  const { tasks, clearCompleted } = useTasks();
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [briefing, setBriefing] = useState("Initializing system intelligence...");

  const scrollToWidget = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: "center" });
      setActiveHighlight(id);
      setTimeout(() => setActiveHighlight(null), 2000);
    }
  };

  useEffect(() => {
    setDate(new Date());
  }, []);

  useEffect(() => {
    async function fetchBriefing() {
      const completed = tasks.filter(t => t.completed).length;
      const total = tasks.length;
      const { briefing } = await getSystemBriefing(total, completed);
      setBriefing(briefing);
    }
    if (session) fetchBriefing();
  }, [tasks.length, session]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="">
      <CommandOverlay
        onNavigate={scrollToWidget}
        onClearCompleted={clearCompleted}
      />

      <main className="container mx-auto px-6 py-12 relative z-10">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-primary-glow bg-clip-text text-transparent mb-2">
              Opta Life Manager
            </h1>
            <p className="text-text-secondary font-light text-lg">
              {date ? formatDate(date) : "Loading..."}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <button aria-label="Search" className="p-3 rounded-full hover:bg-white/5 transition-colors text-text-secondary hover:text-primary">
              <Search className="w-5 h-5" />
            </button>

            {session?.user ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-text-primary">{session.user.name}</p>
                  <div className="flex justify-end">
                    <SignOut />
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full border border-glass-border flex items-center justify-center bg-void/50 backdrop-blur-sm shadow-[0_0_20px_rgba(139,92,246,0.15)] overflow-hidden">
                  {session.user.image ? (
                    <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-dim to-void opacity-80" />
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 glass-panel flex items-center">
                <SignIn />
              </div>
            )}
          </div>
        </header>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div variants={itemVariants} className="glass-panel p-6 text-center flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="mb-4 scale-100 group-hover:scale-110 transition-transform duration-700">
                <OptaRing />
              </div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em] mb-2 relative z-10">System Intelligence</h3>
              <p className="text-xs text-text-muted relative z-10 leading-relaxed animate-in fade-in duration-1000">
                {briefing}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-panel p-4">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton icon={<CheckCircle2 className="w-4 h-4" />} label="Tasks" onClick={() => scrollToWidget('widget-tasks')} />
                <ActionButton icon={<Calendar className="w-4 h-4" />} label="Schedule" onClick={() => scrollToWidget('widget-schedule')} />
                <ActionButton icon={<Mail className="w-4 h-4" />} label="Email" onClick={() => scrollToWidget('widget-inbox')} />
                <ActionButton icon={<Cloud className="w-4 h-4" />} label="Weather" onClick={() => scrollToWidget('widget-weather')} />
                <ActionButton icon={<Newspaper className="w-4 h-4" />} label="News" onClick={() => scrollToWidget('widget-news')} />
                <ActionButton icon={<Lightbulb className="w-4 h-4" />} label="Insights" onClick={() => scrollToWidget('widget-insights')} />
              </div>
            </motion.div>
          </div>

          {/* Center Column */}
          <div className="lg:col-span-6 space-y-6">
            <motion.div
              variants={itemVariants}
              id="widget-tasks"
              className={cn(
                "glass-panel p-6 scroll-mt-24 transition-all duration-500",
                activeHighlight === 'widget-tasks' ? "ring-2 ring-primary shadow-[0_0_30px_rgba(139,92,246,0.3)] bg-white/10" : ""
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Tasks</h3>
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              </div>
              <TodoistWidget />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <motion.div
                variants={itemVariants}
                id="widget-inbox"
                className={cn(
                  "glass-panel p-6 scroll-mt-24 transition-all duration-500",
                  activeHighlight === 'widget-inbox' ? "ring-2 ring-neon-amber shadow-[0_0_30px_rgba(245,158,11,0.3)] bg-white/10" : ""
                )}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Unified Inbox</h3>
                  <div className="w-2 h-2 rounded-full bg-neon-amber animate-pulse" />
                </div>
                <GmailWidget
                  sessionToken={session?.user?.email ? `opta-${session.user.email}` : undefined}
                  primaryEmail={session?.user?.email || undefined}
                />
              </motion.div>

              <motion.div
                variants={itemVariants}
                id="widget-schedule"
                className={cn(
                  "glass-panel p-6 scroll-mt-24 transition-all duration-500",
                  activeHighlight === 'widget-schedule' ? "ring-2 ring-neon-blue shadow-[0_0_30px_rgba(59,130,246,0.3)] bg-white/10" : ""
                )}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Schedule</h3>
                  <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
                </div>
                <CalendarWidget />
              </motion.div>
            </div>

            <motion.div
              variants={itemVariants}
              id="widget-briefing"
              className={cn(
                "glass-panel p-6 scroll-mt-24 transition-all duration-500",
                activeHighlight === 'widget-briefing' ? "ring-2 ring-primary shadow-[0_0_30px_rgba(139,92,246,0.3)] bg-white/10" : ""
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Opta Briefing</h3>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
              <OptaBriefingWidget />
            </motion.div>

            <motion.div variants={itemVariants} className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  <span className="text-xs text-text-primary font-medium">All Systems Operational</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>Calendar: <span className="text-neon-green">OK</span></span>
                  <span>Email: <span className="text-neon-green">OK</span></span>
                  <span>Todoist: <span className="text-neon-green">OK</span></span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div
              variants={itemVariants}
              id="widget-insights"
              className={cn(
                "glass-panel p-5 scroll-mt-24 transition-all duration-500",
                activeHighlight === 'widget-insights' ? "ring-2 ring-neon-purple shadow-[0_0_30px_rgba(139,92,246,0.3)] bg-white/10" : ""
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Insights</h3>
                <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
              </div>
              <SmartInsightsWidget />
            </motion.div>

            <motion.div
              variants={itemVariants}
              id="widget-weather"
              className={cn(
                "glass-panel p-5 scroll-mt-24 transition-all duration-500",
                activeHighlight === 'widget-weather' ? "ring-2 ring-neon-cyan shadow-[0_0_30px_rgba(6,182,212,0.3)] bg-white/10" : ""
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Weather</h3>
                <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
              </div>
              <WeatherWidget />
            </motion.div>

            <motion.div
              variants={itemVariants}
              id="widget-news"
              className={cn(
                "glass-panel p-5 scroll-mt-24 transition-all duration-500",
                activeHighlight === 'widget-news' ? "ring-2 ring-neon-amber shadow-[0_0_30px_rgba(245,158,11,0.3)] bg-white/10" : ""
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Tech & AI News</h3>
                <div className="w-2 h-2 rounded-full bg-neon-amber animate-pulse" />
              </div>
              <NewsWidget />
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <MagneticButton
      onClick={(e) => {
        if (onClick) onClick();
      }}
      className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-glass-border transition-colors group cursor-none"
    >
      <div className="text-primary group-hover:text-primary-glow mb-1 transition-colors">
        {icon}
      </div>
      <span className="text-[10px] text-text-secondary font-medium">{label}</span>
    </MagneticButton>
  );
}
