"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Clock,
  Upload,
  CreditCard,
  Landmark,
  Smartphone,
  Banknote,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { ZodError } from "zod";
import { signupSchema } from "@/zodschemas/signupSchema";
import Particles from "@/components/Particles";
import Cookies from "js-cookie";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Plan = {
  id: number;
  code: string;
  name: string;
  priceMonthlyUsd: number;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  features?: Record<string, any> | null;
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
  { value: "CARD", label: "Credit / Debit Card", icon: CreditCard, desc: "Visa, Mastercard (Not Enabled)", disabled: true },
];



const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"user" | "org">("org");
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "", confirmPassword: "", phone: "", address: "" });
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"signup" | "plan" | "payment" | "verification" | "pending">("signup");
  const [verificationCode, setVerificationCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [orgId, setOrgId] = useState<number | null>(null);
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
    const errorParam = searchParams.get("error");
    if (errorParam) {
      toast.error(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const userIdParam = searchParams.get("userId");
    const orgIdParam = searchParams.get("orgId");
    if (stepParam === "plan" && userIdParam && orgIdParam) {
      setUserId(parseInt(userIdParam));
      setOrgId(parseInt(orgIdParam));
      setStep("plan");
    }
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
    const finalCode = newCode.join("");
    setVerificationCode(finalCode);
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

  const handleContinueToPlan = () => {
    if (!form.companyName.trim()) { toast.error("Company name is required."); return; }
    if (!form.email.trim()) { toast.error("Email is required."); return; }
    if (!form.password) { toast.error("Password is required."); return; }
    const strength = getPasswordStrength(form.password);
    if (strength === "weak") { toast.error("Password is too weak."); return; }
    try {
      signupSchema.parse({ email: form.email.trim(), password: form.password });
    } catch (err) {
      if (err instanceof ZodError) { toast.error(err.issues[0].message); return; }
    }
    handleSignup("free", true);
  };

  const getChecklistForPlan = (plan: any): string[] => {
    if (plan.features && Array.isArray(plan.features.featuresList) && plan.features.featuresList.length > 0) {
      return plan.features.featuresList;
    }
    const code = plan.code;
    switch (code) {
      case "starter":
        return ["100 shipments/month", "1 user limit", "1 branch limit", "All core features", "Excludes Remote Area & Finances"];
      case "growth":
        return ["300 shipments/month", "5 users limit", "3 branches limit", "Remote Area Lookup included", "Excludes Finances"];
      case "pro":
        return ["500 shipments/month", "10 users limit", "5 branches limit", "Remote Area Lookup included", "Finances & Reports included", "All features enabled"];
      default:
        return [];
    }
  };

  const handleSelectPaidPlan = async (planCode: string) => {
    setSelectedPlan(planCode);
    setIsFreeTrial(false);
    setIsLoading(true);
    try {
      const res = await fetch("/api/signup/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          organizationId: orgId,
          planCode,
          billingCycle: isAnnual ? "annually" : "monthly",
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("payment");
      } else {
        toast.error(data.message || "Failed to update plan selection.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFreeTrial = async () => {
    setSelectedPlan("trial");
    setIsFreeTrial(true);
    setIsLoading(true);
    try {
      const res = await fetch("/api/signup/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          organizationId: orgId,
          planCode: "trial",
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("pending");
        toast.success("Registration complete! Your 14-day free trial is awaiting approval.");
      } else {
        toast.error(data.message || "Failed to start free trial.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentMethod) { toast.error("Please select a payment method."); return; }
    if (!referenceId.trim()) { toast.error("Please enter a transaction/reference ID."); return; }

    setIsLoading(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt();
      }

      const res = await fetch("/api/signup/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          organizationId: orgId,
          planCode: selectedPlan,
          paymentMethod,
          referenceId: referenceId.trim(),
          receiptUrl,
          billingCycle: isAnnual ? "annually" : "monthly",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStep("pending");
        toast.success("Payment submitted successfully! Waiting for approval.");
      } else {
        toast.error(data.message || "Failed to submit payment details");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
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
        if (data.organization?.id) {
          setOrgId(data.organization.id);
        }
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

  const handleGoogleSignup = () => {
    if (tab === "org") {
      if (!form.companyName.trim()) {
        toast.error("Company Name is required to set up your workspace.");
        return;
      }
    }

    // Save the metadata temporarily in cookie
    Cookies.set("google_signup_data", JSON.stringify({
      companyName: form.companyName.trim(),
    }), { expires: 1/24 }); // expires in 1 hour

    window.location.href = "/api/auth/google";
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
          setStep("plan");
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
  const strengthColor = strength === "strong" ? "bg-green-500" : strength === "medium" ? "bg-amber-500" : "bg-rose-500";

  const Background = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {isDark && (
        <>
          {/* Grid Pattern Background */}
          <div 
            className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70"
          />
          {/* Vibrant glowing ambient blobs behind the card */}
          <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-purple-600/15 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
          <Particles
            particleColors={["#ffffff", "#4f8fff", "#a78bfa"]}
            particleCount={100}
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

  // --- STEP: Pending Approval ---
  if (step === "pending") {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-lg relative z-10 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Card className="backdrop-blur-xl bg-white/45 dark:bg-slate-950/45 border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-3xl">
            <CardContent className="p-10 space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-indigo-500/20">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h2 className={`text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                Account Pending Approval
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Thank you for signing up! Your payment and reference details are being reviewed by our finance department.
                Approval usually takes between 1-3 business hours.
              </p>
              <div className="bg-white/50 dark:bg-slate-950/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 text-left space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Workspace:</span><span className="font-bold text-slate-700 dark:text-slate-350">{form.companyName}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Owner Name:</span><span className="font-bold text-slate-700 dark:text-slate-350">{form.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Status:</span><span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold uppercase tracking-wider text-[10px]">Under Review</span></div>
              </div>
              <Button onClick={() => router.push("/auth/login")} className="w-full py-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10 cursor-pointer">
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Verification ---
  if (step === "verification") {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        <motion.div className="w-full max-w-[440px] relative z-10" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="backdrop-blur-xl bg-white/45 dark:bg-slate-950/45 border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-3xl">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className={`text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Verify Email Address</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                  We've sent a 6-digit confirmation code to <span className="font-bold text-slate-700 dark:text-slate-300">{form.email}</span>.
                </p>
              </div>

              {/* 6 Digit Inputs */}
              <div className="flex justify-between gap-2.5 py-2" onPaste={handlePaste}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Input
                    key={idx}
                    id={`verification-${idx}`}
                    type="text"
                    maxLength={1}
                    value={verificationCode[idx] || ""}
                    onChange={(e) => handleVerificationCodeChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-14 text-center font-bold text-lg bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all"
                  />
                ))}
              </div>

              <div className="space-y-3">
                <Button onClick={handleVerification} disabled={verificationCode.length < 6 || isLoading} className="w-full py-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10 cursor-pointer flex items-center justify-center">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                </Button>
                <button onClick={() => handleSignup("free", true)} className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Resend Verification Code
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Plan Selection ---
  if (step === "plan") {
    const sortedPlans = [...plans]
      .filter((p) => p.code !== "trial" && p.code !== "free")
      .sort((a, b) => a.priceMonthlyUsd - b.priceMonthlyUsd);

    return (
      <div className={`h-screen max-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-4 relative overflow-y-auto lg:overflow-y-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        
        <motion.div className="w-full max-w-[1480px] relative z-10 flex flex-col items-center" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex justify-center w-full mb-6 pb-4 border-b border-slate-200/50 dark:border-slate-800/40">
            <div className="flex items-center gap-6 text-left max-w-4xl">
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                onClick={() => setStep("verification")}
                className="rounded-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 h-11 w-11"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[44px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Simple, transparent pricing
                </h1>
                <p className="text-sm sm:text-base text-slate-550 dark:text-slate-400 mt-2">
                  Choose the plan that fits your logistics operation. Start free, upgrade as you grow.
                </p>
              </div>
            </div>
          </div>


          {/* Self-adjusting pricing grid */}
          <div className="flex flex-wrap xl:flex-nowrap justify-center items-stretch gap-4 w-full max-w-[1440px] mx-auto mt-4 mb-0">
            {/* Free Trial Card */}
            {(() => {
              const trialPlan = plans.find((p) => p.code === "trial") || {
                name: "14-Day Trial",
                features: {
                  trialDays: 14,
                  description: "Test the system with full features. No credit card required upfront."
                }
              };
              const trialFeatures = (trialPlan.features || {}) as any;
              const trialDays = trialFeatures.trialDays ?? 14;
              const trialDescription = trialFeatures.description || "Test the system with full features. No credit card required upfront.";
              const trialChecklist: string[] = Array.isArray(trialFeatures.featuresList) 
                ? trialFeatures.featuresList 
                : ["14 Days Access", "Core Features Included", "Easy upgrade path"];
              
              const activeCurrency = sortedPlans[0]?.features?.currency || "PKR";
              let trialPriceFormatted = "";
              if (activeCurrency === "USD") trialPriceFormatted = "$0.00";
              else if (activeCurrency === "EUR") trialPriceFormatted = "€0.00";
              else if (activeCurrency === "GBP") trialPriceFormatted = "£0.00";
              else trialPriceFormatted = `${activeCurrency} 0`;

              return (
                <Card 
                  className="relative flex flex-col justify-between p-5 border border-slate-200 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-slate-50/50 dark:bg-slate-950/45 backdrop-blur-md rounded-2xl w-full sm:w-[230px] md:w-[245px] xl:w-auto xl:flex-1 xl:max-w-[270px] hover:border-indigo-500/50 dark:hover:border-indigo-500/30 hover:shadow-[0_15px_35px_rgba(99,102,241,0.08)] transition-all duration-300"
                >
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-extrabold text-base text-gray-900 dark:text-white capitalize">{trialPlan.name}</h3>
                      <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 min-h-[28px] leading-normal">
                        {trialDescription}
                      </p>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {trialPriceFormatted}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">/{trialDays} days</span>
                      </div>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800/50 my-1" />

                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 flex-1 py-1">
                      {trialChecklist.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Button 
                      onClick={handleSelectFreeTrial}
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-xl font-bold transition-all bg-slate-950 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 cursor-pointer shadow-xs"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Free Trial"}
                    </Button>
                  </div>
                </Card>
              );
            })()}

            {/* Paid Plans */}
            {sortedPlans.map((plan) => {
              const features = plan.features || {};
              const isGrowth = plan.code === "growth";
              const planDescription = features.description || "";

              return (
                <Card 
                  key={plan.id}
                  className={`relative flex flex-col justify-between p-5 transition-all duration-300 w-full sm:w-[230px] md:w-[245px] xl:w-auto xl:flex-1 xl:max-w-[270px] rounded-2xl ${
                    isGrowth 
                      ? "border-2 border-indigo-600 dark:border-indigo-500 shadow-xl bg-slate-50/50 dark:bg-slate-950/45 backdrop-blur-md" 
                      : "border border-slate-200 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-slate-50/50 dark:bg-slate-950/45 backdrop-blur-md hover:border-indigo-500/50 dark:hover:border-indigo-500/30 hover:shadow-[0_15px_35px_rgba(99,102,241,0.08)]"
                  }`}
                >
                  {isGrowth && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-3.5 py-1.5 rounded-full uppercase flex items-center gap-1 shadow-md shadow-indigo-500/10">
                      <Sparkles className="w-3 h-3 fill-white" /> Popular
                    </div>
                  )}

                  <div className="space-y-3 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-extrabold text-base text-gray-900 dark:text-white capitalize">{plan.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[28px] leading-normal">{planDescription}</p>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {(() => {
                            const currency = (plan.features as any)?.currency || "PKR";
                            const priceToDisplay = plan.priceMonthlyUsd;

                            if (currency === "USD") return `$${priceToDisplay.toFixed(2)}`;
                            if (currency === "EUR") return `€${priceToDisplay.toFixed(2)}`;
                            if (currency === "GBP") return `£${priceToDisplay.toFixed(2)}`;
                            return `${currency} ${Math.round(priceToDisplay).toLocaleString()}`;
                          })()}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">/month</span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold flex items-center justify-start flex-wrap gap-1">
                        {(() => {
                          const discountPercent = features.yearlyDiscountPercent !== undefined 
                            ? parseFloat(features.yearlyDiscountPercent) 
                            : (features.annualPrice && plan.priceMonthlyUsd > 0 
                              ? Math.round((1 - (features.annualPrice / (plan.priceMonthlyUsd * 12))) * 100) 
                              : 20);
                          const calculatedAnnualPrice = features.annualPrice ?? (plan.priceMonthlyUsd * 12 * (1 - (discountPercent / 100)));
                          const currency = (plan.features as any)?.currency || "PKR";
                          let formattedPrice = "";
                          if (currency === "USD") formattedPrice = `$${calculatedAnnualPrice.toFixed(2)}`;
                          else if (currency === "EUR") formattedPrice = `€${calculatedAnnualPrice.toFixed(2)}`;
                          else if (currency === "GBP") formattedPrice = `£${calculatedAnnualPrice.toFixed(2)}`;
                          else formattedPrice = `${currency} ${Math.round(calculatedAnnualPrice).toLocaleString()}`;
                          
                          return (
                            <>
                              <span>{formattedPrice}/year</span>
                              <span className="text-green-600 dark:text-green-400 font-bold ml-0.5">(save {discountPercent}%)</span>
                            </>
                          );
                        })()}
                      </p>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800/50 my-1" />

                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 flex-1 py-1">
                      {getChecklistForPlan(plan).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => handleSelectPaidPlan(plan.code)}
                      disabled={isLoading}
                      className={`w-full py-3.5 rounded-xl font-bold transition-all cursor-pointer ${
                        isGrowth 
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10" 
                          : "bg-slate-950 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                      }`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Choose Plan"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // --- STEP: Payment ---
  if (step === "payment") {
    const chosenPlan = plans.find((p) => p.code === selectedPlan);
    
    return (
      <div className={`h-screen max-h-screen overflow-hidden flex flex-col items-center justify-center px-4 pt-4 pb-16 relative overflow-hidden transition-colors duration-500 ${isDark ? "bg-[#030014]" : "bg-white"}`}>
        <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
        <Background />
        
        <motion.div className="w-full max-w-xl relative z-10 flex flex-col items-center" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex justify-center w-full mb-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/40">
            <div className="flex items-center gap-6 text-left w-full">
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                onClick={() => setStep("plan")}
                className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 h-11 w-11"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-[36px] lg:text-[38px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Submit payment details
                </h2>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 truncate max-w-full">
                  Send subscription fee and enter transaction details below.
                </p>
              </div>
            </div>
          </div>

          <Card className="backdrop-blur-xl bg-white/45 dark:bg-slate-950/45 border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-3xl overflow-hidden w-full">
            <CardContent className="p-6 pt-4 space-y-6">
              {/* Plan Summary without Billing Cycle Selector */}
              {chosenPlan && (
                <div className="bg-white/40 dark:bg-slate-950/40 rounded-xl p-3 border border-white/60 dark:border-white/10 space-y-2.5">
                  {/* Billing Switcher inside Payment summary */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/50 dark:border-slate-800/40">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-405 uppercase tracking-wider">Billing Cycle</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${!isAnnual ? "text-indigo-600 dark:text-indigo-400" : "text-slate-450 dark:text-slate-500"}`}>Monthly</span>
                      <button 
                        type="button" 
                        onClick={() => setIsAnnual(!isAnnual)}
                        className="relative w-8 h-4.5 rounded-full bg-slate-200 dark:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
                      >
                        <motion.div 
                          className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-xs"
                          animate={{ x: isAnnual ? 14 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${isAnnual ? "text-indigo-600 dark:text-indigo-400" : "text-slate-450 dark:text-slate-500"}`}>
                        Yearly
                        {(() => {
                          const features = chosenPlan.features || {};
                          const discountPercent = features.yearlyDiscountPercent !== undefined 
                            ? parseFloat(features.yearlyDiscountPercent) 
                            : (features.annualPrice && chosenPlan.priceMonthlyUsd > 0 
                              ? Math.round((1 - (features.annualPrice / (chosenPlan.priceMonthlyUsd * 12))) * 100) 
                              : 20);
                          return (
                            <span className="text-[8px] font-extrabold px-1 py-0.2 bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 rounded">
                              -{discountPercent}%
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selected Plan</span>
                      <h4 className="text-sm font-extrabold capitalize text-slate-800 dark:text-white mt-0.5">{chosenPlan.name} Plan</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Due</span>
                      <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {(() => {
                          const currency = (chosenPlan.features as any)?.currency || "PKR";
                          const discountPercent = chosenPlan.features?.yearlyDiscountPercent !== undefined 
                            ? parseFloat(chosenPlan.features.yearlyDiscountPercent) 
                            : (chosenPlan.features?.annualPrice && chosenPlan.priceMonthlyUsd > 0 
                              ? Math.round((1 - (chosenPlan.features.annualPrice / (chosenPlan.priceMonthlyUsd * 12))) * 100) 
                              : 20);
                          const annualPrice = chosenPlan.features?.annualPrice ?? (chosenPlan.priceMonthlyUsd * 12 * (1 - (discountPercent / 100)));
                          const dueAmount = isAnnual ? annualPrice : chosenPlan.priceMonthlyUsd;
                          return `${currency} ${Math.round(dueAmount).toLocaleString()}`;
                        })()}
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 ml-1">
                          {isAnnual ? "/year" : "/month"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Methods Grid */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Payment Option</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.value;
                    const isDisabled = method.disabled;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={isDisabled ? undefined : () => setPaymentMethod(method.value)}
                        disabled={isDisabled}
                        className={`text-left rounded-xl border p-3.5 transition-all focus:outline-none ${
                          method.value === "CARD" ? "col-span-2" : ""
                        } ${
                          isDisabled
                            ? "opacity-40 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 cursor-not-allowed"
                            : active
                            ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/10 cursor-pointer scale-[1.02] shadow-sm"
                            : "border-slate-200 dark:border-slate-850 bg-slate-100/60 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900/30 dark:hover:bg-slate-900/50 dark:hover:border-slate-700 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                          <span className={`text-xs font-bold ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}>{method.label}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 pl-6 leading-normal">{method.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Details Panel */}
              {paymentMethod && paymentMethod !== "CASH" && paymentMethod !== "CARD" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs"
                >
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Recipient Account Details</p>
                  
                  {paymentMethod === "JAZZCASH" && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">Mobile Wallet:</span><span className="font-bold text-slate-700 dark:text-slate-350">JazzCash</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Title:</span><span className="font-bold text-slate-700 dark:text-slate-350">Zeeshan Ahmad Chaudhry</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Mobile Number:</span><span className="font-bold text-indigo-600 dark:text-indigo-400 select-all tracking-wider">03008482321</span></div>
                    </div>
                  )}

                  {paymentMethod === "EASYPAISA" && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">Mobile Wallet:</span><span className="font-bold text-slate-700 dark:text-slate-350">Easypaisa</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Title:</span><span className="font-bold text-slate-700 dark:text-slate-350">Zeeshan Ahmad Chaudhry</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Mobile Number:</span><span className="font-bold text-indigo-600 dark:text-indigo-400 select-all tracking-wider">03008482321</span></div>
                    </div>
                  )}

                  {paymentMethod === "BANK_TRANSFER" && (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">Bank:</span><span className="font-bold text-slate-700 dark:text-slate-350">Allied Bank Limited</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account Name:</span><span className="font-bold text-slate-700 dark:text-slate-350">Prompt Survey & Services (PSS)</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Account No:</span><span className="font-bold text-indigo-600 dark:text-indigo-400 select-all">053000010010882520025</span></div>
                      <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                        <span className="text-slate-400">IBAN:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 select-all bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 rounded break-all">
                          PK37ABPA0010010882520025
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Reference ID input */}
              <div className="space-y-1.5">
                <Label htmlFor="referenceId" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Transaction Reference ID</Label>
                <div className="relative group">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input
                    id="referenceId"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="Enter 12-digit transaction ID"
                    className="pl-9 h-9 bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all text-sm"
                  />
                </div>
              </div>

              {/* Screenshot Selector */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Upload Receipt Screenshot <span className="text-slate-400 dark:text-slate-500">(Optional)</span></Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all hover:border-indigo-400/80 bg-white/40 dark:bg-slate-950/20 ${
                    receiptPreview
                      ? "border-green-400 bg-green-50/20 dark:bg-green-950/10"
                      : "border-slate-205 dark:border-slate-800"
                  }`}
                >
                  {receiptPreview ? (
                    <div className="space-y-1">
                      <img src={receiptPreview} alt="Receipt preview" className="max-h-12 mx-auto rounded-lg shadow-sm" />
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Receipt Attached
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-slate-350 dark:text-slate-700 mx-auto" />
                      <p className="text-xs font-semibold text-slate-550 dark:text-slate-400">Click to upload screenshot</p>
                      <p className="text-[9px] text-slate-400">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
              </div>

              <Button
                onClick={handlePaymentSubmit}
                disabled={!paymentMethod || !referenceId.trim() || isLoading || uploadingReceipt}
                className="w-full h-10 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-600 text-white font-bold rounded-xl shadow-md shadow-indigo-500/10 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading || uploadingReceipt ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{uploadingReceipt ? "Uploading..." : "Processing..."}</>
                ) : (
                  <>Submit Details & Complete Setup <CheckCircle2 className="w-4 h-4" /></>
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
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-16 relative bg-[#F4F5F9] dark:bg-zinc-950 transition-colors duration-500">
      {/* Top-left SaaS logo */}
      <div className="absolute top-8 left-8 z-20 select-none hidden sm:block">
        <img src="/SaaS-Logo.png" alt="PSS Proxima Smart Solutions Logo" className="h-20 w-auto object-contain" />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>

      <motion.div className="w-full max-w-[500px] relative z-10" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Card className="bg-white dark:bg-zinc-900 border border-gray-200/50 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden w-full">
          <CardContent className="p-8 sm:p-10 space-y-6">
            {/* Top-left SaaS logo on mobile when absolute header is hidden */}
            <div className="sm:hidden flex justify-center mb-2">
              <img src="/SaaS-Logo.png" alt="PSS Proxima Smart Solutions Logo" className="h-20 w-auto object-contain" />
            </div>

            <h1 className="text-3xl font-extrabold text-[#1d1b26] dark:text-white text-center mb-6">
              Register
            </h1>

            {/* Google Authentication - Centered with no text */}
            <Button
              variant="outline"
              type="button"
              onClick={handleGoogleSignup}
              className="w-full h-11 border-slate-205 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 flex items-center justify-center transition-all cursor-pointer"
            >
              <FcGoogle size={25} />
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
              {tab === "org" && (
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company Name</Label>
                  <div className="relative group">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input id="companyName" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Acme Logistics Ltd" className="pl-9 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-205 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all text-sm" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Work Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="jane@company.com" className="pl-9 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-205 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="••••••••" className="pl-9 pr-10 h-11 bg-white/50 dark:bg-slate-950/40 border-slate-205 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 rounded-xl transition-all text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
                {form.password && (
                  <div className="space-y-1.5 pt-1.5">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div className={`h-full ${strengthColor}`} initial={{ width: 0 }} animate={{ width: strength === "strong" ? "100%" : strength === "medium" ? "66%" : "33%" }} transition={{ duration: 0.4 }} />
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${strength === "strong" ? "text-green-600 dark:text-green-400" : strength === "medium" ? "text-amber-500" : "text-rose-500"}`}>
                      Strength: {strength}
                    </p>
                  </div>
                )}
              </div>

              {/* WhatsApp/SMS updates agreement checkbox */}
              <div className="flex items-start gap-2.5 pt-2 text-left">
                <Checkbox
                  id="agreeMarketing"
                  checked={agreeMarketing}
                  onCheckedChange={(checked) => setAgreeMarketing(!!checked)}
                  className="mt-1 accent-indigo-600 focus:ring-indigo-500 h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="agreeMarketing" className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed cursor-pointer select-none">
                  I agree to receive product updates and special offers via WhatsApp and SMS. You can withdraw consent anytime. More info in <span className="text-indigo-650 dark:text-indigo-400 hover:underline">Privacy Policy</span>.
                </Label>
              </div>

              {/* Register Button */}
              <Button
                onClick={handleContinueToPlan}
                className="w-full h-11 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-750 text-white font-bold rounded-xl shadow-md shadow-indigo-500/10 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
                disabled={strength === "weak" || isLoading}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register"}
              </Button>

              {/* Terms of Service & Privacy Policy agreement footer */}
              <div className="text-xs text-center text-slate-405 dark:text-slate-500 leading-relaxed pt-2">
                By continuing you agree with our <span className="text-indigo-650 dark:text-indigo-400 hover:underline font-semibold cursor-pointer">Terms of Service</span> and confirm that you have read our <span className="text-indigo-650 dark:text-indigo-400 hover:underline font-semibold cursor-pointer">Privacy Policy</span>. We may send you product updates and special offers via email. You can opt out anytime (see Privacy Policy).
              </div>

              {/* Bottom links */}
              <div className="text-sm text-center pt-4">
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Already have an account?{" "}
                  <Link href="/auth/login" className="text-indigo-655 dark:text-indigo-400 font-bold hover:underline">Log in</Link>
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
