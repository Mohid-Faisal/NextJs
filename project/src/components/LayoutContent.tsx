// components/LayoutContent.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { usePermissions, getRequiredPermission } from "@/components/PermissionContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, loading } = usePermissions();

  const requiredPermission = getRequiredPermission(pathname);
  const isAuthorized = requiredPermission ? hasPermission(requiredPermission) : true;

  // Prevent document scroll so only main content area scrolls (fixes double vertical scroll)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <>
      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 no-print">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
      </div>

      {/* Sidebar + Main */}
      <div className="flex pt-[64px] h-screen overflow-hidden no-print">
        {/* Sidebar with transition and width toggle */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } transition-all duration-300 ease-in-out h-[calc(100vh-64px)] fixed top-[64px] left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40`}
        >
          <Suspense fallback={<div className="p-4 text-xs text-gray-400">Loading Menu...</div>}>
            <Sidebar isOpen={sidebarOpen} />
          </Suspense>
        </aside>

        {/* Page content - min-w-0 so flex child can shrink; overflow-x-hidden to prevent horizontal scroll */}
        <main
          className={`w-full min-w-0 flex-1 bg-gray-100 dark:bg-gray-900 overflow-y-auto overflow-x-hidden h-[calc(100vh-64px)] transition-all duration-300 ease-in-out ${
            sidebarOpen ? "ml-64" : "ml-20"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500">
              Checking permissions...
            </div>
          ) : !isAuthorized ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 bg-gray-50 dark:bg-zinc-950">
              <Card className="max-w-md w-full shadow-lg border border-red-100 dark:border-red-950/30 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
                <div className="h-2 bg-red-500" />
                <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    You do not have permission to view this section. Please contact your organization administrator to request access.
                  </p>
                  <Button onClick={() => router.push("/dashboard")} className="mt-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white">
                    Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </>
  );
};


export default LayoutContent;
