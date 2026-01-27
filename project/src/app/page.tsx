"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package, Truck, Globe, Clock, Shield, HeadphonesIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - single image, centered tagline */}
      <section className="relative w-full min-h-screen overflow-hidden -mt-30 pt-30">
        <Image
          src="/banner_new.jpg"
          alt="Your trusted delivery partner"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight uppercase"
              >
                FAST. SECURE. GLOBAL
              </motion.h1>
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mt-3 leading-tight tracking-tight uppercase"
              >
                YOUR TRUSTED DELIVERY PARTNER!
              </motion.h2>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Services
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive courier solutions tailored to meet your shipping needs
            </p>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { icon: Package, title: "Express Delivery", desc: "Fast and secure express delivery services to over 100+ countries worldwide.", color: "blue" },
              { icon: Truck, title: "Freight Services", desc: "Reliable freight and cargo services for businesses of all sizes.", color: "green" },
              { icon: Globe, title: "International Shipping", desc: "Seamless international shipping with customs clearance support.", color: "purple" },
              { icon: Clock, title: "Same-Day Delivery", desc: "Urgent delivery options available for time-sensitive shipments.", color: "orange" },
              { icon: Shield, title: "Secure Packaging", desc: "Professional packaging services to ensure your items arrive safely.", color: "red" },
              { icon: HeadphonesIcon, title: "24/7 Support", desc: "Round-the-clock customer support to assist you whenever you need help.", color: "cyan" },
            ].map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700"
                >
                  <div className={`w-12 h-12 bg-${service.color}-100 dark:bg-${service.color}-900 rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 text-${service.color}-600 dark:text-${service.color}-400`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {service.desc}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                About PSS Worldwide
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
              <Link href="/about">
                <Button size="lg" className="bg-[#1a365d] hover:bg-[#2c5282] text-white hover:scale-105 transition-transform">
                  Learn More About Us
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative h-96 rounded-xl overflow-hidden shadow-2xl"
            >
              <Image
                src="/truck.jpg"
                alt="About Us"
                fill
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section id="contact" className="py-20 bg-linear-to-r from-[#1a365d] to-[#2E7D7D] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Ship?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Get in touch with us today and experience the difference of world-class courier services.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/contact">
              <Button
                size="lg"
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-white border-0 hover:scale-105 transition-transform"
              >
                Contact Us
              </Button>
            </Link>
            <Link href="/tracking">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/20 text-white hover:bg-white/30 border-white hover:scale-105 transition-transform"
              >
                Track Package
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
