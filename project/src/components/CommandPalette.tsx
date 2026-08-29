"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Package,
  FileText,
  CreditCard,
  Users,
  Truck,
  BookOpen,
  Settings,
  Calculator,
  MapPin,
  Moon,
  Sun,
  ArrowRight,
  Sparkles,
  X,
  Layers,
} from "lucide-react";

type CommandItem = {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "Search Results";
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  action: () => void;
  keywords?: string;
};

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<CommandItem[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Default Quick Navigation & Action Items
  const defaultCommands: CommandItem[] = [
    {
      id: "nav-add-shipment",
      title: "Book New Shipment",
      category: "Navigation",
      icon: Package,
      badge: "Create",
      action: () => {
        router.push("/dashboard/add-shipment");
        onClose();
      },
      keywords: "add create book shipment parcel package",
    },
    {
      id: "nav-shipments",
      title: "Shipments List & Tracking",
      category: "Navigation",
      icon: Layers,
      action: () => {
        router.push("/dashboard/shipments");
        onClose();
      },
      keywords: "shipments parcels orders tracking list",
    },
    {
      id: "nav-invoices",
      title: "Invoices & Billing",
      category: "Navigation",
      icon: FileText,
      action: () => {
        router.push("/dashboard/accounts/invoices");
        onClose();
      },
      keywords: "invoices bills billing customer vendor",
    },
    {
      id: "nav-add-payment",
      title: "Record Payment / Receipt",
      category: "Navigation",
      icon: CreditCard,
      badge: "Finance",
      action: () => {
        router.push("/dashboard/accounts/payments/add");
        onClose();
      },
      keywords: "payment pay receive income expense voucher",
    },
    {
      id: "nav-customers",
      title: "Customers Directory",
      category: "Navigation",
      icon: Users,
      action: () => {
        router.push("/dashboard/customers");
        onClose();
      },
      keywords: "customers clients accounts senders",
    },
    {
      id: "nav-vendors",
      title: "Vendors Directory",
      category: "Navigation",
      icon: Truck,
      action: () => {
        router.push("/dashboard/vendors");
        onClose();
      },
      keywords: "vendors carriers suppliers partners",
    },
    {
      id: "nav-ledger",
      title: "General Ledger & Accounts",
      category: "Navigation",
      icon: BookOpen,
      action: () => {
        router.push("/dashboard/accounts/ledger");
        onClose();
      },
      keywords: "ledger accounts books debit credit transactions",
    },
    {
      id: "nav-volumetric",
      title: "Volumetric Weight Calculator",
      category: "Navigation",
      icon: Calculator,
      action: () => {
        router.push("/tools/volumetric-calculator");
        onClose();
      },
      keywords: "volumetric weight calculator 3d box dimensions",
    },
    {
      id: "nav-remote-area",
      title: "Remote Area Lookup",
      category: "Navigation",
      icon: MapPin,
      action: () => {
        router.push("/dashboard/remote-area-lookup");
        onClose();
      },
      keywords: "remote area postal zip iata check",
    },
    {
      id: "nav-settings",
      title: "Organization Settings & Branding",
      category: "Navigation",
      icon: Settings,
      action: () => {
        router.push("/dashboard/settings/organization");
        onClose();
      },
      keywords: "settings branding org logo company profile",
    },
    {
      id: "act-theme",
      title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      category: "Actions",
      icon: theme === "dark" ? Sun : Moon,
      action: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        onClose();
      },
      keywords: "theme dark light mode toggle appearance",
    },
  ];

  // Dynamic search for shipments & customers when user types
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      try {
        // Fetch matching shipments and customers
        const [shipmentsRes, customersRes] = await Promise.all([
          fetch(`/api/shipments?search=${encodeURIComponent(q)}&take=4`).catch(() => null),
          fetch(`/api/customers?search=${encodeURIComponent(q)}&take=4`).catch(() => null),
        ]);

        const dynamicItems: CommandItem[] = [];

        if (shipmentsRes && shipmentsRes.ok) {
          const data = await shipmentsRes.json();
          const list = Array.isArray(data) ? data : data.shipments || [];
          list.slice(0, 4).forEach((s: any) => {
            dynamicItems.push({
              id: `shipment-${s.id}`,
              title: `Shipment #${s.trackingId || s.invoiceNumber || s.id} - ${s.destination || "Worldwide"}`,
              category: "Search Results",
              icon: Package,
              badge: s.deliveryStatus || "Shipment",
              action: () => {
                router.push(`/dashboard/shipments?search=${encodeURIComponent(s.trackingId || s.invoiceNumber)}`);
                onClose();
              },
            });
          });
        }

        if (customersRes && customersRes.ok) {
          const data = await customersRes.json();
          const list = Array.isArray(data) ? data : data.customers || [];
          list.slice(0, 4).forEach((c: any) => {
            dynamicItems.push({
              id: `customer-${c.id}`,
              title: `Customer: ${c.CompanyName || c.CustomerName || "Client"}`,
              category: "Search Results",
              icon: Users,
              badge: "Customer",
              action: () => {
                router.push(`/dashboard/accounts/transactions/customer/${c.id}`);
                onClose();
              },
            });
          });
        }

        startTransition(() => {
          setSearchResults(dynamicItems);
        });
      } catch (err) {
        console.error("Command palette dynamic search error:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, router, onClose]);

  // Combine and filter items
  const filteredStatic = defaultCommands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.keywords && cmd.keywords.toLowerCase().includes(q))
    );
  });

  const allItems = [...searchResults, ...filteredStatic];

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, tracking #, customer name, or jump to page..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none border-none ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 divide-y-0">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-zinc-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-zinc-600 animate-pulse" />
              No matching commands or records found.
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all duration-100 ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium"
                      : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span>{item.title}</span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-zinc-500">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-in fade-in" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/60 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 border border-slate-300/60 dark:border-zinc-700 font-mono">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 border border-slate-300/60 dark:border-zinc-700 font-mono">
                ↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 border border-slate-300/60 dark:border-zinc-700 font-mono">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <div>Spotlight ERP Search</div>
        </div>
      </div>
    </div>
  );
}
