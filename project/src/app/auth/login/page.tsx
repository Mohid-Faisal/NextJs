"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Cookies from "js-cookie";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ArrowLeft, Mail, Lock, Sparkles, Loader2, Search, Zap, ShieldCheck } from "lucide-react";

import { motion } from "framer-motion";
import Particles from "@/components/Particles";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Background = ({ isDark }: { isDark: boolean }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {isDark && (
      <>
        {/* Grid pattern background */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70"
        />
        {/* Soft glowing ambient blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-purple-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
        <Particles
          particleColors={['#ffffff', '#4f8fff', '#a78bfa']}
          particleCount={80}
          particleSpread={10}
          speed={0.05}
          particleBaseSize={60}
          moveParticlesOnHover={false}
          alphaParticles={true}
          sizeRandomness={1}
          cameraDistance={20}
        />
      </>
    )}
  </div>
);

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "org-suspended") {
        toast.error("Your organization has been suspended. Contact support.");
      } else {
        toast.error(decodeURIComponent(errorParam));
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      toast.error("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Login successful!");
        Cookies.set("token", data.token, { expires: 1 });
        router.push("/dashboard");
      } else {
        toast.error(data.message || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    const demoCreds = { email: "demo@psswe.com", password: "DemoUser@123" };
    setForm(demoCreds);
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoCreds),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Welcome to Unified Demo Workspace!");
        Cookies.set("token", data.token, { expires: 1 });
        router.push("/dashboard");
      } else {
        toast.error(data.message || "Demo login failed.");
      }
    } catch (err) {
      toast.error("Demo login error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-950 transition-colors duration-500 overflow-hidden">
      {/* Left panel - Connected Carrier Hub (60% width on desktop) */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-slate-50/40 dark:bg-zinc-950 flex-col justify-between p-8 xl:p-12 select-none border-r-2 border-gray-300 dark:border-zinc-800">
        {/* Ambient background glow & subtle dot texture */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-500/10 dark:bg-purple-600/15 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-35" />
        </div>

        {/* Top-left SaaS logo & badge */}
        <div className="relative z-20 flex items-center justify-between">
          <img src="/SaaS-Logo.png" alt="PSS Proxima Smart Solutions Logo" className="h-14 xl:h-16 w-auto object-contain drop-shadow-xs" />
          <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800 backdrop-blur-md shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Multi-Carrier Enterprise Platform</span>
          </div>
        </div>

        {/* Center content: Hero & Connected Carrier Hub */}
        <div className="relative z-10 my-auto flex flex-col items-start justify-center max-w-xl mx-auto w-full px-2 py-3 space-y-4 xl:space-y-5">
          <div className="flex items-center gap-2">
            <span className="h-1 w-8 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Smart Logistics, Stronger Business
            </span>
          </div>

          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            All-In-One <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-500 dark:from-indigo-400 dark:via-sky-400 dark:to-indigo-300">
              Courier & Cargo
            </span> <br />
            Management SaaS.
          </h2>

          <p className="text-xs xl:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
            A complete cloud-based solution to simplify your courier, cargo, and logistics operations, empowering you to deliver an exceptional experience to your customers.
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              onClick={() => router.push("/tracking")}
              className="bg-white hover:bg-indigo-50/60 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-indigo-600 dark:text-indigo-400 border border-indigo-600/40 dark:border-indigo-400/40 font-semibold px-4 xl:px-5 py-3 xl:py-3.5 rounded-xl shadow-xs active:scale-[0.98] transition-all text-xs xl:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Track Shipment
            </Button>

            <Button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 xl:px-5 py-3 xl:py-3.5 rounded-xl shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all text-xs xl:text-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  Live Demo
                </>
              )}
            </Button>
          </div>

          {/* Direction 1: Connected Carrier Hub 3D Scene */}
          <div className="w-full relative mt-2 pt-2">
            <div className="relative rounded-2xl bg-gradient-to-b from-white/95 via-slate-50/90 to-indigo-50/40 dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-indigo-950/30 border border-slate-200/90 dark:border-zinc-800 shadow-sm backdrop-blur-md p-4 xl:p-5">
              {/* Floating Status Badge 1 (Top-Right) */}
              <motion.div
                animate={{ y: [-2, 3, -2] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute -top-3 right-3 xl:right-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-700/80 shadow-md shadow-slate-900/5 rounded-xl px-3 py-1.5 flex items-center gap-2 z-20"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 leading-tight">Live Carrier Sync</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-medium">10+ Global APIs</p>
                </div>
              </motion.div>

              {/* Floating Badge 2 (Bottom-Left) */}
              <motion.div
                animate={{ y: [3, -3, 3] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-2.5 left-3 xl:left-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-700/80 shadow-md shadow-slate-900/5 rounded-xl px-3 py-1.5 flex items-center gap-2 z-20"
              >
                <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Zap className="w-3 h-3" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 leading-tight">Auto-Dispatch</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-medium">Instant Waybills</p>
                </div>
              </motion.div>

              {/* Floating 3D Parcel Illustration */}
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                className="relative flex items-center justify-center py-2"
              >
                <img
                  src="/boxes.png"
                  alt="Multi-carrier delivery packages"
                  className="h-28 xl:h-36 2xl:h-40 w-auto object-contain drop-shadow-md select-none pointer-events-none"
                />
              </motion.div>

              {/* Supported Carriers Pill Ribbon */}
              <div className="pt-3 mt-1 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider whitespace-nowrap">
                  Integrated Couriers
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {["FedEx", "DHL", "UPS", "DPD", "Aramex", "SkyNet", "Pakistan Post", "ParcelForce"].map((carrier) => (
                    <span
                      key={carrier}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/90 dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/50 text-slate-700 dark:text-zinc-300 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                    >
                      {carrier}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer of Left Panel */}
        <div className="text-xs text-slate-400 dark:text-zinc-500 relative z-10 flex items-center justify-between">
          <span>© {new Date().getFullYear()} PSSWWE. All rights reserved.</span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-600">Enterprise Cloud Portal</span>
        </div>
      </div>

      {/* Right panel - Form container (40% width on desktop, blending seamlessly into background) */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto bg-white dark:bg-zinc-950">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[520px] relative z-10 my-auto"
        >
          <Card className="bg-transparent border-0 shadow-none rounded-none w-full">
            <CardContent className="p-0 sm:p-4 space-y-6">
              {/* Top-left SaaS logo on mobile when absolute header is hidden */}
              <div className="sm:hidden flex justify-center mb-2">
                <img src="/SaaS-Logo.png" alt="PSS Proxima Smart Solutions Logo" className="h-20 w-auto object-contain" />
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1b26] dark:text-white text-center mb-6">
                Log in
              </h1>

              {/* Google Authentication - Centered with no text */}
              <Button
                variant="outline"
                type="button"
                onClick={() => window.location.href = "/api/auth/google"}
                className="w-full h-13 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 flex items-center justify-center transition-all cursor-pointer py-2.5"
              >
                <FcGoogle size={36} />
              </Button>

              {/* OR Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-sm uppercase">
                  <span className="bg-white dark:bg-zinc-950 px-4 text-slate-400">or</span>
                </div>
              </div>

              <div className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-600 dark:text-slate-300">Email address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className="pl-11 h-12 bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-base"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-600 dark:text-slate-300">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="pl-11 pr-11 h-12 bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <FaEyeSlash size={18} />
                      ) : (
                        <FaEye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-left pt-1">
                  <Link
                    href="/auth/reset-password"
                    className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Login Button */}
                <Button 
                  onClick={handleLogin} 
                  disabled={loading}
                  className="w-full h-12 bg-white hover:bg-indigo-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 font-semibold rounded-xl shadow-md active:scale-[0.98] transition-all text-base mt-4 flex items-center justify-center cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    "Log in"
                  )}
                </Button>
              </div>

              {/* Mobile Track Shipment & Live Demo buttons */}
              <div className="lg:hidden grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  onClick={() => router.push("/tracking")}
                  className="bg-white hover:bg-indigo-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 font-semibold h-11 rounded-xl shadow-sm active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Track Shipment
                </Button>

                <Button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-11 rounded-xl shadow-sm active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      Live Demo
                    </>
                  )}
                </Button>
              </div>

              {/* Bottom Links */}
              <div className="text-base text-center space-y-3 pt-2">
                <Link
                  href="/auth/reset-password"
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline block"
                >
                  Can't Access Your Account?
                </Link>
                
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">
                  Don't have an account?{" "}
                  <Link
                    href="/auth/signup"
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Sign Up
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
