"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/domestic", label: "Domestic", icon: Truck },
  { href: "/international", label: "International", icon: Globe },
  { href: "/add-shipment", label: "Add Shipment", icon: Plus },
  { href: "/rate-calculator", label: "Rate Calculator", icon: DollarSign },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const pathname = usePathname();

  return (
    <aside
      className={`h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
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
                    ? "bg-indigo-600 text-white"
                    : "text-gray-900 hover:bg-indigo-600 hover:text-white"
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

        {/* Profile Section */}
        <div className="px-3 mt-auto pb-6">
          <button
            type="button"
            className="flex items-center gap-3 w-full text-sm font-medium text-gray-900 rounded-lg px-3 py-2 hover:bg-gray-100 transition-all duration-200"
          >
            <img
              src="https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/vertical-menu/2/avatar-male.png"
              alt="User"
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
            <span
              className={`transition-all duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              Jacob Jones
            </span>
            {isOpen && <ChevronDown className="w-5 h-5 ml-auto" />}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
