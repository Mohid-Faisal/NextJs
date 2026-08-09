'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCountryNameFromCode, getStateNameFromCode } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Package {
  id?: string;
  amount?: number;
  packageDescription?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  weightVol?: number;
  fixedCharge?: number;
  decValue?: number;
  vendorWeight?: number;
  remarks?: string;
}

interface Shipment {
  id: string;
  trackingId?: string;
  senderName?: string;
  senderAddress?: string;
  recipientName?: string;
  recipientAddress?: string;
  destination?: string;
  serviceMode?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  amount?: number;
  packaging?: string;
  office?: string;
  agency?: string;
  referenceNumber?: string;
  weightVol?: number;
  decValue?: number;
  packages?: string | Package[];
  totalWeight?: number;
  totalWeightVol?: number;
  totalPackages?: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate?: string;
  totalAmount?: number;
  currency?: string;
  weight?: number;
  fscCharges?: number;
  discount?: number;
  lineItems?: any[];
  status?: string;
  shipment?: Shipment;
  customer?: {
    id?: string;
    CompanyName?: string;
    PersonName?: string;
    Address?: string;
    City?: string;
    State?: string;
    Country?: string;
    Zip?: string;
    Phone?: string;
    DocumentNumber?: string;
  };
  recipient?: {
    CompanyName?: string;
    PersonName?: string;
    Address?: string;
    City?: string;
    State?: string;
    Country?: string;
    Zip?: string;
    Phone?: string;
  } | null;
}

