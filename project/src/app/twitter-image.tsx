import { ImageResponse } from "next/og";

export const alt =
  "Proxima Smart Solutions (PSS) — All-In-One Courier & Cargo Management SaaS";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const PILLS = [
  "Real-Time Tracking",
  "Multi-Branch",
  "Rate Calculator",
  "Full Accounting",
];

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(135deg, #090d1f 0%, #0f172a 45%, #1e3a8a 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 20px",
              borderRadius: "9999px",
              background: "rgba(59, 130, 246, 0.18)",
              border: "1px solid rgba(96, 165, 250, 0.4)",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#93c5fd",
            }}
          >
            <span>PROXIMA SMART SOLUTIONS · PSS</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: "#cbd5e1",
              fontWeight: 600,
            }}
          >
            <span>psswwe.com</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "58px",
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              color: "#ffffff",
            }}
          >
            <span>All-In-One Courier &amp; Cargo</span>
            <span style={{ color: "#60a5fa" }}>Management SaaS</span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "26px",
              lineHeight: 1.45,
              color: "#cbd5e1",
              maxWidth: "900px",
            }}
          >
            <span>
              Real-time tracking, multi-branch operations, automated billing
              &amp; double-entry accounting.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          {PILLS.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                fontSize: "20px",
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
