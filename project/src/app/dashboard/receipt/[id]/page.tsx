'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Shipment {
  id: string;
  senderName?: string;
  senderAddress?: string;
  senderPhone?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  amount?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  weightVol?: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount?: number;
  currency?: string;
  weight?: number;
  lineItems?: any[];
  shipment?: Shipment;
}

export default function ReceiptPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/accounts/invoices/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch invoice');
        }
        const data = await response.json();
        setInvoice(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchInvoice();
    }
  }, [params.id]);

  const handlePrint = () => {
    // Create a new window with only the receipt content for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    // Get the receipt content
    const receiptContent = document.querySelector('.receipt-content')?.innerHTML;
    if (!receiptContent) {
      alert('Could not generate receipt content');
      return;
    }

    // Create a clean HTML document for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PSS Receipt - ${invoice?.invoiceNumber || 'Receipt'}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { 
                margin: 0; 
                padding: 0; 
                background: white !important;
              }
              .receipt-container { 
                margin: 0; 
                max-width: none; 
                box-shadow: none !important;
              }
              .no-print { display: none !important; }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: black;
            }
            .receipt-container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
            }
            .header {
              background: #1e40af;
              color: white;
              padding: 20px;
              text-align: center;
              margin-bottom: 20px;
            }
            .logo {
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .tagline {
              font-size: 18px;
              opacity: 0.9;
            }
            .content-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0;
              min-height: 600px;
            }
            .column {
              padding: 20px;
              border-right: 1px solid #e5e7eb;
            }
            .right-column {
              padding: 20px;
              border-right: none;
            }
            
            .top-bar {
              background: #e5e7eb;
              padding: 12px;
              border-bottom: 1px solid #d1d5db;
            }
            
            .top-bar-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 16px;
              text-align: center;
            }
            
            .top-bar-left {
              text-align: left;
            }
            
            .top-bar-center {
              text-align: center;
            }
            
            .top-bar-right {
              text-align: right;
            }
            
            .customer-ref-label {
              font-size: 12px;
              font-weight: bold;
              color: #374151;
              margin-bottom: 2px;
            }
            
            .customer-ref-value {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              color: #4b5563;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 8px;
            }
            .section-content {
              font-size: 14px;
              color: #1f2937;
              line-height: 1.5;
            }
            .person-name {
              font-weight: 600;
              margin-bottom: 4px;
            }
            .address {
              margin-bottom: 4px;
            }
            .contact-info {
              margin-top: 8px;
              font-size: 13px;
            }
            .tracking-section {
              text-align: center;
              margin-bottom: 25px;
            }
            .zone-code {
              color: #dc2626;
              font-weight: bold;
              font-size: 18px;
              margin-bottom: 8px;
            }
            .tracking-number {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
            }
            .declared-value {
              background: #f3f4f6;
              padding: 16px;
              border-radius: 4px;
              text-align: center;
              margin-bottom: 16px;
            }
            .declared-value h4 {
              font-size: 12px;
              font-weight: bold;
              color: #4b5563;
              margin-bottom: 8px;
            }
            .declared-value .amount {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
            }
            .barcode {
              background: #000;
              height: 48px;
              margin: 8px 0;
            }
            .barcode-text {
              text-align: center;
              font-weight: bold;
              color: #1f2937;
            }
            .customer-reference {
              background: #f0f9ff;
              padding: 16px;
              border-radius: 4px;
              margin-bottom: 16px;
            }
            .reference-label {
              font-size: 12px;
              font-weight: bold;
              color: #0369a1;
              margin-bottom: 4px;
            }
            .reference-value {
              color: #1e40af;
            }
            .service-type {
              background: #dbeafe;
              padding: 16px;
              border-radius: 4px;
              margin-bottom: 16px;
            }
            .service-title {
              font-size: 12px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 8px;
            }
            .service-note {
              font-size: 10px;
              color: #dc2626;
              margin-bottom: 12px;
              font-weight: bold;
            }
            .contents-label {
              font-size: 12px;
              font-weight: bold;
              color: #374151;
              margin-bottom: 4px;
            }
            .contents-value {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            .size-weight {
              background: #f9fafb;
              padding: 16px;
              border-radius: 4px;
            }
            .size-weight-title {
              font-size: 12px;
              font-weight: bold;
              color: #374151;
              margin-bottom: 12px;
            }
            .size-weight-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .size-weight-label {
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
            }
            .size-weight-value {
              font-size: 12px;
              color: #1f2937;
            }
            .copy-label {
              font-size: 10px;
              color: #6b7280;
              font-weight: bold;
              position: absolute;
              bottom: 16px;
              left: 24px;
            }
            .terms {
              font-size: 12px;
              color: #4b5563;
              line-height: 1.4;
              margin-bottom: 16px;
            }
            .pod-section {
              margin-bottom: 16px;
            }
            .pod-line {
              margin-bottom: 8px;
            }
            .pod-underline {
              border-bottom: 1px solid #000;
              display: inline-block;
              min-width: 150px;
              margin-left: 8px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="logo">PSS</div>
              <div class="tagline">PROMPT SURVEY & SERVICES</div>
            </div>
            
            <div class="top-bar">
              <div class="top-bar-grid">
                <div class="top-bar-left">
                  <span class="zone-code">LHE</span>
                </div>
                <div class="top-bar-center">
                  <span class="tracking-number">${trackingNumber}</span>
                </div>
                <div class="top-bar-right">
                  <div class="customer-ref-label">CUSTOMER REFERENCE</div>
                  <div class="customer-ref-value">PSS</div>
                  <div class="customer-ref-label">ALTERNATE REFERENCE</div>
                  <div class="customer-ref-value"></div>
                </div>
              </div>
            </div>
            
            <div class="content-grid">
              <div class="column">
                <div class="section">
                  <div class="section-title">1 ACCOUNT NAME</div>
                  <div class="section-content">CSS Google (LHE - 420004)</div>
                </div>
                
                <div class="section">
                  <div class="section-title">2 SHIPPER</div>
                  <div class="section-content">
                    <div class="person-name">${sender.PersonName}</div>
                    <div class="address">${sender.Address}</div>
                    <div class="contact-info">
                      <div>Contact Person: ${sender.PersonName}</div>
                      <div>Phone: ${sender.Phone}</div>
                      <div>CNIC/NTN: ${sender.CNIC}</div>
                    </div>
                  </div>
                </div>
                
                <div class="section">
                  <div class="section-title">3 SENDER'S AUTHORIZATION & SIGNATURE</div>
                  <div class="terms">
                    I, WE AGREE THAT THE CARRIERS STANDARD TERMS AND CONDITIONS APPLY TO THIS SHIPMENT AND LIMIT CARRIERS LIABILITY. THE WARSAW CONVENTION MAY ALSO APPLY. TERMS AND CONDITIONS AVAILABLE AT WWW.SKYWWE.COM
                  </div>
                </div>
                
                <div class="section">
                  <div class="section-title">4 PROOF OF DELIVERY (POD)</div>
                  <div class="pod-section">
                    <div class="pod-line">RECEIVER'S SIGNATURE: <span class="pod-underline"></span></div>
                    <div class="pod-line">DATE: <span class="pod-underline"></span></div>
                    <div class="pod-line">PRINT NAME: <span class="pod-underline"></span></div>
                  </div>
                </div>
                
                <div class="copy-label">SENDER COPY</div>
              </div>

              <div class="column right-column">
                <div class="tracking-section">
                  <div class="zone-code">LHE</div>
                  <div class="tracking-number">${trackingNumber}</div>
                </div>
                
                <div class="section">
                  <div class="section-title">2 CONSIGNEE</div>
                  <div class="section-content">
                    <div class="person-name">${recipient.PersonName}</div>
                    <div class="address">${recipient.Address}</div>
                    <div class="contact-info">
                      <div>Attention: Attn.: ${recipient.PersonName}</div>
                      <div>Phone: ${recipient.Phone}</div>
                      <div>IEC</div>
                    </div>
                  </div>
                </div>
                
                <div class="declared-value">
                  <h4>Declared Value for Customs and Currency</h4>
                  <div class="amount">${invoice?.currency || 'USD'} ${invoice?.totalAmount?.toFixed(2) || '45.00'}</div>
                </div>
                
                <div class="barcode"></div>
                <div class="barcode-text">*${trackingNumber}*</div>
                
                <div class="customer-reference">
                  <div class="reference-label">CUSTOMER REFERENCE</div>
                  <div class="reference-value">PSS</div>
                </div>
                
                <div class="customer-reference">
                  <div class="reference-label">ALTERNATE REFERENCE</div>
                  <div class="reference-value"></div>
                </div>
                
                <div class="service-type">
                  <div class="service-title">5 SERVICE TYPE</div>
                  <div class="service-note">IMPORTANT ATTACH ORIGINAL THREE COPIES OF COMMERCIAL INVOICES WITH PACKAGE FOR CUSTOM PURPOSE</div>
                  <div class="contents-label">FULL DESCRIPTION OF CONTENTS</div>
                  <div class="contents-value">${description}</div>
                  <div class="contents-label">SPECIAL INSTRUCTIONS</div>
                  <div class="contents-value">Gift</div>
                </div>
                
                <div class="size-weight">
                  <div class="size-weight-title">6 SIZE & WEIGHT</div>
                  <div class="size-weight-item">
                    <span class="size-weight-label">NO. OF PIECES:</span>
                    <span class="size-weight-value">${shipment?.amount || '1'}</span>
                  </div>
                  <div class="size-weight-item">
                    <span class="size-weight-label">WEIGHT:</span>
                    <span class="size-weight-value">${shipment?.weight || invoice?.weight || '7.500'} KGS</span>
                  </div>
                  <div class="size-weight-item">
                    <span class="size-weight-label">DIMENSIONS IN CM (LxWxH):</span>
                    <span class="size-weight-value">${shipment?.length || '0.00'} x ${shipment?.width || '0.00'} x ${shipment?.height || '0.00'}</span>
                  </div>
                  <div class="size-weight-item">
                    <span class="size-weight-label">VOLUMETRIC / CHARGED WEIGHT:</span>
                    <span class="size-weight-value">${shipment?.weightVol || '0.00'} KGS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const handleDownload = () => {
    // Create a new window with the receipt content for PDF download
    const downloadWindow = window.open('', '_blank');
    if (!downloadWindow) {
      alert('Please allow popups to download the receipt');
      return;
    }

    // Get the receipt content
    const receiptContent = document.querySelector('.receipt-content')?.innerHTML;
    if (!receiptContent) {
      alert('Could not generate receipt content');
      return;
    }

    // Create a clean HTML document for download
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PSS Receipt - ${invoice?.invoiceNumber || 'Receipt'}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .receipt-container { margin: 0; max-width: none; }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: black;
            }
            .receipt-container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
            }
            .header {
              background: #1e40af;
              color: white;
              padding: 20px;
              text-align: center;
              margin-bottom: 20px;
            }
            .logo {
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .tagline {
              font-size: 18px;
              opacity: 0.9;
            }
            .exp-badge {
              background: #dc2626;
              color: white;
              padding: 8px 16px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 18px;
              display: inline-block;
              margin-top: 10px;
            }
            .content-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0;
              min-height: 600px;
            }
            .column {
              padding: 20px;
              border-right: 1px solid #e5e7eb;
            }
            .last-column {
              padding: 20px;
              border-right: none;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              color: #374151;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .section-content {
              font-size: 11px;
              line-height: 1.4;
              color: #1f2937;
            }
            .name {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 5px;
            }
            .address {
              margin-bottom: 3px;
            }
            .contact-info {
              margin-top: 8px;
            }
            .contact-item {
              margin-bottom: 2px;
            }
            .tracking-info {
              text-align: center;
              margin-bottom: 20px;
            }
            .tracking-number {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 5px;
            }
            .origin-code {
              font-size: 18px;
              font-weight: bold;
              color: #dc2626;
              margin-bottom: 10px;
            }
            .barcode {
              background: #000;
              height: 60px;
              margin: 15px 0;
            }
            .delivery-term {
              background: #fef3c7;
              color: #92400e;
              padding: 5px 10px;
              border-radius: 4px;
              font-weight: bold;
              text-align: center;
              margin: 15px 0;
            }
            .declared-value {
              background: #f3f4f6;
              padding: 10px;
              border-radius: 4px;
              text-align: center;
              margin: 15px 0;
            }
            .value-amount {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
            }
            .service-type {
              background: #dbeafe;
              padding: 15px;
              border-radius: 6px;
              margin: 15px 0;
            }
            .service-title {
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 8px;
            }
            .service-note {
              font-size: 10px;
              color: #dc2626;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .contents {
              margin: 10px 0;
            }
            .contents-label {
              font-weight: bold;
              color: #374151;
              margin-bottom: 3px;
            }
            .contents-value {
              color: #6b7280;
            }
            .size-weight {
              background: #f9fafb;
              padding: 15px;
              border-radius: 6px;
              margin: 15px 0;
            }
            .size-weight-title {
              font-weight: bold;
              color: #374151;
              margin-bottom: 10px;
            }
            .size-weight-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .size-weight-item {
              display: flex;
              justify-content: space-between;
            }
            .size-weight-label {
              font-weight: bold;
              color: #6b7280;
            }
            .size-weight-value {
              color: #1f2937;
            }
            .customer-reference {
              background: #f0f9ff;
              padding: 10px;
              border-radius: 4px;
              margin: 10px 0;
            }
            .reference-label {
              font-weight: bold;
              color: #0369a1;
              margin-bottom: 3px;
            }
            .reference-value {
              color: #1e40af;
            }
            .copy-label {
              position: absolute;
              bottom: 10px;
              left: 20px;
              font-size: 10px;
              color: #6b7280;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
                           <div class="logo">PSS</div>
             <div class="tagline">PROMPT SURVEY & SERVICES</div>
            </div>
            ${receiptContent}
          </div>
          <script>
            // Auto-print when window loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close window after printing (optional)
                // window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    downloadWindow.document.write(htmlContent);
    downloadWindow.document.close();
  };

  const generateTrackingNumber = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading receipt...</p>
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
  const trackingNumber = generateTrackingNumber();
  
  const sender = {
    PersonName: shipment?.senderName || 'ZEESHAN AHMAD CHAUDHRY',
    CompanyName: shipment?.senderName || 'ZEESHAN AHMAD CHAUDHRY',
    Address: shipment?.senderAddress || 'H NO 6 ST NO 47 SHALAMAR BAG GULAB SINGH, LAHORE, PUNJAB, 54000, PAKISTAN',
    Phone: shipment?.senderPhone || '00923008482321',
    CNIC: '3520116573435'
  };
  
  const recipient = {
    PersonName: shipment?.recipientName || 'UJJOL MIA',
    CompanyName: shipment?.recipientName || 'UJJOL MIA',
    Address: shipment?.recipientAddress || 'AL QUWAIZI BLDG LIFT A 4 FLAT NUMBER 601 NEAR SALAHUDDIN METRO, STATION EXIT 2 DEIRA DUBAI, DUBAI, DUBAI, 1234, UNITED ARAB EMIRATES',
    Phone: shipment?.recipientPhone || '00971567640313'
  };

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const description = lineItems.length > 0 ? lineItems[0]?.description : 'WOMEN SUITS';

  return (
    <div className="min-h-screen bg-gray-50 p-4 print:p-0">
      {/* Print Header - Hidden on screen, visible when printing */}
      <div className="hidden print:block print-header bg-blue-600 text-white p-4 text-center mb-4">
        <div className="flex items-center justify-center gap-4">
          <img src="/logo_final.png" alt="PSS Logo" className="h-12 w-auto" />
          <div>
            <h1 className="text-3xl font-bold">PSS</h1>
            <p className="text-lg">PROMPT SURVEY & SERVICES</p>
          </div>
        </div>
      </div>

      {/* Action Buttons - Hidden when printing */}
      <div className="max-w-7xl mx-auto mb-6 print:hidden no-print">
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex gap-3">
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="max-w-7xl mx-auto receipt-content">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden print:shadow-none">
          {/* Header - Visible on screen, hidden when printing */}
          <div className="bg-white text-white p-6 text-center print:hidden no-print">
            <div className="flex items-center justify-center gap-4">
              <img src="/logo_final.png" alt="PSS Logo" className="h-16 w-auto" />
            </div>
          </div>

          {/* Top Gray Bar - Like in the reference image */}
          <div className="bg-white p-3 border-b border-gray-300">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="text-left">
                <span className="font-bold text-gray-700">LHE</span>
              </div>
              <div className="text-center">
                <span className="font-bold text-gray-700">{trackingNumber}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-700">CUSTOMER REFERENCE</div>
                <div className="text-sm text-gray-600">PSS</div>
                <div className="text-sm font-bold text-gray-700">ALTERNATE REFERENCE</div>
                <div className="text-sm text-gray-600"></div>
              </div>
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[800px] print:min-h-0">
            {/* Left Column - Shipper Details */}
            <div className="p-6 border-r border-gray-200 print:border-r-0">
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">1 ACCOUNT NAME</h3>
                <p className="text-gray-800">CSS Google (LHE - 420004)</p>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">2 SHIPPER</h3>
                <div className="text-gray-800">
                  <p className="font-semibold text-sm mb-1">{sender.PersonName}</p>
                  <p className="text-sm mb-1">{sender.Address}</p>
                  <div className="mt-2 text-sm">
                    <p>Contact Person: {sender.PersonName}</p>
                    <p>Phone: {sender.Phone}</p>
                    <p>CNIC/NTN: {sender.CNIC}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">3 SENDER'S AUTHORIZATION & SIGNATURE</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  I, WE AGREE THAT THE CARRIERS STANDARD TERMS AND CONDITIONS APPLY TO THIS SHIPMENT AND LIMIT CARRIERS LIABILITY. THE WARSAW CONVENTION MAY ALSO APPLY. TERMS AND CONDITIONS AVAILABLE AT WWW.SKYWWE.COM
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">SENDER'S SIGNATURE:</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">DATE:</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Received by:</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">4 PROOF OF DELIVERY (POD)</h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <span>RECEIVER'S SIGNATURE:</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>DATE:</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>PRINT NAME (CAPITAL LETTERS VERY IMPORTANT):</span>
                    <div className="flex-1 border-b border-gray-400 h-6"></div>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 font-bold print:absolute print:bottom-4 print:left-6">
                SENDER COPY
              </div>
            </div>

            {/* Right Column - Consignee and Service Details */}
            <div className="p-6">
              {/* Consignee Section */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">2 CONSIGNEE</h3>
                <div className="text-gray-800">
                  <p className="font-semibold text-sm mb-1">{recipient.PersonName}</p>
                  <p className="text-sm mb-1">{recipient.Address}</p>
                  <div className="mt-2 text-sm">
                    <p>Attention: Attn.: {recipient.PersonName}</p>
                    <p>Phone: {recipient.Phone}</p>
                    <p>IEC</p>
                  </div>
                </div>
              </div>
              
              {/* Service Type Section */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">5 SERVICE TYPE</h3>
                <div className="bg-blue-50 p-4 rounded">
                  <p className="font-semibold text-blue-600 mb-2">PSS Export Non Documents</p>
                  <p className="text-xs text-red-600 font-bold mb-3">
                    IMPORTANT ATTACH ORIGINAL THREE COPIES OF COMMERCIAL INVOICES WITH PACKAGE FOR CUSTOM PURPOSE
                  </p>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">FULL DESCRIPTION OF CONTENTS</p>
                    <p className="text-sm text-gray-600">{description}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">SPECIAL INSTRUCTIONS</p>
                    <p className="text-sm text-gray-600">Gift</p>
                  </div>
                </div>
              </div>
              
              {/* Declared Value Section */}
              <div className="bg-yellow-100 p-4 rounded text-center mb-4">
                <h4 className="text-sm font-bold text-yellow-800 mb-2">DECLARED VALUE FOR CUSTOMS AND CURRENCY</h4>
                <div className="text-lg font-bold text-yellow-800">
                  {invoice?.currency || 'USD'} {invoice?.totalAmount?.toFixed(2) || '45.00'}
                </div>
              </div>
              
              {/* Size & Weight Section */}
              <div className="bg-gray-50 p-4 rounded mb-4">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">6 SIZE & WEIGHT</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">NO. OF PIECES</span>
                    <span className="text-sm text-gray-800">{shipment?.amount || '1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">WEIGHT</span>
                    <span className="text-sm text-gray-800">{shipment?.weight || invoice?.weight || '7.500'} KGS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">DIMENSIONS IN CM LxWxH</span>
                    <span className="text-sm text-gray-800">{shipment?.length || '0.00'} x {shipment?.width || '0.00'} x {shipment?.height || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">VOLUMETRIC / CHARGED WEIGHT</span>
                    <span className="text-sm text-gray-800">{shipment?.weightVol || '0.00'} KGS</span>
                  </div>
                </div>
              </div>
              
              {/* Barcode Section */}
              <div className="text-center">
                <div className="bg-black h-16 mb-2"></div>
                <div className="font-bold text-gray-800">*{trackingNumber}*</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Footer - Hidden on screen, visible when printing */}
      <div className="hidden print:block print-footer text-center text-xs text-gray-500 mt-8">
        <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>PSS Prompt Survey & Services - Receipt</p>
      </div>
    </div>
  );
}
