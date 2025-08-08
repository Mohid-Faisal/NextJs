import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import React from "react";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = parseInt(params.id);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: "Invalid shipment ID" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const { Document, Page, Text, View, StyleSheet, pdf } = await import("@react-pdf/renderer");

    const styles = StyleSheet.create({
      page: { padding: 28, fontSize: 10 },
      header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
      titleWrap: {},
      title: { fontSize: 18, fontWeight: 700 },
      subtitle: { color: "#666" },
      awbBox: { borderWidth: 1, borderStyle: "solid", borderColor: "#333", padding: 6, borderRadius: 4 },
      awbText: { fontSize: 12, fontWeight: 700 },
      section: { marginTop: 10, borderWidth: 1, borderStyle: "solid", borderColor: "#ddd", borderRadius: 4 },
      sectionTitle: { backgroundColor: "#eee", padding: 6, fontWeight: 700 },
      sectionBody: { padding: 8 },
      twoCol: { flexDirection: "row", gap: 12 },
      col: { flex: 1 },
      row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
      label: { color: "#666" },
      value: { fontWeight: 600 },
      grid: { flexDirection: "row", flexWrap: "wrap" },
      cell: { width: "50%", paddingRight: 8, marginBottom: 6 },
      cellLabel: { color: "#666" },
      cellValue: { fontWeight: 600 },
      footer: { marginTop: 14, textAlign: "center", color: "#666" },
    });

    const formatMoney = (num?: number | null) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(num || 0));

    const MyDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>PSS</Text>
              <Text style={styles.subtitle}>Commercial Invoice</Text>
            </View>
            <View style={styles.awbBox}>
              <Text style={styles.awbText}>{shipment.awbNumber}</Text>
            </View>
          </View>

          {/* Shipper / Consignee */}
          <View style={[styles.section, styles.twoCol]}> 
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Shipper</Text>
              <View style={styles.sectionBody}>
                <Text>{shipment.senderName}</Text>
                <Text>{shipment.senderAddress}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Consignee</Text>
              <View style={styles.sectionBody}>
                <Text>{shipment.recipientName}</Text>
                <Text>{shipment.recipientAddress}</Text>
                <Text>{shipment.destination}</Text>
              </View>
            </View>
          </View>

          {/* Service & Contents */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            <View style={styles.sectionBody}>
              <View style={styles.grid}>
                <View style={styles.cell}><Text style={styles.cellLabel}>Service Type</Text><Text style={styles.cellValue}>{shipment.serviceMode || "N/A"}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Shipping Mode</Text><Text style={styles.cellValue}>{shipment.shippingMode || "N/A"}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Packaging</Text><Text style={styles.cellValue}>{shipment.packaging || "N/A"}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Delivery Time</Text><Text style={styles.cellValue}>{shipment.deliveryTime || "N/A"}</Text></View>
                <View style={[styles.cell, { width: "100%" }]}><Text style={styles.cellLabel}>Description of Contents</Text><Text style={styles.cellValue}>{shipment.packageDescription || "N/A"}</Text></View>
              </View>
            </View>
          </View>

          {/* Totals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipment Summary</Text>
            <View style={styles.sectionBody}>
              <View style={styles.grid}>
                <View style={styles.cell}><Text style={styles.cellLabel}>Pieces</Text><Text style={styles.cellValue}>{shipment.totalPackages ?? 1}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Weight (kg)</Text><Text style={styles.cellValue}>{shipment.totalWeight ?? shipment.weight ?? 0}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Declared Value</Text><Text style={styles.cellValue}>{formatMoney(shipment.declaredValue)}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Invoice Status</Text><Text style={styles.cellValue}>{shipment.invoiceStatus || "N/A"}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Subtotal</Text><Text style={styles.cellValue}>{formatMoney(shipment.subtotal)}</Text></View>
                <View style={styles.cell}><Text style={styles.cellLabel}>Total</Text><Text style={styles.cellValue}>{formatMoney(shipment.totalCost)}</Text></View>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>Generated on {new Date().toLocaleString()} • PSS</Text>
        </Page>
      </Document>
    );

    const blob = await pdf(MyDocument).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename=invoice_${shipment.awbNumber}.pdf`);

    return new Response(buffer, { status: 200, headers });
  } catch (error) {
    console.error("Invoice generation error:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}


