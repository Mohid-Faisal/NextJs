import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invID = searchParams.get('invID');
    const formData = searchParams.get('data');
    const format = searchParams.get('format');
    const print = searchParams.get('print');
    const shipmentId = id;
    
    console.log('API called with:', { shipmentId, invID, hasFormData: !!formData });
    
    if (!invID) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    let invoice;
    
    // If form data is provided, use it instead of fetching from database
    if (formData) {
      try {
        invoice = JSON.parse(formData);
        console.log('Using form data for invoice generation');
        console.log('Form data invoice:', JSON.stringify(invoice, null, 2));
      } catch (e) {
        console.error('Error parsing form data:', e);
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
      }
    } else {
      // Fetch invoice data from database
      invoice = await prisma.invoice.findFirst({
      where: {
        id: parseInt(invID),
        shipmentId: parseInt(shipmentId)
      },
      include: {
        shipment: true,
        customer: true,
        vendor: true
      }
    });

    if (!invoice) {
      console.log('No invoice found for:', { shipmentId, invID });
      return NextResponse.json({ 
        error: 'Invoice not found', 
        details: { shipmentId, invID } 
      }, { status: 404 });
    }
    }

    console.log('Invoice data:', { id: invoice.id, invoiceNumber: invoice.invoiceNumber });
    console.log('Shipment data:', invoice.shipment);
    console.log('Shipment packages:', invoice.shipment?.packages);

    // Parse line items from JSON or use form data
    let lineItems = [];
    if (formData) {
      // Use line items from form data
      lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems as any[] : [];
      console.log('Using line items from form data:', lineItems);
      console.log('Line items count:', lineItems.length);
      console.log('First line item:', lineItems[0]);
    } else {
      // Parse line items from database
      lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems as any[] : [];
      console.log('Using line items from database:', lineItems);
    }

    // Parse packages from shipment JSON string or use form data
    let packages = [];
    let calculatedValues = {};
    
    if (formData) {
      // Use packages and calculated values from form data
      packages = invoice.shipment?.packages || [];
      calculatedValues = invoice.shipment?.calculatedValues || {};
      console.log('Using packages from form data:', packages);
      console.log('Using calculated values from form data:', calculatedValues);
    } else {
      // Parse from database JSON strings
      if (invoice.shipment) {
        // Parse packages JSON string
        if (invoice.shipment.packages && typeof invoice.shipment.packages === 'string') {
          try {
            packages = JSON.parse(invoice.shipment.packages);
          } catch (e) {
            console.error('Error parsing packages JSON:', e);
          }
        }
        
        // Parse calculated values JSON string
        if (invoice.shipment.calculatedValues && typeof invoice.shipment.calculatedValues === 'string') {
          try {
            calculatedValues = JSON.parse(invoice.shipment.calculatedValues);
          } catch (e) {
            console.error('Error parsing calculated values JSON:', e);
          }
        }
      }
      console.log('Parsed packages from database:', packages);
      console.log('Parsed calculated values from database:', calculatedValues);
    }

    // Convert logo and footer to base64
    const logoBase64 = getLogoAsBase64();
    const footerBase64 = getFooterAsBase64();
    
    // Generate HTML invoice content
    const htmlContent = generateInvoiceHTML(invoice, lineItems, packages, calculatedValues, logoBase64, footerBase64, !!formData, print);
    
    // Return HTML content for display (not as download)
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
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

function getLogoAsBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo_final.png');
    const logoBuffer = fs.readFileSync(logoPath);
    const base64 = logoBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error reading logo file:', error);
    // Return a placeholder or empty string if logo can't be read
    return '';
  }
}

function getFooterAsBase64(): string {
  try {
    const footerPath = path.join(process.cwd(), 'public', 'footer.png');
    const footerBuffer = fs.readFileSync(footerPath);
    const base64 = footerBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error reading footer file:', error);
    // Return a placeholder or empty string if footer can't be read
    return '';
  }
}

