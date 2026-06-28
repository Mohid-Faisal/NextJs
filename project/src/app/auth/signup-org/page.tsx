"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ArrowLeft, Check, Building2 } from "lucide-react";
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

export default function SignupOrgPage() {
  const router = useRouter();
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        if (res.ok && data.plans?.length) {
          setPlans(data.plans);
          setSelectedPlan(data.plans[0].code);
        }
      } catch {
        // plans are optional; signup falls back to starter
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = verificationCode.split("");
    newCode[index] = value;
    setVerificationCode(newCode.join(""));
    if (value && index < 5) document.getElementById(`vo-${index + 1}`)?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      document.getElementById(`vo-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d{6}$/.test(pasted)) setVerificationCode(pasted);
  };

  const strength = getPasswordStrength(form.password);
  const canSubmit =
    form.companyName.trim() &&
    form.name.trim() &&
    /\S+@\S+\.\S+/.test(form.email) &&
    strength !== "weak" &&
    !isLoading;

  const handleSignup = async () => {
    if (!canSubmit) {
      toast.error("Please complete all fields with a valid email and stronger password.");
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          companyName: form.companyName.trim(),
          planCode: selectedPlan || "starter",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserId(data.userId);
        setStep("verification");
        toast.success("Verification code sent to your email!");
      } else {
        toast.error(data.message || "Signup failed. Try again.");
      }
    } catch (err) {
      console.error("Org signup error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!userId) {
      toast.error("Session expired. Please sign up again.");
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, verificationCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Email verified! You can now log in.");
        setTimeout(() => router.push("/auth/login"), 2500);
      } else {
        toast.error(data.message || "Verification failed. Try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error("An unexpected error occurred during verification.");
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>
        <Background />
        <motion.div
          className="w-full max-w-md relative z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className={`text-3xl font-bold text-center mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
            Verify Your Email
          </h1>
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-center text-muted-foreground">
                We sent a 6-digit code to <span className="font-semibold text-primary">{form.email}</span>
              </p>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Input
                    key={i}
                    id={`vo-${i}`}
                    type="text"
                    inputMode="numeric"
                    value={verificationCode[i] || ""}
                    onChange={(e) => handleVerificationCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    className="w-12 h-12 text-center text-xl font-semibold border-2 focus:border-primary"
                    autoComplete="off"
                  />
                ))}
              </div>
              <Button
                onClick={handleVerification}
                className="w-full text-lg"
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
              <Button variant="ghost" className="w-full text-sm" onClick={() => setStep("signup")}>
                ← Back
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      <Background />
      <motion.div
        className="w-full max-w-lg relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Link
          href="/"
          className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className={`text-3xl font-bold text-center mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
          Start your courier workspace
        </h1>
        <p className="text-center text-muted-foreground mb-6">14-day free trial. No card required.</p>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Acme Logistics"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              {form.password && (
                <p
                  className={`text-xs font-medium ${
                    strength === "strong" ? "text-green-600" : strength === "medium" ? "text-yellow-500" : "text-red-500"
                  }`}
                >
                  Password strength: {strength}
                </p>
              )}
            </div>

            {plans.length > 0 && (
              <div className="space-y-2">
                <Label>Choose a plan</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {plans.map((plan) => {
                    const active = selectedPlan === plan.code;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.code)}
                        className={`text-left rounded-lg border p-3 transition-all ${
                          active
                            ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold capitalize">{plan.name}</span>
                          {active && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="text-lg font-bold">${plan.priceMonthlyUsd}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                        <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          <li>{plan.maxUsers} users</li>
                          <li>{plan.maxShipmentsPerMonth.toLocaleString()} shipments/mo</li>
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={handleSignup} className="w-full text-lg" disabled={!canSubmit}>
              {isLoading ? "Creating workspace..." : "Create workspace"}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
