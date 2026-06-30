"use client";

import { useState, useEffect, Suspense, useRef } from "react";
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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Sparkles,
  Zap,
  Crown,
  Clock,
  Upload,
  CreditCard,
  Landmark,
  Smartphone,
  Banknote,
  Shield,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
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

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Landmark, desc: "Wire or bank deposit" },
  { value: "EASYPAISA", label: "Easypaisa", icon: Smartphone, desc: "Mobile wallet" },
  { value: "JAZZCASH", label: "JazzCash", icon: Smartphone, desc: "Mobile wallet" },
  { value: "CASH", label: "Cash", icon: Banknote, desc: "Cash payment" },
];

// Step indicator showing progress
const StepIndicator = ({ currentStep, totalSteps, labels }: { currentStep: number; totalSteps: number; labels: string[] }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {labels.map((label, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              idx < currentStep
                ? "bg-green-500 text-white"
                : idx === currentStep
                ? "bg-indigo-600 text-white ring-4 ring-indigo-200 dark:ring-indigo-900"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400"
            }`}
          >
            {idx < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
          </div>
          <span className={`text-[10px] font-medium ${idx <= currentStep ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>
            {label}
          </span>
        </div>
        {idx < labels.length - 1 && (
          <div className={`w-8 h-0.5 mt-[-16px] transition-all duration-300 ${idx < currentStep ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />
        )}
      </div>
    ))}
  </div>
);

const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"user" | "org">("user");
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "", phone: "", address: "" });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"signup" | "plan" | "payment" | "verification" | "pending">("signup");
  const [verificationCode, setVerificationCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setForm((prev) => ({ ...prev, email: emailParam }));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        if (res.ok && data.plans?.length) {
          setPlans(data.plans);
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
    const newCode = verificationCode.split("");
    newCode[index] = value;
    setVerificationCode(newCode.join(""));
    if (value && index < 5) {
      document.getElementById(`verification-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      document.getElementById(`verification-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData);
      document.getElementById(`verification-${Math.min(pastedData.length - 1, 5)}`)?.focus();
    }
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum 5MB.");
      return;
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null;
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append("file", receiptFile);
      const res = await fetch("/api/signup/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) return data.url;
      toast.error("Receipt upload failed");
      return null;
    } catch {
      toast.error("Receipt upload failed");
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Step 1 → Step 2 (for org tab only)
  const handleContinueToPlan = () => {
    if (!form.companyName.trim()) { toast.error("Company name is required."); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required."); return; }
    if (!form.address.trim()) { toast.error("Address is required."); return; }
    if (!form.name.trim()) { toast.error("Your name is required."); return; }
    if (!form.email.trim()) { toast.error("Email is required."); return; }
    if (!form.password) { toast.error("Password is required."); return; }
    const strength = getPasswordStrength(form.password);
    if (strength === "weak") { toast.error("Password is too weak."); return; }
    try {
      signupSchema.parse({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      if (err instanceof ZodError) { toast.error(err.issues[0].message); return; }
    }
    setStep("plan");
  };

  // Step 2 → Step 3 or API call
  const handlePlanSelected = () => {
    if (isFreeTrial) {
      // Free trial — go straight to signup API
      handleSignup("starter", true);
    } else {
      if (!selectedPlan) { toast.error("Please select a plan."); return; }
      setStep("payment");
    }
  };

  // Step 3 → API call (paid plan)
  const handlePaymentSubmit = async () => {
    if (!paymentMethod) { toast.error("Please select a payment method."); return; }
    if (!referenceId.trim()) { toast.error("Please enter a transaction/reference ID."); return; }

    let receiptUrl: string | null = null;
    if (receiptFile) {
      receiptUrl = await uploadReceipt();
    }
    await handleSignup(selectedPlan, false, paymentMethod, referenceId.trim(), receiptUrl);
  };

  const handleSignup = async (planCode: string, trial: boolean, pMethod?: string, refId?: string, rcptUrl?: string | null) => {
    try {
      setIsLoading(true);

      let payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };

      if (tab === "org") {
        payload.companyName = form.companyName.trim();
        payload.planCode = planCode;
        payload.phone = form.phone.trim();
        payload.address = form.address.trim();
        if (pMethod) payload.paymentMethod = pMethod;
        if (refId) payload.referenceId = refId;
        if (rcptUrl) payload.receiptUrl = rcptUrl;
      }

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

  // Direct user signup (no org)
  const handleUserSignup = async () => {
    try {
      setIsLoading(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      signupSchema.parse(payload);
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
        toast.error(data.message || "Signup failed.");
      }
    } catch (err) {
      if (err instanceof ZodError) toast.error(err.issues[0].message);
      else toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    try {
      setIsLoading(true);
      if (!userId) { toast.error("User ID not found."); return; }
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, verificationCode }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (tab === "org") {
          setStep("pending");
        } else {
          toast.success(data.message);
          setTimeout(() => router.push("/auth/login"), 3000);
        }
      } else {
        toast.error(data.message || "Verification failed.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = getPasswordStrength(form.password);
  const strengthColor = strength === "strong" ? "bg-green-600" : strength === "medium" ? "bg-yellow-500" : "bg-red-500";

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

  // --- STEP: Pending Approval ---
  if (step === "pending") {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-lg relative z-10 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-2xl">
            <CardContent className="p-10">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Awaiting Approval</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Your workspace <span className="font-semibold text-indigo-600 dark:text-indigo-400">{form.companyName}</span> has been created successfully.
                {isFreeTrial
                  ? " Your 14-day free trial will begin once our team reviews and approves your account."
                  : " Your payment proof has been submitted and is under review. Once approved, your workspace will be activated."}
              </p>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 mb-6 border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-semibold">What happens next?</span>
                </div>
                <ul className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 space-y-1 text-left">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Our team will review your application</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> You'll receive an email once approved</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Then you can log in and start using your workspace</li>
                </ul>
              </div>
              <Button onClick={() => router.push("/auth/login")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Email Verification ---
  if (step === "verification") {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-md relative z-10" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Link href="/" className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <h1 className={`text-3xl font-bold text-center mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>Verify Your Email</h1>
          <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xl">
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">We've sent a 6-digit verification code to:</p>
                <p className="font-semibold text-primary mt-2">{form.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Input
                      key={index}
                      id={`verification-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={verificationCode[index] || ""}
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
              <Button onClick={handleVerification} className="w-full mt-2 text-lg" disabled={verificationCode.length !== 6 || isLoading}>
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
              <div className="text-center">
                <Button variant="ghost" onClick={() => setStep(tab === "org" ? "plan" : "signup")} className="text-sm text-slate-500">
                  ← Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Plan Selection (org only) ---
  if (step === "plan") {
    const orgStepLabels = ["Details", "Plan", "Verify"];
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-3xl relative z-10" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <button onClick={() => setStep("signup")} className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to details
          </button>

          <h1 className={`text-3xl font-extrabold text-center mb-2 tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Choose Your Plan
          </h1>
          <p className="text-center text-muted-foreground text-sm mb-8">
            Start with a 14-day free trial, or pick a plan that fits your needs.
          </p>

          <StepIndicator currentStep={1} totalSteps={3} labels={orgStepLabels} />

          {/* Free Trial Card */}
          <motion.button
            type="button"
            onClick={() => { setIsFreeTrial(true); setSelectedPlan(""); }}
            className={`w-full text-left rounded-2xl border-2 p-6 mb-4 transition-all cursor-pointer focus:outline-none ${
              isFreeTrial
                ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40"
                : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-900"
            }`}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">14-Day Free Trial</h3>
                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Recommended</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Try all features free for 14 days. No payment required.</p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isFreeTrial ? "border-indigo-500 bg-indigo-500" : "border-gray-300 dark:border-gray-600"
              }`}>
                {isFreeTrial && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">or choose a paid plan</span>
            <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
          </div>

          {/* Paid Plan Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {plans.map((plan, idx) => {
              const active = !isFreeTrial && selectedPlan === plan.code;
              const icons = [Zap, Crown, Crown];
              const gradients = [
                "from-blue-500 to-cyan-500",
                "from-violet-500 to-purple-600",
                "from-amber-500 to-orange-500",
              ];
              const PlanIcon = icons[idx] || Zap;

              return (
                <motion.button
                  key={plan.id}
                  type="button"
                  onClick={() => { setIsFreeTrial(false); setSelectedPlan(plan.code); }}
                  className={`text-left rounded-2xl border-2 p-5 transition-all cursor-pointer focus:outline-none ${
                    active
                      ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-900"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${gradients[idx]} rounded-xl flex items-center justify-center shadow-sm`}>
                      <PlanIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      active ? "border-indigo-500 bg-indigo-500" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {active && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white capitalize">{plan.name}</h3>
                  <div className="mt-1 mb-3">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">${plan.priceMonthlyUsd}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">/mo</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{plan.maxUsers} users</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{plan.maxShipmentsPerMonth.toLocaleString()} shipments/mo</li>
                  </ul>
                </motion.button>
              );
            })}
          </div>

          <Button
            onClick={handlePlanSelected}
            disabled={!isFreeTrial && !selectedPlan || isLoading}
            className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Processing...</>
            ) : isFreeTrial ? (
              <>Start Free Trial</>
            ) : (
              <>Continue to Payment <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Payment (org with paid plan) ---
  if (step === "payment") {
    const chosenPlan = plans.find((p) => p.code === selectedPlan);
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-lg relative z-10" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <button onClick={() => setStep("plan")} className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to plans
          </button>

          <h1 className={`text-3xl font-extrabold text-center mb-2 tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Payment Details
          </h1>
          <p className="text-center text-muted-foreground text-sm mb-6">
            Submit your payment proof for the <span className="font-semibold text-indigo-600 capitalize">{chosenPlan?.name}</span> plan.
          </p>

          <StepIndicator currentStep={2} totalSteps={3} labels={["Details", "Plan", "Payment"]} />

          <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-2xl">
            <CardContent className="p-6 space-y-5">
              {/* Plan Summary */}
              {chosenPlan && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold uppercase">Selected Plan</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{chosenPlan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">${chosenPlan.priceMonthlyUsd}</p>
                    <p className="text-xs text-gray-400">per month</p>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((method) => {
                    const active = paymentMethod === method.value;
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={`text-left rounded-xl border-2 p-3 transition-all cursor-pointer focus:outline-none ${
                          active
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-300"
                            : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                          <span className={`text-sm font-semibold ${active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}>{method.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 ml-6">{method.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference ID */}
              <div className="space-y-2">
                <Label htmlFor="referenceId" className="text-sm font-semibold">Transaction / Reference ID</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="referenceId"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="Enter your transaction reference number"
                    className="pl-9 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Receipt Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Receipt / Screenshot <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-indigo-400 ${
                    receiptPreview
                      ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                      : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950"
                  }`}
                >
                  {receiptPreview ? (
                    <div className="space-y-2">
                      <img src={receiptPreview} alt="Receipt preview" className="max-h-32 mx-auto rounded-lg shadow-sm" />
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Receipt uploaded
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload receipt screenshot</p>
                      <p className="text-[10px] text-gray-400">PNG, JPG, PDF up to 5MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />
              </div>

              <Button
                onClick={handlePaymentSubmit}
                disabled={!paymentMethod || !referenceId.trim() || isLoading || uploadingReceipt}
                className="w-full py-6 text-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading || uploadingReceipt ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" />{uploadingReceipt ? "Uploading..." : "Processing..."}</>
                ) : (
                  <>Submit & Create Workspace <CheckCircle2 className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Signup Form (Step 1) ---
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
      <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
      <Background />
      <motion.div className="w-full max-w-xl relative z-10" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Link href="/" className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className={`text-3xl font-extrabold text-center mb-2 tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
          Join Our Platform
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-6">
          Sign up to join an existing courier workspace or create a brand new one.
        </p>

        <Card className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <CardContent className="p-6">
            {/* Tab Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-6 relative">
              <button
                type="button"
                onClick={() => setTab("user")}
                className="flex-1 py-2 text-sm font-semibold relative z-10 transition-colors text-center cursor-pointer focus:outline-none"
              >
                <span className={tab === "user" ? "text-slate-900 dark:text-white" : "text-slate-500"}>User Sign Up</span>
                {tab === "user" && (
                  <motion.div layoutId="activeTabBg" className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-xs -z-10" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("org")}
                className="flex-1 py-2 text-sm font-semibold relative z-10 transition-colors text-center cursor-pointer focus:outline-none"
              >
                <span className={tab === "org" ? "text-slate-900 dark:text-white" : "text-slate-500"}>Create Workspace</span>
                {tab === "org" && (
                  <motion.div layoutId="activeTabBg" className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-xs -z-10" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {tab === "org" && (
                  <motion.div key="org-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="companyName" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Acme Logistics" className="pl-9 bg-white dark:bg-slate-950" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" className="pl-9 bg-white dark:bg-slate-950" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="address" name="address" value={form.address} onChange={handleChange} placeholder="123 Logistics Way, Suite 100" className="pl-9 bg-white dark:bg-slate-950" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Jane Doe" className="pl-9 bg-white dark:bg-slate-950" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tab === "org" ? "Work Email" : "Email"}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="pl-9 bg-white dark:bg-slate-950" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="••••••••" className="pl-9 pr-10 bg-white dark:bg-slate-950" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none">
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>
                {form.password && (
                  <>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-slate-800 mt-2 overflow-hidden">
                      <motion.div className={`h-full ${strengthColor}`} initial={{ width: 0 }} animate={{ width: strength === "strong" ? "100%" : strength === "medium" ? "66%" : "33%" }} transition={{ duration: 0.4 }} />
                    </div>
                    <p className={`text-xs font-semibold ${strength === "strong" ? "text-green-600" : strength === "medium" ? "text-yellow-500" : "text-red-500"}`}>
                      Password strength: {strength}
                    </p>
                  </>
                )}
              </div>

              {/* NO plan selection here anymore for org tab */}

              <Button
                onClick={tab === "org" ? handleContinueToPlan : handleUserSignup}
                className="w-full mt-4 text-lg py-6"
                disabled={strength === "weak" || isLoading}
              >
                {isLoading ? "Please wait..." : tab === "org" ? (
                  <>Continue <ArrowRight className="w-5 h-5 ml-2" /></>
                ) : "Sign Up"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground my-4">
                <div className="h-px bg-gray-200 dark:bg-slate-800 w-full" />
                or
                <div className="h-px bg-gray-200 dark:bg-slate-800 w-full" />
              </div>

              <Button variant="outline" className="w-full flex items-center gap-2 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <FcGoogle size={20} />
                Continue with Google
              </Button>

              <div className="text-sm text-center mt-6">
                <p className="text-muted-foreground">
                  Already a user?{" "}
                  <Link href="/auth/login" className="text-primary hover:underline font-semibold">Log in</Link>
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
