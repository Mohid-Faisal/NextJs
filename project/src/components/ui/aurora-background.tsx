"use client";

import { motion } from "framer-motion";

export function AuroraBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Vivid animated gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #e0e7ff 0%, #dbeafe 20%, #f0e6ff 40%, #fce7f3 60%, #dbeafe 80%, #e0e7ff 100%)",
        }}
      />

      {/* Large animated gradient blob - top left */}
      <motion.div
        className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0.15) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 60, 120, 0],
          scale: [1, 1.2, 0.95, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Large animated gradient blob - bottom right */}
      <motion.div
        className="absolute -bottom-32 -right-20 w-[650px] h-[650px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.35) 0%, rgba(236,72,153,0.12) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          x: [0, -80, -30, 0],
          y: [0, -90, -40, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Medium blob - center */}
      <motion.div
        className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 40%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{
          x: [0, -60, 80, 0],
          y: [0, 80, -40, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Floating glassmorphic shapes */}
      <motion.div
        className="absolute top-[15%] right-[18%] w-20 h-20 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.25)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.15)",
        }}
        animate={{
          y: [0, -25, 0],
          rotate: [0, 15, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute bottom-[20%] left-[12%] w-16 h-16 rounded-full"
        style={{
          background: "rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 8px 32px rgba(236,72,153,0.15)",
        }}
        animate={{
          y: [0, -30, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <motion.div
        className="absolute top-[55%] right-[10%] w-12 h-12 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 8px 32px rgba(59,130,246,0.12)",
        }}
        animate={{
          y: [0, -20, 0],
          rotate: [0, -20, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      <motion.div
        className="absolute top-[10%] left-[25%] w-10 h-10 rounded-lg"
        style={{
          background: "rgba(255,255,255,0.22)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.1)",
        }}
        animate={{
          y: [0, -18, 0],
          rotate: [0, 25, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />

      <motion.div
        className="absolute bottom-[12%] right-[30%] w-14 h-14 rounded-full"
        style={{
          background: "rgba(255,255,255,0.28)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.45)",
          boxShadow: "0 8px 32px rgba(168,85,247,0.15)",
        }}
        animate={{
          y: [0, -22, 0],
          x: [0, -12, 0],
        }}
        transition={{
          duration: 6.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
      />

      <motion.div
        className="absolute top-[40%] left-[8%] w-24 h-24 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 8px 32px rgba(59,130,246,0.1)",
        }}
        animate={{
          y: [0, -15, 0],
          rotate: [0, -10, 0],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />
    </div>
  );
}
