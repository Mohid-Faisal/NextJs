import type { Metadata } from "next";
import LayoutContent from "@/components/LayoutContent";
import { PermissionProvider } from "@/components/PermissionContext";

export const metadata: Metadata = {
  title: "Courier Dashboard",
  description: "Admin and User Courier Portal",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionProvider>
      <LayoutContent>{children}</LayoutContent>
    </PermissionProvider>
  );
}

