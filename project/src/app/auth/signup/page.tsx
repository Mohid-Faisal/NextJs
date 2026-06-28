"use client";

import { useState, useEffect, Suspense } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { ArrowLeft, Check, Building2, User, Mail, Lock } from "lucide-react";
import { ZodError } from "zod";
import { signupSchema } from "@/zodschemas/signupSchema";
import Particles from "@/components/Particles";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuroraBackground } from "@/components/ui/aurora-background";

type Plan = {
  id: number;
  code: string;
  name: string;
  priceMonthlyUsd: number;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  features?: Record<string, unknown> | null;
};

const getPasswordStrength = (password: string) => {
  const strong = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const medium = /^(?=.*[a-zA-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

  if (strong.test(password)) return "strong";
  if (medium.test(password)) return "medium";
  return "weak";
};

const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"user" | "org">("user");
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "" });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"signup" | "verification">("signup");
  const [verificationCode, setVerificationCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  // Pre-fill email from query parameter if present (from team invitation link)
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setForm((prev) => ({ ...prev, email: emailParam }));
    }
  }, [searchParams]);

  // Fetch plans for organization signup
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        if (res.ok && data.plans?.length) {
          setPlans(data.plans);
          setSelectedPlan(data.plans[0].code);
        }
      } catch (err) {
        console.error("Failed to load plans:", err);
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = verificationCode.split('');
    newCode[index] = value;
    setVerificationCode(newCode.join(''));
    if (value && index < 5) {
      const nextInput = document.getElementById(`verification-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`verification-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData);
      const lastIndex = Math.min(pastedData.length - 1, 5);
      const lastInput = document.getElementById(`verification-${lastIndex}`);
      if (lastInput) lastInput.focus();
    }
  };

  const handleSignup = async () => {
    try {
      setIsLoading(true);

      let payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };

      if (tab === "org") {
        if (!form.companyName.trim()) {
          toast.error("Company name is required for workspaces.");
          setIsLoading(false);
          return;
        }
        payload.companyName = form.companyName.trim();
        payload.planCode = selectedPlan || "starter";
      }

      // Basic Zod schema check (shares structure check)
      signupSchema.parse({ name: payload.name, email: payload.email, password: payload.password });

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUserId(data.userId);
        setStep("verification");
        toast.success("Verification code sent to your email!");
      } else {
        toast.error(data.message || "Signup failed. Try again.");
      }
    } catch (err) {
      if (err instanceof ZodError) {
        toast.error(err.issues[0].message);
      } else {
        console.error("Signup error:", err);
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    try {
      setIsLoading(true);
      if (!userId) {
        toast.error("User ID not found. Please try signing up again.");
        return;
      }

      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, verificationCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        setTimeout(() => router.push("/auth/login"), 3000);
      } else {
        toast.error(data.message || "Verification failed. Try again.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("An unexpected error occurred during verification.");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = getPasswordStrength(form.password);
  const strengthColor =
    strength === "strong"
      ? "bg-green-600"
      : strength === "medium"
      ? "bg-yellow-500"
      : "bg-red-500";

  const Background = () =>
    isDark ? (
      <div className="absolute inset-0 z-0">
        <Particles
          particleColors={["#ffffff", "#4f8fff", "#a78bfa"]}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={false}
          alphaParticles={false}
          sizeRandomness={1}
          cameraDistance={20}
        />
      </div>
    ) : (
      <AuroraBackground />
    );

  if (step === "verification") {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#030014]' : 'bg-white'}`}>
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>
        <Background />
        <motion.div
          className="w-full max-w-md relative z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <h1 className={`text-3xl font-bold text-center mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Verify Your Email
          </h1>

          <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xl">
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  We've sent a 6-digit verification code to:
                </p>
                <p className="font-semibold text-primary mt-2">{form.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Input
                      key={index}
                      id={`verification-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={verificationCode[index] || ''}
                      onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      placeholder="0"
                      maxLength={1}
                      className="w-12 h-12 text-center text-xl font-semibold border-2 focus:border-primary bg-white dark:bg-slate-950"
                      autoComplete="off"
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={handleVerification}
                className="w-full mt-2 text-lg"
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => setStep("signup")}
                  className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  ← Back to Signup
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#030014]' : 'bg-white'}`}>
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      <Background />
      <motion.div
        className="w-full max-w-xl relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Link
          href="/"
          className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className={`text-3xl font-extrabold text-center mb-2 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Join Our Platform
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-6">
          Sign up to join an existing courier workspace or create a brand new one.
        </p>

        <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <CardContent className="p-6">
            
            {/* Animated Tab Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-6 relative">
              <button
                type="button"
                onClick={() => setTab("user")}
                className="flex-1 py-2 text-sm font-semibold relative z-10 transition-colors text-center cursor-pointer focus:outline-none"
              >
                <span className={tab === "user" ? "text-slate-900 dark:text-white" : "text-slate-500"}>User Sign Up</span>
                {tab === "user" && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-xs -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("org")}
                className="flex-1 py-2 text-sm font-semibold relative z-10 transition-colors text-center cursor-pointer focus:outline-none"
              >
                <span className={tab === "org" ? "text-slate-900 dark:text-white" : "text-slate-500"}>Create Workspace</span>
                {tab === "org" && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-xs -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {tab === "org" && (
                  <motion.div
                    key="company-name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="companyName">Company Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        name="companyName"
                        value={form.companyName}
                        onChange={handleChange}
                        placeholder="Acme Logistics"
                        className="pl-9 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Jane Doe"
                    className="pl-9 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tab === "org" ? "Work Email" : "Email"}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="pl-9 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="pl-9 pr-10 bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none"
                  >
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>

                {form.password && (
                  <>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-slate-800 mt-2 overflow-hidden">
                      <motion.div
                        className={`h-full ${strengthColor}`}
                        initial={{ width: 0 }}
                        animate={{
                          width:
                            strength === "strong"
                              ? "100%"
                              : strength === "medium"
                              ? "66%"
                              : "33%",
                        }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <p
                      className={`text-xs font-semibold ${
                        strength === "strong"
                          ? "text-green-600"
                          : strength === "medium"
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    >
                      Password strength: {strength}
                    </p>
                  </>
                )}
              </div>

              <AnimatePresence mode="wait">
                {tab === "org" && plans.length > 0 && (
                  <motion.div
                    key="plans-selection"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <Label>Choose a Plan</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {plans.map((plan) => {
                        const active = selectedPlan === plan.code;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelectedPlan(plan.code)}
                            className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer focus:outline-none ${
                              active
                                ? "border-primary ring-2 ring-primary/40 bg-primary/5 dark:bg-primary/10"
                                : "border-slate-200 dark:border-slate-800 hover:border-primary/50 bg-white dark:bg-slate-950"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm capitalize">{plan.name}</span>
                              {active && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="text-xl font-extrabold mt-1.5">${plan.priceMonthlyUsd}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                            <ul className="mt-2 text-[11px] text-muted-foreground space-y-1 list-none pl-0">
                              <li className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-400"></span>{plan.maxUsers} users</li>
                              <li className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-400"></span>{plan.maxShipmentsPerMonth.toLocaleString()} shipments</li>
                            </ul>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={handleSignup}
                className="w-full mt-4 text-lg py-6"
                disabled={strength === "weak" || isLoading}
              >
                {isLoading ? "Please wait..." : tab === "org" ? "Create Workspace" : "Sign Up"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground my-4">
                <div className="h-px bg-gray-200 dark:bg-slate-800 w-full" />
                or
                <div className="h-px bg-gray-200 dark:bg-slate-800 w-full" />
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full flex items-center gap-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                  <FcGoogle size={20} />
                  Continue with Google
                </Button>
              </div>

              <div className="text-sm text-center mt-6">
                <p className="text-muted-foreground">
                  Already a user?{" "}
                  <Link href="/auth/login" className="text-primary hover:underline font-semibold">
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default function UnifiedSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#030014] text-white">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium animate-pulse">Loading signup...</p>
        </div>
      </div>
    }>
      <SignupPage />
    </Suspense>
  );
}

