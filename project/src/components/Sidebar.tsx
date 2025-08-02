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
  ChevronUp,
  LogOut,
  Edit3,
  User,
  Building2,
  Search,
} from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { AnimatePresence, motion } from "framer-motion";

const links = [
  { href: "/dashboard/customers", label: "Customers", icon: User },
  { href: "/dashboard/recipients", label: "Recipients", icon: Users },
  { href: "/dashboard/vendors", label: "Vendors", icon: Building2 },
];

interface DecodedToken {
  name: string;
  email?: string;
}

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [shipmentOpen, setShipmentOpen] = useState(
    pathname.startsWith("/dashboard/shipments") ||
      pathname.startsWith("/dashboard/add-shipment") ||
      pathname.startsWith("/dashboard/rate-calculator")
  );
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/dashboard/shipment-settings")
  );

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

  const subLinksShipment = [
    { href: "/dashboard/shipments", label: "All Shipments", icon: Package },
    { href: "/dashboard/add-shipment", label: "Add Shipment", icon: Plus },
    {
      href: "/dashboard/rate-calculator",
      label: "Rate Calculator",
      icon: DollarSign,
    },
    {
      href: "/dashboard/remote-area-lookup",
      label: "Remote Area Lookup",
      icon: Search,
    },
  ];
  const subLinksSettings = [
    {
      href: "/dashboard/settings/shipment-info-settings",
      label: "Shipment Info Settings",
      icon: Edit3,
    },
    {
      href: "/dashboard/settings/general-settings",
      label: "General Settings",
      icon: Plus,
    },
    {
      href: "/dashboard/settings/manage-zones",
      label: "Manage Zones",
      icon: Plus,
    },
    {
      href: "/dashboard/settings/manage-rate-list",
      label: "Manage Rate List",
      icon: DollarSign,
    },
  ];

  return (
    <aside
      className={`h-full bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 px-2 py-6 space-y-2">
          {/* Add Shipment */}
          {/* <Link
            href="/dashboard/add-shipment"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group 
    bg-rose-700 hover:bg-rose-900 text-white`}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Add Shipment
            </span>
          </Link> */}

          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-4 transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 group ${
              pathname === "/dashboard"
                ? "bg-black text-white dark:bg-gray-800 dark:text-white"
                : "text-gray-900 hover:bg-black hover:text-white dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Dashboard
            </span>
          </Link>

          {/* Shipments Collapsible */}
          <div>
            <button
              onClick={() => setShipmentOpen(!shipmentOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/shipments") ||
                pathname.startsWith("/dashboard/add-shipment") ||
                pathname.startsWith("/dashboard/rate-calculator")
                  ? "bg-black text-white dark:bg-gray-800 dark:text-white"
                  : "text-gray-900 hover:bg-black hover:text-white dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-4">
                <Package className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Shipments
                </span>
              </div>
              {isOpen &&
                (shipmentOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {shipmentOpen && isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksShipment.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Other Static Links */}
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
          {/* Settings Collapsible */}
          <div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`flex items-center justify-between w-full text-left transition-all duration-200 text-sm font-medium rounded-lg px-3 py-2 ${
                pathname.startsWith("/dashboard/shipment-settings")
                  ? "bg-black text-white dark:bg-gray-800 dark:text-white"
                  : "text-gray-900 hover:bg-black hover:text-white dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-4">
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`whitespace-nowrap transition-all duration-200 ${
                    isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}
                >
                  Settings
                </span>
              </div>
              {isOpen &&
                (settingsOpen ? (
                  <ChevronUp className="w-4 h-4 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto" />
                ))}
            </button>

            <AnimatePresence>
              {settingsOpen && isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-10 mt-2 space-y-1"
                >
                  {subLinksSettings.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 transition-all ${
                        pathname === href
                          ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* User Info + Logout */}
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
