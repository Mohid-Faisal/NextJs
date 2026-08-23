"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ContactPage() {
  const [activeFormTab, setActiveFormTab] = useState<"demo" | "inquiry">("demo");
  const [submitted, setSubmitted] = useState(false);

  // Demo Form State
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoVolume, setDemoVolume] = useState("5,000 - 25,000 AWBs / mo");
  const [demoInterest, setDemoInterest] = useState("Both Logistics Dispatch & Accounting ERP");
  const [demoDate, setDemoDate] = useState("");

  // General Inquiry State
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName || !demoEmail || !demoCompany) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitted(true);
    toast.success("Demo request submitted! An enterprise solution architect will contact you within 2 business hours.");
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryEmail || !inquiryMessage) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitted(true);
    toast.success("Inquiry received! Our support team will get back to you shortly.");
  };

  return (
    <div className="relative w-full overflow-x-clip bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 pt-28 pb-24">
      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-500/20">
          <MessageSquare className="h-3.5 w-3.5" />
          Enterprise Support & Demo Access
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Let’s Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Logistics Workflow</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          Schedule an interactive walk-through with our logistics engineers or reach our enterprise desk directly.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Form Column */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1422] p-8 sm:p-10 shadow-2xl space-y-6">
          {/* Form Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <button
              onClick={() => {
                setActiveFormTab("demo");
                setSubmitted(false);
              }}
              className={`pb-2 text-sm font-bold transition-all relative ${
                activeFormTab === "demo"
                  ? "text-cyan-600 dark:text-cyan-400"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Book a Live 1-on-1 Demo
              {activeFormTab === "demo" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-full" />
              )}
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => {
                setActiveFormTab("inquiry");
                setSubmitted(false);
              }}
              className={`pb-2 text-sm font-bold transition-all relative ${
                activeFormTab === "inquiry"
                  ? "text-cyan-600 dark:text-cyan-400"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              General Sales & Support Inquiry
              {activeFormTab === "inquiry" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-full" />
              )}
            </button>
          </div>

          {submitted ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-4 py-12">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Request Successfully Logged!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Our logistics architecture team has received your details. We have sent a calendar invite and sandbox login credentials to your email.
              </p>
              <Button
                variant="outline"
                onClick={() => setSubmitted(false)}
                className="mt-4"
              >
                Submit Another Request
              </Button>
            </div>
          ) : (
            <>
              {activeFormTab === "demo" ? (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={demoName}
                        onChange={(e) => setDemoName(e.target.value)}
                        placeholder="e.g. Alexander Wright"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        placeholder="alex@logisticsfleet.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Company / Courier Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={demoCompany}
                        onChange={(e) => setDemoCompany(e.target.value)}
                        placeholder="Velocity Express 3PL"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Monthly AWB Volume
                      </label>
                      <select
                        value={demoVolume}
                        onChange={(e) => setDemoVolume(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option>Under 1,500 AWBs / mo</option>
                        <option>1,500 - 5,000 AWBs / mo</option>
                        <option>5,000 - 25,000 AWBs / mo</option>
                        <option>25,000+ AWBs / mo (Enterprise)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Primary Area of Interest
                    </label>
                    <select
                      value={demoInterest}
                      onChange={(e) => setDemoInterest(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option>Both Logistics Dispatch & Accounting ERP</option>
                      <option>Automated AWB Barcodes & Rate Matrices</option>
                      <option>Double-Entry General Ledger & Invoicing</option>
                      <option>Multi-Branch & Agency Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Preferred Demo Date / Timeframe
                    </label>
                    <input
                      type="date"
                      value={demoDate}
                      onChange={(e) => setDemoDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Confirm Live Demo Booking
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={inquiryName}
                        onChange={(e) => setInquiryName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={inquiryEmail}
                        onChange={(e) => setInquiryEmail(e.target.value)}
                        placeholder="john@company.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={inquirySubject}
                      onChange={(e) => setInquirySubject(e.target.value)}
                      placeholder="e.g. Custom ERP integration inquiry"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Message *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={inquiryMessage}
                      onChange={(e) => setInquiryMessage(e.target.value)}
                      placeholder="Tell us about your fleet requirements..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl font-bold text-sm text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Send Direct Message
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Right Info Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Direct Contact Channels
            </h3>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Enterprise Support</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">support@promptcourier.com</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">sales@promptcourier.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Direct Hotline</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">+92 300 8482321 (WhatsApp & Voice)</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Mon - Sat: 9:00 AM - 7:00 PM PKT</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Headquarters</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                    Prompt Software Solutions (PSS Worldwide)<br />
                    Commercial Cargo Center, Airport Road, Lahore, Pakistan
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              SLA Guarantee & Onboarding Support
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every enterprise onboarded to PSS receives a dedicated deployment engineer, automatic historical data migration, and comprehensive staff training on double-entry ledger operations.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
