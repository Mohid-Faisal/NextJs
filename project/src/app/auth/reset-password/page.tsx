import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Reset Password",
  description: "Reset your Proxima Smart Solutions (PSS) account password.",
  path: "/auth/reset-password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
