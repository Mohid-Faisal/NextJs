"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ResetPasswordSchema } from "@/zodschemas/resetpasswordSchema";
import { ZodError } from "zod";

const getPasswordStrength = (password: string) => {
  const strong = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  const medium = /^(?=.*[a-zA-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

  if (strong.test(password)) return "strong";
  if (medium.test(password)) return "medium";
  return "weak";
};

const ResetPasswordPage = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Step 1: request a reset code by email.
  const handleSendCode = async () => {
    if (!form.email) {
      toast.error("Please enter your registered email.");
      return;
    }
    setSendingCode(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || "Reset code sent. Check your inbox.");
        setCodeSent(true);
      } else {
        toast.error(data.message || "Failed to send reset code.");
      }
    } catch (err) {
      console.error("Reset code error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setSendingCode(false);
    }
  };

  // Step 2: verify code and set the new password.
  const handleReset = async () => {

    try {
      const validated = ResetPasswordSchema.parse(form);

      if (validated.password !== form.confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }

      setSubmitting(true);
      const response = await fetch("/api/reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validated.email,
          code: form.code,
          password: validated.password,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success("Password reset successful!");
        router.push("/auth/login");
      } else {
        toast.error(data.message || "Failed to reset password.");
      }
    } catch (err) {
      if (err instanceof ZodError) {
        toast.error(err.issues[0].message);
      } else {
        console.error("Reset error:", err);
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const strength = getPasswordStrength(form.password);
  const strengthColor =
    strength === "strong"
      ? "bg-green-600"
      : strength === "medium"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-bold text-center text-primary mb-6">
          Reset Password
        </h1>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your registered email"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={sendingCode || !form.email}
                >
                  {sendingCode ? "Sending..." : codeSent ? "Resend Code" : "Send Code"}
                </Button>
              </div>
            </div>

            {codeSent && (
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.code}
                  onChange={handleChange}
                  placeholder="6-digit code from your email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
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
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-primary"
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
                    ></motion.div>
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
                  <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Minimum 8 characters</li>
                    <li>At least one letter and one number</li>
                    <li>Include a special character (for strong password)</li>
                  </ul>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
              />
            </div>

            <Button
              onClick={handleReset}
              className="w-full mt-2 text-lg"
              disabled={strength === "weak" || !codeSent || submitting}
            >
              {submitting ? "Resetting..." : "Reset Password"}
            </Button>

            <div className="text-sm text-center mt-4">
              <a href="/auth/login" className="text-primary hover:underline">
                Back to Login
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
