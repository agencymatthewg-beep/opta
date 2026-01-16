import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Zap, Gamepad2 } from 'lucide-react';

function Optimize() {
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

      {/* Hero Section */}
      <motion.div
        className="text-center py-12 mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            size="lg"
            className={cn(
              "h-auto px-12 py-5 text-lg font-semibold gap-2",
              "disabled:glow-none disabled:bg-card disabled:text-muted-foreground",
              "bg-gradient-to-r from-primary to-accent"
            )}
            disabled
          >
            <Zap className="w-6 h-6" strokeWidth={2} />
            One-Click Optimize
          </Button>
        </motion.div>
        <p className="mt-4 text-sm text-muted-foreground">
          Automatically optimize your system for maximum gaming performance
        </p>
      </motion.div>

      {/* Games Section */}
      <motion.section
        className="mt-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Detected Games</h2>
        <Card className="glass">
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
