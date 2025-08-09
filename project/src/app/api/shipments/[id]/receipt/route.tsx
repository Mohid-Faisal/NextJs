// /app/api/receipt/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import bwipjs from "bwip-js";

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

    // Generate barcode PNG from AWB number
    const barcodePng = await new Promise<Buffer>((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: "code128", // Barcode type
          text: shipment.awbNumber || "000000000000", // Text to encode
          scale: 3,
          height: 10,
          includetext: false,
        },
        (err: Error | null, png: Buffer) => {
          if (err) reject(err);
          else resolve(png);
        }
      );
    });
    const barcodeBase64 = `data:image/png;base64,${barcodePng.toString("base64")}`;

    const styles = StyleSheet.create({
      page: {
        fontSize: 8,
        padding: 10,
        fontFamily: "Helvetica",
      },
      headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      logo: { width: 100, height: 25 },
      svp: {
        fontSize: 24,
        fontWeight: "bold",
        backgroundColor: "#000",
        color: "#fff",
        paddingHorizontal: 6,
        paddingVertical: 2,
      },
      sectionRow: {
        flexDirection: "row",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#000",
      },
      sectionNumber: {
        backgroundColor: "#d32f2f",
        color: "#fff",
        fontWeight: "bold",
        width: 15,
        textAlign: "center",
        paddingVertical: 2,
      },
      sectionContent: { flex: 1, padding: 4 },
      bold: { fontWeight: "bold" },
      barcode: { width: 180, height: 40, alignSelf: "center", marginTop: 4 },
      tableRow: {
        flexDirection: "row",
        justifyContent: "space-between",
      },
    });

    // Map schema fields to layout requirements (fallbacks used for missing fields)
    const accountName = shipment.agency || shipment.vendor || "PSS";
    const senderCity = ""; // not in schema
    const senderState = ""; // not in schema
    const senderZip = ""; // not in schema
    const senderCountry = ""; // not in schema
    const senderPhone = ""; // not in schema
    const senderId = ""; // not in schema

    const recipientCity = ""; // not in schema
    const recipientState = ""; // not in schema
    const recipientZip = ""; // not in schema
    const recipientCountry = shipment.destination || ""; // destination represents country
    const recipientPhone = ""; // not in schema

    const serviceType = shipment.serviceMode || shipment.shippingMode || "N/A";
    const description = shipment.packageDescription || "N/A";
    const specialInstructions = shipment.packaging || "N/A";
    const pieces = shipment.totalPackages || shipment.amount || 1;
    const weightKg = (shipment.totalWeight || shipment.weight || 0).toFixed(2);
    const currency = "USD";

    const MyDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Image style={styles.logo} src="/skynet-logo.png" />
            <Text style={styles.svp}>SVP</Text>
          </View>

          {/* Shipper */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>1</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.bold}>ACCOUNT NAME</Text>
              <Text>{accountName}</Text>
              <Text>{shipment.senderName}</Text>
              <Text>{shipment.senderAddress}</Text>
              <Text>{senderCity}{senderCity && ", "}{senderState}{senderState && ", "}{senderZip}</Text>
              <Text>{senderCountry}</Text>
              <Text>{senderPhone}</Text>
              <Text>{senderId}</Text>
            </View>
          </View>

          {/* Consignee */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>2</Text>
            <View style={styles.sectionContent}>
              <Text>{shipment.recipientName}</Text>
              <Text>{shipment.recipientAddress}</Text>
              <Text>{recipientCity}{recipientCity && ", "}{recipientState}{recipientState && ", "}{recipientZip}</Text>
              <Text>{recipientCountry}</Text>
              <Text>Attn.: {shipment.recipientName}</Text>
              <Text>{recipientPhone}</Text>
            </View>
          </View>

          {/* Sender Authorization */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>3</Text>
            <View style={styles.sectionContent}>
              <Text>SENDER'S AUTHORIZATION & SIGNATURE</Text>
              <Text>
                I/We agree that the carriers standard terms and conditions apply...
              </Text>
              <Text>Sender's Signature ____________________</Text>
              <Text>Date: {new Date().toLocaleString()}</Text>
            </View>
          </View>

          {/* Proof of Delivery */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>4</Text>
            <View style={styles.sectionContent}>
              <Text>PROOF OF DELIVERY (POD)</Text>
              <Text>Receiver's Signature: ____________________</Text>
              <Text>Date: __________ AM/PM</Text>
              <Text>Print Name: ____________________</Text>
            </View>
          </View>

          {/* Service Type */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>5</Text>
            <View style={styles.sectionContent}>
              <Text>SERVICE TYPE: {serviceType}</Text>
              <Text>Full Description: {description}</Text>
              <Text>Special Instructions: {specialInstructions}</Text>
            </View>
          </View>

          {/* Size & Weight */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionNumber}>6</Text>
            <View style={styles.sectionContent}>
              <View style={styles.tableRow}>
                <Text>No. of Pieces: {pieces}</Text>
                <Text>Weight: {weightKg} KGS</Text>
              </View>
            </View>
          </View>

          {/* DAP + Barcode */}
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <Text style={{ fontWeight: "bold" }}>** DAP **</Text>
            <Text>
              Declared Value for Customs: {shipment.declaredValue} {currency}
            </Text>
            <Image style={styles.barcode} src={barcodeBase64} />
            <Text>*{shipment.awbNumber}*</Text>
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
