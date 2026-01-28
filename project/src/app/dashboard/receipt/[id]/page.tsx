'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCountryNameFromCode } from '@/lib/utils';
import { format } from 'date-fns';

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
  };
}

export default function ReceiptPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handlePrint = () => {
    if (!invoice) {
      alert('Invoice data not available');
      return;
    }

    // Get the waybill container HTML
    const waybillContainer = document.querySelector('.waybill-container');
    if (!waybillContainer) {
      alert('Waybill content not found');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the waybill');
      return;
    }

    // Get the waybill HTML content
    const waybillHTML = waybillContainer.innerHTML;

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

            body {
              font-family: Arial, Helvetica, sans-serif;
              background-color: #f3f4f6;
              padding: 20px;
              margin: 0;
              font-size: 10px;
            }

            .waybill-container {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border: 1px solid #ccc;
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
              background: #e5e7eb;
              color: black;
              padding: 2px 5px;
              font-weight: bold;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 1px solid black;
              margin: 0;
              width: 100%;
              box-sizing: border-box;
            }

            .cell-content {
              padding: 5px;
            }

            .col-1 {
              border-right: 1px solid black;
            }

            .shipper-container {
              display: flex;
              height: 180px;
            }
            .vertical-label {
              background: #d1d5db;
              width: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-right: 1px solid black;
              writing-mode: vertical-rl;
              transform: rotate(180deg);
              font-weight: bold;
              font-size: 10px;
              letter-spacing: 2px;
            }
            .address-details {
              padding: 8px;
              flex: 1;
              font-size: 11px;
              line-height: 1.3;
            }

            .auth-section {
              height: 120px;
              padding: 0;
              position: relative;
              font-size: 9px;
            }
            .auth-section .section-header {
              margin: 0;
              padding: 2px 5px;
              width: 100%;
              box-sizing: border-box;
            }
            .auth-section > *:not(.section-header) {
              padding: 5px;
            }
            .terms-text {
              font-size: 9px;
              margin-bottom: 5px;
              text-align: justify;
            }
            .signature-line {
              border-top: 1px solid black;
              width: 100%;
              margin-top: 5px;
              padding-top: 5px;
            }
            .timestamp {
              margin-top: 10px;
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
              line-height: 1.3;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
              box-sizing: border-box;
            }
            .barcode-section {
              height: 140px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 10px;
            }
            .barcode {
              height: 60px;
              width: 90%;
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
            .ref-box {
              height: 25px;
              border-bottom: 1px solid black;
              display: flex;
              align-items: center;
              padding: 0 5px;
            }
            .service-section {
              flex: 1;
              padding: 5px 5px 0 5px;
              border-bottom: 1px solid black;
              margin-bottom: 0;
              max-height: 210px;
              overflow: hidden;
            }
            .service-section .section-header {
              margin: -5px -5px 0 -5px;
              padding: 2px 5px 0 5px;
              width: calc(100% + 10px);
            }
            .service-section > *:not(.section-header) {
              padding: 0 5px 0 5px;
            }
            .size-section {
              height: 100px;
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
              margin-top: 5px;
              font-size: 12px;
              font-weight: bold;
            }

            @media print {
              body { padding: 0; background: white; }
              .waybill-container { border: none; padding: 0; margin: 0; width: 100%; max-width: 100%; }
              @page {
                size: landscape;
                margin: 0.5cm;
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
  const senderName = shipment?.senderName || invoice.customer?.CompanyName || invoice.customer?.PersonName || 'N/A';
  const senderAddress = shipment?.senderAddress || invoice.customer?.Address || '';
  const senderCity = invoice.customer?.City || '';
  const senderState = invoice.customer?.State || '';
  const senderCountry = invoice.customer?.Country ? getCountryNameFromCode(invoice.customer.Country) : '';
  const senderZip = invoice.customer?.Zip || '';
  const senderPhone = invoice.customer?.Phone || '';
  
  // Format recipient address (from shipment)
  const recipientName = shipment?.recipientName || 'N/A';
  const recipientAddress = shipment?.recipientAddress || '';
  const recipientCountry = shipment?.destination ? getCountryNameFromCode(shipment.destination) : '';
  
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
    : (shipment?.decValue || invoice.totalAmount || 0);
  
  // Format date for timestamp
  const timestampDate = invoice.invoiceDate 
    ? format(new Date(invoice.invoiceDate), 'dd MMM yy HH:mm:ss')
    : format(new Date(), 'dd MMM yy HH:mm:ss');

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
          max-width: 900px;
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
          background: #e5e7eb;
          color: black;
          padding: 2px 5px;
              font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          border-bottom: 1px solid black;
        }

        .waybill-wrapper .cell-content {
          padding: 5px;
        }

        .waybill-wrapper .col-1 {
          border-right: 1px solid black;
        }

        .waybill-wrapper .shipper-container {
          display: flex;
          height: 180px;
        }

        .waybill-wrapper .vertical-label {
          background: #d1d5db;
          width: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid black;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
              font-weight: bold;
          font-size: 10px;
          letter-spacing: 2px;
        }

        .waybill-wrapper .address-details {
          padding: 8px;
          flex: 1;
          font-size: 11px;
          line-height: 1.3;
        }

        .waybill-wrapper .auth-section {
          height: 120px;
          padding: 0;
          position: relative;
          font-size: 9px;
        }
        .waybill-wrapper .auth-section .section-header {
          margin: 0;
          padding: 2px 5px;
          width: 100%;
        }
        .waybill-wrapper .auth-section > *:not(.section-header) {
          padding: 5px;
        }

        .waybill-wrapper .terms-text {
          font-size: 9px;
          margin-bottom: 5px;
          text-align: justify;
        }

        .waybill-wrapper .signature-line {
          border-top: 1px solid black;
          width: 100%;
          margin-top: 5px;
          padding-top: 5px;
        }

        .waybill-wrapper .timestamp {
          margin-top: 10px;
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
          height: 140px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
              padding: 10px;
        }

        .waybill-wrapper .barcode {
          height: 60px;
          width: 90%;
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

        .waybill-wrapper .ref-box {
          height: 25px;
          border-bottom: 1px solid black;
          display: flex;
          align-items: center;
          padding: 0 5px;
        }

        .waybill-wrapper .service-section {
          flex: 1;
          padding: 5px 5px 0 5px;
          border-bottom: 1px solid black;
          margin-bottom: 0;
          max-height: 210px;
          overflow: hidden;
        }
        .waybill-wrapper .service-section .section-header {
          margin: -5px -5px 0 -5px;
          padding: 2px 5px 0 5px;
          width: calc(100% + 10px);
        }
        .waybill-wrapper .service-section > *:not(.section-header) {
          padding: 0 5px 0 5px;
        }

        .waybill-wrapper .size-section {
          height: 100px;
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
          margin-top: 5px;
          font-size: 12px;
          font-weight: bold;
        }

        .waybill-print-btn {
          position: fixed;
          bottom: 30px;
          right: 30px;
          background: #10b981;
          color: white;
          padding: 12px 24px;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          transition: transform 0.2s;
          z-index: 1000;
        }

        .waybill-print-btn:hover {
          transform: translateY(-2px);
          background: #059669;
        }

        .waybill-back-btn {
          position: fixed;
          bottom: 30px;
          left: 30px;
          z-index: 1000;
        }

        @media print {
          .waybill-wrapper .waybill-container {
            border: none;
            padding: 0;
            width: 100%;
            max-width: 100%;
          }
          .waybill-print-btn, .waybill-back-btn {
            display: none !important;
          }
        }
      `}</style>

      <div className="waybill-wrapper">
        <div className="waybill-container">
          {/* Header */}
          <div className="header-area" style={{position: 'relative'}}>
            <div className="logo">
              <img src="/logo_final.png" alt="PSS Logo" />
          </div>
            
            {/* Contact Information - Centered between logo and WPX */}
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              fontSize: '10px',
              lineHeight: '1.4',
              color: '#333'
            }}>
              <div>+92 300 8482 321</div>
              <div>info@psswwe.com</div>
              <div>LGF-44, Land Mark Plaza, Jail Road</div>
              <div>Lahore, 54660, Pakistan</div>
            </div>

            {packagingLabel && (
              <div style={{
                background: 'black',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                padding: '5px 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto'
              }}>
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
                <div className="vertical-label">SHIPPER</div>
                <div className="address-details">
                  <div style={{marginBottom: '8px'}}>
                    <strong>{senderName.toUpperCase()}</strong><br />
                    {senderAddress}
            </div>
                  <div style={{marginBottom: '8px'}}>
                    {senderCity && `${senderCity}`}
                    {senderState && `, ${senderState}`}
                    {senderZip && `, ${senderZip}`}
                    {senderCountry && <><br />{senderCountry}</>}
          </div>
                  <div>
                    {senderName}<br />
                    {senderPhone || 'N/A'}<br />
                    CNIC/NTN: N/A
              </div>
              </div>
              </div>

              {/* Sender Authorization */}
              <div className="auth-section">
                <div className="section-header bg-red">
                  SENDER'S AUTHORIZATION & SIGNATURE
            </div>
                <div className="terms-text">
                  The shipper declares that this shipment contains no money, explosives, weapons, jewelry, narcotics, or other prohibited items. Any customs duties, taxes, penalties, or charges arising from detention or seizure shall be borne by the shipper/consignee.
                  <br />
                  <br />
                  PSS Worldwide's liability is limited to USD 0.00–100.00 as per company appraisal and criteria. PSS Worldwide is not responsible for loss, breakage, or damage to the shipment. The shipper authorizes visual inspection of the shipment by PSS Worldwide or its agents.
                </div>
                <div className="signature-line">
                  <span>SENDER'S SIGNATURE</span>
                </div>
                <div className="timestamp">
                  DATE: {timestampDate}<br />
                  Received by:
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
                <div className="section-header bg-red" style={{position: 'absolute', width: '15px', height: '15px', padding: 0, textAlign: 'center', lineHeight: '15px'}}>2</div>
                <div className="vertical-label">CONSIGNEE</div>
                <div className="address-details" style={{paddingLeft: '15px'}}>
                  <div style={{marginBottom: '8px'}}>
                    <strong>{recipientName.toUpperCase()}</strong><br />
                    {recipientAddress}
                  </div>
                  <div style={{marginBottom: '8px'}}>
                    {recipientCountry && <>{recipientCountry}</>}
                  </div>
                  <div>
                    Attn.: {recipientName}<br />
                    N/A<br />
                    <br />
                    EORI
                  </div>
                </div>
              </div>
              
              {/* DAP & Value */}
              <div className="dap-section">
                <div className="dap-box">** DAP **</div>
                <div className="currency-box">
                  <div style={{marginBottom: '1px', lineHeight: '1.2'}}>DECLARED VALUE FOR</div>
                  <div style={{marginBottom: '1px', lineHeight: '1.2'}}>CUSTOMS AND CURRENCY</div>
                  <div style={{marginTop: '2px', lineHeight: '1.2'}}><strong>{declaredValue.toFixed(2)} PKR.</strong></div>
              </div>
            </div>

              {/* Barcode and Invoice Number */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 0',
                borderBottom: '1px solid black'
              }}>
                <div className="barcode" style={{height: '40px', width: '140px', marginBottom: '10.5px'}}></div>
                <div style={{fontWeight: 'bold', fontSize: '14px'}}>{invoice.invoiceNumber}</div>
              </div>

              {/* Declaration Text */}
              <div style={{padding: '8px 5px', fontSize: '11px', lineHeight: '1.4'}}>
                <div>
                  <strong>انشورنس نوٹس:</strong> بھیجنے والے کی طرف سے انشورنس لازمی ہے۔ اگر اعلان نہیں کیا گیا تو، بھیجنے والا مکمل خطرہ قبول کرتا ہے اور بیان کردہ ذمہ داری کی حد کو تسلیم کرتا ہے۔
                </div>
              </div>

              {/* Empty barcode section */}
              {/* <div className="barcode-section">
              </div> */}
            </div>
              
            {/* COLUMN 3 (RIGHT) */}
            <div className="col-3">
              {/* References */}
              <div className="section-header bg-grey text-center">CUSTOMER REFERENCE</div>
              <div className="ref-box">{referenceNumber || 'PSS'}</div>

              {/* Service Type */}
              <div className="service-section">
                <div className="section-header bg-red">
                  SERVICE MODE
                  </div>
                <div className="bold" style={{margin: '5px 0'}}>{serviceType}</div>
                <div style={{fontSize: '9px', marginBottom: '8px'}}>
                  IMPORTANT<br />
                  ATTACH ORIGINAL THREE COPIES OF COMMERCIAL INVOICES WITH PACKAGE FOR CUSTOM PURPOSE
                  </div>
                
                <div style={{borderTop: '1px solid #ccc', paddingTop: '5px'}}>
                  FULL DESCRIPTION OF CONTENTS:-<br />
                  <strong>{contentsDescription.toUpperCase()}</strong>
                </div>
                <div style={{marginTop: '5px', marginBottom: '0'}}>
                  SPECIAL INSTRUCTIONS:-<br />
                  N/A
                </div>
              </div>
              
              {/* Size & Weight */}
              <div className="size-section">
                <div className="section-header bg-red">
                  SIZE & WEIGHT
                </div>
                <div style={{padding: '5px 5px 0 5px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee'}}>
                    <span>NO. OF PIECES</span>
                    <strong>{totalPieces}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid black', padding: '2px 0'}}>
                    <span>WEIGHT</span>
                    <strong>{totalWeight.toFixed(3)} KGS</strong>
              </div>
              
                  <div style={{marginTop: '2px'}}>DIMENSIONS IN CM <span style={{float: 'right'}}>LxWxH</span></div>
                  <div style={{textAlign: 'center', margin: '2px 0'}}>{dimensions}</div>
                  
                  <div style={{borderTop: '1px solid black', paddingTop: '8px', marginTop: '5px'}}>
                    <div style={{marginBottom: '3px'}}>VOLUMETRIC / CHARGED WEIGHT</div>
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

          <div className="footer-strip">
            SENDER COPY
          </div>
        </div>
      </div>

      {/* Floating Print Button */}
      <button className="waybill-print-btn" onClick={handlePrint}>
        Print Waybill
      </button>

      {/* Back Button */}
      <div className="waybill-back-btn">
        <Link href="/dashboard">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
    </div>
  );
}
