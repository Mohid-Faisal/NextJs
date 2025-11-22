'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCountryNameFromCode } from '@/lib/utils';
import { format } from 'date-fns';

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
        setInvoice(data.invoice);
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
    if (!invoice) {
      alert('Invoice data not available');
      return;
    }

    // Get the receipt container HTML
    const receiptContainer = document.querySelector('.receipt-container');
    if (!receiptContainer) {
      alert('Receipt content not found');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    // Get the receipt HTML content
    const receiptHTML = receiptContainer.innerHTML;

    // Create a complete HTML document for printing
    const printHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt ${invoice.invoiceNumber}</title>
          <style>
            :root {
              --primary-color: #2563eb;
              --text-dark: #1e293b;
              --text-light: #64748b;
              --border-color: #e2e8f0;
              --bg-color: #f8fafc;
            }

            * {
              box-sizing: border-box;
                margin: 0; 
                padding: 0; 
            }

            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background-color: white;
              color: var(--text-dark);
              line-height: 1.5;
              padding: 20px;
            }

            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              box-shadow: none;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid var(--border-color);
            }

            .company-branding img {
              height: 45px;
              width: auto;
              margin-bottom: 6px;
            }

            .company-branding h1 {
              color: var(--primary-color);
              font-size: 24px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }

            .company-branding p {
              font-size: 14px;
              color: var(--text-light);
              margin-top: 4px;
              font-weight: 600;
            }

            .invoice-details {
              text-align: right;
            }

            .invoice-details h2 {
              font-size: 20px;
              color: var(--text-dark);
              margin-bottom: 5px;
            }

            .tag {
              display: inline-block;
              background: #dbeafe;
              color: #1e40af;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }

            .route-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              gap: 20px;
            }

            .address-box {
              flex: 1;
            }

            .address-box h3 {
              font-size: 12px;
              text-transform: uppercase;
              color: var(--text-light);
              margin-bottom: 8px;
              letter-spacing: 1px;
            }

            .address-box strong {
              display: block;
              font-size: 16px;
              margin-bottom: 4px;
            }

            .address-box p {
              font-size: 14px;
              color: var(--text-light);
            }

            .details-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 6px;
              border: 1px solid var(--border-color);
              margin-bottom: 30px;
            }

            .detail-item h4 {
              font-size: 11px;
              text-transform: uppercase;
              color: var(--text-light);
              margin-bottom: 4px;
            }

            .detail-item p {
              font-weight: 600;
              font-size: 15px;
            }

            .table-container {
              margin-bottom: 30px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            th {
              text-align: left;
              padding: 12px;
              font-size: 12px;
              text-transform: uppercase;
              color: var(--text-light);
              border-bottom: 1px solid var(--border-color);
            }

            td {
              padding: 12px;
              font-size: 14px;
              border-bottom: 1px solid var(--border-color);
            }

            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }

            .footer-section {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-top: 20px;
            }

            .barcode-area {
              text-align: center;
            }

            .barcode {
              height: 40px;
              width: 200px;
              background: repeating-linear-gradient(
                to right,
                #000 0,
                #000 2px,
                #fff 2px,
                #fff 4px,
                #000 4px,
                #000 8px,
                #fff 8px,
                #fff 9px
              );
              margin-bottom: 5px;
            }

            .totals-area {
              width: 250px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }

            .total-row.final {
              border-top: 2px solid var(--text-dark);
              margin-top: 8px;
              padding-top: 12px;
              font-weight: 800;
              font-size: 18px;
              color: var(--primary-color);
            }

            @media print {
              body {
                padding: 0;
                margin: 0;
                background: white;
                height: auto;
              }
              .receipt-container {
                box-shadow: none;
                padding: 15px;
                max-width: 100%;
                margin: 0;
                page-break-inside: avoid;
                page-break-after: avoid;
              }
              @page {
                size: landscape;
                margin: 0.5cm;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${receiptHTML}
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
  const trackingNumber = shipment?.trackingId || invoice.invoiceNumber;
  
  // Format sender address
  const senderName = shipment?.senderName || invoice.customer?.CompanyName || invoice.customer?.PersonName || 'N/A';
  const senderAddress = shipment?.senderAddress || invoice.customer?.Address || '';
  const senderCity = invoice.customer?.City || '';
  const senderState = invoice.customer?.State || '';
  const senderCountry = invoice.customer?.Country ? getCountryNameFromCode(invoice.customer.Country) : '';
  const senderZip = invoice.customer?.Zip || '';
  
  // Format recipient address (from shipment)
  const recipientName = shipment?.recipientName || 'N/A';
  const recipientAddress = shipment?.recipientAddress || '';
  const recipientCountry = shipment?.destination ? getCountryNameFromCode(shipment.destination) : '';
  
  // Format invoice date
  const invoiceDate = invoice.invoiceDate 
    ? format(new Date(invoice.invoiceDate), 'MMM dd, yyyy')
    : format(new Date(), 'MMM dd, yyyy');
  
  // Get status
  const status = invoice.status || 'Pending';
  const statusColor = status === 'Paid' ? '#10b981' : status === 'Pending' ? '#f59e0b' : '#ef4444';
  
  // Get line items - they use 'value' field, not 'total' or 'amount'
  // Line items don't include fuel surcharge and discount (they're separate fields)
  const lineItems = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [
        {
          description: 'Shipping Service',
          value: invoice.totalAmount || 0
        }
      ];
  
  // Calculate subtotal from line items using 'value' field
  const subtotal = lineItems.reduce((sum: number, item: any) => {
    return sum + (item.value || 0);
  }, 0);
  
  // Get fuel surcharge and discount amounts directly (they're stored as amounts, not percentages)
  const fscAmount = invoice.fscCharges || 0;
  const discountAmount = invoice.discount || 0; // This is already an amount, not a percentage
  const taxAmount = 0; // Add tax calculation if needed
  
  // Calculate final total: subtotal + fuel surcharge - discount + tax
  // This matches the invoice generation logic: lineItemsTotal + fscCharges - discount
  const total = subtotal + fscAmount - discountAmount + taxAmount;
  
  // Format dimensions
  const dimensions = shipment?.length && shipment?.width && shipment?.height
    ? `${shipment.length}x${shipment.width}x${shipment.height} cm`
    : 'N/A';
  
  // Get service type
  const serviceType = shipment?.serviceMode || shipment?.packaging || 'Standard';

  return (
    <div className="w-full p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <style jsx>{`
        .receipt-wrapper {
          --primary-color: #2563eb;
          --text-dark: #1e293b;
          --text-light: #64748b;
          --border-color: #e2e8f0;
          --bg-color: #f8fafc;
        }

        .receipt-wrapper .receipt-container {
          max-width: 800px;
              margin: 0 auto;
              background: white;
          padding: 40px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .receipt-wrapper .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--border-color);
        }

        .receipt-wrapper .company-branding img {
          height: 45px;
          width: auto;
          margin-bottom: 6px;
        }

        .receipt-wrapper .company-branding h1 {
          color: var(--primary-color);
          font-size: 24px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: -0.5px;
        }

        .receipt-wrapper .company-branding p {
          font-size: 14px;
          color: var(--text-light);
          margin-top: 4px;
          font-weight: 600;
        }

        .receipt-wrapper .invoice-details {
          text-align: right;
        }

        .receipt-wrapper .invoice-details h2 {
          font-size: 20px;
          color: var(--text-dark);
              margin-bottom: 5px;
            }

        .receipt-wrapper .tag {
          display: inline-block;
          background: #dbeafe;
          color: #1e40af;
          padding: 4px 8px;
              border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .receipt-wrapper .route-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          gap: 20px;
        }

        .receipt-wrapper .address-box {
          flex: 1;
        }

        .receipt-wrapper .address-box h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-light);
              margin-bottom: 8px;
          letter-spacing: 1px;
        }

        .receipt-wrapper .address-box strong {
          display: block;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .receipt-wrapper .address-box p {
          font-size: 14px;
          color: var(--text-light);
        }

        .receipt-wrapper .details-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          background-color: #f8fafc;
          padding: 20px;
              border-radius: 6px;
          border: 1px solid var(--border-color);
          margin-bottom: 30px;
        }

        .receipt-wrapper .detail-item h4 {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-bottom: 4px;
        }

        .receipt-wrapper .detail-item p {
          font-weight: 600;
          font-size: 15px;
        }

        .receipt-wrapper .table-container {
          margin-bottom: 30px;
        }

        .receipt-wrapper table {
          width: 100%;
          border-collapse: collapse;
        }

        .receipt-wrapper th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-light);
          border-bottom: 1px solid var(--border-color);
        }

        .receipt-wrapper td {
          padding: 12px;
          font-size: 14px;
          border-bottom: 1px solid var(--border-color);
        }

        .receipt-wrapper .text-right { text-align: right; }
        .receipt-wrapper .font-bold { font-weight: 700; }

        .receipt-wrapper .footer-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 20px;
        }

        .receipt-wrapper .barcode-area {
          text-align: center;
        }

        .receipt-wrapper .barcode {
          height: 40px;
          width: 200px;
          background: repeating-linear-gradient(
            to right,
            #000 0,
            #000 2px,
            #fff 2px,
            #fff 4px,
            #000 4px,
            #000 8px,
            #fff 8px,
            #fff 9px
          );
          margin-bottom: 5px;
        }

        .receipt-wrapper .totals-area {
          width: 250px;
        }

        .receipt-wrapper .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }

        .receipt-wrapper .total-row.final {
          border-top: 2px solid var(--text-dark);
          margin-top: 8px;
          padding-top: 12px;
          font-weight: 800;
          font-size: 18px;
          color: var(--primary-color);
        }

        .receipt-print-btn {
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

        .receipt-print-btn:hover {
          transform: translateY(-2px);
          background: #059669;
        }

        .receipt-back-btn {
          position: fixed;
          bottom: 30px;
          left: 30px;
          z-index: 1000;
        }

        @media print {
          .receipt-wrapper .receipt-container {
            box-shadow: none;
            padding: 0;
            width: 100%;
            max-width: 100%;
          }
          .receipt-print-btn, .receipt-back-btn {
            display: none !important;
          }
        }
      `}</style>

      <div className="receipt-wrapper">
        <div className="receipt-container">
          {/* Header */}
          <header className="header">
          <div className="company-branding">
            <img src="/logo_final.png" alt="PSS Logo" style={{height: '45px', width: 'auto', marginBottom: '6px'}} />
            <br></br>
            <p style={{fontSize: '12px', marginTop: '2px'}}>Global Shipping Solutions</p>
          </div>
          <div className="invoice-details">
            <h2>RECEIPT #{invoice.invoiceNumber}</h2>
            <p>Date: {invoiceDate}</p>
            <span className="tag" style={{background: status === 'Paid' ? '#d1fae5' : status === 'Pending' ? '#fef3c7' : '#fee2e2', color: status === 'Paid' ? '#065f46' : status === 'Pending' ? '#92400e' : '#991b1b'}}>
              {status}
            </span>
              </div>
        </header>

        {/* Address Route */}
        <section className="route-section">
          <div className="address-box">
            <h3>From (Sender)</h3>
            <strong>{senderName}</strong>
            {senderAddress && <p>{senderAddress}</p>}
            {(senderCity || senderState || senderZip) && (
              <p>
                {[senderCity, senderState, senderZip].filter(Boolean).join(', ')}
                {senderCountry && `, ${senderCountry}`}
              </p>
            )}
            {!senderAddress && !senderCity && <p>{senderCountry || 'N/A'}</p>}
                  </div>
          <div className="address-box" style={{textAlign: 'right'}}>
            <h3>To (Receiver)</h3>
            <strong>{recipientName}</strong>
            {recipientAddress && <p>{recipientAddress}</p>}
            {recipientCountry && <p>{recipientCountry}</p>}
            {!recipientAddress && !recipientCountry && <p>N/A</p>}
                  </div>
        </section>

        {/* Shipment Specifics */}
        <section className="details-grid">
          <div className="detail-item">
            <h4>Tracking Number</h4>
            <p>{trackingNumber}</p>
                  </div>
          <div className="detail-item">
            <h4>Service Type</h4>
            <p>{serviceType}</p>
                  </div>
          <div className="detail-item">
            <h4>Total Weight</h4>
            <p>{shipment?.weight || invoice.weight || 0} kg</p>
                  </div>
          <div className="detail-item">
            <h4>Dimensions</h4>
            <p>{dimensions}</p>
                </div>
        </section>

        {/* Itemized List */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item: any, index: number) => {
                // Line items use 'value' field, not 'total', 'amount', 'unitPrice', or 'price'
                const itemValue = item.value || 0;
                const quantity = item.quantity || 1;
                const unitPrice = quantity > 0 ? itemValue / quantity : itemValue;
                
                return (
                  <tr key={index}>
                    <td>
                      <strong>{item.description || item.name || 'Shipping Service'}</strong>
                      {item.note && (
                        <>
                          <br />
                          <span style={{color: '#64748b', fontSize: '12px'}}>{item.note}</span>
                        </>
                      )}
                    </td>
                    <td className="text-right">{quantity}</td>
                    <td className="text-right">
                      {invoice.currency || 'USD'} {unitPrice.toFixed(2)}
                    </td>
                    <td className="text-right">
                      {invoice.currency || 'USD'} {itemValue.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
              </div>
              
        {/* Footer */}
        <div className="footer-section">
          <div className="barcode-area">
            <div className="barcode"></div>
            <p style={{fontSize: '12px', letterSpacing: '2px'}}>{trackingNumber}</p>
            <p style={{fontSize: '10px', color: '#94a3b8', marginTop: '10px'}}>Thank you for your business!</p>
              </div>
              
          <div className="totals-area">
            <div className="total-row">
              <span>Subtotal</span>
              <span>{invoice.currency || 'USD'} {subtotal.toFixed(2)}</span>
                </div>
            {invoice.fscCharges && invoice.fscCharges > 0 && (
              <div className="total-row">
                <span>Fuel Surcharge</span>
                <span>{invoice.currency || 'USD'} {fscAmount.toFixed(2)}</span>
              </div>
            )}
            {invoice.discount && invoice.discount > 0 && (
              <div className="total-row">
                <span>Discount</span>
                <span>-{invoice.currency || 'USD'} {discountAmount.toFixed(2)}</span>
                  </div>
            )}
            {taxAmount > 0 && (
              <div className="total-row">
                <span>Tax</span>
                <span>{invoice.currency || 'USD'} {taxAmount.toFixed(2)}</span>
                  </div>
            )}
            <div className="total-row final">
              <span>Total Paid</span>
              <span>{invoice.currency || 'USD'} {total.toFixed(2)}</span>
                  </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Print Button */}
      <button className="receipt-print-btn" onClick={handlePrint}>
        Print Receipt
      </button>

      {/* Back Button */}
      <div className="receipt-back-btn">
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
