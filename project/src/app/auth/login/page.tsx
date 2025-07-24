"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Cookies from "js-cookie";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import { motion } from "framer-motion";

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

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
        Cookies.set("token", data.token);
        router.push("/dashboard");
      } else {
        toast.error(data.message || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <h1 className="text-3xl font-bold text-center text-primary mb-6">
          Login
        </h1>
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Email */}
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

            {/* Password */}
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
                  className="pr-10" // space for the eye icon
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-primary focus:outline-none"
                >
                  {showPassword ? (
                    <FaEyeSlash size={18} />
                  ) : (
                    <FaEye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button onClick={handleLogin} className="w-full mt-2 text-lg">
              Login
            </Button>

            {/* OR Divider */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-px bg-gray-300 w-full" />
              or
              <div className="h-px bg-gray-300 w-full" />
            </div>

            {/* Social Buttons */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <FcGoogle size={20} />
                Continue with Google
              </Button>
            </div>

            {/* Bottom Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-center mt-4 space-y-1"
            >
              <p className="text-muted-foreground">
                Not a user?{" "}
                <Link
                  href="/auth/signup"
                  className="text-primary hover:underline"
                >
                  Sign Up
                </Link>
              </p>
              <p className="text-muted-foreground">
                <Link
                  href="/auth/reset-password"
                  className="text-primary hover:underline"
                >
                  Forgot password?
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
