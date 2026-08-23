"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Barcode,
  Clock,
  ShieldCheck,
  Building2,
  Receipt,
  Boxes,
  Database,
  Lock,
  Globe2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroSectionRef = useRef<HTMLDivElement | null>(null);

  // Workflow Simulator State
  const [simStep, setSimStep] = useState(1);
  const [simOrigin, setSimOrigin] = useState("Lahore Hub");
  const [simDestination, setSimDestination] = useState("London Heathrow (LHR)");
  const [simWeight, setSimWeight] = useState(4.5);
  const [simClient, setSimClient] = useState("Apex Global Trading Ltd");

  // Normalized Scroll Progress & Progress-Locked Hero Text
  const [progress, setProgress] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    // Direct preloading & decoding
    video.src = "/assets/hero.mp4";
    video.load();

    const handleLoadedData = () => {
      setVideoLoaded(true);
      // Force initial frame decode in Chromium
      try {
        video.currentTime = 0.001;
      } catch {
        // ignore
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);

    // Scroll Progress Tracker
    let targetProgress = 0;
    let currentProgress = 0;
    let animId: number;

    const handleScroll = () => {
      if (!heroSectionRef.current) return;
      const rect = heroSectionRef.current.getBoundingClientRect();
      const max = rect.height - window.innerHeight;
      if (max > 0) {
        targetProgress = Math.max(0, Math.min(1, -rect.top / max));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    // 60fps Loop for video scrubbing
    const scrubLoop = () => {
      currentProgress += (targetProgress - currentProgress) * 0.15;
      setProgress(targetProgress);

      if (video.duration && !video.seeking) {
        const targetTime = currentProgress * video.duration;
        if (Math.abs(video.currentTime - targetTime) > 0.02) {
          video.currentTime = targetTime;
        }
      }

      animId = requestAnimationFrame(scrubLoop);
    };

    animId = requestAnimationFrame(scrubLoop);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Helper for progress-locked opacity calculation
  const calcOpacity = (prog: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) => {
    if (prog < enterStart || prog > exitEnd) return 0;
    if (prog < enterEnd) return (prog - enterStart) / (enterEnd - enterStart);
    if (prog > exitStart) return Math.max(0, 1 - (prog - exitStart) / (exitEnd - exitStart));
    return 1.0;
  };

  // Phase 0: Fully visible at 0%, starts exiting at 0.22, gone by 0.32
  const op0 = progress <= 0.22 ? 1.0 : calcOpacity(progress, 0.0, 0.0, 0.22, 0.32);
  // Phase 1: Enters 0.30 - 0.40, fully visible 0.40 - 0.60, exits 0.60 - 0.70
  const op1 = calcOpacity(progress, 0.30, 0.40, 0.60, 0.70);
  // Phase 2: Enters 0.68 - 0.78, fully visible 0.78 - 1.0
  const op2 = progress >= 0.78 ? 1.0 : calcOpacity(progress, 0.68, 0.78, 1.0, 1.0);

  return (
    <div className="relative w-full overflow-x-clip bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* ========================================================================= */}
      {/* 1. 400vh STICKY SCROLL HERO VIDEO ENGINE                                 */}
      {/* ========================================================================= */}
      <div ref={heroSectionRef} id="hero-section" className="relative h-[400vh] w-full">
        <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center bg-slate-950">
          {/* Instant Background Poster (Visible before/during video load) */}
          <div className="absolute inset-0 w-full h-full">
            <img
              src="/assets/phase0_cargo.jpg"
              alt="PSS Global Cargo Telemetry"
              className="w-full h-full object-cover brightness-90"
            />
          </div>

          {/* Edge-to-Edge Hero Video */}
          <video
            ref={heroVideoRef}
            id="hero-video"
            poster="/assets/phase0_cargo.jpg"
            src="/assets/hero.mp4"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none brightness-90 transition-opacity duration-500"
            playsInline
            muted
            autoPlay={false}
            preload="auto"
          />

          {/* Cinematic Vignette & Dynamic Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/70 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/80 pointer-events-none" />

          {/* Phase 0 Typography (0% - 25% Scroll) */}
          <div
            className="phase-text absolute bottom-20 left-6 sm:left-12 md:left-24 max-w-2xl pointer-events-auto transition-all duration-75"
            style={{
              opacity: typeof op0 === "number" ? op0.toFixed(3) : "1",
              transform: `translateY(${-progress * 40}px)`,
              pointerEvents: (typeof op0 === "number" ? op0 : 1) > 0.3 ? "auto" : "none"
            }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold tracking-wider uppercase border border-cyan-500/30 mb-4 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Logistics ERP & Financial OS
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
              The Operating System for Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Logistics & Couriers</span>.
            </h1>
            <p className="mt-4 text-base sm:text-xl text-slate-200 leading-relaxed max-w-xl font-normal drop-shadow">
              Unite live cargo telemetry, high-speed AWB barcoding, and automated double-entry accounting in a unified multi-tenant command platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#interactive-demo"
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-200 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 backdrop-blur-md transition-all hover:text-white"
              >
                Explore Live Sandbox
              </Link>
            </div>
          </div>

          {/* Phase 1 Typography (30% - 60% Scroll) */}
          <div
            className="phase-text absolute top-1/3 right-6 sm:right-12 md:right-24 max-w-xl text-right pointer-events-auto transition-all duration-75"
            style={{
              opacity: op1.toFixed(3),
              transform: `translateY(${(0.45 - progress) * 30}px)`,
              pointerEvents: op1 > 0.3 ? "auto" : "none"
            }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase border border-blue-500/30 mb-4 backdrop-blur-md">
              <Barcode className="h-3.5 w-3.5" />
              Automated Parcel Ops
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
              High-Velocity Barcode & <span className="text-cyan-400">AWB Automation</span>.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed font-normal drop-shadow">
              Generate batch airway bills, auto-calculate remote surcharge zones, and process bulk CSV bookings at sub-second speeds.
            </p>
          </div>

          {/* Phase 2 Typography (65% - 95% Scroll) */}
          <div
            className="phase-text absolute bottom-24 left-6 sm:left-12 md:left-24 max-w-xl pointer-events-auto transition-all duration-75"
            style={{
              opacity: op2.toFixed(3),
              transform: `translateY(${(0.80 - progress) * 30}px)`,
              pointerEvents: op2 > 0.3 ? "auto" : "none"
            }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wider uppercase border border-emerald-500/30 mb-4 backdrop-blur-md">
              <TrendingUp className="h-3.5 w-3.5" />
              Real-Time Fintech Core
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
              Double-Entry Ledgers & <span className="text-emerald-400">P&L Financials</span>.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed font-normal drop-shadow">
              Every dispatched parcel instantly posts journal vouchers, calculates FIFO payment reconciliations, and updates trial balance statements.
            </p>
          </div>

          {/* Scroll Cue Indicator */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-xs font-medium text-slate-400 tracking-wider uppercase transition-opacity duration-300 pointer-events-none"
            style={{ opacity: progress < 0.1 ? 1 : 0 }}
          >
            <span>Scroll to Explore</span>
            <div className="w-5 h-9 rounded-full border-2 border-slate-500 flex items-start justify-center p-1">
              <div className="w-1 h-2 rounded-full bg-cyan-400 animate-bounce" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATS & REPUTATION STRIP                                              */}
      {/* ========================================================================= */}
      <section className="relative z-10 border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              2.4M+
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              AWBs Generated Annually
            </p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              $85M+
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Freight Invoices Audited
            </p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              99.99%
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Enterprise Cloud SLA
            </p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              450+
            </p>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Courier Workspaces Active
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. VISUAL SHOWCASE TILES                                                 */}
      {/* ========================================================================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-widest uppercase">
            Platform Visuals
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Purpose-Built for End-to-End Courier Scale
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            A unified suite powering high-velocity sorting facilities, live fleet telemetry, and enterprise general ledgers.
          </p>
        </div>

        {/* Visual Feature 1: Operations Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Global Operations Center
            </span>
            <h3 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Real-Time Freight Telemetry & Routing
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
              Monitor international flight routes, customs clearance milestones, and regional delivery hubs with second-by-second telematics.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">Live AWB Tracking</span>
              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">Zone Surcharges</span>
              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">Remote Area Matrix</span>
            </div>
          </div>
          <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl group">
            <img
              src="/assets/phase0_cargo.jpg"
              alt="Global Cargo Operations"
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>

        {/* Visual Feature 2: High-Speed Warehouse Sorting */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl group">
            <img
              src="/assets/phase1_warehouse.jpg"
              alt="Automated Warehouse Barcode Scanning"
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Automated Sorting Facility
            </span>
            <h3 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Instant Barcode & Thermal AWB Label Dispatch
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
              Direct-spool to 4x6 Zebra thermal printers and industrial barcode readers. Batch import spreadsheets and generate 1,000+ airway bills in under 2 seconds.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Bulk Excel Uploader</span>
              <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">GS1-128 Barcodes</span>
              <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Automated Manifests</span>
            </div>
          </div>
        </div>

        {/* Visual Feature 3: Double-Entry Financial Suite */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Logistics Fintech Core
            </span>
            <h3 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Double-Entry General Ledger & Real-Time P&L
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
              Every dispatched package automatically posts debits to Accounts Receivable and credits to Freight Revenue with zero manual bookkeeping.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Automated FIFO Payments</span>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Trial Balance & P&L</span>
              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Debit/Credit Vouchers</span>
            </div>
          </div>
          <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl group">
            <img
              src="/assets/phase2_fintech.jpg"
              alt="Fintech Accounting Command Center"
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE SHIPMENT-TO-INVOICE WORKFLOW SIMULATOR                     */}
      {/* ========================================================================= */}
      <section id="interactive-demo" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1422] p-8 md:p-12 shadow-2xl overflow-hidden relative">
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Live Interactive Sandbox
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Experience the Instant Dispatch-to-Ledger Flow
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Test how PSS bridges physical cargo bookings with automatic general ledger postings.
            </p>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-2 sm:gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4 overflow-x-auto">
            <button
              onClick={() => setSimStep(1)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
                simStep === 1
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span>1. Booking & AWB</span>
            </button>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            <button
              onClick={() => setSimStep(2)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
                simStep === 2
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span>2. Rate & Fuel Surcharge</span>
            </button>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            <button
              onClick={() => setSimStep(3)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
                simStep === 3
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span>3. General Ledger Journal Entry</span>
            </button>
          </div>

          {/* Interactive Screen Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Column: Form Controls */}
            <div className="space-y-4 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Sandbox Parameters
              </h4>

              <div className="space-y-3 text-xs sm:text-sm">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Organization:
                  </label>
                  <select
                    value={simClient}
                    onChange={(e) => setSimClient(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option>Apex Global Trading Ltd</option>
                    <option>Pacific Ocean Freight Corp</option>
                    <option>Skyline E-Commerce Direct</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Origin Hub:
                    </label>
                    <input
                      type="text"
                      value={simOrigin}
                      onChange={(e) => setSimOrigin(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Destination:
                    </label>
                    <input
                      type="text"
                      value={simDestination}
                      onChange={(e) => setSimDestination(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Chargeable Weight:
                    </label>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{simWeight} KG</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={simWeight}
                    onChange={(e) => setSimWeight(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimStep((prev) => (prev > 1 ? prev - 1 : 3))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                  onClick={() => setSimStep((prev) => (prev < 3 ? prev + 1 : 1))}
                >
                  Next Step <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Right Column: Live Output Screen */}
            <div className="p-6 rounded-2xl bg-slate-950 text-white font-mono text-xs space-y-4 border border-slate-800 shadow-xl">
              {simStep === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-cyan-400 font-bold">AIRWAY BILL GENERATED</span>
                    <span className="text-slate-400">AWB-8930129</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-lg space-y-1">
                    <p className="text-slate-400">Consignee: {simClient}</p>
                    <p className="text-slate-400">Route: {simOrigin} &rarr; {simDestination}</p>
                    <p className="text-slate-400">Weight: {simWeight} KG</p>
                  </div>
                  <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-cyan-300">
                    &bull; 2D Barcode string encoded with encrypted tracking payload.
                  </div>
                </div>
              )}

              {simStep === 2 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-blue-400 font-bold">RATE ENGINE CALCULATION</span>
                    <span className="text-slate-400">Zone 4 (International Air)</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Base Freight ({simWeight} KG @ $28.00/kg):</span>
                      <span>${(simWeight * 28).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fuel Surcharge (14.5%):</span>
                      <span>${(simWeight * 28 * 0.145).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Customs Clearance:</span>
                      <span>$25.00</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-sm text-emerald-400">
                      <span>Total Invoice Amount:</span>
                      <span>${(simWeight * 28 * 1.145 + 25).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {simStep === 3 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-emerald-400 font-bold">JOURNAL VOUCHER #JV-2026-819</span>
                    <span className="text-slate-400">AUTO-POSTED</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800">
                        <th className="pb-1">Account</th>
                        <th className="pb-1 text-right">Debit</th>
                        <th className="pb-1 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      <tr>
                        <td className="pt-2 text-slate-300">1100 - A/R ({simClient})</td>
                        <td className="pt-2 text-right text-emerald-400">${(simWeight * 28 * 1.145 + 25).toFixed(2)}</td>
                        <td className="pt-2 text-right text-slate-600">-</td>
                      </tr>
                      <tr>
                        <td className="pt-1 text-slate-300">4000 - Freight Revenue</td>
                        <td className="pt-1 text-right text-slate-600">-</td>
                        <td className="pt-1 text-right text-cyan-400">${(simWeight * 28 * 1.145 + 25).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    &bull; Double-entry verified: Debit = Credit (${(simWeight * 28 * 1.145 + 25).toFixed(2)})
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. ENTERPRISE TESTIMONIALS & TRUST                                       */}
      {/* ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-slate-800">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-2">
          <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-widest uppercase">
            Customer Success
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trusted by High-Volume Logistics Networks
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              &ldquo;PSS cut our billing reconciliation from 4 days at month-end to literally zero seconds. Every AWB booked immediately creates balanced journal entries.&rdquo;
            </p>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm">
                TK
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Tariq Khan</p>
                <p className="text-xs text-slate-500">Chief Operating Officer, Orient Express Cargo</p>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              &ldquo;The multi-tenant isolation and remote area surcharge matrix allowed us to scale to 12 regional branches without any data contamination.&rdquo;
            </p>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-sm">
                SM
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Sara Mitchell</p>
                <p className="text-xs text-slate-500">Head of Logistics Tech, Velocity Freight</p>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              &ldquo;The automated inactive customer detection alerted our sales team to $180,000 in at-risk accounts that we successfully retained.&rdquo;
            </p>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm">
                DA
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Danyal Ahmed</p>
                <p className="text-xs text-slate-500">Managing Director, TransGlobal Couriers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. CONVERSION CTA BANNER                                                 */}
      {/* ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl p-10 sm:p-16 bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 border border-slate-800 text-center text-white shadow-2xl space-y-6 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider border border-cyan-500/30">
            Get Started in 5 Minutes
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto">
            Upgrade Your Courier Fleet with Enterprise Financial Precision
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-base sm:text-lg">
            Start your 14-day free trial. No credit card required. Migrate your existing customer spreadsheets in minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/contact"
              className="px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/30 transition-all hover:scale-105"
            >
              Start Free Trial Now
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 rounded-xl text-base font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700"
            >
              View Transparent Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
