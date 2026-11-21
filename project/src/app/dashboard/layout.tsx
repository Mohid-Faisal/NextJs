import type { Metadata } from "next";
import LayoutContent from "@/components/LayoutContent";
import { PermissionProvider } from "@/components/PermissionContext";
import SupportChat from "@/components/SupportChat";
import { SITE_CONFIG } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: `%s | Dashboard — ${SITE_CONFIG.name}`,
  },
  description: "Courier & Cargo Management SaaS Portal",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionProvider>
      <LayoutContent>{children}</LayoutContent>
      <SupportChat />
    </PermissionProvider>
  );
}