function generateInvoiceHTML(invoice: any, lineItems: any[], packages: any[], calculatedValues: any, logoBase64: string, footerBase64: string, formData: boolean, printParam: string | null): string {
  const shipment = invoice.shipment;
  const customer = invoice.customer;
  const vendor = invoice.vendor;
  
  // Format dates like PHP
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  };

  // Generate line items HTML
  console.log('Generating line items HTML for:', lineItems);
  console.log('Form data present:', !!formData);
  console.log('Line items length:', lineItems.length);
  console.log('Packages length:', packages.length);
  
  const lineItemsHTML = lineItems.map((item, index) => 
    `<tr>
      <td colspan="2">${item.description || 'Service Item'}</td>
      <td>$${vendor ? 
        (calculatedValues.vendorPrice || item.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
        (item.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }</td>
    </tr>`
  ).join('');
  console.log('Generated line items HTML:', lineItemsHTML);
  
  // Debug template decision
  const useLineItems = formData && lineItems.length > 0;
  const usePackages = !useLineItems && packages.length > 0;
  console.log('Template decision - useLineItems:', useLineItems, 'usePackages:', usePackages);
  
  // Debug total calculation
  console.log('Invoice totalAmount:', invoice.totalAmount);
  console.log('Calculated values:', calculatedValues);
  console.log('Shipment totalCost:', shipment?.totalCost);

  // Generate HTML content using PHP shipping invoice format
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>PSS Payment Invoice - ${invoice.invoiceNumber}</title>
  <!-- Tell the browser to be responsive to screen width -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap 4 -->
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
  <!-- Ionicons -->
  <link rel="stylesheet" href="https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css">
  <!-- AdminLTE CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/css/adminlte.min.css">
  <!-- Google Font: Source Sans Pro -->
  <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700" rel="stylesheet">
  <!-- JsBarcode for barcode generation -->
  <script src="https://unpkg.com/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  
  <style type="text/css">
    .invoice{
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .invoice-content {
      flex: 1;
      padding-bottom: 20px;
    }
    .footer-container {
      margin-top: auto;
      width: 100%;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .invoice { 
        margin: 0; 
        padding: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .invoice-content {
        flex: 1;
        padding-bottom: 20px;
      }
      .footer-container {
        margin-top: auto;
        width: 100%;
        page-break-inside: avoid;
      }
      thead>tr>th, th{
        background-color: #999 !important;
      }
      .no-print { display: none !important; }
      @page { 
        margin: 0.5in; 
        size: A4;
      }
    }
    #barcode {
      min-width: 300px;
      min-height: 120px;
      display: inline-block;
    }
    #barcode svg {
      max-width: 300px;
      height: 120px;
    }
    #barcode canvas {
      max-width: 300px;
      height: 120px;
    }
    .barcode-fallback {
      font-family: 'Courier New', monospace;
      font-size: 8px;
      line-height: 1;
      letter-spacing: 1px;
      color: #000;
      background: #fff;
      padding: 5px;
      border: 1px solid #ccc;
    }
    .barcode-lines {
      display: inline-block;
      height: 40px;
      background: repeating-linear-gradient(
        90deg,
        #000 0px,
        #000 2px,
        transparent 2px,
        transparent 3px
      );
      background-size: 4px 100%;
    }
  </style>
