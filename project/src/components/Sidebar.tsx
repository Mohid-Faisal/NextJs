"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Package,
  Settings,
  BarChart2,
  ShoppingCart,
  LayoutGrid,
  Globe,
  Truck,
  Plus,
  DollarSign,
  ChevronDown,
  LogOut,
  Edit3,
} from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/shipments", label: "Shipments", icon: Package },
  { href: "/dashboard/add-shipment", label: "Add Shipment", icon: Plus },
  { href: "/dashboard/update-shipment", label: "Update Shipment", icon: Edit3 },
  { href: "/dashboard/rate-calculator", label: "Rate Calculator", icon: DollarSign },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/vendors", label: "Vendors", icon: Users },
  { href: "/dashboard/recipients", label: "Recipients", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface DecodedToken {
  name: string;
  email?: string;
}

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setUserName(decoded.name || "User");
      } catch (err) {
        console.error("Failed to decode token:", err);
      }
    }
  }, []);

  const handleLogout = () => {
    Cookies.remove("token");
    router.push("/auth/login");
  };

  return (
    <aside
      className={`h-full bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-2 py-6 space-y-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
                  isActive
                    ? "bg-black text-white dark:bg-gray-800 dark:text-white"
                    : "text-gray-900 hover:bg-black hover:text-white dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 mt-auto pb-6 space-y-2">
          <button
            type="button"
            className="flex items-center gap-3 w-full text-sm font-medium text-gray-900 dark:text-gray-300 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          >
            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-white flex-shrink-0">
              {isOpen ? userName[0]?.toUpperCase() : ""}
            </div>
            <span
              className={`transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              {userName}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full text-sm font-medium text-red-600 rounded-lg px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span
              className={`transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
