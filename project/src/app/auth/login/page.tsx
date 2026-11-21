import { Suspense } from "react";
import type { Metadata } from "next";
import LoginClient from "./LoginClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign In",
  description:
    "Sign in to your Proxima Smart Solutions (PSS) workspace to manage shipments, customers, invoices, and multi-branch courier operations.",
  path: "/auth/login",
});

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading sign in...
          </p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
