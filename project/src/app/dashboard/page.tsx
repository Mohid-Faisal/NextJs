"use client";

import { useEffect, useState } from "react";
import {
  BarChart as BarIcon,
  Users,
  ShoppingCart,
  Truck,
  Package,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

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
    <div className="w-full px-4 md:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          title="Monthly Revenue"
          value={`PKR ${data.totalRevenue.toLocaleString()}`}
          icon={<BarIcon className="w-6 h-6" />}
          bgColor="bg-indigo-100"
          iconColor="text-indigo-600"
        />
        <Card
          title="Active Users"
          value={data.totalUsers}
          icon={<Users className="w-6 h-6" />}
          bgColor="bg-teal-100"
          iconColor="text-teal-600"
        />
        <Card
          title="New Orders"
          value={data.newOrders}
          icon={<ShoppingCart className="w-6 h-6" />}
          bgColor="bg-yellow-100"
          iconColor="text-yellow-600"
        />
        <Card
          title="Total Shipments"
          value={data.totalShipments}
          icon={<Truck className="w-6 h-6" />}
          bgColor="bg-pink-100"
          iconColor="text-pink-600"
        />
      </div>

      {/* Monthly Earnings Chart */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <BarIcon className="w-5 h-5 text-indigo-500" />
            Monthly Earnings
          </h2>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {currentYear}
          </div>
        </div>
        {data.monthlyEarnings.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No data available for this year.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data.monthlyEarnings}
              margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="earnings"
                fill="#4f46e5"
                radius={[6, 6, 0, 0]}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Shipments Table */}
      {/* Recent Shipments Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white p-6 rounded-xl shadow border border-gray-200"
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" />
          Recent Shipments
        </h2>

        <div className="w-full overflow-hidden">
          <table className="w-full text-sm text-left border-separate border-spacing-y-1">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
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
              className="divide-y divide-gray-200"
            >
              {data.recentShipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 text-center text-gray-500"
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
                    className="cursor-pointer transition-colors duration-200 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-indigo-600 font-medium">
                      {shipment.trackingId}
                    </td>
                    <td className="px-4 py-3">{shipment.senderName}</td>
                    <td className="px-4 py-3">{shipment.recipientName}</td>
                    <td className="px-4 py-3">{shipment.destination}</td>
                    <td className="px-4 py-3">
                      PKR {shipment.totalCost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          shipment.status === "Delivered"
                            ? "bg-green-100 text-green-700"
                            : shipment.status === "Pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
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
    className="bg-white p-6 rounded-xl shadow hover:shadow-md border border-gray-200 transition-all duration-300 ease-in-out"
  >
    <div className="flex items-center gap-4">
      <div className={`${bgColor} ${iconColor} p-3 rounded-full`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h3 className="text-xl font-bold text-gray-800">{value}</h3>
      </div>
    </div>
  </motion.div>
);

export default DashboardPage;
