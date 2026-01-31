// components/LayoutContent.tsx
"use client";

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          <Sidebar isOpen={sidebarOpen} />
        </aside>

        {/* Page content - min-w-0 so flex child can shrink; overflow-x-hidden to prevent horizontal scroll */}
        <main
          className={`w-full min-w-0 flex-1 bg-gray-100 dark:bg-gray-900 overflow-y-auto overflow-x-hidden h-[calc(100vh-64px)] transition-all duration-300 ease-in-out ${
            sidebarOpen ? "ml-64" : "ml-20"
          }`}
        >
          {children}
        </main>
      </div>
    </>
  );
};

export default LayoutContent;
