import { prisma } from "@/lib/prisma";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 20,
    paddingHorizontal: 30,
    flexDirection: "column",
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  logo: { width: 80, height: 40, objectFit: "contain" },
  companyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  companySubTitle: { fontSize: 9, textAlign: "right" },

  // Client + Invoice Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  clientInfo: { fontSize: 10, lineHeight: 1.4 },
  invoiceInfo: { fontSize: 10, lineHeight: 1.4, textAlign: "right" },

  // Invoice title
  invoiceTitle: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    marginVertical: 10,
  },

  // Lines
  divider: { borderBottomWidth: 1, borderColor: "#999", marginVertical: 4 },

  // Table styles
  table: { borderWidth: 1, borderColor: "#ccc" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f3f3",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  tableHeaderText: {
    flex: 1,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tableCell: {
    flex: 1,
    padding: 4,
    textAlign: "center",
    fontSize: 9,
  },

  // Description table
  descRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  descCellLeft: { flex: 3, padding: 4, fontSize: 9 },
  descCellRight: { flex: 1, padding: 4, textAlign: "right", fontSize: 9 },

  // Note box
  noteBox: {
    backgroundColor: "#f3f3f3",
    padding: 6,
    fontSize: 8,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },

  // Summary
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontSize: 9,
  },
  summaryLabel: { width: 100, textAlign: "right", paddingRight: 6 },
  summaryValue: { width: 60, textAlign: "right" },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 2,
  },

  // Footer text
  disclaimer: {
    fontSize: 8,
    marginTop: 10,
    textAlign: "left",
  },

  // Blue contact bar
  blueBar: {
    backgroundColor: "#0072bc",
    color: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 6,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  contactItem: { flexDirection: "row", alignItems: "center" },
  contactIcon: { width: 10, height: 10, marginRight: 4 },
  contactText: { fontSize: 8, color: "#fff" },
});

const InvoicePDF = ({ shipment, assets }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {assets.logo ? <Image style={styles.logo} src={assets.logo} /> : <View />}
        <View>
          <Text style={styles.companyTitle}>PSS WWE | Dashboard</Text>
        </View>
      </View>

      {/* Client + Invoice Info */}
      <View style={styles.infoRow}>
        <View style={styles.clientInfo}>
          <Text>{shipment.senderName}</Text>
          <Text>Attn: {shipment.recipientName}</Text>
          <Text>{shipment.senderAddress}</Text>
          <Text>{shipment.destination}</Text>
        </View>
        <View style={styles.invoiceInfo}>
          <Text>Invoice: {shipment.id}</Text>
          <Text>Account Id: {shipment.vendor || "-"}</Text>
          <Text>
            Date: {new Date(shipment.createdAt).toLocaleDateString("en-GB")}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Payment Invoice Title */}
      <Text style={styles.invoiceTitle}>Payment Invoice</Text>

      <View style={styles.divider} />

      {/* Shipment Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          {["Date", "Receipt #", "Tracking #", "Reference #", "Dest", "D/W", "Wight"].map(
            (h, i) => (
              <Text key={i} style={styles.tableHeaderText}>{h}</Text>
            )
          )}
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>
            {new Date(shipment.createdAt).toLocaleDateString("en-GB")}
          </Text>
          <Text style={styles.tableCell}>{shipment.id}</Text>
          <Text style={styles.tableCell}>{shipment.trackingId}</Text>
          <Text style={styles.tableCell}>{shipment.awbNumber}</Text>
          <Text style={styles.tableCell}>{shipment.destination || "-"}</Text>
          <Text style={styles.tableCell}>{shipment.deliveryStatus || "-"}</Text>
          <Text style={styles.tableCell}>
            {(shipment.totalWeight ?? shipment.weight ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Description Table */}
      <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#ccc" }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: "left" }]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>
            Value
          </Text>
        </View>
        <View style={styles.descRow}>
          <Text style={styles.descCellLeft}>
            {shipment.packageDescription || "Fabric Hangers"}
          </Text>
          <Text style={styles.descCellRight}>
            {Number(shipment.totalCost || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Note */}
      <Text style={styles.noteBox}>
        ACCEPTED: PSS shall be liable for the declared value of any shipment ranging from
        $0.00 to $1000.0, subject to appraisal and internal assessment criteria. By using our
        services, the client grants the Agent permission to visually inspect the contents of
        the package.
      </Text>

      {/* Summary */}
      <View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fsc Charges</Text>
          <Text style={styles.summaryValue}>0.00</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount</Text>
          <Text style={styles.summaryValue}>0.00</Text>
        </View>
        <View style={styles.summaryTotal}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>
            {Number(shipment.totalCost || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        No cash, Cash equivalent, Gold jewelry or Dangerous goods accepted. Insurance is
        compulsory from shipper side, PSS is not responsible for any loss and damage goods.
      </Text>

      {/* Blue Footer Bar */}
      <View style={styles.blueBar}>
        <View style={styles.contactItem}>
          {assets.location ? <Image style={styles.contactIcon} src={assets.location} /> : null}
          <Text style={styles.contactText}>LG-44, Land Mark Plaza 56 Jail Road, Lahore</Text>
        </View>
        <View style={styles.contactItem}>
          {assets.phone ? <Image style={styles.contactIcon} src={assets.phone} /> : null}
          <Text style={styles.contactText}>+92 42 35716494 — +92 300 8482321</Text>
        </View>
        <View style={styles.contactItem}>
          {assets.email ? <Image style={styles.contactIcon} src={assets.email} /> : null}
          <Text style={styles.contactText}>info@psswwe.com — www.psswwe.com</Text>
        </View>
      </View>
    </Page>
  </Document>
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) return new Response("Shipment not found", { status: 404 });

    const isValidPng = (buf: Buffer) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;
    const isValidJpeg = (buf: Buffer) =>
      buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

    const toSafeDataUri = (files: string[]): string => {
      for (const fname of files) {
        const full = path.join(process.cwd(), "public", fname);
        if (fs.existsSync(full)) {
          const file = fs.readFileSync(full);
          const ext = path.extname(full).toLowerCase();
          const isPngFile = ext === ".png";
          const isJpgFile = ext === ".jpg" || ext === ".jpeg";
          if ((isPngFile && isValidPng(file)) || (isJpgFile && isValidJpeg(file))) {
            const mime = isJpgFile ? "image/jpeg" : "image/png";
            return `data:${mime};base64,${file.toString("base64")}`;
          }
        }
      }
      return "";
    };

    const assets = {
      logo: toSafeDataUri(["logo.png", "logo.jpg"]),
      location: toSafeDataUri(["location.png"]),
      phone: toSafeDataUri(["phone.png"]),
      email: toSafeDataUri(["email.png"]),
    };

    const blob = await pdf(<InvoicePDF shipment={shipment} assets={assets} />).toBlob();
    const unit8Body = new Uint8Array(await blob.arrayBuffer());
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${id}.pdf`,
    });
    return new Response(unit8Body, { status: 200, headers });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return new Response("Failed to generate invoice", { status: 500 });
  }
}
