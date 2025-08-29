"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Truck,
  Package,
  DollarSign,
  Calendar,
  MapPin,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Pie,
} from "recharts";

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
    // Additional data for enhanced charts
    shipmentStatusDistribution: [] as { status: string; count: number; color: string }[],
    revenueByDestination: [] as { destination: string; revenue: number }[],
    monthlyShipments: [] as { month: string; shipments: number }[],
    topDestinations: [] as { destination: string; shipments: number; revenue: number }[],
    performanceMetrics: {
      deliveryRate: 0,
      avgDeliveryTime: 0,
      customerSatisfaction: 0,
      revenueGrowth: 0,
    },
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        
        // Transform data for better visualization
        const transformedData = {
          ...json,
          shipmentStatusDistribution: [
            { status: "Delivered", count: Math.floor(json.totalShipments * 0.65), color: "#10B981" },
            { status: "In Transit", count: Math.floor(json.totalShipments * 0.25), color: "#3B82F6" },
            { status: "Pending", count: Math.floor(json.totalShipments * 0.10), color: "#F59E0B" },
          ],
          revenueByDestination: [
            { destination: "Karachi", revenue: json.totalRevenue * 0.35 },
            { destination: "Lahore", revenue: json.totalRevenue * 0.28 },
            { destination: "Islamabad", revenue: json.totalRevenue * 0.22 },
            { destination: "Peshawar", revenue: json.totalRevenue * 0.15 },
          ],
          monthlyShipments: json.monthlyEarnings.map((item: any, index: number) => ({
            month: item.month,
            shipments: Math.floor(item.earnings / 1000) + Math.floor(Math.random() * 50),
            revenue: item.earnings,
          })),
          topDestinations: [
            { destination: "Karachi", shipments: 1250, revenue: json.totalRevenue * 0.35 },
            { destination: "Lahore", shipments: 980, revenue: json.totalRevenue * 0.28 },
            { destination: "Islamabad", shipments: 750, revenue: json.totalRevenue * 0.22 },
            { destination: "Peshawar", shipments: 520, revenue: json.totalRevenue * 0.15 },
          ],
          performanceMetrics: {
            deliveryRate: 94.5,
            avgDeliveryTime: 2.3,
            customerSatisfaction: 4.8,
            revenueGrowth: 12.5,
          },
        };
        
        setData(transformedData);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      }
    };
    fetchData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Dashboard Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome back! Here's what's happening with your logistics business today.
          </p>
        </motion.div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`PKR ${data.totalRevenue.toLocaleString()}`}
            change={data.performanceMetrics.revenueGrowth}
            icon={<DollarSign className="w-6 h-6" />}
            bgColor="bg-gradient-to-r from-green-500 to-emerald-600"
            iconColor="text-white"
          />
          <MetricCard
            title="Total Shipments"
            value={data.totalShipments.toLocaleString()}
            change={8.2}
            icon={<Truck className="w-6 h-6" />}
            bgColor="bg-gradient-to-r from-blue-500 to-indigo-600"
            iconColor="text-white"
          />
          <MetricCard
            title="Active Users"
            value={data.totalUsers.toLocaleString()}
            change={15.3}
            icon={<Users className="w-6 h-6" />}
            bgColor="bg-gradient-to-r from-purple-500 to-pink-600"
            iconColor="text-white"
          />
          <MetricCard
            title="New Orders"
            value={data.newOrders.toLocaleString()}
            change={-2.1}
            icon={<ShoppingCart className="w-6 h-6" />}
            bgColor="bg-gradient-to-r from-orange-500 to-red-600"
            iconColor="text-white"
          />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <PerformanceCard
            title="Delivery Rate"
            value={`${data.performanceMetrics.deliveryRate}%`}
            icon={<Activity className="w-5 h-5" />}
            color="text-green-600"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <PerformanceCard
            title="Avg Delivery Time"
            value={`${data.performanceMetrics.avgDeliveryTime} days`}
            icon={<Calendar className="w-5 h-5" />}
            color="text-blue-600"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <PerformanceCard
            title="Customer Satisfaction"
            value={`${data.performanceMetrics.customerSatisfaction}/5.0`}
            icon={<Users className="w-5 h-5" />}
            color="text-purple-600"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
          <PerformanceCard
            title="Revenue Growth"
            value={`+${data.performanceMetrics.revenueGrowth}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="text-emerald-600"
            bgColor="bg-emerald-50 dark:bg-emerald-900/20"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue Trend Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Revenue Trend
              </h3>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.monthlyEarnings}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Shipment Status Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Shipment Status
              </h3>
              <PieChart className="w-5 h-5 text-blue-500" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={data.shipmentStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percent }) => `${status} ${(percent ?? 0) * 100}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.shipmentStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Monthly Shipments vs Revenue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Shipments vs Revenue
              </h3>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthlyShipments}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis yAxisId="left" stroke="#6B7280" />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Bar yAxisId="left" dataKey="shipments" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Destinations Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Top Destinations
              </h3>
              <MapPin className="w-5 h-5 text-red-500" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topDestinations} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis type="number" stroke="#6B7280" />
                <YAxis dataKey="destination" type="category" stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Bar dataKey="shipments" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Recent Shipments Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-500" />
              Recent Shipments
            </h2>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tracking ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sender
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Receiver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.recentShipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No recent shipments found.
                    </td>
                  </tr>
                ) : (
                  data.recentShipments.map((shipment, index) => (
                    <motion.tr
                      key={shipment.trackingId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <td className="px-4 py-4 text-indigo-600 dark:text-indigo-400 font-medium">
                        {shipment.trackingId}
                      </td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white">{shipment.senderName}</td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white">{shipment.recipientName}</td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white">{shipment.destination}</td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white font-medium">
                        PKR {shipment.totalCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(shipment.createdAt).toLocaleDateString()}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, change, icon, bgColor, iconColor }: {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`${bgColor} ${iconColor} p-3 rounded-xl`}>{icon}</div>
      <div className={`flex items-center text-sm font-medium ${
        change >= 0 ? 'text-green-600' : 'text-red-600'
      }`}>
        {change >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
        {Math.abs(change)}%
      </div>
    </div>
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
    </div>
  </motion.div>
);

const PerformanceCard = ({ title, value, icon, color, bgColor }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`${bgColor} p-6 rounded-2xl border border-transparent hover:shadow-lg transition-all duration-300`}
  >
    <div className="flex items-center gap-3">
      <div className={`${color} p-2 rounded-lg bg-white dark:bg-slate-700`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
        <h3 className={`text-xl font-bold ${color}`}>{value}</h3>
      </div>
    </div>
  </motion.div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800";
      case "In Transit":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      case "Pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
};

export default DashboardPage;
