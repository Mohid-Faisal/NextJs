"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import SplitText from "@/components/SplitText";

export default function HomePage() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background Image */}
      <Image
        src="/banner_new.jpg"
        alt="Courier Truck"
        fill
        priority
        className="object-cover"
      />

      {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        {/* SplitText animation */}
        <SplitText
          text="Fast. Reliable. Affordable."
          className="text-white font-extrabold text-4xl sm:text-5xl md:text-6xl leading-tight tracking-wide"
          delay={20}
          duration={2}
          ease="elastic.out(1,0.3)"
          splitType="chars"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-100px"
        />

        {/* Subheading */}
        <p className="text-base sm:text-xl md:text-2xl text-gray-300 max-w-2xl mt-4 mb-8 animate-fade-in delay-100">
          Experience world-class courier services to 100+ destinations with real-time tracking and unbeatable rates.
        </p>

        {/* CTA Buttons */}
        <div className="flex gap-4 flex-wrap justify-center animate-fade-in delay-200">
          <Link href="/auth/login">
            <Button
              variant="secondary"
              size="lg"
              className="px-8 py-4 text-base sm:text-lg shadow-md hover:scale-105 transition-transform"
            >
              Login
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="px-8 py-4 text-base sm:text-lg shadow-md hover:scale-105 transition-transform"
            >
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
