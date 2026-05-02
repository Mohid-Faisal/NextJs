"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Truck,
  Globe,
  Clock,
  Shield,
  HeadphonesIcon,
  Facebook,
  Twitter,
  Instagram,
  MapPin,
  Phone,
  Mail,
  Search,
  Star,
  BadgeCheck,
  Award,
  PlaneTakeoff,
  ShipWheel,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useInView,
  animate as fmAnimate,
} from "framer-motion";
import { toast } from "sonner";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const CUSTOMER_STORIES: { name: string; title: string; shortQuote: string; fullQuote: string; photo?: string }[] = [
  { name: "Sajid Aslam", title: "CEO Cormet Group", shortQuote: "Always reliable, always personal—PSS makes shipping easy.", fullQuote: "As a transportation coordinator, I appreciate the simplicity and power of PSS Worldwide's real-time features. Managing fleets, monitoring routes, and addressing issues proactively - all in one place. It's a game-changer for anyone in the logistics field.", photo: "/customers/Sajid.jpeg" },
  { name: "Zubair Suleman", title: "Partner Matila Traders", shortQuote: "Exceptional service with a friendly touch every time.", fullQuote: "We've been using PSS Worldwide for our international shipments for over two years. The tracking is transparent, customer support is responsive, and our packages always arrive when promised. Highly recommend for B2B logistics.", photo: "/customers/Zubair.jpeg" },
  { name: "Shafiq Latif", title: "Swift Global", shortQuote: "Trusted team, smooth delivery, peace of mind.", fullQuote: "As a small business owner, I needed a courier that could handle both domestic and international orders without breaking the bank. PSS Worldwide offered competitive rates and seamless delivery. My customers are happy and so am I." },
  { name: "Najam Alavi", title: "Xenomorph", shortQuote: "Fast, safe, and handled with care—every shipment counts.", fullQuote: "The customs clearance assistance from PSS Worldwide has saved us countless hours. They handle documentation, coordinate with authorities, and keep us informed at every step. Professional and stress-free.", photo: "/customers/Najam.jpeg" },
  { name: "Hamza Asif", title: "Vodoo Spell Botique", shortQuote: "Professional, personal, and always going the extra mile.", fullQuote: "When we have urgent orders or last-minute restocks, PSS's same-day delivery option has been a lifesaver. Fast, secure, and our fragile items always arrive in perfect condition. Worth every penny." },
  { name: "Arshad Rasheed", title: "Owner Friends Tailor", shortQuote: "Your cargo is safe, and the service is seamless.", fullQuote: "We grew from shipping a few dozen boxes a month to hundreds. PSS Worldwide scaled with us—same quality, same reliability. Their freight services and warehouse support made the transition smooth." },
  { name: "Asad Ullah", title: "Partner Alwan Printers", shortQuote: "Reliable, efficient, and truly cares about your shipment.", fullQuote: "We ship time-sensitive medical equipment and supplies. PSS Worldwide understands the urgency and handles every shipment with care. Tracking and notifications give us peace of mind.", photo: "/customers/Asad.jpeg" },
  { name: "Shms ul Haq", title: "Owner Nisar Studio", shortQuote: "Shipping made simple, with a team you can trust.", fullQuote: "Exporting to multiple countries used to be a headache. With PSS Worldwide, we get one point of contact, clear pricing, and deliveries across Asia, Europe, and the Americas. Feels local even when it's global." },
  { name: "Mubashir Malik", title: "GM Minolta Systems", shortQuote: "On time, stress-free, and always professional.", fullQuote: "We ship art and fragile installations. PSS's secure packaging and careful handling mean our pieces arrive exhibition-ready. Their team treats every shipment like it's their own.", photo: "/customers/Mubashir.jpeg" },
  { name: "Abdur Rahman", title: "Director Sphere Traders", shortQuote: "Friendly service, expert handling, and consistent delivery.", fullQuote: "The real-time tracking and proof of delivery have cut down customer disputes and support tickets. We always know where a package is and when it was received. Efficiency went up, stress went down." },
  { name: "Aaida Abu Jaber", title: "Tor Tar Fashion", shortQuote: "Every shipment handled with care and attention.", fullQuote: "We needed a partner who could handle temperature-sensitive organic produce. PSS Worldwide's logistics and cold-chain options have been solid. Fresh delivery, happy customers, fewer losses.", photo: "/customers/Aaida.jpeg" },
  { name: "Amna Shah", title: "Director Rakhtsaaz", shortQuote: "A brilliant team making international shipping effortless.", fullQuote: "We use PSS for both heavy freight and express spare parts. Having one provider for both simplifies invoicing, reporting, and relationship management. Quality and consistency across the board." },
];

const BRANDS = [
  "INTERWOOD",
  "BEECHTREE",
  "Telenor Microfinance Bank",
  "SANAULLA",
  "CHASE UP",
  "Nestlé",
  "Unilever",
  "Packages Limited",
  "Engro",
  "Habib Metropolitan",
  "Lucky Cement",
  "Nishat Mills",
  "Fauji Foods",
  "JDW Sugar",
  "GSK",
  "PepsiCo",
  "Coca-Cola",
  "Philips",
  "Siemens",
  "Toyota",
];

