import { Suspense } from "react";
import type { Metadata } from "next";
import SignupClient from "./SignupClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Start Free Trial & Sign Up",
  description:
    "Create your courier & cargo management workspace on Proxima Smart Solutions (PSS). Start a 14-day free trial with multi-branch operations, tracking, and built-in accounting.",
  path: "/auth/signup",
  keywords: [
    "courier software free trial",
    "cargo SaaS signup",
    "Proxima Smart Solutions register",
    "PSS workspace signup",
  ],
});

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#030014] text-white">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium animate-pulse">Loading signup...</p>
          </div>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
