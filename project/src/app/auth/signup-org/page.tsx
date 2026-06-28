"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupOrgRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/signup");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030014] text-white">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium animate-pulse">Redirecting to new signup page...</p>
      </div>
    </div>
  );
}
