"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Check, ChevronDown, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { FaqItem } from "@/lib/seo";

export type PublicPlan = {
  id: number;
  code: string;
  name: string;
  priceMonthly: number;
  currency: string;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  description: string;
  featuresList: string[];
  yearlyDiscountPercent: number;
};

export function QuickTrackForm() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bookingId.trim();
    if (!trimmed) {
      router.push("/tracking");
      return;
    }
    router.push(`/tracking?bookingId=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full max-w-lg"
      role="search"
      aria-label="Track a shipment by booking ID"
    >
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          type="text"
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="Enter booking ID to track (e.g. 420001)"
          aria-label="Booking ID"
          className="h-12 pl-10 pr-4 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-slate-300 focus-visible:ring-blue-400"
        />
      </div>
      <Button
        type="submit"
        className="h-12 px-6 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold shrink-0 cursor-pointer"
      >
        Track Shipment
      </Button>
    </form>
  );
}

export function PricingSectionClient({ plans }: { plans: PublicPlan[] }) {
  const [annual, setAnnual] = useState(false);

  const formatMoney = (amount: number, currency: string) => {
    const rounded = Math.round(amount);
    if (currency === "USD") return `$${rounded.toLocaleString()}`;
    if (currency === "EUR") return `€${rounded.toLocaleString()}`;
    if (currency === "GBP") return `£${rounded.toLocaleString()}`;
    return `${currency} ${rounded.toLocaleString()}`;
  };

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={`text-sm font-semibold ${
            !annual
              ? "text-slate-900 dark:text-white"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing discount"
          onClick={() => setAnnual((prev) => !prev)}
          className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
            annual ? "bg-blue-600" : "bg-slate-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
              annual ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold flex items-center gap-1.5 ${
            annual
              ? "text-slate-900 dark:text-white"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          Annual
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Save up to 20%
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {/* Free Trial Tier */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              14-Day Free Trial
            </h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 min-h-[40px]">
              Explore the complete courier &amp; cargo platform with zero upfront commitment.
            </p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {formatMoney(0, plans[0]?.currency || "PKR")}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                / 14 days
              </span>
            </div>
            <hr className="my-5 border-slate-100 dark:border-zinc-800" />
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Full shipment booking &amp; tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Customer &amp; vendor portals</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Invoice PDF &amp; waybill generation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>No credit card required</span>
              </li>
            </ul>
          </div>
          <div className="mt-6">
            <Link
              href="/auth/signup"
              className="block w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 py-3 text-center text-sm font-semibold transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        {/* Paid Tiers */}
        {plans.map((plan) => {
          const isPopular = plan.code === "growth" || plan.code === "business";
          const displayPrice = annual
            ? plan.priceMonthly * (1 - plan.yearlyDiscountPercent / 100)
            : plan.priceMonthly;

          return (
            <div
              key={plan.code}
              className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all ${
                isPopular
                  ? "border-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-zinc-900 shadow-xl shadow-blue-600/10"
                  : "border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
                  <Sparkles className="w-3 h-3" /> Popular
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                  {plan.name}
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 min-h-[40px]">
                  {plan.description}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {formatMoney(displayPrice, plan.currency)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    / month
                  </span>
                </div>
                {annual && (
                  <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Billed annually (save {plan.yearlyDiscountPercent}%)
                  </p>
                )}

                <hr className="my-5 border-slate-100 dark:border-zinc-800" />
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  {plan.featuresList.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <Link
                  href="/auth/signup"
                  className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                      : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {faqs.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={item.question}
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <span className="text-sm sm:text-base">{item.question}</span>
              <ChevronDown
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-blue-600" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-6 pb-5 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-zinc-800">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DEMO_SERVICES = [
  "Platform Demo",
  "Multi-Branch Enterprise Setup",
  "Rate & Accounting Migration",
  "Custom Carrier Integration",
  "General Inquiry",
];

export function LandingContactForm() {
  const [formData, setFormData] = useState({
    company: "",
    name: "",
    phone: "",
    email: "",
    service: "",
    message: "",
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in Name, Email and Message.");
      return;
    }
    if (!privacyAccepted) {
      toast.error("Please accept the privacy policy.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: formData.company || undefined,
          name: formData.name,
          phone: formData.phone || undefined,
          email: formData.email,
          service: formData.service || undefined,
          message: formData.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data.error || "Failed to send. Please try again or email us directly."
        );
        return;
      }
      toast.success("Thank you for your message! Our team will reach out shortly.");
      setFormData({
        company: "",
        name: "",
        phone: "",
        email: "",
        service: "",
        message: "",
      });
      setPrivacyAccepted(false);
    } catch {
      toast.error("Failed to send. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="landing-company">Company</Label>
          <Input
            id="landing-company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            placeholder="Your courier company"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing-name">Name *</Label>
          <Input
            id="landing-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your full name"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="landing-phone">Phone</Label>
          <Input
            id="landing-phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+92 300 000 0000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing-email">Work Email *</Label>
          <Input
            id="landing-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@company.com"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Topic</Label>
        <Select
          value={formData.service}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, service: value }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an inquiry topic" />
          </SelectTrigger>
          <SelectContent>
            {DEMO_SERVICES.map((topic) => (
              <SelectItem key={topic} value={topic}>
                {topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="landing-message">Message *</Label>
        <Textarea
          id="landing-message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us about your shipment volume, branches, or onboarding goals..."
          rows={4}
          required
        />
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="landing-privacy"
          checked={privacyAccepted}
          onCheckedChange={(v) => setPrivacyAccepted(!!v)}
          className="mt-0.5"
        />
        <label
          htmlFor="landing-privacy"
          className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer leading-relaxed"
        >
          I agree to the processing of my inquiry in accordance with the{" "}
          <Link
            href="/privacy"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Privacy Policy
          </Link>
          .
        </label>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
      >
        {loading ? (
          "Sending..."
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Request Demo / Send Message
          </>
        )}
      </Button>
    </form>
  );
}
