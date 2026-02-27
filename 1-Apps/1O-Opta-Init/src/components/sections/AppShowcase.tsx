'use client'

import { motion } from 'framer-motion'
import { TerminalWindow } from '@/components/ui/TerminalWindow'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'
import { SHOWCASE_CONTENT } from '@/lib/constants'

function WelcomeMockup() {
  const { logo, menuItems } = SHOWCASE_CONTENT.welcome
  return (
    <TerminalWindow title="Opta">
      {/* ASCII logo */}
      <div className="mb-4 text-center">
        {logo.map((line, i) => (
          <div key={i} className="text-primary text-[10px] leading-tight sm:text-xs">
            {line}
          </div>
        ))}
      </div>

      <div className="mb-3 text-center text-text-secondary text-xs">
        Welcome to Opta
      </div>

      {/* Quick Start menu */}
      <div className="mx-auto max-w-[200px] space-y-1">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-text-muted">
          Quick Start
        </div>
        {menuItems.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
              i === 0
                ? 'bg-primary/20 text-primary'
                : 'text-text-secondary'
            }`}
          >
            <span>{item.label}</span>
            <span className="text-text-muted text-[10px]">{item.shortcut}</span>
          </div>
        ))}
      </div>
    </TerminalWindow>
  )
}

function ChatMockup() {
  const { model, messages } = SHOWCASE_CONTENT.chat
  return (
    <TerminalWindow title="Opta \u2014 Chat">
      {/* Model badge */}
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
        {model}
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`mb-0.5 text-[10px] font-medium ${
              msg.role === 'user' ? 'text-neon-blue' : 'text-primary-light'
            }`}>
              {msg.role === 'user' ? 'You' : 'Opta'}
            </div>
            <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-white/5 text-text-primary'
                : 'bg-primary/5 text-text-secondary border border-primary/10'
            }`}>
              {msg.text.split('\n').map((line, j) => (
                <div key={j}>{line || <br />}</div>
              ))}
            </div>
          </div>
        ))}

        {/* Blinking cursor */}
        <div className="flex items-center gap-1 text-text-muted text-xs">
          <span className="terminal-cursor inline-block h-3.5 w-1.5 bg-primary/60" />
        </div>
      </div>
    </TerminalWindow>
  )
}

function MenuMockup() {
  const { items, hint } = SHOWCASE_CONTENT.menu
  return (
    <TerminalWindow title="Opta \u2014 Models">
      {/* Overlay panel */}
      <div className="rounded-lg border border-white/10 bg-surface/80 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-text-muted">
          Select Model
        </div>

        <div className="space-y-0.5">
          {items.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                item.active
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary'
              }`}
            >
              {item.active && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              {!item.active && <span className="h-1.5 w-1.5" />}
              {item.label}
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-white/5 pt-2 text-[10px] text-text-muted text-center">
          {hint}
        </div>
      </div>
    </TerminalWindow>
  )
}

const mockups = [
  { key: 'welcome', component: WelcomeMockup, ...SHOWCASE_CONTENT.welcome },
  { key: 'chat', component: ChatMockup, ...SHOWCASE_CONTENT.chat },
  { key: 'menu', component: MenuMockup, ...SHOWCASE_CONTENT.menu },
]

export function AppShowcase() {
  return (
    <SectionReveal id="showcase" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div variants={itemVariants} className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            See it in action
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            A visual app that lives in your terminal — menus, chat, and model switching built in
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {mockups.map(({ key, component: Mockup, heading, caption }) => (
            <motion.div key={key} variants={itemVariants} className="flex flex-col">
              <Mockup />
              <div className="mt-4 text-center">
                <h3 className="text-sm font-semibold text-text-primary">{heading}</h3>
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">{caption}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionReveal>
  )
}