/* ────────────────────────────────────────────────────────────────────────────
 *  TRUST & AUTHORITY: stat counters
 * ──────────────────────────────────────────────────────────────────────────── */

type Stat = { label: string; value: number; suffix?: string; prefix?: string };
const STATS: Stat[] = [
  { label: "Years of Experience", value: 30, suffix: "+" },
  { label: "Countries Served", value: 100, suffix: "+" },
  { label: "Monthly Shipments", value: 10000, suffix: "+" },
  { label: "On-Time Delivery", value: 99.8, suffix: "%" },
];

function AnimatedCounter({ to, suffix = "", prefix = "", decimals = 0 }: { to: number; suffix?: string; prefix?: string; decimals?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(to.toFixed(decimals));
      return;
    }
    const controls = fmAnimate(mv, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        const formatted =
          decimals > 0
            ? v.toFixed(decimals)
            : Math.round(v).toLocaleString();
        setDisplay(formatted);
      },
    });
    return () => controls.stop();
  }, [inView, to, mv, reduced, decimals]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  ANIMATED SVG: Global Network of routes between logistics hubs
 * ──────────────────────────────────────────────────────────────────────────── */

const NETWORK_HUBS: { x: number; y: number; name: string }[] = [
  { x: 150, y: 220, name: "New York" },
  { x: 380, y: 200, name: "London" },
  { x: 460, y: 230, name: "Paris" },
  { x: 600, y: 290, name: "Dubai" },
  { x: 660, y: 305, name: "Karachi" },
  { x: 760, y: 330, name: "Singapore" },
  { x: 840, y: 380, name: "Sydney" },
  { x: 720, y: 230, name: "Shanghai" },
];

const NETWORK_ROUTES: [number, number][] = [
  [4, 0], // Karachi → New York
  [4, 1], // Karachi → London
  [4, 3], // Karachi → Dubai
  [4, 5], // Karachi → Singapore
  [3, 1], // Dubai → London
  [3, 6], // Dubai → Sydney
  [5, 7], // Singapore → Shanghai
  [7, 0], // Shanghai → New York
  [1, 2], // London → Paris
];

function quadPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.max(40, Math.abs(b.x - a.x) * 0.18);
  return `M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`;
}

