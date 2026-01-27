"use client";

import { usePathname } from "next/navigation";
import PublicNavbar from "./PublicNavbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Show public navbar on all pages except dashboard and auth pages
  const showPublicNavbar = !pathname.startsWith("/dashboard") && !pathname.startsWith("/auth");

  return (
    <>
      {showPublicNavbar && <PublicNavbar />}
      {children}
    </>
  );
}
