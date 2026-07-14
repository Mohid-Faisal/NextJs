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
import { ArrowLeft, Mail, Lock, Sparkles, Loader2 } from "lucide-react";

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
    if (searchParams.get("error") === "org-suspended") {
      toast.error("Your organization has been suspended. Contact support.");
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

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F4F5F9] dark:bg-zinc-950 transition-colors duration-500">
      {/* Left panel - Punchline & Logo (Hidden on mobile, visible on lg/xl) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black text-white flex-col justify-between p-12 select-none border-r border-zinc-800">
        {/* Background Image aligned to right-center to show logistics vertical grid */}
        <div 
          className="absolute inset-0 bg-cover opacity-80 z-0"
          style={{ 
            backgroundImage: `url('/banner_new.jpg')`,
            backgroundPosition: 'right center'
          }}
        />
        {/* Subtle black overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/50 z-0" />

        {/* Concentric abstract geometric line overlays matching SaleSkip layout */}
        <div className="absolute inset-0 opacity-5 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] border-2 border-white rounded-full" />
          <div className="absolute top-[-30%] left-[-30%] w-[160%] h-[160%] border-2 border-white rounded-full" />
          <div className="absolute top-[-40%] left-[-40%] w-[180%] h-[180%] border border-white rounded-full" />
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] border border-white rounded-full" />
        </div>

        {/* Header decoration */}
        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest relative z-10">
          PSS Worldwide Express
        </div>

        {/* Centered Content */}
        <div className="relative z-10 my-auto flex flex-col items-center text-center space-y-8 max-w-md mx-auto">
          {/* Logo container in the middle - white background card to make the logo perfectly visible */}
          <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.35)] border border-white/10 w-full max-w-[290px] flex items-center justify-center transition-all duration-300 hover:scale-[1.03]">
            <img src="/SaaS-Logo.png" alt="PSS Worldwide Express Logo" className="w-full h-auto object-contain" />
          </div>

          {/* Punchline */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="h-0.5 w-6 bg-amber-400 rounded-full" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">
                Reliable Operations For Your Business
              </span>
              <span className="h-0.5 w-6 bg-amber-400 rounded-full" />
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Courier, Cargo & Logistics Management Software
            </h2>
            <p className="text-sm text-blue-100/90 leading-relaxed max-w-sm">
              Effortlessly manage your delivery operations with iCargos, an all-in-one White Label Courier Tracking System designed to streamline your supply chain.
            </p>
          </div>
        </div>

        {/* Footer of Left Panel */}
        <div className="text-xs text-blue-200 relative z-10">
          © {new Date().getFullYear()} PSS Worldwide Express. All rights reserved.
        </div>
      </div>

      {/* Right panel - Form container */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[460px] relative z-10"
        >
          <Card className="bg-white dark:bg-zinc-900 border border-gray-200/50 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden w-full">
            <CardContent className="p-8 sm:p-10 space-y-6">
              <h1 className="text-3xl font-extrabold text-[#1d1b26] dark:text-white text-center mb-6">
                Log in
              </h1>

              {/* Google Authentication - Centered with no text */}
              <Button
                variant="outline"
                type="button"
                className="w-full h-11 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 flex items-center justify-center transition-all cursor-pointer"
              >
                <FcGoogle size={20} />
              </Button>

              {/* OR Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-zinc-900 px-4 text-slate-400">or</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className="pl-10 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-205 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-sm"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-205 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                    >
                      {showPassword ? (
                        <FaEyeSlash size={16} />
                      ) : (
                        <FaEye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link - Underneath the password field aligned to start */}
                <div className="text-left pt-1">
                  <Link
                    href="/auth/reset-password"
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-450 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Login Button */}
                <Button 
                  onClick={handleLogin} 
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all text-sm mt-4 flex items-center justify-center cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Log in"
                  )}
                </Button>
              </div>

              {/* Bottom Links */}
              <div className="text-sm text-center space-y-3 pt-4">
                <Link
                  href="/auth/reset-password"
                  className="text-indigo-600 dark:text-indigo-455 font-bold hover:underline block"
                >
                  Can't Access Your Account?
                </Link>
                
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Don't have an account?{" "}
                  <Link
                    href="/auth/signup"
                    className="text-indigo-600 dark:text-indigo-455 font-bold hover:underline"
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
