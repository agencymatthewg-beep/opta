import { motion } from "framer-motion";

/**
 * Background - Animated gradient mesh with grid overlay
 *
 * Creates an immersive atmospheric background with:
 * - Animated gradient mesh that slowly drifts
 * - Subtle circuit/grid pattern overlay
 * - Performance optimized with GPU acceleration
 */
export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Gradient Mesh Layer */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, hsl(270 60% 20% / 0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, hsl(280 70% 25% / 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, hsl(260 50% 15% / 0.5) 0%, transparent 60%),
            hsl(260 25% 6%)
          `,
        }}
      >
        {/* Animated orbs for subtle movement */}
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, hsl(270 70% 30% / 0.3) 0%, transparent 70%)",
            left: "10%",
            top: "20%",
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px]"
          style={{
            background: "radial-gradient(circle, hsl(280 80% 35% / 0.25) 0%, transparent 70%)",
            right: "5%",
            bottom: "10%",
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, -20, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[80px]"
          style={{
            background: "radial-gradient(circle, hsl(260 60% 25% / 0.35) 0%, transparent 70%)",
            left: "50%",
            top: "60%",
            transform: "translateX(-50%)",
          }}
          animate={{
            y: [0, -30, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Grid Pattern Overlay */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        style={{
          backgroundImage: `
            linear-gradient(hsl(270 50% 40% / 0.08) 1px, transparent 1px),
            linear-gradient(90deg, hsl(270 50% 40% / 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 70%)",
        }}
      />

      {/* Noise texture overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default Background;
