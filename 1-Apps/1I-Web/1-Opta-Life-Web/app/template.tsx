"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, filter: "blur(10px)", scale: 0.96, y: 15 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
            exit={{ opacity: 0, filter: "blur(5px)", scale: 0.98, y: -10 }}
            transition={{ ease: [0.76, 0, 0.24, 1], duration: 0.6 }} // Cinematic ease
            className="w-full"
        >
            {children}
        </motion.div>
    );
}