export default function ReceiptPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<any>(null);
  const [supportAddress, setSupportAddress] = useState("LG-44, Land Mark Plaza, 5-6 Jail Road, Lahore");
  const [supportPhone, setSupportPhone] = useState("+92 (21) 111-222-333");
  const [supportEmail, setSupportEmail] = useState("info@psswwe.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const address = localStorage.getItem("brand_support_address") || "LG-44, Land Mark Plaza, 5-6 Jail Road, Lahore";
      const phone = localStorage.getItem("brand_support_phone") || "+92 (21) 111-222-333";
      const email = localStorage.getItem("brand_support_email") || "info@psswwe.com";
      setSupportAddress(address);
      setSupportPhone(phone);
      setSupportEmail(email);
    }
  }, []);

  useEffect(() => {
    fetch("/api/org/current")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOrg(data.organization);
        }
      })
      .catch((err) => console.error("Error fetching org settings:", err));
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Missing invoice id');
      setLoading(false);
      return;
    }
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/accounts/invoices/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch invoice');
        }
        const data = await response.json();
        setInvoice(data.invoice);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const handlePrint = (copy: 'sender' | 'vendor' = 'sender') => {
    if (!invoice) {
      alert('Invoice data not available');
      return;
    }

    if (org?.slug === "pss-demo") {
      toast.warning("Receipts carry a Demo Watermark in Demo Mode. Start a 14-Day Free Trial for unwatermarked commercial receipts!");
    }

    // Get the waybill container HTML
    const waybillContainer = document.querySelector('.waybill-container');
    if (!waybillContainer) {
      alert('Waybill content not found');
      return;
    }

    // Clone the DOM so we can adjust the printed copy without
    // affecting what is shown on screen.
    const clone = waybillContainer.cloneNode(true) as HTMLElement;

    if (copy === 'vendor') {
      // Hide the sender phone number for the vendor copy.
      const phoneEl = clone.querySelector('[data-sender-phone]');
      if (phoneEl) phoneEl.remove();
      const footerStrip =
        clone.querySelector('[data-copy-label]') ||
        clone.querySelector('.footer-strip');
      if (footerStrip) footerStrip.textContent = 'VENDOR COPY';
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the waybill');
      return;
    }

    // Get the waybill HTML content
    const waybillHTML = clone.innerHTML;

    // Create a complete HTML document for printing
    const printHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Waybill ${invoice.invoiceNumber}</title>
          <style>
            :root {
              --primary-blue: #2563eb;
              --border-color: #000;
              --bg-grey: #d1d5db;
              --text-black: #000;
            }

            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @page {
              size: A4 portrait;
              margin: 6mm;
            }

            html, body {
              font-family: Arial, Helvetica, sans-serif;
              background-color: #fff;
              padding: 0;
              margin: 0;
              font-size: 9.5px;
              height: auto;
              min-height: 0;
              line-height: 1.3;
            }

            .waybill-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              background: white;
              padding: 0;
              border: none;
              transform: none;
            }

            .header-area {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              padding-bottom: 5px;
            }

            .logo {
              font-style: italic;
              font-weight: 900;
              font-size: 28px;
              color: var(--primary-blue);
              line-height: 0.8;
            }
            .logo span {
              display: block;
              font-size: 12px;
              font-weight: 700;
              margin-top: 2px;
            }

            .logo img {
              height: 50px;
              width: auto;
            }


            .main-grid {
              display: grid;
              grid-template-columns: 34% 33% 33%;
              border: 2px solid black;
              transform: scale(1.1);
              transform-origin: top left;
              width: 90.909%; /* 100% / 1.1 so scaled width fits the page */
              /* Fixed px — % margin is based on width and left a huge gap under the grid */
              margin-bottom: 22px;
            }

            .border-right { border-right: 1px solid black; }
            .border-bottom { border-bottom: 1px solid black; }
            .bg-grey { background-color: var(--bg-grey); }
            .bg-red { background-color: var(--primary-blue); color: black; }
            .bold { font-weight: 700; }
            .text-center { text-align: center; }
            .full-height { height: 100%; }
            .flex { display: flex; }
            .flex-col { display: flex; flex-direction: column; }

            .sec-num {
              display: inline-block;
              background: var(--primary-blue);
              color: black;
              width: 16px;
              height: 16px;
              text-align: center;
              line-height: 16px;
              font-weight: bold;
              font-size: 11px;
              margin-right: 4px;
            }

            .section-header {
              background: #000;
              color: #fff;
              padding: 2px 5px;
              font-weight: bold;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 1px solid black;
              margin: 0;
              width: 100%;
              box-sizing: border-box;
              text-align: center;
            }

            .cell-content {
              padding: 5px;
            }

            .col-1 {
              border-right: 1px solid black;
            }

            .shipper-container {
              display: flex;
              flex-direction: column;
              min-height: 165px;
              height: auto;
            }
            .address-details {
              padding: 6px;
              flex: 1;
              font-size: 10.5px;
              line-height: 1.25;
              overflow: visible;
            }

            .auth-section {
              height: 100px;
              padding: 0;
              position: relative;
              font-size: 8.5px;
            }
            .auth-section .section-header {
              margin: 0;
              padding: 2px 5px;
              width: 100%;
              box-sizing: border-box;
            }
            .auth-section > *:not(.section-header) {
              padding: 4px;
            }
            .terms-text {
              font-size: 8px;
              text-align: justify;
              margin-bottom: 4px;
              line-height: 1.35;
            }
            .signature-line {
              border-top: 1px solid black;
              width: 100%;
              margin-top: 1px;
              padding-top: 5px;
            }
            .timestamp {
              margin-top: 5px;
              text-align: right;
              font-size: 9px;
            }

            .pod-section {
              height: 100px;
              padding: 5px;
            }

            .col-2 {
              border-right: 1px solid black;
            }
            .col-2-bottom-box {
              min-height: 0;
              display: flex;
              flex-direction: column;
            }
            .lhe-header {
              display: flex;
              border-bottom: 1px solid black;
            }
            .lhe-box {
              width: 40%;
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              padding: 5px;
              border-right: 1px solid black;
            }
            .tracking-box {
              width: 60%;
              font-size: 16px;
              font-weight: bold;
              text-align: right;
              padding: 5px 10px;
            }
            .dap-section {
              display: flex;
              border-bottom: 1px solid black;
              min-height: 45px;
              height: auto;
            }
            .dap-box {
              width: 50%;
              font-size: 20px;
              font-weight: bold;
              display: flex;
              align-items: center;
              justify-content: center;
              border-right: 1px solid black;
            }
            .currency-box {
              width: 50%;
              padding: 3px 5px;
              font-size: 9px;
              line-height: 1.5;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
              box-sizing: border-box;
            }
            .barcode-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 10px;
            }
            .barcode {
              background: repeating-linear-gradient(
                to right,
                #000 0,
                #000 2px,
                #fff 2px,
                #fff 4px,
                #000 4px,
                #000 7px,
                #fff 7px,
                #fff 9px
              );
            }

            .col-3 {
              display: flex;
              flex-direction: column;
            }
            .col-3 .section-header {
              margin-right: -2px;
              width: calc(100% + 2px);
              box-sizing: border-box;
            }
            .ref-box {
              height: 25px;
              border-bottom: 1px solid black;
              display: flex;
              align-items: center;
              padding: 0 5px;
            }
            .service-section {
              flex: 0 0 auto;
              padding: 5px 5px 0 5px;
              border-bottom: 1px solid black;
              margin-bottom: 0;
            }
            .service-section .section-header {
              margin: -5px -5px 0 -5px;
              margin-right: -2px;
              padding: 2px 5px 0 5px;
              width: calc(100% + 10px);
            }
            .service-section > *:not(.section-header) {
              padding: 0 5px 0 5px;
            }
            .size-section {
              padding: 0;
              margin-top: 0px;
            }
            .dims-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 5px;
            }
            .dims-table td {
              padding: 2px;
            }

            .footer-strip {
              margin-top: 2px;
              margin-bottom: 0;
              font-size: 11px;
              font-weight: bold;
            }

            .terms-conditions-wrapper {
              margin-top: 2px !important;
              padding-top: 2px !important;
            }

            .terms-title {
              font-size: 8px !important;
              margin-bottom: 1px !important;
            }

            .terms-body {
              font-size: 5.6px !important;
              line-height: 1.12 !important;
            }

            .terms-body .terms-notice {
              margin-bottom: 2px !important;
            }

            .terms-body .terms-columns {
              column-gap: 10px !important;
            }

            .terms-body .terms-section {
              margin-bottom: 1.5px !important;
            }

            .support-info-footer {
              margin-top: 3px !important;
              padding-top: 2px !important;
              font-size: 6.5px !important;
            }

            /* Utility classes shared with on-screen layout (margins/paddings) */
            .packaging-label {
              padding: 5px 15px;
            }
            .section-header-shipper-adjust {
              margin-right: -2px;
            }
            .address-block {
              line-height: 1.5;
              margin-bottom: 8px;
            }
            .declared-label {
              margin-bottom: 1px;
              white-space: nowrap;
            }
            .declared-value {
              margin-top: 2px;
            }
            .barcode-bottom-padding {
              padding: 10px 0 6px 0;
            }
            .barcode-number {
              margin-top: 4px;
            }
            .separator-small-margin {
              margin: 4px 0;
            }
            .urdu-block {
              padding: 0 5px;
            }
            .service-type-line {
              line-height: 1.5;
              margin: 5px 0;
              padding-bottom: 5px;
            }
            .description-row {
              padding: 5px;
            }
            .instructions-row {
              padding: 5px;
            }
            .size-section-inner {
              padding: 5px 5px 0 5px;
            }
            .size-row-primary {
              padding-bottom: 8px;
              margin-top: 2px;
            }
            .size-row-secondary {
              padding-bottom: 8px;
              margin-top: 7px;
            }
            .dimensions-label {
              margin-top: 5px;
            }
            .dimensions-value {
              margin: 5px 0 5px 0;
            }
            .charged-weight-block {
              border-top: 1px solid black;
              padding-top: 8px;
              margin-top: 6px;
            }
            .charged-weight-label {
              margin-bottom: 3px;
            }

            @media print {
              html, body { padding: 0; margin: 0; background: white; height: auto; min-height: 0; }
              .waybill-container { border: none; padding: 0; margin: 0; width: 100%; max-width: 100%; }
              .pod-section { height: 0; min-height: 0; padding: 0; overflow: hidden; }
              .main-grid { margin-bottom: 18px; }
              .terms-body { font-size: 5.4px !important; line-height: 1.1 !important; }
              @page {
                size: A4;
                margin: 6mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="waybill-container">
            ${waybillHTML}
            </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    // Write the content to the print window
    printWindow.document.write(printHTML);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading waybill...</p>
                </div>
                    </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Invoice not found'}</p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
                  </div>
                </div>
    );
  }

  const shipment = invoice.shipment;
  const trackingNumber = shipment?.trackingId || invoice.invoiceNumber;
  const shipmentId = invoice.invoiceNumber;
  
  console.log('=== D/W FIELD DEBUG ===');
  console.log('Invoice object:', invoice);
  console.log('D/W field (dayWeek):', (invoice as any).dayWeek);
  console.log('Invoice keys:', invoice ? Object.keys(invoice) : 'No invoice');
  console.log('=== END D/W FIELD DEBUG ===');
  
  // Format sender address
  const senderName = invoice.customer?.PersonName || 'N/A';
  const sendercompanyname = invoice.customer?.CompanyName || 'N/A';
  // Always use the customer's saved address as the source of truth so the
  // waybill stays in sync with the customer record (and isn't broken by a
  // bad shipment-time snapshot like a stray "a").
  const senderAddress = (invoice.customer?.Address || '').trim();
  const senderCity = invoice.customer?.City || '';
  const senderState = invoice.customer?.Country && invoice.customer?.State
    ? getStateNameFromCode(String(invoice.customer.State), invoice.customer.Country)
    : (invoice.customer?.State || '');
  const senderCountry = invoice.customer?.Country ? getCountryNameFromCode(invoice.customer.Country) : '';
  const senderZip = invoice.customer?.Zip || '';
  const senderPhone = invoice.customer?.Phone || '';
  const senderDocumentNumber = invoice.customer?.DocumentNumber || '';
  
  // Format recipient (from invoice.recipient when available, else shipment)
  const r = invoice.recipient;
  const recipientName = r?.PersonName || shipment?.recipientName || 'N/A';
  const recipientcompanyname = r?.CompanyName || 'N/A';
  const recipientAddress = r?.Address ?? shipment?.recipientAddress ?? '';
  const recipientCity = r?.City ?? '';
  const recipientState = r?.Country && r?.State
    ? getStateNameFromCode(String(r.State), r.Country)
    : (r?.State ?? '');
  const recipientZip = r?.Zip ?? '';
  const recipientPhone = r?.Phone ?? '';
  const recipientCountry = r?.Country ? getCountryNameFromCode(r.Country) : (shipment?.destination ? getCountryNameFromCode(shipment.destination) : '');
  
  // Format invoice date
  const invoiceDate = invoice.invoiceDate 
    ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')
    : format(new Date(), 'MMM dd, yyyy');
  
  // Get status
  const status = invoice.status || 'Unpaid';
  
  // Parse packages from shipment
  let parsedPackages: Package[] = [];
  if (shipment?.packages) {
    try {
      parsedPackages = typeof shipment.packages === 'string' 
        ? JSON.parse(shipment.packages) 
        : shipment.packages;
      if (!Array.isArray(parsedPackages)) {
        parsedPackages = [];
      }
    } catch (e) {
      console.error('Error parsing packages:', e);
      parsedPackages = [];
    }
  }

  // Calculate totals from packages if available
  let totalPieces = 0;
  let totalWeight = 0;
  let totalWeightVol = 0;
  let totalDecValue = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;
  const packageDescriptions: string[] = [];

  if (parsedPackages.length > 0) {
    parsedPackages.forEach((pkg: Package) => {
      // Sum pieces
      totalPieces += pkg.amount || 1;
      
      // Sum actual weights (not max - we'll calculate charged weight separately)
      totalWeight += pkg.weight || 0;
      totalWeightVol += pkg.weightVol || 0;
      
      // Sum declared values
      totalDecValue += pkg.decValue || 0;
      
      // Track max dimensions - use package dimensions if available
      // Handle both number and string types
      const pkgLength = typeof pkg.length === 'number' ? pkg.length : (typeof pkg.length === 'string' ? parseFloat(pkg.length) : 0);
      const pkgWidth = typeof pkg.width === 'number' ? pkg.width : (typeof pkg.width === 'string' ? parseFloat(pkg.width) : 0);
      const pkgHeight = typeof pkg.height === 'number' ? pkg.height : (typeof pkg.height === 'string' ? parseFloat(pkg.height) : 0);
      
      if (pkgLength > 0 && pkgLength > maxLength) maxLength = pkgLength;
      if (pkgWidth > 0 && pkgWidth > maxWidth) maxWidth = pkgWidth;
      if (pkgHeight > 0 && pkgHeight > maxHeight) maxHeight = pkgHeight;
      
      // Collect package descriptions
      if (pkg.packageDescription) {
        packageDescriptions.push(pkg.packageDescription);
      }
    });
    
    // If no dimensions found in packages, try shipment-level data
    if (maxLength === 0 && maxWidth === 0 && maxHeight === 0) {
      const shipLength = shipment?.length ? (typeof shipment.length === 'number' ? shipment.length : parseFloat(String(shipment.length))) : 0;
      const shipWidth = shipment?.width ? (typeof shipment.width === 'number' ? shipment.width : parseFloat(String(shipment.width))) : 0;
      const shipHeight = shipment?.height ? (typeof shipment.height === 'number' ? shipment.height : parseFloat(String(shipment.height))) : 0;
      
      if (shipLength > 0) maxLength = shipLength;
      if (shipWidth > 0) maxWidth = shipWidth;
      if (shipHeight > 0) maxHeight = shipHeight;
    }
  } else {
    // Fallback to shipment-level data
    totalPieces = shipment?.totalPackages || shipment?.amount || 1;
    totalWeight = shipment?.totalWeight || shipment?.weight || invoice.weight || 0;
    totalWeightVol = shipment?.totalWeightVol || shipment?.weightVol || 0;
    totalDecValue = shipment?.decValue || 0;
    const shipLength = shipment?.length ? (typeof shipment.length === 'number' ? shipment.length : parseFloat(String(shipment.length))) : 0;
    const shipWidth = shipment?.width ? (typeof shipment.width === 'number' ? shipment.width : parseFloat(String(shipment.width))) : 0;
    const shipHeight = shipment?.height ? (typeof shipment.height === 'number' ? shipment.height : parseFloat(String(shipment.height))) : 0;
    
    maxLength = shipLength;
    maxWidth = shipWidth;
    maxHeight = shipHeight;
  }

  // Calculate charged weight (max of total weight and total volumetric weight)
  // This is the weight used for billing purposes
  const chargedWeight = Math.max(totalWeight, totalWeightVol);

  // Format dimensions - use calculated max dimensions
  // Ensure we have valid numbers
  const finalLength = maxLength > 0 ? maxLength : 0;
  const finalWidth = maxWidth > 0 ? maxWidth : 0;
  const finalHeight = maxHeight > 0 ? maxHeight : 0;
  
  // Format dimensions - show actual values if available, otherwise show 0.00
  const dimensions = (finalLength > 0 || finalWidth > 0 || finalHeight > 0)
    ? `${finalLength.toFixed(2)} x ${finalWidth.toFixed(2)} x ${finalHeight.toFixed(2)}`
    : '0.00 x 0.00 x 0.00';

  // Get line items
  const lineItems = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [
        {
          description: 'Shipping Service',
          value: invoice.totalAmount || 0
        }
      ];
  
  // Get service type
  const serviceType = shipment?.serviceMode || shipment?.packaging || 'Standard';
  
  // Get packaging type for DOC/WPX label
  const packagingType = shipment?.packaging?.toLowerCase() || '';
  const packagingLabel = packagingType.includes('document') || packagingType === 'doc' ? 'DOC' : 
                         packagingType.includes('wpx') || packagingType === 'wpx' ? 'WPX' : '';
  
  // Get office (default to LHE)
  const office = shipment?.office || 'LHE';
  
  // Get reference number
  const referenceNumber = shipment?.referenceNumber || '';
  
  // Get account name (from customer)
  const accountName = invoice.customer?.CompanyName || invoice.customer?.PersonName || senderName;
  const accountId = invoice.customer?.id || '';
  
  // Get contents description from package descriptions or line items
  const contentsDescription = packageDescriptions.length > 0
    ? packageDescriptions.join(', ')
    : (lineItems
        .map((item: any) => item.description || item.name || '')
        .filter(Boolean)
        .join(', ') || 'Shipping Service');
  
  // Get declared value (from packages decValue or shipment decValue or total amount)
  const declaredValue = totalDecValue > 0 
    ? totalDecValue 
    : (shipment?.decValue || 0);
  
  // Format date for timestamp
  const timestampDate = invoice.invoiceDate 
    ? format(new Date(invoice.invoiceDate), 'dd MMM yy HH:mm:ss')
    : format(new Date(), 'dd MMM yy HH:mm:ss');

  const orgName = org?.name || "PSS Worldwide Express";

  return (
    <div className="w-full p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <style jsx>{`
        .waybill-wrapper {
          --primary-blue: #2563eb;
          --border-color: #000;
          --bg-grey: #d1d5db;
          --text-black: #000;
        }

        .waybill-wrapper * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .waybill-wrapper .waybill-container {
          max-width: 855px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border: 1px solid #ccc;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
        }

        .waybill-wrapper .header-area {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 5px;
        }

        .waybill-wrapper .logo {
          font-style: italic;
          font-weight: 900;
          font-size: 28px;
          color: var(--primary-blue);
          line-height: 0.8;
        }

        .waybill-wrapper .logo span {
          display: block;
          font-size: 12px;
          font-weight: 700;
          margin-top: 2px;
        }

        .waybill-wrapper .logo img {
          height: 50px;
          width: auto;
        }

        .waybill-wrapper .main-grid {
          display: grid;
          grid-template-columns: 34% 33% 33%;
          border: 2px solid black;
          transform: scale(1.1);
          transform-origin: top left;
          width: 90.909%; /* 100% / 1.1 so scaled width fits */
          margin-bottom: 22px;
        }

        .waybill-wrapper .border-right { border-right: 1px solid black; }
        .waybill-wrapper .border-bottom { border-bottom: 1px solid black; }
        .waybill-wrapper .bg-grey { background-color: var(--bg-grey); }
        .waybill-wrapper .bg-red { background-color: var(--primary-blue); color: black; }
        .waybill-wrapper .bold { font-weight: 700; }
        .waybill-wrapper .text-center { text-align: center; }
        .waybill-wrapper .flex { display: flex; }
        .waybill-wrapper .flex-col { display: flex; flex-direction: column; }

        .waybill-wrapper .sec-num {
          display: inline-block;
          background: var(--primary-blue);
          color: black;
          width: 16px;
          height: 16px;
          text-align: center;
          line-height: 16px;
          font-weight: bold;
          font-size: 11px;
          margin-right: 4px;
        }

        .waybill-wrapper .section-header {
          background: #000;
          color: #fff;
          padding: 2px 5px;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          border-bottom: 1px solid black;
          text-align: center;
        }

        .waybill-wrapper .cell-content {
          padding: 5px;
        }

        .waybill-wrapper .col-1 {
          border-right: 1px solid black;
        }

        .waybill-wrapper .shipper-container {
          display: flex;
          flex-direction: column;
          min-height: 165px;
          height: auto;
        }

        .waybill-wrapper .address-details {
          padding: 6px;
          flex: 1;
          font-size: 10.5px;
          line-height: 1.25;
          overflow: visible;
        }

        .waybill-wrapper .auth-section {
          height: 100px;
          padding: 0;
          position: relative;
          font-size: 8.5px;
        }
        .waybill-wrapper .auth-section .section-header {
          margin: 0;
          padding: 2px 5px;
          width: 100%;
        }
        .waybill-wrapper .auth-section > *:not(.section-header) {
          padding: 4px;
        }

        .waybill-wrapper .terms-text {
          font-size: 8px;
          margin-bottom: 3px;
          text-align: justify;
          line-height: 1.35;
        }

        .waybill-wrapper .signature-line {
          border-top: 1px solid black;
          width: 100%;
          margin-top: 15px;
          padding-top: 5px;
        }

        .waybill-wrapper .timestamp {
          margin-top: 5px;
          text-align: right;
          font-size: 9px;
        }

        .waybill-wrapper .pod-section {
          height: 100px;
          padding: 5px;
        }

        .waybill-wrapper .col-2 {
          border-right: 1px solid black;
        }
        .waybill-wrapper .col-2-bottom-box {
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .waybill-wrapper .lhe-header {
          display: flex;
          border-bottom: 1px solid black;
        }

        .waybill-wrapper .lhe-box {
          width: 40%;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          padding: 5px;
          border-right: 1px solid black;
        }

        .waybill-wrapper .tracking-box {
          width: 60%;
          font-size: 16px;
          font-weight: bold;
          text-align: right;
          padding: 5px 10px;
        }

        .waybill-wrapper .dap-section {
          display: flex;
          border-bottom: 1px solid black;
          min-height: 45px;
          height: auto;
        }

        .waybill-wrapper .dap-box {
          width: 50%;
          font-size: 20px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid black;
        }

        .waybill-wrapper .currency-box {
          width: 50%;
          padding: 3px 5px;
          font-size: 9px;
          line-height: 1.3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          box-sizing: border-box;
        }

        .waybill-wrapper .barcode-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px;
        }

        .waybill-wrapper .barcode {
          background: repeating-linear-gradient(
            to right,
            #000 0,
            #000 2px,
            #fff 2px,
            #fff 4px,
            #000 4px,
            #000 7px,
            #fff 7px,
            #fff 9px
          );
        }

        .waybill-wrapper .col-3 {
          display: flex;
          flex-direction: column;
        }
        .waybill-wrapper .col-3 .section-header {
          margin-right: -2px;
          width: calc(100% + 2px);
          box-sizing: border-box;
        }

        .waybill-wrapper .ref-box {
          height: 25px;
          border-bottom: 1px solid black;
          display: flex;
          align-items: center;
          padding: 0 5px;
        }

        .waybill-wrapper .service-section {
          flex: 0 0 auto;
          padding: 5px 5px 0 5px;
          border-bottom: 1px solid black;
          margin-bottom: 0;
          margin-right: -2px;
        }
        .waybill-wrapper .service-section .section-header {
          margin: -5px -5px 0 -5px;
          margin-right: -2px;
          padding: 2px 5px 0 5px;
          width: calc(100% + 10px);
        }
        .waybill-wrapper .service-section > *:not(.section-header) {
          padding: 0 5px 0 5px;
        }

        .waybill-wrapper .size-section {
          padding: 0;
          margin-top: 0px;
        }

        .waybill-wrapper .dims-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }

        .waybill-wrapper .dims-table td {
          padding: 2px;
        }

        .waybill-wrapper .footer-strip {
          margin-top: 2px;
          margin-bottom: 0;
          font-size: 11px;
          font-weight: bold;
        }

        /* Utility classes shared with print template (margins/paddings) */
        .waybill-wrapper .packaging-label {
          padding: 5px 15px;
        }
        .waybill-wrapper .section-header-shipper-adjust {
          margin-right: -2px;
        }
        .waybill-wrapper .address-block {
          margin-bottom: 8px;
        }
        .waybill-wrapper .declared-label {
          margin-bottom: 1px;
        }
        .waybill-wrapper .declared-value {
          margin-top: 2px;
        }
        .waybill-wrapper .barcode-bottom-padding {
          padding: 30px 0 20px 0;
        }
        .waybill-wrapper .barcode-number {
          margin-top: 4px;
        }
        .waybill-wrapper .separator-small-margin {
          margin: 4px 0;
        }
        .waybill-wrapper .urdu-block {
          padding: 0 5px;
        }
        .waybill-wrapper .service-type-line {
          margin: 5px 0;
          padding-bottom: 5px;
        }
        .waybill-wrapper .description-row {
          padding: 5px;
        }
        .waybill-wrapper .instructions-row {
          padding: 5px;
        }
        .waybill-wrapper .size-section-inner {
          padding: 5px 5px 0 5px;
        }
        .waybill-wrapper .size-row-primary {
          padding-bottom: 8px;
          margin-top: 2px;
        }
        .waybill-wrapper .size-row-secondary {
          padding-bottom: 8px;
          margin-top: 7px;
        }
        .waybill-wrapper .dimensions-label {
          margin-top: 9px;
        }
        .waybill-wrapper .dimensions-value {
          margin: 2px 0;
        }
        .waybill-wrapper .charged-weight-block {
          border-top: 1px solid black;
          padding-top: 8px;
          margin-top: 6px;
        }
        .waybill-wrapper .charged-weight-label {
          margin-bottom: 3px;
        }

        .waybill-print-btns {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
        }

        .waybill-cancel-btn {
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .waybill-print-btn {
          background: #10b981;
          color: white;
          padding: 12px 24px;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          transition: transform 0.2s, background 0.2s;
        }

        .waybill-print-btn:hover {
          transform: translateY(-2px);
          background: #059669;
        }

        .waybill-print-btn.vendor {
          background: #6366f1;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .waybill-print-btn.vendor:hover {
          background: #4f46e5;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          .waybill-wrapper .waybill-container {
            border: none;
            padding: 0;
            width: 100%;
            max-width: 100%;
          }
          .waybill-print-btns, .waybill-print-btn {
            display: none !important;
          }
        }
      `}</style>

      <div className="waybill-wrapper">
        <div className="waybill-container" style={{ position: 'relative' }}>
          {org?.slug === "pss-demo" && (
            <div
              className="demo-watermark-overlay"
              style={{
                position: 'absolute',
                top: '32%',
                left: '5%',
                width: '90%',
                transform: 'rotate(-25deg)',
                fontSize: '26px',
                fontWeight: '900',
                color: 'rgba(220, 38, 38, 0.35)',
                border: '4px dashed rgba(220, 38, 38, 0.45)',
                padding: '10px 16px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                pointerEvents: 'none',
                zIndex: 100,
                fontFamily: 'Arial, Helvetica, sans-serif',
                backgroundColor: 'rgba(254, 242, 242, 0.25)',
              }}
            >
              DEMO MODE — NOT VALID FOR COMMERCIAL USE
            </div>
          )}
          {/* Header */}
          <div className="header-area" style={{position: 'relative'}}>
            <div className="logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', width: '120px', overflow: 'hidden' }}>
              <img src={org?.logoUrl || "/logo_final.png"} alt={`${org?.name || "PSS"} Logo`} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <a href={org?.website ? (org.website.startsWith("http") ? org.website : `https://${org.website}`) : "https://www.psswwe.com"} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>
                {org?.website || "www.psswwe.com"}
              </a>
            </div>
            {packagingLabel && (
              <div
                className="packaging-label"
                style={{
                  background: 'black',
                  color: 'white',
                  fontSize: '32px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 'auto',
                }}
              >
                {packagingLabel}
              </div>
            )}
      </div>

          {/* Main Grid */}
          <div className="main-grid">
            {/* COLUMN 1 (LEFT) */}
            <div className="col-1">

              {/* Shipper Info */}
              <div className="shipper-container border-bottom">
                <div
                  className="section-header section-header-shipper-adjust"
                  style={{ borderRight: '3px solid white', boxSizing: 'border-box' }}
                >
                  SHIPPER
                </div>
                <div className="address-details">
                  <div className="address-block">
                    <strong>{sendercompanyname.toUpperCase()}</strong><br />
                    {senderAddress}
                  </div>
                  <div className="address-block">
                    {senderCity && `${senderCity}`}
                    {senderState && `, ${senderState}`}
                    {senderZip && `, ${senderZip}`}
                    {senderCountry && <><br />{senderCountry}</>}
                  </div>
                  <div>
                    Attn: {senderName}<br />
                    <span data-sender-phone>{senderPhone || 'N/A'}<br /></span>
                    <br />
                    CNIC/NTN: {senderDocumentNumber ? senderDocumentNumber : 'N/A'}
              </div>
              </div>
              </div>

              {/* Sender Authorization */}
              <div className="auth-section">
                <div className="section-header">
                  SENDER'S AUTHORIZATION & SIGNATURE
            </div>
                <div className="terms-text">
                  The shipper declares that this shipment contains no money, explosives, weapons, jewelry, narcotics, or other prohibited items. Any customs duties, taxes, penalties, or charges arising from detention or seizure shall be borne by the shipper/consignee.
                  <br />
                  <br />
                  {orgName}'s liability is limited to USD 0.00–100.00 as per company appraisal and criteria. {orgName} is not responsible for loss, breakage, or damage to the shipment. The shipper authorizes visual inspection of the shipment by {orgName} or its agents.
                </div>
                <div className="signature-line">
                  <span>SENDER'S SIGNATURE</span>
                </div>
                <div className="timestamp">
                  DATE: {timestampDate}
                </div>
              </div>
              
              {/* POD */}
              <div className="pod-section">

                  </div>
                </div>

            {/* COLUMN 2 (MIDDLE) */}
            <div className="col-2">
              {/* Consignee Info */}
              <div className="shipper-container border-bottom">
                <div className="section-header">CONSIGNEE</div>
                <div className="address-details">
                  <div className="address-block">
                    <strong>{recipientcompanyname.toUpperCase()}</strong><br />
                    {recipientAddress}
                  </div>
                  <div className="address-block">
                    {recipientCity && `${recipientCity}`}
                    {recipientState && `, ${recipientState}`}
                    {recipientZip && `, ${recipientZip}`}
                    {recipientCountry && <><br />{recipientCountry}</>}
                  </div>
                  <div>
                    Attn.: {recipientName}<br />
                    {recipientPhone || 'N/A'}<br />
                    <br />
                    EORI/VAT
                  </div>
                </div>
              </div>
              
              {/* DAP & Value */}
              <div className="dap-section">
                <div className="dap-box">** DDU **</div>
                <div className="currency-box">
                  <div className="declared-label" style={{ lineHeight: '1.2' }}>DECLARED VALUE FOR</div>
                  <div className="declared-label" style={{ lineHeight: '1.2' }}>CUSTOMS AND CURRENCY</div>
                  <div className="declared-value" style={{ lineHeight: '1.2' }}>
                    <strong>{declaredValue.toFixed(2)} USD.</strong>
                  </div>
              </div>
            </div>

              {/* Middle column bottom box: barcode, separator, Urdu notice */}
              <div className="col-2-bottom-box">
                {/* Barcode and Booking ID - inside receipt box, centered */}
                <div
                  className="barcode-bottom barcode-bottom-padding"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  <div className="barcode" style={{ height: '50px', width: '150px' }} />
                  <div className="barcode-number" style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {invoice.invoiceNumber}
                  </div>
                </div>
                <div className="separator-small-margin" style={{ borderTop: '1px solid black', width: '100%' }} />
                {/* Declaration Text (Urdu insurance notice) */}
                <div className="urdu-block" style={{ fontSize: '11px', lineHeight: '1.5' }}>
                  <div>
                    <strong>انشورنس نوٹس:</strong> بھیجنے والے کی طرف سے انشورنس لازمی ہے۔ اگر اعلان نہیں کیا گیا تو، بھیجنے والا مکمل خطرہ قبول کرتا ہے اور بیان کردہ ذمہ داری کی حد کو تسلیم کرتا ہے۔
                  </div>
                </div>
              </div>
            </div>
              
            {/* COLUMN 3 (RIGHT) */}
            <div className="col-3">
              {/* References */}
              <div className="section-header text-center" style={{ borderLeft: '2px solid white', boxSizing: 'border-box' }}>
                CUSTOMER REFERENCE
              </div>
              <div className="ref-box">{referenceNumber || orgName}</div>

              {/* Service Type */}
              <div className="service-section">
                <div className="section-header">
                  SERVICE MODE
                  </div>
                <div className="bold service-type-line" style={{ borderBottom: '1px solid black' }}>
                  {serviceType}
                </div>
                <div className="address-block" style={{ fontSize: '9px' }}>
                  <strong>IMPORTANT:</strong> ATTACH ORIGINAL THREE COPIES OF INVOICES, CNIC AND UNDERTAKING WITH PACKAGE FOR CUSTOM PURPOSE
                  </div>
              </div>

              {/* Full Description and Special Instructions - direct children of col-3 so they span full width */}
              <div>
                <div className="section-header" style={{ borderTop: '1px solid black' }}>FULL DESCRIPTION OF CONTENTS</div>
                <div className="description-row" style={{ borderBottom: '1px solid #eee' }}>
                  <strong>{contentsDescription.toUpperCase()}</strong>
                </div>
              </div>
              <div>
                <div className="section-header" style={{ borderTop: '1px solid black' }}>SPECIAL INSTRUCTIONS</div>
                <div className="instructions-row">N/A</div>
              </div>
              
              {/* Size & Weight */}
              <div className="size-section">
                <div className="section-header">
                  SIZE & WEIGHT
                </div>
                <div className="size-section-inner">
                  <div
                    className="size-row-primary"
                    style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid black' }}
                  >
                    <span>NO. OF PIECES</span>
                    <strong>{totalPieces}</strong>
                  </div>
                  <div
                    className="size-row-secondary"
                    style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid black' }}
                  >
                    <span>WEIGHT</span>
                    <strong>{totalWeight.toFixed(3)} KGS</strong>
              </div>
              
                  <div className="dimensions-label">
                    DIMENSIONS IN CM <span style={{ float: 'right' }}>LxWxH</span>
                  </div>
                  <div className="dimensions-value" style={{ textAlign: 'center' }}>
                    {dimensions}
                  </div>
                  
                  <div className="charged-weight-block">
                    <div className="charged-weight-label">VOLUMETRIC / CHARGED WEIGHT</div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}>
                      <span>{chargedWeight.toFixed(2)}</span>
                      <span>KGS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* End Grid */}

          <div className="footer-strip" data-copy-label>
            SENDER COPY
          </div>

          {/* Terms and Conditions Section — sized to fit under scaled receipt on one A4 page */}
          <div
            className="terms-conditions-wrapper"
            style={{
              marginTop: '2px',
              paddingTop: '2px',
              borderTop: '1.5px solid black',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            <div
              className="terms-title"
              style={{
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                marginBottom: '1px',
                letterSpacing: '0.3px',
              }}
            >
              Terms and Conditions of Transportation
            </div>

            <div className="terms-body" style={{ fontSize: '5.5px', lineHeight: '1.1', color: '#000' }}>
              <div className="terms-notice" style={{ marginBottom: '2px', textAlign: 'justify' }}>
                <strong>IMPORTANT NOTICE:</strong> When ordering {orgName}’s services you, as “Shipper”, are agreeing, on your behalf and on behalf of the consignee of the Shipment (“Consignee”) and anyone else with an interest in the Shipment that these Terms and Conditions shall apply. “Shipment” means all documents or parcels that travel under one waybill and which may be carried by any means {orgName} chooses, including air, road or any other carrier. A “waybill” shall include any Shipment identifier or document produced by {orgName} or Shipper automated systems such as a label, barcode, waybill or consignment note as well as any electronic version thereof. Every Shipment is transported on a limited liability basis as provided herein. If Shipper requires greater protection, then insurance may be arranged at an additional cost. “{orgName}” means any member of the {orgName} Network.
              </div>

              <div
                className="terms-columns"
                style={{
                  columnCount: 2,
                  columnGap: '10px',
                  textAlign: 'justify',
                }}
              >
                <div className="terms-section" style={{ marginBottom: '1.5px' }}>
                  <strong>1. Customs Clearance and Regulatory Compliance:</strong> {orgName} may perform any of the following activities on Shipper’s or Consignee’s behalf in order to provide services: (1) complete any documents, amend product or service codes and advance any duties, taxes or other regulatory charges required under applicable laws and regulations (“Customs Duties”), (2) act as Shipper’s or Consignee´s true and lawful agent or designate a customs broker to perform export control and customs clearance and (3) redirect the Shipment to Consignee’s customs broker or other address upon request by any person who {orgName} believes in its reasonable opinion to be authorized. Shipper or Consignee will provide any extra authorization required by applicable law for {orgName} to clear a Shipment.
                </div>

                <div className="terms-section" style={{ marginBottom: '1.5px' }}>
                  <strong>2. Unacceptable Shipments:</strong> A Shipment is deemed unacceptable if:
                  <ul style={{ margin: '1px 0 1px 8px', paddingLeft: '8px', listStyleType: 'disc' }}>
                    <li>it contains complete firearms, ammunition, explosives, explosive devices or test pieces, air guns, replica or imitation firearms; counterfeit goods; cash; bullion (of any precious metal); live animals, prohibited animal parts or remains, such as ivory; human remains or ashes; loose precious or semi-precious stones; cannabis or its derivatives; or illegal goods, such as narcotics or other illegal drugs,</li>
                    <li>it is classified as hazardous material, dangerous goods, prohibited or restricted articles under ADR (European Road Transport Regulation on dangerous goods) or by IATA (International Air Transport Association), ICAO (International Civil Aviation Organization), or other relevant organization (“Dangerous Goods”),</li>
                    <li>it contains any other item which {orgName} cannot carry safely or legally,</li>
                    <li>the address is incorrect or not properly marked or its packaging is defective or inadequate to ensure safe transportation with ordinary care in handling,</li>
                    <li>Shipper, Consignee or any other party with a direct or indirect interest in the Shipment is listed on any applicable sanctions lists as a denied or restricted party.</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>3. Deliveries and Undeliverables:</strong> Shipments cannot be delivered to PO boxes or postal codes. Shipments are delivered to the Consignee’s address given by Shipper but not necessarily to the named Consignee personally. Shipments to addresses with a central receiving area will be delivered to that area. {orgName} may notify Consignee of an upcoming delivery or a missed delivery. Consignee may be offered alternative delivery options such as delivery on another day, no signature required, redirection or collection at a {orgName} Service Point. If the Shipment is deemed to be unacceptable as described in Section 2, it has been undervalued for customs purposes, Consignee cannot be reasonably identified or located, or Consignee refuses delivery or to pay Customs Duties or other Shipment charges, {orgName} shall use reasonable efforts to return the Shipment to Shipper. This shall be at Shipper’s cost. If it is not possible to return the Shipment, it may be released, abandoned, disposed of or sold without incurring any liability whatsoever to Shipper or anyone else. {orgName} shall have the right to destroy any Shipment if {orgName} is prevented by any law or law enforcement agency from returning it in whole or in part to Shipper, as well as any Shipment of Dangerous Goods.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>4. Inspection:</strong> {orgName} has the right to open and inspect a Shipment without notice for safety, security, customs or other regulatory reasons.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>5. Shipment Charges, Duties and Fees:</strong> {orgName}’s Shipment charges are calculated according to the higher of actual or volumetric weight per piece and any piece may be re-weighed and re-measured by {orgName} to confirm this calculation. Payment of Customs Duties and other charges due as indicated on {orgName}’s website in the receiving country may be requested from Consignee prior to delivery. This includes a fee if {orgName} uses its credit with the Customs Authorities or pays any Customs Duties on Consignee’s behalf. Shipper shall pay or reimburse {orgName} for all Customs Duties and other charges due for services provided by {orgName} or incurred by {orgName} on Shipper’s or Consignee’s behalf if Consignee has failed to pay.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>6. {orgName}’s Liability:</strong> {orgName}’s liability in respect of any one Shipment transported by air (including ancillary road transport or stops en route) is limited by the Montreal Convention or the Warsaw Convention as applicable, or in the absence of such Convention, to the lower of (i) the current market or declared value, or (ii) 22 Special Drawing Rights per kilogram (approximately $US 30.00 per kilogram). Such limits shall also apply to all other forms of transportation, except where Shipments are carried only by road, when the limits below apply. For cross border Shipments transported by road, {orgName}’s liability is or shall be deemed to be limited by the Convention for the International Carriage of Goods by Road (CMR) to the lower of (i) current market value or declared value, or (ii) 8.33 Special Drawing Rights per kilogram (approximately $US 11.00 per kilogram). Such limits will also apply to national road transportation in the absence of any mandatory or lower liability limits in the applicable national transport law. If Shipper regards these limits as insufficient it must make a special declaration of value and request insurance as described in Section 8 or make its own insurance arrangements. {orgName}’s liability is strictly limited to direct loss and damage to a Shipment only and to the per kilogram limits in this Section 6. All other types of loss or damage are excluded (including but not limited to lost profits, income, interest, future business), whether such loss or damage is special or indirect, and even if the risk of such loss or damage was brought to {orgName}’s attention. {orgName} will make every reasonable effort to deliver the Shipment according to {orgName}’s regular delivery schedules, but these schedules are not binding and do not form part of the contract. {orgName} is not liable for any damages or loss caused by delay, but for certain Shipments, Shipper may be able to claim limited delay compensation under the Money Back Guarantee terms and conditions, which are available on the {orgName} website or from {orgName} Customer Service.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>7. Claims:</strong> All claims must be submitted in writing to {orgName} within thirty (30) days from the date that {orgName} accepted the Shipment, failing which {orgName} shall have no liability whatsoever. Claims are limited to one claim per Shipment, settlement of which will be full and final settlement for all loss or damage in connection therewith.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>8. Shipment Insurance:</strong> {orgName} may be able to arrange insurance for loss of or damage to the Shipment, covering the full value of the goods, provided that Shipper so instructs {orgName} in writing, including by completing the insurance section of the waybill or using {orgName}’s automated systems and pays the applicable premium. Shipment insurance does not cover indirect loss or damage, or loss or damage caused by delays.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>9. Circumstances Beyond {orgName}’s Control:</strong> {orgName} is not liable for any loss or damage arising out of circumstances beyond {orgName}’s control. These include but are not limited to electrical or magnetic damage to, or erasure of, electronic or photographic images, data or recordings; any defect or characteristic related to the nature of the Shipment, even if known to {orgName}; any act or omission by a person not employed or contracted by {orgName} - e.g. Shipper, Consignee, third party, customs or other government official; third party cyber-attacks or other information security related threats; “Force Majeure” - e.g. earthquake, cyclone, storm, flood, fog, war, plane crash, embargo, riot, epidemic, pandemic, civil commotion, or industrial action.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>10. Shipper’s Representations, Warranties and Indemnities:</strong> Shipper shall indemnify and hold {orgName} and its directors, officers, employees and agents harmless from and against all and any liabilities, losses and damages arising out of Shipper’s failure to comply with the following warranties and representations:
                  <ul style={{ margin: '1px 0 1px 10px', paddingLeft: '8px', listStyleType: 'disc' }}>
                    <li>the Shipment is acceptable for transport under Section 2 above,</li>
                    <li>the Shipment was prepared in secure premises by reliable persons and was protected against unauthorized interference during preparation, storage and any transportation to {orgName},</li>
                    <li>Shipper has complied with applicable export control, sanctions, customs laws and regulations or other applicable regulatory requirements and restrictions related to the import, export, transit or transfer of goods,</li>
                    <li>Shipper has declared to {orgName} any controlled dual-use or military goods subject to government authorizations contained in the Shipment,</li>
                    <li>Shipper has provided all information, permits, licenses or other government authorizations and documents, as required by applicable law or upon request from {orgName}, and all information, permits, licenses or other government authorizations and documents provided by Shipper or its representatives are true, complete and accurate, including the value and description of the goods and Shipper and Consignee information,</li>
                    <li>when providing personal data to {orgName}, Shipper has complied with its legal obligations to process and share this data, including informing the affected individuals that personal data, including Consignee’s email address and mobile phone number, is required for transport, customs clearance and delivery.</li>
                  </ul>
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>11. Routing:</strong> Shipper agrees to all routing and diversion, including the possibility that the Shipment may be carried via intermediate stopping places.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>12. Governing Law:</strong> Any dispute arising under or in any way connected with these Terms and Conditions shall be subject to the non-exclusive jurisdiction of the courts of, and governed by the law of the country of origin of the Shipment and Shipper irrevocably submits to such jurisdiction, unless contrary to applicable law.
                </div>

                <div style={{ marginBottom: '1.5px' }}>
                  <strong>13. Severability:</strong> The invalidity or unenforceability of any provision shall not affect any other part of these Terms and Conditions.
                </div>
              </div>
            </div>
          </div>

          {/* Branding Support Info Footer */}
          <div
            className="support-info-footer"
            style={{
              marginTop: '2px',
              paddingTop: '1px',
              borderTop: '1px solid #000',
              textAlign: 'center',
              fontSize: '6.5px',
              fontWeight: 'bold',
              color: '#000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              letterSpacing: '0.2px',
            }}
          >
            {supportAddress} | {supportPhone} | {supportEmail}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="waybill-print-btns">
        <Link href="/dashboard/shipments">
          <Button variant="outline" className="waybill-cancel-btn">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </Link>
        <button className="waybill-print-btn vendor" onClick={() => handlePrint('vendor')}>
          Print Vendor Copy
        </button>
        <button className="waybill-print-btn" onClick={() => handlePrint('sender')}>
          Print Waybill
        </button>
      </div>

    </div>
  );
}
