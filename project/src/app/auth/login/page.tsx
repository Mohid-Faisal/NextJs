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
    {/* Grid pattern background */}
    <div 
      className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70"
    />
    {/* Soft glowing ambient blobs */}
    <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-300/40 dark:bg-indigo-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
    <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-purple-300/40 dark:bg-purple-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
    <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] rounded-full bg-blue-300/25 dark:bg-blue-600/10 blur-[100px] pointer-events-none" />
    {isDark ? (
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
    ) : null}
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
    <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#030014]' : 'bg-white'}`}>
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Premium background */}
      <Background isDark={isDark} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[440px] relative z-10"
      >
        <Link
          href="/"
          className={`inline-flex items-center gap-2 text-xs font-semibold mb-6 transition-colors px-2 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>

        <Card className="backdrop-blur-xl bg-white/45 dark:bg-slate-950/45 border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-3xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            {/* Header info */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 dark:shadow-none mb-4">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Welcome back
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                Log in to access your dashboard, shipments, and billing settings.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className="pl-10 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Password</Label>
                  <Link
                    href="/auth/reset-password"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all duration-200 text-sm"
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

              {/* Login Button */}
              <Button 
                onClick={handleLogin} 
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all text-sm mt-2 flex items-center justify-center cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>

            {/* OR Divider */}
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground py-1">
              <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 w-full" />
              <span>or</span>
              <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 w-full" />
            </div>

            {/* Google Authentication */}
            <Button
              variant="outline"
              className="w-full h-11 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <FcGoogle size={18} />
              Continue with Google
            </Button>

            {/* Bottom Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-center pt-2"
            >
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                New to our platform?{" "}
                <Link
                  href="/auth/signup"
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