function GlobalNetworkSVG({ subtle = false }: { subtle?: boolean }) {
  const reduced = useReducedMotion();
  const opacity = subtle ? 0.35 : 1;

  return (
    <svg
      viewBox="0 0 1000 500"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#2563eb" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="routeStroke" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background dot grid hinting at a world map */}
      <g opacity={subtle ? 0.18 : 0.28}>
        {Array.from({ length: 22 }).map((_, row) =>
          Array.from({ length: 44 }).map((_, col) => {
            const cx = 30 + col * 22;
            const cy = 30 + row * 20;
            // Carve a rough land silhouette by skipping ocean cells
            const inLand =
              (col > 4 && col < 13 && row > 5 && row < 14) || // Americas
              (col > 18 && col < 24 && row > 4 && row < 12) || // Europe
              (col > 22 && col < 28 && row > 8 && row < 16) || // Africa
              (col > 26 && col < 38 && row > 6 && row < 14) || // Asia
              (col > 36 && col < 41 && row > 14 && row < 19); // Oceania
            if (!inLand) return null;
            return (
              <circle
                key={`${row}-${col}`}
                cx={cx}
                cy={cy}
                r={1.4}
                fill="#3b82f6"
              />
            );
          })
        )}
      </g>

      {/* Routes */}
      {NETWORK_ROUTES.map(([from, to], idx) => {
        const a = NETWORK_HUBS[from];
        const b = NETWORK_HUBS[to];
        return (
          <motion.path
            key={`route-${idx}`}
            d={quadPath(a, b)}
            fill="none"
            stroke="url(#routeStroke)"
            strokeWidth={1.8}
            strokeDasharray="6 6"
            strokeOpacity={opacity}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: reduced ? 0 : 1.4,
              delay: reduced ? 0 : idx * 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        );
      })}

      {/* Travelling pulse along each route */}
      {!reduced &&
        NETWORK_ROUTES.map(([from, to], idx) => {
          const a = NETWORK_HUBS[from];
          const b = NETWORK_HUBS[to];
          return (
            <circle key={`pulse-${idx}`} r="3.2" fill="#bfdbfe">
              <animateMotion
                dur={`${4 + (idx % 4)}s`}
                repeatCount="indefinite"
                begin={`${idx * 0.6}s`}
                path={quadPath(a, b)}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={`${4 + (idx % 4)}s`}
                repeatCount="indefinite"
                begin={`${idx * 0.6}s`}
              />
            </circle>
          );
        })}

      {/* Hub markers */}
      {NETWORK_HUBS.map((h, idx) => (
        <g key={`hub-${idx}`}>
          <circle cx={h.x} cy={h.y} r={18} fill="url(#hubGlow)" opacity={opacity} />
          {!reduced && (
            <circle cx={h.x} cy={h.y} r={6} fill="#3b82f6" opacity={opacity}>
              <animate
                attributeName="r"
                values="6;14;6"
                dur="2.8s"
                repeatCount="indefinite"
                begin={`${idx * 0.25}s`}
              />
              <animate
                attributeName="opacity"
                values={`${opacity};0;${opacity}`}
                dur="2.8s"
                repeatCount="indefinite"
                begin={`${idx * 0.25}s`}
              />
            </circle>
          )}
          <circle cx={h.x} cy={h.y} r={4.5} fill="#ffffff" opacity={opacity} />
          <circle cx={h.x} cy={h.y} r={2.5} fill="#1d4ed8" opacity={opacity} />
        </g>
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  ANIMATED SVG: Truck travelling along a dashed route (for tracking section)
 * ──────────────────────────────────────────────────────────────────────────── */

function AnimatedTruckPath() {
  const reduced = useReducedMotion();
  const truckPath = "M 40 90 C 200 30, 400 150, 560 70 S 880 110, 960 60";

  return (
    <svg
      viewBox="0 0 1000 140"
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="roadGlow" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Origin and destination pins */}
      <g>
        <circle cx="40" cy="90" r="14" fill="#dbeafe" />
        <circle cx="40" cy="90" r="6" fill="#2563eb" />
        <circle cx="960" cy="60" r="14" fill="#dcfce7" />
        <circle cx="960" cy="60" r="6" fill="#16a34a" />
      </g>

      {/* Dashed road */}
      <path
        d={truckPath}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={3}
        strokeDasharray="2 10"
        strokeLinecap="round"
      />

      {/* Animated bright pulse on the road */}
      <path
        d={truckPath}
        fill="none"
        stroke="url(#roadGlow)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="120 1000"
      >
        {!reduced && (
          <animate
            attributeName="stroke-dashoffset"
            from="1000"
            to="-200"
            dur="6s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* The truck — moves along the path */}
      <g>
        {!reduced ? (
          <g>
            <animateMotion
              dur="6s"
              repeatCount="indefinite"
              rotate="auto"
              path={truckPath}
            />
            <TruckShape />
          </g>
        ) : (
          <g transform="translate(480, 80)">
            <TruckShape />
          </g>
        )}
      </g>
    </svg>
  );
}

function TruckShape() {
  return (
    <g transform="translate(-22, -12)">
      <rect x="0" y="0" width="30" height="18" rx="3" fill="#1e3a8a" />
      <rect x="30" y="4" width="14" height="14" rx="2" fill="#2563eb" />
      <rect x="33" y="6" width="8" height="6" fill="#bfdbfe" />
      <circle cx="9" cy="20" r="3.5" fill="#0f172a" />
      <circle cx="9" cy="20" r="1.5" fill="#94a3b8" />
      <circle cx="35" cy="20" r="3.5" fill="#0f172a" />
      <circle cx="35" cy="20" r="1.5" fill="#94a3b8" />
    </g>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  EXISTING: Brands slideshow (kept, lightly polished)
 * ──────────────────────────────────────────────────────────────────────────── */

const BRANDS_VISIBLE = 5;
const BRANDS_STEP = 1;

function BrandsSlideshowSection() {
  const [startIndex, setStartIndex] = useState(0);
  const n = BRANDS.length;

  useEffect(() => {
    const t = setInterval(() => {
      setStartIndex((i) => (i + BRANDS_STEP) % n);
    }, 3000);
    return () => clearInterval(t);
  }, [n]);

  const visibleBrands = Array.from({ length: BRANDS_VISIBLE }, (_, k) => BRANDS[(startIndex + k) % n]);

  return (
    <section
      id="brands"
      className="py-16 bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-y border-gray-200 dark:border-gray-800 scroll-mt-32"
    >
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2"
        >
          Trusted partners
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-10"
        >
          Proudly working with
        </motion.h2>
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
          {visibleBrands.map((name, i) => (
            <motion.div
              key={`${startIndex}-${i}-${name}`}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center min-w-[140px] md:min-w-[160px] h-16 md:h-20 px-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm md:text-base text-center hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  EXISTING: Customer stories carousel (kept)
 * ──────────────────────────────────────────────────────────────────────────── */

const CARDS_PER_VIEW = 3;
const STORIES_STEP = 1;
const STORIES_GAP_PX = 24;

function CustomerStoriesSection() {
  const stories = CUSTOMER_STORIES;
  const numSlides = stories.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const storiesForStrip = [...stories, ...stories.slice(0, CARDS_PER_VIEW)];
  const stripLength = storiesForStrip.length;

  const activeSlide = displayIndex % numSlides;

  useEffect(() => {
    const t = setInterval(() => {
      setDisplayIndex((i) => (i + STORIES_STEP) % stripLength);
    }, 3000);
    return () => clearInterval(t);
  }, [stripLength]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      setCardWidth((w - 2 * STORIES_GAP_PX) / CARDS_PER_VIEW + STORIES_GAP_PX);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleAnimationComplete = () => {
    if (displayIndex === numSlides) {
      setIsResetting(true);
      setDisplayIndex(0);
    }
  };

  useEffect(() => {
    if (!isResetting) return;
    const id = requestAnimationFrame(() => setIsResetting(false));
    return () => cancelAnimationFrame(id);
  }, [isResetting]);

  const translateX = cardWidth > 0 ? -(displayIndex * cardWidth) : 0;
  const stripWidth = cardWidth > 0 ? stripLength * cardWidth - STORIES_GAP_PX : 0;
  const singleCardWidth = cardWidth > 0 ? cardWidth - STORIES_GAP_PX : 0;

  return (
    <section id="customer-stories" className="py-20 bg-white dark:bg-gray-800 scroll-mt-32">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2"
        >
          Customer Stories
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-center text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-12"
        >
          What our happy clients say
        </motion.h2>

        <div ref={containerRef} className="w-full max-w-6xl mx-auto overflow-hidden">
          <motion.div
            className="flex flex-row shrink-0"
            style={{
              width: stripWidth || undefined,
              gap: STORIES_GAP_PX,
            }}
            animate={{ x: translateX }}
            transition={{ duration: isResetting ? 0 : 0.45, ease: "easeInOut" }}
            onAnimationComplete={handleAnimationComplete}
          >
            {storiesForStrip.map((story, index) => {
              const initials = story.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
              return (
                <div
                  key={`${story.name}-${story.shortQuote}-${index}`}
                  className="shrink-0 min-w-0 rounded-xl shadow-md hover:shadow-xl border border-gray-100 dark:border-gray-600 p-5 md:p-6 flex flex-col text-left bg-white dark:bg-gray-700 transition-shadow"
                  style={{ width: singleCardWidth || undefined }}
                >
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((_) => (
                        <Star key={_} className="w-5 h-5 fill-current" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">(5) Rating</span>
                  </div>
                  <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {story.shortQuote}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1 line-clamp-4">
                    {story.fullQuote}
                  </p>
                  <div className="mt-4 flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                      {story.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={story.photo} alt={story.name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{story.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{story.title}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>

          <div className="flex justify-center gap-2 mt-10" role="tablist" aria-label="Customer story slides">
            {Array.from({ length: numSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeSlide}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setDisplayIndex(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === activeSlide ? "bg-blue-600 scale-125" : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Track your package (enhanced with animated truck)
 * ──────────────────────────────────────────────────────────────────────────── */

function TrackYourPackageSection() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const id = bookingId.trim();
    if (!id) return;
    router.push(`/tracking?bookingId=${encodeURIComponent(id)}`);
  };

  return (
    <section
      id="track-package"
      className="relative py-20 bg-linear-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/40 border-t border-b border-gray-100 dark:border-gray-800 scroll-mt-32 overflow-hidden"
    >
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2"
        >
          Real-time tracking
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2"
        >
          Track Your Shipment
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-gray-600 dark:text-gray-400 text-lg mb-8"
        >
          Enter your booking ID for live updates from pickup to delivery.
        </motion.p>

        <motion.form
          onSubmit={handleTrack}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-xl mx-auto"
        >
          <Input
            type="text"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Enter booking ID (e.g., 420001)"
            className="flex-1 min-w-0 h-12 px-4 rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-blue-600 focus-visible:ring-offset-0 shadow-sm"
          />
          <Button
            type="submit"
            size="lg"
            className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shrink-0 cursor-pointer shadow-lg shadow-blue-600/20"
          >
            <Search className="w-5 h-5 mr-2 inline" />
            Track
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-12 max-w-5xl mx-auto"
        >
          <AnimatedTruckPath />
          <div className="grid grid-cols-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 -mt-2 px-2">
            <span className="text-left font-medium text-blue-700 dark:text-blue-300">Picked up</span>
            <span className="text-center">In transit</span>
            <span className="text-right font-medium text-emerald-700 dark:text-emerald-300">Delivered</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  NEW: Animated stats band (Trust & Authority signature)
 * ──────────────────────────────────────────────────────────────────────────── */

function StatsBandSection() {
  return (
    <section className="relative py-16 bg-linear-to-r from-[#0f172a] via-[#1e3a8a] to-[#0f172a] text-white overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-size-[24px_24px]" aria-hidden />
      <div className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-transparent via-blue-400/40 to-transparent" aria-hidden />
      <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-blue-400/40 to-transparent" aria-hidden />

      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-b from-white to-blue-200 bg-clip-text text-transparent">
                <AnimatedCounter
                  to={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  decimals={stat.value % 1 !== 0 ? 1 : 0}
                />
              </div>
              <div className="mt-2 text-sm md:text-base text-blue-200/80 font-medium uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  NEW: Why choose us — differentiators
 * ──────────────────────────────────────────────────────────────────────────── */

const DIFFERENTIATORS = [
  {
    icon: BadgeCheck,
    title: "Customs Cleared",
    desc: "End-to-end documentation and customs handling so your shipment never gets stuck at the border.",
    accent: "from-blue-500 to-cyan-500",
  },
  {
    icon: ShipWheel,
    title: "Worldwide Network",
    desc: "Air, sea and ground partners across 100+ countries. One contact, global reach.",
    accent: "from-indigo-500 to-blue-500",
  },
  {
    icon: PlaneTakeoff,
    title: "Express & Freight",
    desc: "From single parcels to full container loads — express, economy and freight, all under one roof.",
    accent: "from-violet-500 to-indigo-500",
  },
  {
    icon: Award,
    title: "Award-Winning Service",
    desc: "30+ years of trusted service with 99.8% on-time delivery and a dedicated account manager.",
    accent: "from-amber-500 to-orange-500",
  },
];

function WhyChooseUsSection() {
  return (
    <section
      id="why-us"
      className="relative py-24 bg-linear-to-b from-white via-slate-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 scroll-mt-32"
    >
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
            Why PSS Worldwide
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            Built for businesses that{" "}
            <span className="bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              can&apos;t afford to wait
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Four reasons companies from startups to multinationals trust us with their most critical shipments.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {DIFFERENTIATORS.map((d) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={d.title}
                variants={fadeInUp}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                className="group relative rounded-2xl border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-gray-900 p-7 shadow-sm hover:shadow-2xl transition-all overflow-hidden"
              >
                <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full bg-linear-to-br ${d.accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} aria-hidden />
                <div className={`relative w-12 h-12 rounded-xl bg-linear-to-br ${d.accent} text-white flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="relative text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {d.title}
                </h3>
                <p className="relative text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {d.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  NEW: Global Network section — animated SVG
 * ──────────────────────────────────────────────────────────────────────────── */

function GlobalNetworkSection() {
  return (
    <section
      id="network"
      className="relative py-24 bg-[#0a0f1f] text-white overflow-hidden scroll-mt-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18)_0%,transparent_60%)]" aria-hidden />

      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300 mb-2"
          >
            Global presence
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
          >
            One network. <span className="bg-linear-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">Everywhere your business goes.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-base md:text-lg text-blue-100/70 max-w-2xl mx-auto"
          >
            Live shipments moving across our partner network right now — from Karachi to New York, Dubai to Singapore.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-6xl mx-auto"
        >
          <GlobalNetworkSVG />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          {NETWORK_HUBS.map((h) => (
            <span
              key={h.name}
              className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
              {h.name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  NEW: CTA banner before contact
 * ──────────────────────────────────────────────────────────────────────────── */

function CTABannerSection() {
  return (
    <section className="relative py-20 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0f172a] via-[#1e3a8a] to-[#1d4ed8] px-8 py-16 md:px-16 md:py-20 shadow-2xl shadow-blue-900/30"
        >
          {/* Decorative network SVG layered subtly */}
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <GlobalNetworkSVG subtle />
          </div>
          <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden />
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" aria-hidden />

          <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-sm mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                Ready in 60 seconds
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
                Ready to ship with confidence?
              </h2>
              <p className="text-base md:text-lg text-blue-100/80 max-w-xl">
                Get an instant rate on your next shipment, or talk to a logistics specialist about your business.
                No long forms. No call-center maze.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:items-stretch">
              <Link href="/rate-calculator" className="group">
                <Button
                  size="lg"
                  className="w-full h-14 bg-white hover:bg-blue-50 text-[#1e3a8a] font-semibold rounded-xl shadow-lg cursor-pointer text-base"
                >
                  <Zap className="w-5 h-5 mr-2 text-amber-500" />
                  Get an instant rate
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#contact" className="group">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-14 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white hover:border-white/50 font-semibold rounded-xl cursor-pointer text-base"
                >
                  Talk to sales
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Hero slides
 * ──────────────────────────────────────────────────────────────────────────── */

const HERO_SLIDES = [
  {
    src: "/Hero7.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "EXPRESS COURIER & LOGISTICS",
    headingLines: ["Fast. Secure. Global.", "Your trusted delivery partner."],
    paragraph: "Reliable shipping solutions to over 100+ countries. Track every shipment in real time.",
  },
  {
    src: "/Hero2.jpeg",
    alt: "PSS Worldwide logistics",
    tagline: "FREIGHT & CARGO SOLUTIONS",
    headingLines: ["Freight services.", "Scaled to your business."],
    paragraph: "From single parcels to full-container loads. One partner for all your logistics needs.",
  },
  {
    src: "/Hero3.jpeg",
    alt: "PSS Worldwide logistics",
    tagline: "INTERNATIONAL SHIPPING",
    headingLines: ["Borders don't stop us.", "We deliver worldwide."],
    paragraph: "Customs clearance, tracking, and dedicated support. Shipping made simple.",
  },
  {
    src: "/shipment2.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "SAME-DAY & EXPRESS DELIVERY",
    headingLines: ["Urgent? We've got you.", "Fast. Secure. On time."],
    paragraph: "When it has to get there today. Same-day and express options when you need them most.",
  },
  {
    src: "/Hero5.jpeg",
    alt: "Your trusted delivery partner",
    tagline: "TRACKING & TRANSPARENCY",
    headingLines: ["Always know where it is.", "Real-time tracking."],
    paragraph: "From pickup to delivery. Full visibility and proof of delivery for every shipment.",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 *  Services config — static maps so Tailwind JIT can see classnames
 * ──────────────────────────────────────────────────────────────────────────── */

type ServiceTone = "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan";

const SERVICE_TONES: Record<
  ServiceTone,
  { iconBg: string; iconText: string; ring: string; gradient: string }
> = {
  blue: {
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconText: "text-blue-600 dark:text-blue-400",
    ring: "group-hover:ring-blue-200 dark:group-hover:ring-blue-800",
    gradient: "from-blue-500/10 to-cyan-500/10",
  },
  emerald: {
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconText: "text-emerald-600 dark:text-emerald-400",
    ring: "group-hover:ring-emerald-200 dark:group-hover:ring-emerald-800",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  violet: {
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    iconText: "text-violet-600 dark:text-violet-400",
    ring: "group-hover:ring-violet-200 dark:group-hover:ring-violet-800",
    gradient: "from-violet-500/10 to-indigo-500/10",
  },
  amber: {
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    iconText: "text-amber-600 dark:text-amber-400",
    ring: "group-hover:ring-amber-200 dark:group-hover:ring-amber-800",
    gradient: "from-amber-500/10 to-orange-500/10",
  },
  rose: {
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
    iconText: "text-rose-600 dark:text-rose-400",
    ring: "group-hover:ring-rose-200 dark:group-hover:ring-rose-800",
    gradient: "from-rose-500/10 to-pink-500/10",
  },
  cyan: {
    iconBg: "bg-cyan-50 dark:bg-cyan-950/40",
    iconText: "text-cyan-600 dark:text-cyan-400",
    ring: "group-hover:ring-cyan-200 dark:group-hover:ring-cyan-800",
    gradient: "from-cyan-500/10 to-sky-500/10",
  },
};

const SERVICES: { icon: typeof Package; title: string; desc: string; tone: ServiceTone }[] = [
  { icon: Package, title: "Express Delivery", desc: "Fast and secure express delivery services to over 100+ countries worldwide.", tone: "blue" },
  { icon: Truck, title: "Freight Services", desc: "Reliable freight and cargo services for businesses of all sizes.", tone: "emerald" },
  { icon: Globe, title: "International Shipping", desc: "Seamless international shipping with customs clearance support.", tone: "violet" },
  { icon: Clock, title: "Same-Day Delivery", desc: "Urgent delivery options available for time-sensitive shipments.", tone: "amber" },
  { icon: Shield, title: "Secure Packaging", desc: "Professional packaging services to ensure your items arrive safely.", tone: "rose" },
  { icon: HeadphonesIcon, title: "24/7 Support", desc: "Round-the-clock customer support to assist you whenever you need help.", tone: "cyan" },
];

/* ────────────────────────────────────────────────────────────────────────────
 *  HOME PAGE
 * ──────────────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "22%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.12]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Smooth-scroll to section when landing with a hash
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden scrollbar-pretty">
      {/* ─────────────────────────────  HERO  ───────────────────────────── */}
      <section
        ref={heroRef}
        id="home"
        className="relative w-full min-h-[calc(100vh+25px)] overflow-hidden -mt-[115px] pt-[115px] scroll-mt-0"
      >
        <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
          {HERO_SLIDES.map((slide, index) => (
            <motion.div
              key={slide.src}
              className="absolute inset-0"
              style={{ zIndex: index === currentSlide ? 1 : 0 }}
              initial={false}
              animate={{ opacity: index === currentSlide ? 1 : 0 }}
              transition={{ duration: 0.8 }}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                className="object-cover"
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Gradient overlay for crisp text + brand tint */}
        <div
          className="absolute inset-0 bg-linear-to-br from-black/70 via-black/40 to-blue-950/60 z-1"
          aria-hidden
        />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-size-[24px_24px] z-1"
          aria-hidden
        />
        {/* Animated network behind text - extra wow */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 z-1 opacity-30 pointer-events-none">
          <GlobalNetworkSVG subtle />
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex items-start z-10 pt-[34%] sm:pt-[32%] md:pt-[30%]">
          <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-6 sm:gap-8 md:gap-10">
              {/* Vertical dot navigation */}
              <div className="flex flex-col gap-3 shrink-0" role="tablist" aria-label="Hero slides">
                {HERO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === currentSlide}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setCurrentSlide(i)}
                    className={`rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 ${
                      i === currentSlide
                        ? "w-3 h-3 sm:w-3.5 sm:h-3.5 bg-blue-500 ring-0"
                        : "w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-white bg-transparent hover:border-white/80"
                    }`}
                  />
                ))}
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1 max-w-2xl lg:max-w-3xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4 }}
                    className="text-left"
                  >
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md px-3 py-1 text-[11px] sm:text-xs font-medium tracking-[0.18em] uppercase text-blue-200 mb-4 sm:mb-5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                      {HERO_SLIDES[currentSlide].tagline}
                    </span>
                    <div className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-1 sm:gap-x-5 sm:gap-y-2">
                      {HERO_SLIDES[currentSlide].headingLines.map((line, i) => (
                        <h1
                          key={i}
                          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl 2xl:text-6xl font-bold text-white leading-tight tracking-tight whitespace-nowrap"
                          style={{
                            textShadow: "0 4px 24px rgba(0,0,0,0.35)",
                          }}
                        >
                          {line}
                        </h1>
                      ))}
                    </div>
                    <p className="mt-4 sm:mt-6 text-sm sm:text-base text-gray-200/95 max-w-lg">
                      {HERO_SLIDES[currentSlide].paragraph}
                    </p>

                    {/* Trust pill row */}
                    <div className="mt-6 sm:mt-7 flex flex-wrap gap-2 sm:gap-3">
                      {[
                        { icon: BadgeCheck, label: "Customs handled" },
                        { icon: Globe, label: "100+ countries" },
                        { icon: Clock, label: "99.8% on-time" },
                      ].map((p) => {
                        const Icon = p.icon;
                        return (
                          <span
                            key={p.label}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <Icon className="w-3.5 h-3.5 text-cyan-300" />
                            {p.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Primary CTAs */}
                    <div className="mt-7 sm:mt-8 flex flex-wrap gap-3">
                      <Link href="/rate-calculator">
                        <Button
                          size="lg"
                          className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer shadow-lg shadow-blue-900/40"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Get an instant rate
                        </Button>
                      </Link>
                      <a href="#track-package">
                        <Button
                          size="lg"
                          variant="outline"
                          className="h-12 px-6 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white hover:border-white/50 font-semibold rounded-lg cursor-pointer"
                        >
                          Track a shipment
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        {!reduced && (
          <motion.a
            href="#stats"
            aria-label="Scroll down"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-white/80 hover:text-white"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-[10px] uppercase tracking-[0.25em]">Scroll</span>
            <motion.span
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          </motion.a>
        )}
      </section>

      {/* ─────────────────────────  STATS BAND  ───────────────────────── */}
      <div id="stats" className="scroll-mt-32" />
      <StatsBandSection />

      {/* ─────────────────────────  ABOUT  ───────────────────────── */}
      <section id="about" className="py-20 bg-white dark:bg-gray-800 scroll-mt-30">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
                About us
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                Three decades of moving things that matter.
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                PSS Worldwide is a leading courier and logistics company committed to providing
                fast, reliable, and affordable shipping solutions to customers worldwide.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                With years of experience in the industry, we have built a reputation for
                excellence in international shipping, express delivery, and freight services.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Our state-of-the-art tracking system ensures you always know where your package is,
                and our dedicated team works around the clock to ensure timely and secure delivery.
              </p>

              {/* Credentials */}
              <div className="flex flex-wrap gap-2 mb-6">
                {["IATA Certified", "ISO 9001", "Customs Bonded", "Insured"].map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" />
                    {c}
                  </span>
                ))}
              </div>

              <Link href="/about">
                <Button
                  size="lg"
                  className="bg-[#1a365d] hover:bg-[#2c5282] text-white cursor-pointer shadow-lg shadow-blue-900/20"
                >
                  Learn more about us
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative h-96 rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 ring-1 ring-black/5"
            >
              <Image src="/truck.jpg" alt="About Us" fill className="object-cover" />
              {/* Floating stat card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="absolute bottom-6 left-6 rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur px-5 py-4 shadow-xl ring-1 ring-black/5"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      <AnimatedCounter to={30} suffix="+" />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Years of Service
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────  WHY CHOOSE US  ───────────────────────── */}
      <WhyChooseUsSection />

      {/* ─────────────────────────  GOOD COMPANY  ───────────────────────── */}
      <section id="good-company" className="py-20 bg-white dark:bg-gray-800 scroll-mt-32">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              Carrier partners
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              You&apos;re in good company
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We leverage a premium network of international shipping giants to offer you flexible, fast, and secure delivery solutions for every single package.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <Image
              src="/boxes.png"
              alt="Shipping partners - FedEx, UPS, DPD, EVRi, DHL, Parcelforce Worldwide"
              width={800}
              height={450}
              className="w-full max-w-3xl h-auto object-contain"
            />
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────  BRANDS SLIDESHOW  ───────────────────────── */}
      <BrandsSlideshowSection />

      {/* ─────────────────────────  GLOBAL NETWORK  ───────────────────────── */}
      <GlobalNetworkSection />

      {/* ─────────────────────────  SERVICES  ───────────────────────── */}
      <section id="services" className="py-20 bg-gray-50 dark:bg-gray-900 scroll-mt-24">
        <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              What we deliver
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              Our services
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive courier solutions tailored to meet your shipping needs.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {SERVICES.map((service) => {
              const Icon = service.icon;
              const tone = SERVICE_TONES[service.tone];
              return (
                <motion.div
                  key={service.title}
                  variants={fadeInUp}
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 220, damping: 22 }}
                  className={`group relative bg-white dark:bg-gray-800 p-7 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 ring-1 ring-transparent ${tone.ring} overflow-hidden`}
                >
                  {/* Hover gradient */}
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${tone.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                    aria-hidden
                  />
                  {/* Decorative corner SVG */}
                  <svg
                    className="absolute -bottom-6 -right-6 w-32 h-32 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity"
                    viewBox="0 0 100 100"
                    aria-hidden
                  >
                    <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.6" fill="none" />
                    <circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="0.6" fill="none" />
                    <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="0.6" fill="none" />
                  </svg>

                  <div className={`relative w-12 h-12 ${tone.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${tone.iconText}`} />
                  </div>
                  <h3 className="relative text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {service.title}
                  </h3>
                  <p className="relative text-gray-600 dark:text-gray-400">
                    {service.desc}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────  TRACK PACKAGE  ───────────────────────── */}
      <TrackYourPackageSection />

      {/* ─────────────────────────  CUSTOMER STORIES  ───────────────────────── */}
      <CustomerStoriesSection />

      {/* ─────────────────────────  CTA BANNER  ───────────────────────── */}
      <CTABannerSection />

      {/* ─────────────────────────  CONTACT  ───────────────────────── */}
      <ContactSection />
    </div>
  );
}

const SERVICES_OPTIONS = [
  "Express Delivery",
  "Freight Services",
  "International Shipping",
  "Same-Day Delivery",
  "Secure Packaging",
  "General Inquiry",
];

function ContactSection() {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
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
        toast.error(data.error || "Failed to send. Please try again or email us directly.");
        return;
      }
      toast.success("Thank you for your message! We'll get back to you soon.");
      setFormData({ company: "", name: "", phone: "", email: "", service: "", message: "" });
      setPrivacyAccepted(false);
    } catch {
      toast.error("Failed to send. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="contact"
      className="relative text-white overflow-hidden scroll-mt-30 bg-cover bg-center bg-no-repeat min-h-[calc(100vh-80px)] flex items-stretch"
      style={{ backgroundImage: "url('/map.jpeg')" }}
    >
      <div className="absolute inset-0 bg-black/75" aria-hidden />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563eb]" aria-hidden />
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-size-[24px_24px]" aria-hidden />

      <div className="relative z-10 pt-8 pb-6 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8 mb-8">
          <div>
            <Link href="/" className="inline-block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_final.png" alt="PSS Worldwide" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Fast, secure, and reliable courier and logistics solutions. Your trusted delivery partner for express shipping worldwide.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Contact</h3>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>LGF-44, Land Mark Plaza, Jail Road<br />Lahore, 54660, Pakistan</span>
              </li>
              <li>
                <a href="tel:+92 42 35716494" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 shrink-0" /> +92 42 35716494
                </a>
              </li>
              <li>
                <a href="mailto:info@psswwe.com" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 shrink-0" /> info@psswwe.com
                </a>
              </li>
              <li className="pt-2 flex flex-wrap gap-x-2 gap-y-1">
                <a href="#" className="hover:text-white transition-colors">Legal Notice</a>
                <span aria-hidden>|</span>
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Navigation</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Service</a></li>
              <li><a href="/tools" className="hover:text-white transition-colors">Tools</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white uppercase tracking-wide mb-4">Social media</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Facebook">
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Twitter">
                  <Twitter className="w-4 h-4" /> Twitter
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-white transition-colors" aria-label="Instagram">
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2.1fr_0.9fr] gap-6 pt-4 border-t border-white/10 flex-1 items-start">
          <div className="rounded-lg overflow-hidden bg-gray-800/50 h-[240px] sm:h-[400px]">
            <iframe
              title="PSS Worldwide - Land Mark Plaza, Jail Road, Lahore"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3400.6058668977444!2d74.3469253!3d31.5349833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x391905ede7407d95%3A0x3731d66c5f937a1f!2sPrompt%20Survey%20%26%20Services%20(PSS)!5e0!3m2!1sen!2s!4v1769604264555!5m2!1sen!2s"
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="max-h-[240px] sm:max-h-[400px]">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="company" className="text-gray-300 text-sm">Company</Label>
                  <Input id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Company" className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
                <div>
                  <Label htmlFor="contact-name" className="text-gray-300 text-sm">Name</Label>
                  <Input id="contact-name" name="name" value={formData.name} onChange={handleChange} placeholder="Name" required className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contact-phone" className="text-gray-300 text-sm">Phone</Label>
                  <Input id="contact-phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="Phone" className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
                <div>
                  <Label htmlFor="contact-email" className="text-gray-300 text-sm">Email</Label>
                  <Input id="contact-email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" required className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Select a service</Label>
                <Select value={formData.service} onValueChange={(v) => setFormData({ ...formData, service: v })}>
                  <SelectTrigger className="mt-1 w-full bg-gray-800/50 border-gray-600 text-white focus:ring-[#2563eb] [&>span]:text-gray-300">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {SERVICES_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-white focus:bg-gray-700 focus:text-white">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-gray-300 text-sm">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Message"
                  required
                  rows={3}
                  className="mt-1 bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#2563eb]"
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="privacy" checked={privacyAccepted} onCheckedChange={(v) => setPrivacyAccepted(!!v)} className="border-gray-500 data-[state=checked]:bg-[#2563eb] data-[state=checked]:border-[#2563eb] mt-0.5" />
                <label htmlFor="privacy" className="text-gray-500 text-xs cursor-pointer">
                  I agree to the processing of my data in accordance with the privacy policy.
                </label>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white cursor-pointer">
                {loading ? "Sending..." : "Send"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
