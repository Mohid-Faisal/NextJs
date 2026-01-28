import type { Metadata } from "next";
import LayoutContent from "@/components/LayoutContent";

export const metadata: Metadata = {
  title: "Courier Dashboard",
  description: "Admin and User Courier Portal",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutContent>{children}</LayoutContent>;
}
