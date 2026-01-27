"use client";

import { Package, Truck, Globe, Clock, Shield, HeadphonesIcon, DollarSign, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";

const services = [
  {
    icon: Package,
    title: "Express Delivery",
    description: "Fast and secure express delivery services to over 100+ countries worldwide. Get your packages delivered quickly and safely.",
    features: [
      "International express shipping",
      "Real-time tracking",
      "Insurance options available",
      "Customs clearance support"
    ],
    color: "blue"
  },
  {
    icon: Truck,
    title: "Freight Services",
    description: "Reliable freight and cargo services for businesses of all sizes. We handle everything from small parcels to large shipments.",
    features: [
      "Full truckload (FTL) services",
      "Less than truckload (LTL) services",
      "Warehousing solutions",
      "Supply chain management"
    ],
    color: "green"
  },
  {
    icon: Globe,
    title: "International Shipping",
    description: "Seamless international shipping with comprehensive customs clearance support. We make global shipping simple.",
    features: [
      "Worldwide coverage",
      "Customs documentation",
      "Duty and tax calculation",
      "Multi-currency support"
    ],
    color: "purple"
  },
  {
    icon: Clock,
    title: "Same-Day Delivery",
    description: "Urgent delivery options available for time-sensitive shipments. When you need it fast, we deliver.",
    features: [
      "Same-day local delivery",
      "Next-day international",
      "Time-definite delivery",
      "Priority handling"
    ],
    color: "orange"
  },
  {
    icon: Shield,
    title: "Secure Packaging",
    description: "Professional packaging services to ensure your items arrive safely. We use the best materials and techniques.",
    features: [
      "Custom packaging solutions",
      "Fragile item handling",
      "Climate-controlled storage",
      "Quality assurance"
    ],
    color: "red"
  },
  {
    icon: DollarSign,
    title: "Competitive Rates",
    description: "Affordable shipping rates without compromising on quality. Get the best value for your shipping needs.",
    features: [
      "Volume discounts",
      "Flexible pricing",
      "No hidden fees",
      "Price match guarantee"
    ],
    color: "cyan"
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Round-the-clock customer support to assist you whenever you need help. We're always here for you.",
    features: [
      "24/7 customer service",
      "Multi-language support",
      "Live chat available",
      "Dedicated account managers"
    ],
    color: "pink"
  },
  {
    icon: Zap,
    title: "Real-Time Tracking",
    description: "Track your shipments in real-time with our advanced tracking system. Know exactly where your package is at all times.",
    features: [
      "Live shipment tracking",
      "SMS and email notifications",
      "Delivery confirmation",
      "Mobile app access"
    ],
    color: "yellow"
  }
];

const colorClasses = {
  blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
  green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
  purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400",
  red: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
  cyan: "bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400",
  pink: "bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400",
  yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5
    }
  }
};

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative bg-gradient-to-r from-[#1a365d] to-[#2E7D7D] text-white py-20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Our Services
            </h1>
            <p className="text-xl opacity-90">
              Comprehensive courier and logistics solutions tailored to meet your shipping needs. 
              From express delivery to freight services, we've got you covered.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Services Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Services Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="hover:shadow-2xl transition-all duration-300 border-0 shadow-md h-full">
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 ${colorClasses[service.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center mb-4`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                        {service.description}
                      </p>
                      <ul className="space-y-2">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-gray-500 dark:text-gray-400 flex items-start">
                            <span className="text-[#1a365d] mr-2 font-bold">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-[#1a365d] to-[#2E7D7D] rounded-xl p-8 md:p-12 text-center text-white shadow-2xl"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Contact us today to learn more about our services and get a custom quote for your shipping needs.
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
        </div>
      </section>
    </div>
  );
}
