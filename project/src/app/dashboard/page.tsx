"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart as BarIcon,
  Users,
  ShoppingCart,
  Truck,
  Package,
} from "lucide-react";
import { motion } from "framer-motion";

const EarningChart = dynamic(() => import("@/components/EarningChart"), {
  ssr: false,
});

const DashboardPage = () => {
  const [data, setData] = useState({
    totalShipments: 0,
    totalUsers: 0,
    totalRevenue: 0,
    newOrders: 0,
    monthlyEarnings: [] as { month: string; earnings: number }[],
    recentShipments: [] as {
      trackingId: string;
      senderName: string;
      recipientName: string;
      destination: string;
      totalCost: number;
      status: string;
      createdAt: string;
    }[],
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="w-full px-4 md:px-8 py-6 bg-white dark:bg-[#111827]">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        Dashboard
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          title="Monthly Revenue"
          value={`PKR ${data.totalRevenue.toLocaleString()}`}
          icon={<BarIcon className="w-6 h-6" />}
          bgColor="bg-indigo-100 dark:bg-indigo-900"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <Card
          title="Active Users"
          value={data.totalUsers}
          icon={<Users className="w-6 h-6" />}
          bgColor="bg-teal-100 dark:bg-teal-900"
          iconColor="text-teal-600 dark:text-teal-400"
        />
        <Card
          title="New Orders"
          value={data.newOrders}
          icon={<ShoppingCart className="w-6 h-6" />}
          bgColor="bg-yellow-100 dark:bg-yellow-900"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
        <Card
          title="Total Shipments"
          value={data.totalShipments}
          icon={<Truck className="w-6 h-6" />}
          bgColor="bg-pink-100 dark:bg-pink-900"
          iconColor="text-pink-600 dark:text-pink-400"
        />
      </div>

      {/* Earnings Chart */}
      <EarningChart earningsData={data.monthlyEarnings} />

      {/* Recent Shipments Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-200 dark:border-gray-700"
      >
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" />
          Recent Shipments
        </h2>

        <div className="w-full overflow-hidden">
          <table className="w-full text-sm text-left border-separate border-spacing-y-1">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Tracking ID</th>
                <th className="px-4 py-3">Sender</th>
                <th className="px-4 py-3">Receiver</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>

            <motion.tbody
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { staggerChildren: 0.05 },
                },
              }}
              className="divide-y divide-gray-200 dark:divide-gray-700"
            >
              {data.recentShipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                  >
                    No recent shipments found.
                  </td>
                </tr>
              ) : (
                data.recentShipments.map((shipment) => (
                  <motion.tr
                    key={shipment.trackingId}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="cursor-pointer transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400 font-medium">
                      {shipment.trackingId}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{shipment.senderName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{shipment.recipientName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{shipment.destination}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      PKR {shipment.totalCost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          shipment.status === "Delivered"
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400"
                            : shipment.status === "Pending"
                            ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(shipment.createdAt).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

const Card = ({
  title,
  value,
  icon,
  bgColor,
  iconColor,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out"
  >
    <div className="flex items-center gap-4">
      <div className={`${bgColor} ${iconColor} p-3 rounded-full`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {value}
        </h3>
      </div>
    </div>
  </motion.div>
);

export default DashboardPage;
