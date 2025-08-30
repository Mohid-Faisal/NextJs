"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Bell } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const Navbar = ({
  onToggleSidebar,
  isSidebarOpen,
}: {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}) => {
  return (
    <header className="w-full h-16 bg-white dark:bg-card border-b border-gray-200 dark:border-zinc-700 px-6 flex items-center justify-between shadow-sm z-50 transition-all duration-300 ease-in-out">
      {/* Left section */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={onToggleSidebar}
          className={`text-gray-700 dark:text-gray-300 hover:text-gray-900 text-2xl focus:outline-none transition-transform duration-300 ${
            isSidebarOpen ? "rotate-0" : "rotate-90"
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>

        <Link
          href="/dashboard"
          className={`transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-4 pointer-events-none"
          }`}
        >
          <img 
            src="/logo_final.png" 
            alt="PSS Logo" 
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        <button className="relative text-gray-500 dark:text-gray-300 hover:text-gray-700 transition">
          <Bell className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            1
          </span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Navbar;
