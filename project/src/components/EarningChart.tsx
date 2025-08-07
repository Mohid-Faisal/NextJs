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
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  const data = {
    labels,
    datasets: [
      {
        label: "Earnings",
        data: earningsData.map((item) => item.earnings),
        backgroundColor: isDark ? "#6366f1" : "#4f46e5",
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
        backgroundColor: isDark ? "#374151" : "#1f2937",
        titleColor: isDark ? "#f9fafb" : "#ffffff",
        bodyColor: isDark ? "#d1d5db" : "#e5e7eb",
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
          color: isDark ? "#9ca3af" : "#6b7280",
          font: { size: 12, weight: 500 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: isDark ? "#374151" : "#e5e7eb",
          borderDash: [4, 4],
        },
        ticks: {
          color: isDark ? "#9ca3af" : "#6b7280",
          font: { size: 12, weight: 500 },
        },
      },
    },
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow border border-border w-full h-auto mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          📊 Monthly Earnings
        </h2>
        <span className="text-sm text-muted-foreground">{new Date().getFullYear()}</span>
      </div>
      {earningsData.length === 0 ? (
        <p className="text-muted-foreground text-sm">No earnings data available.</p>
      ) : (
        <div className="w-full h-[300px]">
          <Bar data={data} options={options} />
        </div>
      )}
    </div>
  );
};

export default EarningChart;
