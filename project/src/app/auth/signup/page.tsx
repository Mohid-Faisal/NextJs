"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { ArrowLeft } from "lucide-react";
import { ZodError } from "zod";
import { signupSchema } from "@/zodschemas/signupSchema";

const getPasswordStrength = (password: string) => {
  const strong = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const medium = /^(?=.*[a-zA-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

  if (strong.test(password)) return "strong";
  if (medium.test(password)) return "medium";
  return "weak";
};

const SignupPage = () => {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"signup" | "verification">("signup");
  const [verificationCode, setVerificationCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    // Only allow single digits
    if (value.length > 1) return;
    
    // Update the verification code at the specific index
    const newCode = verificationCode.split('');
    newCode[index] = value;
    setVerificationCode(newCode.join(''));
    
    // Auto-focus to next input if value entered
    if (value && index < 5) {
      const nextInput = document.getElementById(`verification-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to go to previous input
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
      // Focus the last filled input
      const lastIndex = Math.min(pastedData.length - 1, 5);
      const lastInput = document.getElementById(`verification-${lastIndex}`);
      if (lastInput) lastInput.focus();
    }
  };

  const handleSignup = async () => {
    try {
      setIsLoading(true);
      const validated = signupSchema.parse(form); // throws if invalid
  
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
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
        toast.error(err.issues[0].message); // Show first validation error
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
        body: JSON.stringify({
          userId,
          verificationCode,
        }),
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

  if (step === "verification") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <h1 className="text-3xl font-bold text-center text-primary mb-6">
            Verify Your Email
          </h1>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300">
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
                      className="w-12 h-12 text-center text-xl font-semibold tracking-widest border-2 focus:border-primary"
                      autoComplete="off"
                    />
                  ))}
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                  Enter the 6-digit code sent to your email
                </p>
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
                  className="text-sm"
                >
                  ← Back to Signup
                </Button>
              </div>

              <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                <p>Didn't receive the code? Check your spam folder.</p>
                <p>The code will expire in 10 minutes.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className="text-3xl font-bold text-center text-primary mb-6">
          Sign Up
        </h1>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Your Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
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
                <>
                  <div className="h-2 w-full rounded-full bg-gray-200 mt-1 overflow-hidden">
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
                    className={`text-sm font-medium ${
                      strength === "strong"
                        ? "text-green-600"
                        : strength === "medium"
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                  >
                    Password strength: {strength}
                  </p>

                  <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-5">
                    <li>Minimum 8 characters</li>
                    <li>At least one letter and one number</li>
                    <li>Include a special character (for strong password)</li>
                  </ul>
                </>
              )}
            </div>

            <Button
              onClick={handleSignup}
              className="w-full mt-2 text-lg"
              disabled={strength === "weak" || isLoading}
            >
              {isLoading ? "Sending Code..." : "Sign Up"}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-px bg-gray-300 w-full" />
              or
              <div className="h-px bg-gray-300 w-full" />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <FcGoogle size={20} />
                Continue with Google
              </Button>
            </div>

            <div className="text-sm text-center mt-4 space-y-1">
              <p className="text-muted-foreground">
                Already a user?{" "}
                <a href="/auth/login" className="text-primary hover:underline">
                  Log in
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default SignupPage;
