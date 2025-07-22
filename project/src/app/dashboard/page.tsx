"use client";

import { BarChart, Users, ShoppingCart, Truck } from "lucide-react";

const DashboardPage = () => {
  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-md border border-gray-200 transition">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Revenue</p>
              <h3 className="text-xl font-bold text-gray-800">PKR 1,230,000</h3>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-md border border-gray-200 transition">
          <div className="flex items-center gap-4">
            <div className="bg-teal-100 text-teal-600 p-3 rounded-full">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Users</p>
              <h3 className="text-xl font-bold text-gray-800">540</h3>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-md border border-gray-200 transition">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-full">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">New Orders</p>
              <h3 className="text-xl font-bold text-gray-800">320</h3>
            </div>
          </div>
        </div>

        {/* Shipments */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-md border border-gray-200 transition">
          <div className="flex items-center gap-4">
            <div className="bg-pink-100 text-pink-600 p-3 rounded-full">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Shipments</p>
              <h3 className="text-xl font-bold text-gray-800">191</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
