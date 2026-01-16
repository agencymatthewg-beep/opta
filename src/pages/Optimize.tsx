import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Gamepad2 } from 'lucide-react';

interface OptimizeProps {
  /** Callback to navigate to another page */
  onNavigate?: (page: string) => void;
}

function Optimize({ onNavigate }: OptimizeProps) {
  return (
    <div className="page max-w-3xl">
      <motion.h1
        className="page-title"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Optimize
        </span>
      </motion.h1>

      {/* Hero Section - Guide user to Games page */}
      <motion.div
        className="text-center py-12 mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className={cn(
            'w-20 h-20 flex items-center justify-center rounded-full mx-auto mb-6',
            'bg-[#05030a]/60 backdrop-blur-xl border border-white/[0.06]'
          )}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Gamepad2 className="w-9 h-9 text-muted-foreground/40" strokeWidth={1.5} />
        </motion.div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Select a game to optimize
        </h2>
        <p className="text-sm text-muted-foreground/70 mb-6 max-w-sm mx-auto">
          Choose from your detected games to view and apply optimizations.
        </p>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            size="lg"
            className={cn(
              "h-auto px-8 py-4 text-base font-semibold gap-2",
              "bg-gradient-to-r from-primary to-accent",
              "shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.5)]"
            )}
            onClick={() => onNavigate?.('games')}
          >
            <Gamepad2 className="w-5 h-5" strokeWidth={2} />
            Browse Games
          </Button>
        </motion.div>
      </motion.div>

      {/* Games Section */}
      <motion.section
        className="mt-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Detected Games</h2>
        <Card className="bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06]">
          <CardContent className="p-8">
            <motion.div
              className="flex flex-col items-center justify-center py-6 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className={cn(
                  "w-16 h-16 flex items-center justify-center rounded-full mb-6",
                  "glass border border-border/30"
                )}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Gamepad2 className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
              </motion.div>
              <h3 className="text-base font-medium text-foreground mb-2">No games detected yet</h3>
              <p className="text-sm text-muted-foreground/70 max-w-sm">
                Visit the Games page to scan for installed games and configure optimizations.
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}

export default Optimize;
