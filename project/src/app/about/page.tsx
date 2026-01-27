"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Users, Award, Globe, TrendingUp, Heart } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const values = [
  {
    icon: CheckCircle,
    title: "Reliability",
    description: "We deliver on our promises, every single time. Your trust is our commitment."
  },
  {
    icon: TrendingUp,
    title: "Excellence",
    description: "Continuous improvement and innovation drive everything we do."
  },
  {
    icon: Heart,
    title: "Customer First",
    description: "Your satisfaction is our top priority. We go above and beyond for our customers."
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Connecting the world through seamless logistics and shipping solutions."
  }
];

const stats = [
  { number: "100+", label: "Countries Served" },
  { number: "50K+", label: "Happy Customers" },
  { number: "1M+", label: "Packages Delivered" },
  { number: "24/7", label: "Customer Support" }
];

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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5
    }
  }
};

export default function AboutPage() {
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
              About PSS Worldwide
            </h1>
            <p className="text-xl opacity-90">
              Leading the way in courier and logistics services with innovation, 
              reliability, and customer-centric solutions.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Story Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Our Story
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                PSS Worldwide was founded with a simple mission: to make international 
                shipping fast, reliable, and affordable for everyone. What started as a 
                small courier service has grown into a trusted logistics partner serving 
                customers across the globe.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                Over the years, we've built a reputation for excellence by consistently 
                delivering on our promises. Our team of experienced professionals works 
                tirelessly to ensure that every package is handled with care and delivered 
                on time.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Today, we're proud to serve thousands of customers worldwide, from 
                individuals sending personal packages to businesses managing complex 
                supply chains. Our commitment to innovation and customer satisfaction 
                continues to drive us forward.
              </p>
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
                alt="Our Story"
                fill
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.1 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                  className="text-4xl md:text-5xl font-bold text-[#1a365d] dark:text-[#2E7D7D] mb-2"
                >
                  {stat.number}
                </motion.div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Values
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </motion.div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ y: -8, scale: 1.02 }}
                >
                  <Card className="hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                    <CardContent className="p-6 text-center">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.6 }}
                        className="w-16 h-16 bg-[#1a365d]/10 dark:bg-[#2E7D7D]/20 rounded-full flex items-center justify-center mx-auto mb-4"
                      >
                        <Icon className="w-8 h-8 text-[#1a365d] dark:text-[#2E7D7D]" />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {value.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {value.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 gap-12"
            >
              <motion.div variants={itemVariants}>
                <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardContent className="p-8">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-12 h-12 bg-[#1a365d]/10 dark:bg-[#2E7D7D]/20 rounded-lg flex items-center justify-center mb-4"
                    >
                      <Award className="w-6 h-6 text-[#1a365d] dark:text-[#2E7D7D]" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      Our Mission
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      To provide world-class courier and logistics services that connect 
                      people and businesses across the globe, making international shipping 
                      accessible, reliable, and affordable for everyone.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
                  <CardContent className="p-8">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-12 h-12 bg-[#1a365d]/10 dark:bg-[#2E7D7D]/20 rounded-lg flex items-center justify-center mb-4"
                    >
                      <Users className="w-6 h-6 text-[#1a365d] dark:text-[#2E7D7D]" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      Our Vision
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      To become the most trusted and innovative logistics partner globally, 
                      recognized for our commitment to excellence, customer satisfaction, 
                      and sustainable business practices.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-gradient-to-r from-[#1a365d] to-[#2E7D7D] text-white"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Join Thousands of Satisfied Customers
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Experience the difference of working with a trusted logistics partner. 
            Get started today!
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
        </div>
      </motion.section>
    </div>
  );
}
