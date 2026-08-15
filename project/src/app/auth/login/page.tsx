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
import { ArrowLeft, Mail, Lock, Sparkles, Loader2, Search } from "lucide-react";

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
      {/* Left panel - Login Intro (2/3rds width on desktop with thicker partition) */}
      <div className="hidden lg:flex lg:w-2/3 relative overflow-hidden bg-white dark:bg-zinc-950 flex-col justify-between p-6 xl:p-8 pl-6 xl:pl-8 pb-4 xl:pb-6 select-none border-r-2 border-gray-300 dark:border-zinc-800">
        {/* Top-left SaaS logo - positioned more top and left */}
        <div className="absolute top-4 xl:top-6 left-2 xl:left-3 z-20">
          <img src="/SaaS-Logo.png" alt="PSS Proxima Smart Solutions Logo" className="h-16 xl:h-20 w-auto object-contain" />
        </div>

        {/* Boxes picture - pushed slightly more to the right */}
        <div className="absolute top-[26%] xl:top-[28%] right-2 xl:right-4 z-10 pointer-events-none select-none">
          <img 
            src="/boxes.png" 
            alt="Courier Packages" 
            className="h-36 xl:h-48 2xl:h-56 w-auto object-contain" 
          />
        </div>

        {/* Center content: Text layout - indented nicely */}
        <div className="relative z-20 my-auto flex flex-col items-start justify-center max-w-xl w-full pl-6 xl:pl-8 pr-4 space-y-6">
          <div className="flex items-center gap-2">
            <span className="h-1 w-8 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Smart Logistics, Stronger Business
            </span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            All-In-One <br />
            <span className="text-indigo-600 dark:text-indigo-400">Courier & Cargo</span> <br />
            Management SaaS.
          </h2>

          <p className="text-sm xl:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg">
            A complete cloud-based solution to simplify your courier, cargo, and logistics operations, empowering you to deliver an exceptional experience to your customers.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => router.push("/tracking")}
              className="bg-white hover:bg-indigo-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 font-semibold px-5 py-4 rounded-xl shadow-sm active:scale-[0.98] transition-all text-xs xl:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Track Shipment
            </Button>

            <Button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-4 rounded-xl shadow-md active:scale-[0.98] transition-all text-xs xl:text-sm flex items-center gap-2 cursor-pointer"
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
        </div>

        {/* Footer of Left Panel - positioned more bottom and left */}
        <div className="text-xs text-slate-400 dark:text-zinc-500 absolute bottom-3 xl:bottom-4 left-4 xl:left-6 z-10">
          © {new Date().getFullYear()} PSSWWE. All rights reserved.
        </div>
      </div>

      {/* Right panel - Form container (1/3rd width on desktop, blending seamlessly into background) */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto bg-white dark:bg-zinc-950">
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
