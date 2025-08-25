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
import { FcGoogle } from "react-icons/fc";
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async () => {
    try {
      const validated = signupSchema.parse(form); // throws if invalid
  
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
  
      const data = await response.json();
  
      if (response.ok && data.success) {
        toast.success(data.message || "Signup successful! Please wait for admin approval.");
        setTimeout(() => router.push("/auth/login"), 3000);
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
              disabled={strength === "weak"}
            >
              Sign Up
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
