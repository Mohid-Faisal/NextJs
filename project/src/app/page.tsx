// app/page.tsx
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Truck background image */}
      <Image
        src="/truck.jpg" // Make sure this image exists in the public folder
        alt="Courier Truck"
        fill
        priority
        className="object-cover"
      />

      {/* Overlay content */}
      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center text-white px-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Fast. Reliable. Affordable.
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mb-6">
          Experience world-class courier services to over 100+ destinations with real-time tracking and affordable rates.
        </p>
        <div className="flex gap-4">
          <Link href="/auth/login">
            <Button variant="secondary" className="text-lg px-6 py-3">Login</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="text-lg px-6 py-3">Sign Up</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
