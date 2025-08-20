"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, Book, BookOpen } from "lucide-react";

export default function AccountsHomePage() {
  const items = [
    {
      href: "/dashboard/accounts/invoices",
      title: "Invoices",
      description: "Create, view, and manage shipment invoices.",
      Icon: FileText,
    },
    {
      href: "/dashboard/accounts/payments",
      title: "Payments",
      description: "Record and reconcile customer/vendor payments.",
      Icon: CreditCard,
    },
    {
      href: "/dashboard/accounts/ledger",
      title: "Ledger",
      description: "See account balances and transaction history.",
      Icon: Book,
    },
    {
      href: "/dashboard/accounts/account-books",
      title: "Account Books",
      description: "View journal entries filtered by account or category.",
      Icon: BookOpen,
    },
  ];

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">Accounts</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map(({ href, title, description, Icon }) => (
          <Card key={href} className="border-gray-200 dark:border-gray-700">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
              <div>
                <Button asChild>
                  <Link href={href}>Open {title}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


