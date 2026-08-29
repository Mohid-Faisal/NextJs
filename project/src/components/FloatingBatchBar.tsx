"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckSquare } from "lucide-react";

export interface BatchAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline";
}

interface FloatingBatchBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BatchAction[];
}

export default function FloatingBatchBar({
  selectedCount,
  onClearSelection,
  actions,
}: FloatingBatchBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-850/95 text-white shadow-2xl backdrop-blur-md border border-slate-700/60 dark:border-zinc-700"
        >
          {/* Selected badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700 dark:border-zinc-700">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold font-mono text-indigo-200">
              {selectedCount}
            </span>
            <span className="text-xs text-slate-300">selected</span>
            <button
              onClick={onClearSelection}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {actions.map((action, i) => {
              const Icon = action.icon;
              const isDestructive = action.variant === "destructive";

              return (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isDestructive
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 shadow-sm"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-300" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
