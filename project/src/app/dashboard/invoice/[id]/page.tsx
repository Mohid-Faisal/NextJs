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
  trackingId?: string;
  packaging?: string;
  destination?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  lineItems?: any[];
  shipment?: Shipment;
}

export default function InvoicePage() {
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
    // Create a new window with only the invoice content for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the invoice');
      return;
    }

    // Create a clean HTML document for printing - Exactly like the image
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PSS Payment Invoice - ${invoice?.invoiceNumber || 'Invoice'}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { 
                margin: 0; 
                padding: 0; 
                background: white !important;
              }
              .invoice-container { 
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
              color: #333;
            }
            .invoice {
              width: 800px;
              margin: 0 auto;
              background: white;
            }
            .header {
              padding: 20px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .header-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
            }
            .company-info {
              display: flex;
              align-items: center;
              gap: 15px;
              margin-bottom: 20px;
            }
            .logo {
              width: 48px;
              height: 48px;
              background: #1e40af;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
            }
            .company-tagline {
              font-size: 14px;
              color: #1e40af;
            }
            .client-info {
              color: #374151;
            }
            .client-name {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 5px;
            }
            .invoice-details {
              text-align: right;
              color: #374151;
            }
            .invoice-number {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .document-title {
              text-align: center;
              margin: 30px 0;
            }
            .title-text {
              font-size: 28px;
              font-weight: bold;
              color: #374151;
            }
            .charges-table {
              margin: 30px 0;
            }
            .main-table {
              width: 100%;
              border-collapse: collapse;
              background: #f3f4f6;
              border-radius: 8px 8px 0 0;
              overflow: hidden;
            }
            .main-table th {
              background: #e5e7eb;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              color: #374151;
              font-size: 12px;
            }
            .main-table td {
              padding: 12px;
              background: white;
              color: #374151;
              font-size: 12px;
            }
            .sub-table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 0 0 8px 8px;
            }
            .sub-table th {
              background: #f9fafb;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              color: #374151;
              font-size: 12px;
            }
            .sub-table th:last-child {
              text-align: right;
            }
            .sub-table td {
              padding: 12px;
              color: #374151;
              font-size: 12px;
            }
            .sub-table td:last-child {
              text-align: right;
              font-weight: bold;
            }
            .notes-summary {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin: 30px 0;
            }
            .notes-section h3 {
              font-size: 16px;
              font-weight: bold;
              color: #374151;
              text-align: center;
              margin-bottom: 15px;
            }
            .notes-text {
              font-size: 12px;
              color: #4b5563;
              line-height: 1.5;
            }
            .notes-text p {
              margin-bottom: 10px;
            }
            .summary-section {
              text-align: right;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 12px;
              color: #4b5563;
            }
            .summary-total {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              font-weight: bold;
              color: #374151;
              padding-top: 10px;
              border-top: 1px solid #d1d5db;
            }
            .terms {
              text-align: center;
              font-size: 10px;
              color: #6b7280;
              line-height: 1.4;
              margin: 30px 0;
            }
            .footer {
              background: #1e40af;
              color: white;
              padding: 20px;
              border-radius: 8px;
            }
            .footer-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
            }
            .footer-section {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .footer-icon {
              width: 24px;
              height: 24px;
              background: white;
              border-radius: 50%;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .footer-text {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .footer-subtext {
              font-size: 11px;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div class="header-content">
                <div class="company-info">
                  <div class="logo">P</div>
                  <div>
                    <div class="company-name">PSS</div>
                    <div class="company-tagline">Prompt Survey & Services</div>
                  </div>
                </div>
                
                <div class="client-info">
                  <div class="client-name">${invoice?.shipment?.recipientName || 'Client Name'}</div>
                  <div>Attn: ${invoice?.shipment?.recipientName || 'Contact Person'}</div>
                  <div>${invoice?.shipment?.recipientAddress || 'Client Address'}</div>
                  <div>${invoice?.shipment?.destination || 'Location, Country'}</div>
                </div>
                
                <div class="invoice-details">
                  <div class="invoice-number">Invoice: ${invoice?.invoiceNumber || 'Invoice'}</div>
                  <div>Account Id: ${invoice?.id || 'Account ID'}</div>
                  <div>Date: ${new Date().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit'
                  })}</div>
                </div>
              </div>
              
              <div class="document-title">
                <h1 class="title-text">Payment Invoice</h1>
              </div>
            </div>
            
            <div class="charges-table">
              <table class="main-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Tracking #</th>
                    <th>Reference #</th>
                    <th>Dest</th>
                    <th>D/W</th>
                    <th>Wght</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit'
                    })}</td>
                    <td></td>
                    <td>${invoice?.shipment?.trackingId || '392433508989'}</td>
                    <td></td>
                    <td>${invoice?.shipment?.destination || 'United States'}</td>
                    <td>${invoice?.shipment?.packaging || 'W'}</td>
                    <td>1.00</td>
                  </tr>
                </tbody>
              </table>
              
              <table class="sub-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Wpx Charges</td>
                    <td>${(invoice?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="notes-summary">
              <div class="notes-section">
                <h3>Note</h3>
                <div class="notes-text">
                  <p>Any discrepancy in invoice must be notified within 03 days of receipt of this invoice.</p>
                  <p>You are requested to pay the invoice amount through cash payment or cross cheque in favor of "PSS" with immediate effect.</p>
                </div>
              </div>
              
              <div class="summary-section">
                <div class="summary-item">
                  <span>Fsc Charges</span>
                  <span>0.00</span>
                </div>
                <div class="summary-item">
                  <span>Discount</span>
                  <span>0.00</span>
                </div>
                <div class="summary-total">
                  <span>Total</span>
                  <span>${(invoice?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            
            <div class="terms">
              No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is not responsible for any loss and damage goods.
            </div>
            
            <div class="footer">
              <div class="footer-grid">
                <div class="footer-section">
                  <div class="footer-icon">📍</div>
                  <div class="footer-text">LG-44, Land Mark Plaza</div>
                  <div class="footer-subtext">5-6 Jail Road, Lahore</div>
                </div>
                
                <div class="footer-section">
                  <div class="footer-icon">📞</div>
                  <div class="footer-text">+92 42 35716494</div>
                  <div class="footer-subtext">+92 300 8482321</div>
                </div>
                
                <div class="footer-section">
                  <div class="footer-icon">✉️</div>
                  <div class="footer-text">Info@psswwe.com</div>
                  <div class="footer-subtext">www.psswwe.com</div>
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
    // Create a new window for downloading
    const downloadWindow = window.open('', '_blank');
    if (!downloadWindow) {
      alert('Please allow popups to download the invoice');
      return;
    }

    // Create a clean HTML document for downloading - Exactly like the image
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>PSS Payment Invoice - ${invoice?.invoiceNumber || 'Invoice'}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { 
                margin: 0; 
                padding: 0; 
                background: white !important;
              }
              .invoice-container { 
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
              color: #333;
            }
            .invoice {
              width: 800px;
              margin: 0 auto;
              background: white;
            }
            .header {
              padding: 20px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .header-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
            }
            .company-info {
              display: flex;
              align-items: center;
              gap: 15px;
              margin-bottom: 20px;
            }
            .logo {
              width: 48px;
              height: 48px;
              background: #1e40af;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
            }
            .company-tagline {
              font-size: 14px;
              color: #1e40af;
            }
            .client-info {
              color: #374151;
            }
            .client-name {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 5px;
            }
            .invoice-details {
              text-align: right;
              color: #374151;
            }
            .invoice-number {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .document-title {
              text-align: center;
              margin: 30px 0;
            }
            .title-text {
              font-size: 28px;
              font-weight: bold;
              color: #374151;
            }
            .charges-table {
              margin: 30px 0;
            }
            .main-table {
              width: 100%;
              border-collapse: collapse;
              background: #f3f4f6;
              border-radius: 8px 8px 0 0;
              overflow: hidden;
            }
            .main-table th {
              background: #e5e7eb;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              color: #374151;
              font-size: 12px;
            }
            .main-table td {
              padding: 12px;
              background: white;
              color: #374151;
              font-size: 12px;
            }
            .sub-table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 0 0 8px 8px;
            }
            .sub-table th {
              background: #f9fafb;
              padding: 12px;
              text-align: left;
              font-weight: bold;
              color: #374151;
              font-size: 12px;
            }
            .sub-table th:last-child {
              text-align: right;
            }
            .sub-table td {
              padding: 12px;
              color: #374151;
              font-size: 12px;
            }
            .sub-table td:last-child {
              text-align: right;
              font-weight: bold;
            }
            .notes-summary {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin: 30px 0;
            }
            .notes-section h3 {
              font-size: 16px;
              font-weight: bold;
              color: #374151;
              text-align: center;
              margin-bottom: 15px;
            }
            .notes-text {
              font-size: 12px;
              color: #4b5563;
              line-height: 1.5;
            }
            .notes-text p {
              margin-bottom: 10px;
            }
            .summary-section {
              text-align: right;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 12px;
              color: #4b5563;
            }
            .summary-total {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              font-weight: bold;
              color: #374151;
              padding-top: 10px;
              border-top: 1px solid #d1d5db;
            }
            .terms {
              text-align: center;
              font-size: 10px;
              color: #6b7280;
              line-height: 1.4;
              margin: 30px 0;
            }
            .footer {
              background: #1e40af;
              color: white;
              padding: 20px;
              border-radius: 8px;
            }
            .footer-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
            }
            .footer-section {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .footer-icon {
              width: 24px;
              height: 24px;
              background: white;
              border-radius: 50%;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .footer-text {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .footer-subtext {
              font-size: 11px;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div class="header-content">
                <div class="company-info">
                  <div class="logo">P</div>
                  <div>
                    <div class="company-name">PSS</div>
                    <div class="company-tagline">Prompt Survey & Services</div>
                  </div>
                </div>
                
                <div class="client-info">
                  <div class="client-name">${invoice?.shipment?.recipientName || 'Client Name'}</div>
                  <div>Attn: ${invoice?.shipment?.recipientName || 'Contact Person'}</div>
                  <div>${invoice?.shipment?.recipientAddress || 'Client Address'}</div>
                  <div>${invoice?.shipment?.destination || 'Location, Country'}</div>
                </div>
                
                <div class="invoice-details">
                  <div class="invoice-number">Invoice: ${invoice?.invoiceNumber || 'Invoice'}</div>
                  <div>Account Id: ${invoice?.id || 'Account ID'}</div>
                  <div>Date: ${new Date().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit'
                  })}</div>
                </div>
              </div>
              
              <div class="document-title">
                <h1 class="title-text">Payment Invoice</h1>
              </div>
            </div>
            
            <div class="charges-table">
              <table class="main-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt #</th>
                    <th>Tracking #</th>
                    <th>Reference #</th>
                    <th>Dest</th>
                    <th>D/W</th>
                    <th>Wght</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit'
                    })}</td>
                    <td></td>
                    <td>${invoice?.shipment?.trackingId || '392433508989'}</td>
                    <td></td>
                    <td>${invoice?.shipment?.destination || 'United States'}</td>
                    <td>W</td>
                    <td>1.00</td>
                  </tr>
                </tbody>
              </table>
              
              <table class="sub-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Wpx Charges</td>
                    <td>${(invoice?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="notes-summary">
              <div class="notes-section">
                <h3>Note</h3>
                <div class="notes-text">
                  <p>Any discrepancy in invoice must be notified within 03 days of receipt of this invoice.</p>
                  <p>You are requested to pay the invoice amount through cash payment or cross cheque in favor of "PSS" with immediate effect.</p>
                </div>
              </div>
              
              <div class="summary-section">
                <div class="summary-item">
                  <span>Fsc Charges</span>
                  <span>0.00</span>
                </div>
                <div class="summary-item">
                  <span>Discount</span>
                  <span>0.00</span>
                </div>
                <div class="summary-total">
                  <span>Total</span>
                  <span>${(invoice?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            
            <div class="terms">
              No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is not responsible for any loss and damage goods.
            </div>
            
            <div class="footer">
              <div class="footer-grid">
                <div class="footer-section">
                  <div class="footer-icon">📍</div>
                  <div class="footer-text">LG-44, Land Mark Plaza</div>
                  <div class="footer-subtext">5-6 Jail Road, Lahore</div>
                </div>
                
                <div class="footer-section">
                  <div class="footer-icon">📞</div>
                  <div class="footer-text">+92 42 35716494</div>
                  <div class="footer-subtext">+92 300 8482321</div>
                </div>
                
                <div class="footer-section">
                  <div class="footer-icon">✉️</div>
                  <div class="footer-text">Info@psswwe.com</div>
                  <div class="footer-subtext">www.psswwe.com</div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    downloadWindow.document.write(htmlContent);
    downloadWindow.document.close();

    // Wait for content to load, then trigger print dialog (which allows saving as PDF)
    downloadWindow.onload = () => {
      downloadWindow.print();
      // Keep the window open for a moment to allow user to save as PDF
      setTimeout(() => {
        downloadWindow.close();
      }, 1000);
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
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
  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const hasLineItems = lineItems.length > 0;

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
              Print Invoice
            </Button>
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-7xl mx-auto invoice-content">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden print:shadow-none">
          {/* Header Section - Exactly like the image */}
          <div className="p-8 print:p-4">
            <div className="flex justify-between items-start mb-8">
              {/* Left Side - Company Branding & Client Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/logo_final.png" alt="PSS Logo" className="h-12 w-auto" />
                  <div>
                    <h1 className="text-3xl font-bold text-blue-800">PSS</h1>
                    <p className="text-lg text-blue-700">Prompt Survey & Services</p>
                  </div>
                </div>
                
                <div className="text-gray-800">
                  <p className="font-semibold text-lg mb-1">{shipment?.recipientName || 'Client Name'}</p>
                  <p className="text-gray-600 mb-1">Attn: {shipment?.recipientName || 'Contact Person'}</p>
                  <p className="text-gray-600 mb-1">{shipment?.recipientAddress || 'Client Address'}</p>
                  <p className="text-gray-600">{shipment?.destination || 'Location, Country'}</p>
                </div>
              </div>
              
              {/* Right Side - Invoice Details */}
              <div className="text-right text-gray-800">
                <p className="text-lg font-semibold mb-1">Invoice: {invoice.invoiceNumber}</p>
                <p className="text-gray-600 mb-1">Account Id: {invoice.id}</p>
                <p className="text-gray-600">Date: {new Date().toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit'
                })}</p>
              </div>
            </div>
            
            {/* Document Title - Centered */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Payment Invoice</h2>
            </div>
          </div>

          {/* Charges Table Section - Exactly like the image */}
          <div className="px-8 pb-8 print:px-4">
            {/* Main Charges Table */}
            <div className="bg-gray-100 rounded-t-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Receipt #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tracking #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reference #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dest</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">D/W</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Wght</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm text-gray-800">{new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit'
                    })}</td>
                    <td className="px-4 py-3 text-sm text-gray-800"></td>
                    <td className="px-4 py-3 text-sm text-gray-800">{shipment?.trackingId || '392433508989'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800"></td>
                    <td className="px-4 py-3 text-sm text-gray-800">{shipment?.destination || 'United States'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">W</td>
                    <td className="px-4 py-3 text-sm text-gray-800">1.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Description and Value Sub-Table */}
            <div className="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-800">Wpx Charges</td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right font-semibold">
                      {(invoice?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes and Summary Section - Exactly like the image */}
          <div className="px-8 pb-8 print:px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side - Notes */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 text-center mb-4">Note</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <p>Any discrepancy in invoice must be notified within 03 days of receipt of this invoice.</p>
                  <p>You are requested to pay the invoice amount through cash payment or cross cheque in favor of "PSS" with immediate effect.</p>
                </div>
              </div>
              
              {/* Right Side - Summary of Charges */}
              <div className="text-right">
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Fsc Charges</span>
                    <span>0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>0.00</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-300">
                    <span>Total</span>
                    <span>{(invoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions - Exactly like the image */}
          <div className="px-8 pb-8 print:px-4">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is not responsible for any loss and damage goods.
            </p>
          </div>

          {/* Footer Section - Exactly like the image */}
          <div className="bg-blue-600 text-white p-6 print:p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {/* Left Section - Location */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                <p className="text-sm font-semibold">LG-44, Land Mark Plaza</p>
                <p className="text-sm opacity-90">5-6 Jail Road, Lahore</p>
              </div>
              
              {/* Middle Section - Phone */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                </div>
                <p className="text-sm font-semibold">+92 42 35716494</p>
                <p className="text-sm opacity-90">+92 300 8482321</p>
              </div>
              
              {/* Right Section - Email/Website */}
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mb-2">
                  <div className="w-3 h-2 bg-blue-600 rounded-sm"></div>
                </div>
                <p className="text-sm font-semibold">Info@psswwe.com</p>
                <p className="text-sm opacity-90">www.psswwe.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Footer - Hidden on screen, visible when printing */}
      <div className="hidden print:block print-footer text-center text-xs text-gray-500 mt-8">
        <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <p>PSS Prompt Survey & Services - Payment Invoice</p>
      </div>
    </div>
  );
}
