"use client";
import Link from "next/link";
import { Menu, Bell } from "lucide-react";

const Navbar = ({
  onToggleSidebar,
  isSidebarOpen,
}: {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}) => {
  return (
    <header className="w-full h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm z-50 transition-all duration-300 ease-in-out">
      {/* Left section */}
      <div className="flex items-center gap-4 relative">
        {/* Toggle sidebar button - always at far left */}
        <button
          onClick={onToggleSidebar}
          className={`text-gray-700 hover:text-gray-900 text-2xl focus:outline-none transition-transform duration-300 ${
            isSidebarOpen ? "rotate-0" : "rotate-90"
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Logo that shifts in/out */}
        <Link
          href="/dashboard"
          className={`text-xl font-semibold text-gray-800 absolute left-10 transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-4 pointer-events-none"
          }`}
        >
          PSS
        </Link>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        <button className="relative text-gray-500 hover:text-gray-700 transition">
          <Bell className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            1
          </span>
        </button>

        <div className="flex items-center gap-3">
          <img
            src="https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/avatar-male.png"
            alt="User"
            className="w-9 h-9 rounded-full border border-gray-300 object-cover"
          />
          <span className="text-sm font-medium text-gray-800 hidden md:block">
            Jacob Jones
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