</head>
<body class="hold-transition sidebar-mini layout-fixed">
<div class="wrapper">
  <!-- Main content -->
  <section class="invoice">
    <div class="invoice-content">
    <!-- title row -->
    <div class="row" style="display: flex; align-items: center;">
      <div class="col-8">
        <h2 class="page-header" style="margin-bottom: 0;">
          ${logoBase64 ? `<img src="${logoBase64}" width="300px" alt="PSS Logo">` : '<img src="img/VC.png" width="300px" alt="PSS Logo">'}
        </h2>
      </div>
      <div class="col-4" style="text-align: right; display: flex; align-items: center; justify-content: flex-end;">
        <div style="display: inline-block; text-align: center;">
          <div id="barcode" style="margin-bottom: 10px; display: inline-block; min-width: 300px; min-height: 120px; text-align: center;">
            <div class="barcode-fallback">
              <div style="font-size: 10px; margin-bottom: 3px;">Barcode</div>
              <div class="barcode-lines" style="width: 180px; margin: 2px 0;"></div>
              <div style="font-size: 12px; font-weight: bold; margin-top: 3px;">${invoice.invoiceNumber}</div>
            </div>
          </div>
        </div>
      </div>
      <!-- /.col -->
    </div>
    
    <!-- Break line below logo and barcode -->
    <div class="row">
      <div class="col-12">
        <hr style="border: 1px solid #ddd; margin: 20px 0;">
      </div>
    </div>

    <!-- info row -->
    <div class="row invoice-info">
      <div class="col-sm-9 invoice-col">
        <address>
          <strong>${vendor ? (vendor.CompanyName || vendor.name || 'Vendor Name') : (customer?.CompanyName || 'Customer Name')}</strong><br>
          Attn: ${vendor ? (vendor.PersonName || vendor.contactPerson || 'Contact Person') : (customer?.PersonName || 'Contact Person')} <br>
          ${vendor ? (vendor.Address || vendor.address || 'Vendor Address') : (customer?.Address || 'Customer Address')}<br>
          ${vendor ? (vendor.City || vendor.city || '') : (customer?.City || '')}, ${vendor ? (vendor.Country || vendor.country || '') : (customer?.Country || '')}<br>
        </address>
      </div>
      <!-- /.col -->
      
      <div class="col-sm-3 invoice-col">
        <p style="margin-bottom: 0;"><b>Invoice: </b> <span style="float: right;"> ${invoice.invoiceNumber}</span></p>
        <p style="margin-bottom: 0;"><b>Account Id: </b><span style="float: right;"> ${vendor ? (vendor.id || 'N/A') : (customer?.id || 'N/A')}</span></p>
        <p style="margin-bottom: 0;"><b>Date :</b> <span style="float: right;"> ${formatDate(invoice.createdAt)}</span></p>
      </div>
      <!-- /.col -->
    </div>
    <!-- /.row -->

    <div class="row">
      <div class="col-12 table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th class="text-center"> <h3> Payment Invoice</h3></th>
            </tr>
          </thead>
        </table>
      </div>
      <!-- /.col -->
    </div>

    <br/>

    <!-- Job Headings -->
    <div class="row">
      <div class="col-12 table-responsive">
        <table class="table">
          <thead style="background-color: #999 !important;">
            <tr style="background-color: #999 !important;">
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
            <td>${formatDate(shipment?.createdAt || invoice.createdAt)}</td>
            <td>${shipment?.invoiceNumber || shipment?.id || 'N/A'}</td>
            <td>${shipment?.trackingId || 'N/A'}</td>
            <td>${shipment?.referenceNumber || invoice.referenceNumber || 'N/A'}</td>
            <td>${shipment?.destination || 'N/A'}</td>
            <td>${shipment?.dayWeek ? 'D' : 'W'}</td>
            <td>${packages.length > 0 ? packages[0].weight || 'N/A' : 'N/A'}</td>
          </tr>
          </tbody>
        </table>
      </div>
      <!-- /.col -->
    </div>
    <!-- /.row -->

    <br/>
    <br/>

    <!-- Table row -->
    <div class="row">
      <div class="col-12 table-responsive">
        <table class="table table-striped">
          <thead>
          <tr>
            <th colspan="2">Description</th>
            <th>Value</th>
          </tr>
          </thead>
          <tbody>
          ${formData && lineItems.length > 0 ? lineItemsHTML : packages.length > 0 ? packages.map((pkg, index) => `
          <tr>
            <td colspan="2">${pkg.packageDescription || 'Shipping Package'}</td>
            <td>$${vendor ? 
              ((calculatedValues.vendorPrice || calculatedValues.total || 0) / packages.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
              ((calculatedValues.total || calculatedValues.subtotal || 0) / packages.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }</td>
          </tr>
          `).join('') : lineItems.length > 0 ? lineItemsHTML : `
          <tr>
            <td colspan="2">No items available</td>
            <td>$0.00</td>
          </tr>
          `}
          </tbody>

          <tfoot>
            <tr>
              <th colspan="3">&nbsp;</th>
            </tr>
            <tr>
              <th style="width:60%; background-color: #ccc; font-size: 22px; color: #fff;" class="text-center">
                Note
              </th>
              <th colspan="2"></th>
            </tr>
            <tr>
              <th style="width:60%;" rowspan="4">
                ${invoice.disclaimer || 'Any discrepancy in invoice must be notified within 03 days of receipt of this invoice.You are requested to pay the invoice amount through cash payment or cross cheque in favor of "PSS" with immediate effect.'}
              </th>
              <th>Fsc Charges</th>
              <td>$${(shipment?.fuelSurcharge || invoice.fscCharges || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            
            <tr>
              <th class="">Discount</th>
              <td>$${(shipment?.discount || invoice.discount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            
            <tr>
              <th style="font-size: 20px;"> Total</th>
              <td style="font-size: 20px;"><b>$${vendor ? 
                (invoice.totalAmount || calculatedValues.vendorPrice || shipment?.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                (invoice.totalAmount || calculatedValues.total || shipment?.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }</b></td>
            </tr>
            
          </tfoot>
          </table>
        </div>
      <!-- /.col -->
    </div>
    <!-- /.row -->

    <div style="margin-top: 40px;" class="row">
      <!-- accepted payments column -->
      <div style="font-weight: bold;" class="col-12">
        <p class="lead"> ${invoice.note || 'No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is not responsible for any loss and damage goods.'}</p>
      </div>
      <!-- /.col -->
    </div>
    <!-- /.row -->
    </div>
    <!-- /.invoice-content -->

    <div class="footer-container">
      <div class="row">
        ${footerBase64 ? `<img src="${footerBase64}" width="100%" alt="Footer" style="display: block;">` : '<div style="width: 100%; height: 100px; background-color: #007bff; color: white; text-align: center; padding: 20px;">PSS Payment Solutions Footer</div>'}
      </div>
    </div>

    </div>
    <!-- /.row -->
  </section>
  <!-- /.content -->
</div>
<!-- ./wrapper -->

<script type="text/javascript"> 
  // Try to load JsBarcode from multiple sources
  function loadJsBarcode() {
    return new Promise((resolve, reject) => {
      if (typeof JsBarcode !== 'undefined') {
        resolve(JsBarcode);
        return;
      }
      
      // Try alternative CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js';
      script.onload = () => {
        if (typeof JsBarcode !== 'undefined') {
          resolve(JsBarcode);
        } else {
          reject(new Error('JsBarcode not loaded'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load JsBarcode'));
      document.head.appendChild(script);
    });
  }

  function generateSimpleBarcode(number) {
    // Create a simple barcode pattern using CSS
    const barcodeContainer = document.getElementById('barcode');
    const pattern = number.toString().split('').map(digit => {
      // Create a simple pattern based on the digit
      const patterns = {
        '0': '11011001100',
        '1': '11001101100',
        '2': '11001100110',
        '3': '10010011000',
        '4': '10010001100',
        '5': '10001001100',
        '6': '11001001000',
        '7': '11001000100',
        '8': '11000100100',
        '9': '10010110000'
      };
      return patterns[digit] || '11011001100';
    }).join('0');
    
    const barcodeLines = pattern.split('').map(bit => 
      '<div style="width: 3px; height: 80px; background: ' + (bit === '1' ? '#000' : '#fff') + '; margin-right: 1px;"></div>'
    ).join('');
    
    const barcodeHTML = '<div class="barcode-fallback">' +
      '<div style="font-size: 10px; margin-bottom: 3px; color: #28a745;">✓ Custom Barcode Generated</div>' +
      '<div style="display: flex; align-items: center; justify-content: center; height: 80px; margin: 2px 0;">' +
        barcodeLines +
      '</div>' +
      '<div style="font-size: 16px; font-weight: bold; margin-top: 3px;">' + number + '</div>' +
      '</div>';
    
    barcodeContainer.innerHTML = barcodeHTML;
    console.log("✓ Custom barcode generated successfully for:", number);
  }

  window.addEventListener("load", function() {
    console.log("Page loaded, attempting barcode generation for: ${invoice.invoiceNumber}");
    
    loadJsBarcode().then((JsBarcode) => {
      try {
        console.log("JsBarcode library loaded, generating barcode...");
        
        // Check if barcode element exists
        const barcodeElement = document.getElementById('barcode');
        if (!barcodeElement) {
          console.error("Barcode element not found, using custom barcode");
          generateSimpleBarcode("${invoice.invoiceNumber}");
          return;
        }
        
        // Clear the element first
        barcodeElement.innerHTML = '';
        
        // Create a canvas element for JsBarcode
        const canvas = document.createElement('canvas');
        barcodeElement.appendChild(canvas);
        
        JsBarcode(canvas, "${invoice.invoiceNumber}", {
          format: "CODE128",
          width: 4,
          height: 120,
          displayValue: true,
          margin: 15,
          fontSize: 16
        });
        console.log("✓ Barcode generated successfully with JsBarcode");
        
        // Add success indicator
        const successIndicator = document.createElement('div');
        successIndicator.style.cssText = 'font-size: 10px; color: #28a745; margin-bottom: 5px; text-align: center;';
        barcodeElement.insertBefore(successIndicator, barcodeElement.firstChild);
        
      } catch (e) {
        console.error("JsBarcode generation failed:", e);
        generateSimpleBarcode("${invoice.invoiceNumber}");
      }
    }).catch((error) => {
      console.log("JsBarcode library not available, using simple barcode:", error);
      generateSimpleBarcode("${invoice.invoiceNumber}");
    });
    
    // Auto print for PDF generation
    ${printParam === 'true' ? `
    setTimeout(function() {
      window.print();
    }, 2000);
    ` : ''}
  });
</script>

</body>
</html>`;

  return htmlContent;
}