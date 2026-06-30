"use client";

import React from "react";

export type ExportCell = string | number | boolean | null | undefined;

const todayStamp = () => new Date().toISOString().split("T")[0];

const escapeCsvCell = (cell: ExportCell) =>
  `"${String(cell ?? "").replace(/"/g, '""')}"`;

const escapeHtml = (value: ExportCell) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function exportRowsToExcel(rows: ExportCell[][], headers: string[], filename: string) {
  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${todayStamp()}.csv`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToPrint(rows: ExportCell[][], headers: string[], title: string, total?: number | string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; }
          h1 { margin-bottom: 8px; }
          p { margin: 4px 0 14px; color: #555; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${total !== undefined ? `<p>Total: ${escapeHtml(total)}</p>` : ""}
        <p>Generated on: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}</p>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

export async function exportRowsToPDF(rows: ExportCell[][], headers: string[], title: string, total?: number | string) {
  const { Document, Page, Text, View, StyleSheet, pdf } = await import("@react-pdf/renderer");
  const columnWidth = `${100 / Math.max(headers.length, 1)}%`;

  const styles = StyleSheet.create({
    page: { backgroundColor: "#ffffff", padding: 28 },
    title: { fontSize: 20, marginBottom: 8, textAlign: "center", color: "#222222" },
    subtitle: { fontSize: 10, marginBottom: 5, color: "#555555" },
    table: { display: "flex", width: "auto", borderStyle: "solid", borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0, borderColor: "#bfbfbf", marginTop: 10 },
    row: { flexDirection: "row" },
    headerCell: { width: columnWidth, borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, borderColor: "#bfbfbf", backgroundColor: "#4285f4", padding: 4 },
    cell: { width: columnWidth, borderStyle: "solid", borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, borderColor: "#bfbfbf", padding: 4 },
    headerText: { fontSize: 7, color: "#ffffff", fontWeight: "bold" },
    cellText: { fontSize: 7, color: "#333333" },
  });

  const ReportDocument = () => (
    <Document>
      <Page size="A4" orientation={headers.length > 6 ? "landscape" : "portrait"} style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {total !== undefined && <Text style={styles.subtitle}>Total: {String(total)}</Text>}
        <Text style={styles.subtitle}>
          Generated on: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}
        </Text>
        <View style={styles.table}>
          <View style={styles.row}>
            {headers.map((header) => (
              <View key={header} style={styles.headerCell}>
                <Text style={styles.headerText}>{header}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((cell, cellIndex) => (
                <View key={`${rowIndex}-${cellIndex}`} style={styles.cell}>
                  <Text style={styles.cellText}>{String(cell ?? "")}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(<ReportDocument />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_${todayStamp()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
