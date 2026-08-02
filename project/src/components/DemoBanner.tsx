"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { Sparkles, Info, ChevronDown, ChevronUp, PackagePlus, Users, FileText, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const token = Cookies.get("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        if (decoded?.email === "demo@psswe.com" || decoded?.orgSlug === "pss-demo") {
          setIsDemo(true);
        }
      }
    } catch {
      setIsDemo(false);
    }
  }, []);

  // Also check if org info matches from /api/org/current if needed
  useEffect(() => {
    fetch("/api/org/current")
      .then((res) => res.json())
      .then((data) => {
        if (data?.organization?.slug === "pss-demo") {
          setIsDemo(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!isDemo) return null;

  return (
    <div className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white shadow-lg border-b border-indigo-700/50">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-wide text-white">
                  Unified Live Demo Account
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400/20 border border-amber-400/40 text-amber-300">
                  Shared Live Workspace
                </span>
              </div>
              <p className="text-xs text-indigo-200 hidden sm:block">
                All created entries stay in this shared workspace so you & future visitors can see live software in action.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <Button
              asChild
              size="sm"
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Link href="/auth/signup">
                Start Private Trial
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100 transition-colors focus:outline-none flex items-center gap-1 text-xs font-medium"
              title="Toggle instructions"
            >
              <span>{expanded ? "Hide Instructions" : "Instructions"}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Instructions Panel */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-indigo-700/60 text-xs text-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <PackagePlus className="w-4 h-4 text-emerald-400" />
                1. Test Adding Shipments
              </div>
              <p className="text-[11px] text-indigo-200 leading-relaxed">
                Add test shipments or transactions. Default sample entries are <strong className="text-white">permanently preserved</strong>, while user test entries reset automatically every 24 hours.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <Users className="w-4 h-4 text-blue-400" />
                2. Demo Safeguards & Watermark
              </div>
              <p className="text-[11px] text-indigo-200 leading-relaxed">
                Branding settings are locked and waybill receipts carry a <strong className="text-white font-semibold">"DEMO MODE" watermark</strong> to prevent commercial misuse.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <ShieldCheck className="w-4 h-4 text-purple-300" />
                3. Ready for Real Business?
              </div>
              <p className="text-[11px] text-indigo-200 leading-relaxed">
                Want your own clean company workspace with your logo & clean receipts? Click <strong className="text-amber-300">Start Private Trial</strong> anytime.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
