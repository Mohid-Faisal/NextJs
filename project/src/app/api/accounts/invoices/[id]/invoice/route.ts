import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoiceId = parseInt(id);
    
    // Fetch invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        shipment: true,
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Generate HTML invoice content
    const htmlContent = generateInvoiceHTML(invoice);
    
    // Return HTML content as downloadable file
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="Invoice_${invoice.invoiceNumber}.html`,
      },
    });

  } catch (error) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoice: any): string {
  const shipment = invoice.shipment;
  
  // Generate HTML content - Exactly like the reference image
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PSS Payment Invoice - ${invoice.invoiceNumber}</title>
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
                    <div class="client-name">${shipment?.recipientName || 'Client Name'}</div>
                    <div>Attn: ${shipment?.recipientName || 'Contact Person'}</div>
                    <div>${shipment?.recipientAddress || 'Client Address'}</div>
                    <div>${shipment?.destination || 'Location, Country'}</div>
                </div>
                
                <div class="invoice-details">
                    <div class="invoice-number">Invoice: ${invoice.invoiceNumber}</div>
                    <div>Account Id: ${invoice.id}</div>
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
                        <td>${shipment?.trackingId || '392433508989'}</td>
                        <td></td>
                        <td>${shipment?.destination || 'United States'}</td>
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
                        <td>${(invoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
                    <span>${(invoice.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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

  return htmlContent;
}
