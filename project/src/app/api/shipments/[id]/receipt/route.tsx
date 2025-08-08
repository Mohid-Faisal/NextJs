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
      page: { padding: 28, fontSize: 11 },
      header: { textAlign: "center", marginBottom: 12 },
      company: { fontSize: 18, fontWeight: 700 },
      awb: { textAlign: "center", fontSize: 20, fontWeight: 700, marginVertical: 10 },
      section: { marginTop: 10, padding: 8, borderWidth: 1, borderStyle: "solid", borderColor: "#ddd", borderRadius: 4 },
      row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
      label: { color: "#666" },
      value: { fontWeight: 600 },
      title: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
      center: { textAlign: "center" },
    });

    const formatMoney = (num?: number | null) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(num || 0));

    const MyDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.company}>PSS</Text>
            <Text>Shipment Receipt</Text>
          </View>

          <View style={styles.awb}>
            <Text>{shipment.awbNumber}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>Summary</Text>
            <View style={styles.row}><Text style={styles.label}>Tracking ID</Text><Text style={styles.value}>{shipment.trackingId}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Created</Text><Text style={styles.value}>{new Date(shipment.createdAt).toLocaleString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Delivery Status</Text><Text style={styles.value}>{shipment.deliveryStatus || "N/A"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Invoice Status</Text><Text style={styles.value}>{shipment.invoiceStatus || "N/A"}</Text></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>Sender</Text>
            <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{shipment.senderName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}>{shipment.senderAddress}</Text></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>Recipient</Text>
            <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{shipment.recipientName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Address</Text><Text style={styles.value}>{shipment.recipientAddress}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Destination</Text><Text style={styles.value}>{shipment.destination}</Text></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.title}>Charges</Text>
            <View style={styles.row}><Text style={styles.label}>Price / kg</Text><Text style={styles.value}>{formatMoney(shipment.price)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Fuel Surcharge</Text><Text style={styles.value}>{formatMoney(shipment.fuelSurcharge)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Discount %</Text><Text style={styles.value}>{shipment.discount ?? 0}%</Text></View>
            <View style={styles.row}><Text style={styles.label}>Subtotal</Text><Text style={styles.value}>{formatMoney(shipment.subtotal)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Total</Text><Text style={styles.value}>{formatMoney(shipment.totalCost)}</Text></View>
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={styles.center}>Thank you for shipping with PSS</Text>
          </View>
        </Page>
      </Document>
    );

    const blob = await pdf(MyDocument).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename=receipt_${shipment.awbNumber}.pdf`);

    return new Response(buffer, { status: 200, headers });
  } catch (error) {
    console.error("Receipt generation error:", error);
    return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 });
  }
}


