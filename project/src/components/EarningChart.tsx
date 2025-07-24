"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const EarningChart = ({
  earningsData,
}: {
  earningsData: { month: string; earnings: number }[];
}) => {
  const labels = earningsData.map((item) => item.month);

  const data = {
    labels,
    datasets: [
      {
        label: "Earnings",
        data: earningsData.map((item) => item.earnings),
        backgroundColor: "#4f46e5",
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300,
      easing: "easeOutQuart" as const,
    },
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#1f2937",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 8,
        cornerRadius: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#6b7280",
          font: { size: 12, weight: 500 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "#e5e7eb",
          borderDash: [4, 4],
        },
        ticks: {
          color: "#6b7280",
          font: { size: 12, weight: 500 },
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-gray-200 w-full h-auto mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          📊 Monthly Earnings
        </h2>
        <span className="text-sm text-gray-500">{new Date().getFullYear()}</span>
      </div>
      {earningsData.length === 0 ? (
        <p className="text-gray-500 text-sm">No earnings data available.</p>
      ) : (
        <div className="w-full h-[300px]">
          <Bar data={data} options={options} />
        </div>
      )}
    </div>
  );
};

export default EarningChart;
