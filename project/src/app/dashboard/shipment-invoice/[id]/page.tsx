'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Country } from 'country-state-city';
import { getCountryNameFromCode, getStateNameFromCode } from '@/lib/utils';

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
  hsCode?: string;
  unitValue?: number;
}

interface Shipment {
  id: number;
  trackingId: string;
  invoiceNumber: string;
  referenceNumber: string;
  agency?: string;
  office?: string;
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  destination: string;
  deliveryTime?: string;
  invoiceStatus?: string;
  deliveryStatus?: string;
  shippingMode?: string;
  packaging?: string;
  vendor?: string;
  serviceMode?: string;
  amount: number;
  packageDescription?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  weightVol: number;
  fixedCharge: number;
  decValue: number;
  price: number;
  discount: number;
  fuelSurcharge: number;
  insurance: number;
  customs: number;
  tax: number;
  declaredValue: number;
  totalCost: number;
  subtotal: number;
  totalPackages: number;
  totalWeight: number;
  totalWeightVol: number;
  shipmentDate: string;
  packages?: string | Package[];
  createdAt: string;
}

export interface EditableItem {
  id: string;
  qty: number;
  description: string;
  hsCode: string;
  unitValue: number;
}

// Convert number to words
function numberToWords(num: number): string {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION'];

  if (num === 0) return 'Zero only';
  if (num < 0) return 'Minus ' + numberToWords(-num).toLowerCase();

  const numStr = Math.floor(num).toString();
  const decimal = num % 1;
  
  let words = '';
  let scaleIndex = 0;
  
  while (numStr.length > 0) {
    const chunk = parseInt(numStr.slice(-3)) || 0;
    const chunkStr = numStr.slice(-3);
    
    if (chunk > 0) {
      let chunkWords = '';
      
      if (chunk >= 100) {
        chunkWords += ones[Math.floor(chunk / 100)] + ' HUNDRED ';
        const remainder = chunk % 100;
        if (remainder > 0) {
          if (remainder < 20) {
            chunkWords += ones[remainder];
          } else {
            chunkWords += tens[Math.floor(remainder / 10)] + ' ' + ones[remainder % 10];
          }
        }
      } else if (chunk < 20) {
        chunkWords += ones[chunk];
      } else {
        chunkWords += tens[Math.floor(chunk / 10)] + ' ' + ones[chunk % 10];
      }
      
      if (scales[scaleIndex]) {
        chunkWords += ' ' + scales[scaleIndex];
      }
      
      words = chunkWords.trim() + ' ' + words;
    }
    
    // Remove last 3 digits
    const remaining = numStr.slice(0, -3);
    if (remaining === '') break;
    // Update numStr for next iteration (this is a workaround since we can't reassign)
    scaleIndex++;
    if (remaining.length === 0) break;
    
    // Process remaining digits
    const nextChunk = parseInt(remaining.slice(-3)) || 0;
    if (nextChunk > 0) {
      let nextChunkWords = '';
      
      if (nextChunk >= 100) {
        nextChunkWords += ones[Math.floor(nextChunk / 100)] + ' HUNDRED ';
        const remainder = nextChunk % 100;
        if (remainder > 0) {
          if (remainder < 20) {
            nextChunkWords += ones[remainder];
          } else {
            nextChunkWords += tens[Math.floor(remainder / 10)] + ' ' + ones[remainder % 10];
          }
        }
      } else if (nextChunk < 20) {
        nextChunkWords += ones[nextChunk];
      } else {
        nextChunkWords += tens[Math.floor(nextChunk / 10)] + ' ' + ones[nextChunk % 10];
      }
      
      if (scales[scaleIndex]) {
        nextChunkWords += ' ' + scales[scaleIndex];
      }
      
      words = nextChunkWords.trim() + ' ' + words;
    }
    break;
  }
  
  const result = (words.trim() + ' Only').toLowerCase();
  return result.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ShipmentInvoicePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [customer, setCustomer] = useState<{ Address?: string; City?: string; State?: string; Country?: string; Zip?: string; DocumentNumber?: string } | null>(null);
  const [recipient, setRecipient] = useState<{ Address?: string; City?: string; State?: string; Country?: string; Zip?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [itemsInitialized, setItemsInitialized] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Missing shipment id');
      setLoading(false);
      return;
    }
    const fetchShipment = async () => {
      try {
        const response = await fetch(`/api/shipments/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch shipment');
        }
        const data = await response.json();
        setShipment(data.shipment);
        setCustomer(data.customer ?? null);
        setRecipient(data.recipient ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchShipment();
  }, [id]);

  // Format full address: Address, City, ZipCode, State, Country
  const formatFullAddress = (
    addr: string,
    city?: string,
    zip?: string,
    state?: string,
    countryCode?: string
  ) => {
    const country = countryCode ? getCountryNameFromCode(countryCode) : '';
    const stateName = state && countryCode ? getStateNameFromCode(state, countryCode) : (state || '');
    const parts = [addr, city, zip, stateName, country].filter((p) => p && String(p).trim());
    return parts.join(', ') || '';
  };

  // Initialize items from shipment when it loads
  useEffect(() => {
    if (!shipment || itemsInitialized) return;
    
    let parsedPackages: Package[] = [];
    if (shipment.packages) {
      try {
        parsedPackages = typeof shipment.packages === 'string'
          ? JSON.parse(shipment.packages)
          : shipment.packages;
        if (!Array.isArray(parsedPackages)) parsedPackages = [];
      } catch {
        parsedPackages = [];
      }
    }

    const initial: EditableItem[] = [];
    if (parsedPackages.length > 0) {
      parsedPackages.forEach((pkg, i) => {
        initial.push({
          id: `item-${Date.now()}-${i}`,
          qty: pkg.amount || 1,
          description: pkg.packageDescription || shipment.packageDescription || 'GOODS',
          hsCode: pkg.hsCode || '',
          unitValue: pkg.unitValue ?? pkg.decValue ?? 0
        });
      });
    } else {
      initial.push({
        id: `item-${Date.now()}-0`,
        qty: shipment.amount || 1,
        description: shipment.packageDescription || 'GOODS',
        hsCode: '',
        unitValue: shipment.decValue ?? 0
      });
    }
    setItems(initial);
    setItemsInitialized(true);
  }, [shipment, itemsInitialized]);

  const updateItem = (id: string, field: keyof EditableItem, value: string | number) => {
    setItems(prev => prev.map(it =>
      it.id === id ? { ...it, [field]: value } : it
    ));
  };

  const addRow = () => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${prev.length}`,
      qty: 1,
      description: '',
      hsCode: '',
      unitValue: 0
    }]);
  };

  const removeRow = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);
  };

  const totalInvoiceAmount = items.reduce((sum, item) => sum + (item.qty * item.unitValue), 0);
  const amountInWordsRaw = numberToWords(Math.round(totalInvoiceAmount * 100) / 100);
  const amountInWords = amountInWordsRaw.replace(/ only$/i, ' Dollars Only');

  const handlePrint = () => {
    if (!shipment) {
      alert('Shipment data not available');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the invoice');
      return;
    }

    const totalPieces = shipment.totalPackages || shipment.amount || 1;
    const netWeight = shipment.totalWeight || shipment.weight || 0;
    const dimensions = `${shipment.length || 0}X${shipment.width || 0}X${shipment.height || 0}`;
    const getCountryName = (code: string | null | undefined) => {
      if (!code) return 'N/A';
      return getCountryNameFromCode(String(code)) || code;
    };
    const invoiceDate = shipment.shipmentDate
      ? format(parseISO(shipment.shipmentDate), 'dd/MM/yyyy')
      : format(new Date(), 'dd/MM/yyyy');

    const senderFullAddr = customer
      ? formatFullAddress(customer.Address || '', customer.City, customer.Zip, customer.State, customer.Country) || shipment.senderAddress
      : shipment.senderAddress;
    const recipientFullAddr = recipient
      ? formatFullAddress(recipient.Address || '', recipient.City, recipient.Zip, recipient.State, recipient.Country || shipment.destination) || shipment.recipientAddress
      : (shipment.recipientAddress + (shipment.destination ? ', ' + getCountryName(shipment.destination) : ''));

    const itemsRowsHTML = items.map((item, i) => {
      const sub = item.qty * item.unitValue;
      return `<tr>
        <td>${String(i + 1).padStart(2, '0')}</td>
        <td>${String(item.qty).padStart(2, '0')}</td>
        <td class="description-col">${item.description || ''}</td>
        <td>${item.hsCode}</td>
        <td>${item.unitValue > 0 ? item.unitValue.toFixed(2) : ''}</td>
        <td>${sub > 0 ? sub.toFixed(2) : ''}</td>
      </tr>`;
    }).join('');

    const printHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Performa Invoice ${shipment.invoiceNumber}</title>
          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            html, body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 20px;
              font-size: 14px;
              background: white;
            }
            @page { size: A4; margin: 1cm; }
            
            .invoice-container {
              max-width: 210mm;
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background: white;
              padding: 20px;
              font-size: 14px;
              display: flex;
              flex-direction: column;
            }
            
            .invoice-title {
              text-align: center;
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 20px;
              text-decoration: underline;
            }
            
            .main-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            
            .main-table td {
              border: 1px solid #000;
              padding: 8px 12px;
              vertical-align: top;
              font-size: 14px;
            }
            
            .main-table .label {
              font-weight: bold;
              width: 140px;
              background-color: #f5f5f5;
              font-size: 14px;
              white-space: nowrap;
            }
            
            .main-table .value {
              min-width: 150px;
              font-size: 14px;
            }
            
            .section-header {
              font-weight: bold;
              background-color: #e0e0e0;
              padding: 8px 10px;
              font-size: 14px;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 14px;
            }
            
            .items-table th {
              border: 1px solid #000;
              padding: 10px;
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
              font-size: 14px;
            }
            
            .items-table td {
              border: 1px solid #000;
              padding: 8px 10px;
              text-align: center;
              font-size: 14px;
            }
            
            .items-table .description-col {
              text-align: left;
              min-width: 200px;
            }
            
            .total-row {
              background-color: #f5f5f5;
            }
            
            .total-row td {
              font-weight: bold;
            }
            
            .declaration-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            .declaration-table td { border: 1px solid #000; padding: 10px 12px; vertical-align: top; font-size: 14px; }
            .declaration-table .label-cell { font-weight: bold; width: 100px; background-color: #f5f5f5; font-size: 14px; }
            .declaration-table .content-cell { text-align: justify; font-size: 14px; }
            .address-block { line-height: 1.5; font-size: 14px; }
            .signature-section { margin-top: 84px; padding-top: 24px; width: 280px; }
            .signature-line { border-bottom: 1px solid #000; height: 1px; margin-bottom: 4px; }
            .signature-label { font-size: 12px; color: #333; }
            
            @media print {
              html, body {
                padding: 0;
                margin: 0;
              }
              .invoice-container {
                padding: 15px;
              }
              @page {
                size: A4;
                margin: 1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-title">Performa Invoice</div>
            <table class="main-table">
              <tbody>
                <tr><td class="section-header" colspan="2">Sender / Consignor</td><td class="label">Invoice Date</td><td class="value">${invoiceDate}</td></tr>
                <tr><td colspan="2" rowspan="4" class="address-block"><strong>${shipment.senderName}</strong><br/>${senderFullAddr}</td><td class="label">Invoice Number</td><td class="value">${shipment.invoiceNumber}</td></tr>
                <tr><td class="label">CNIC/NTN No.</td><td class="value">${customer?.DocumentNumber || ''}</td></tr>
                <tr><td class="label">Service Mode</td><td class="value">${shipment.serviceMode || ''}</td></tr>
                <tr><td class="label">Origin</td><td class="value">${shipment.office || 'LHE-PK'}</td></tr>
                <tr><td class="section-header" colspan="2">Receiver / Consignee</td><td class="label">Destination</td><td class="value">${getCountryName(shipment.destination)}</td></tr>
                <tr><td colspan="2" rowspan="5" class="address-block"><strong>${shipment.recipientName}</strong><br/>${recipientFullAddr}</td><td class="label">Terms Of Trade</td><td class="value">DDU-Delivery Duty Unpaid</td></tr>
                <tr><td class="label">Net Weight</td><td class="value">${netWeight} KG</td></tr>
                <tr><td class="label">Dims (cm)</td><td class="value">${dimensions}</td></tr>
                <tr><td class="label">Shipment Pieces</td><td class="value">${String(totalPieces).padStart(2, '0')}</td></tr>
                <tr><td class="label">Status</td><td class="value">${shipment.packaging || shipment.packageDescription || 'GOODS'}</td></tr>
              </tbody>
            </table>
            <table class="items-table">
              <thead><tr><th>Sr #</th><th>Qty</th><th>Description Of Contents</th><th>HS Code</th><th>Unit Value<br/>USD $</th><th>Sub Total<br/>USD $</th></tr></thead>
              <tbody>${itemsRowsHTML}
                <tr class="total-row"><td colspan="4" style="text-align:right;padding-right:20px">${amountInWords}</td><td style="text-align:center">Total Invoice Amount</td><td>${totalInvoiceAmount > 0 ? totalInvoiceAmount.toFixed(2) + ' $' : '0.00 $'}</td></tr>
              </tbody>
            </table>
            <table class="declaration-table"><tbody>
              <tr><td class="label-cell">Note</td><td class="content-cell">Non-Commercial Value, Mentioned For Just Custom Purpose Only</td></tr>
              <tr><td class="label-cell">Declaration</td><td class="content-cell">We/Shipper hereby certify that the information on this invoice is true and correct and the contents of this shipment are stated above</td></tr>
            </tbody></table>
            <div class="signature-section">
              <div class="signature-line"></div>
              <div class="signature-label">Sender's Signature & Thumb Impression</div>
            </div>
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

    printWindow.document.write(printHTML);
    printWindow.document.close();
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

  if (error || !shipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Shipment not found'}</p>
          <Link href="/dashboard/shipments">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Shipments
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalPieces = shipment.totalPackages || shipment.amount || 1;
  const netWeight = shipment.totalWeight || shipment.weight || 0;
  const dimensions = `${shipment.length || 0}X${shipment.width || 0}X${shipment.height || 0}`;
  
  // Get country names
  const getCountryName = (code: string | null | undefined) => {
    if (!code) return 'N/A';
    const country = Country.getAllCountries().find(c => c.isoCode === code || c.name === code);
    return country?.name || code;
  };

  // Format date
  const invoiceDate = shipment.shipmentDate
    ? format(parseISO(shipment.shipmentDate), 'dd/MM/yyyy')
    : format(new Date(), 'dd/MM/yyyy');

  // Full address for display
  const senderFullAddr = customer
    ? formatFullAddress(customer.Address || '', customer.City, customer.Zip, customer.State, customer.Country) || shipment.senderAddress
    : shipment.senderAddress;
  const recipientFullAddr = recipient
    ? formatFullAddress(recipient.Address || '', recipient.City, recipient.Zip, recipient.State, recipient.Country || shipment.destination) || shipment.recipientAddress
    : (shipment.recipientAddress + (shipment.destination ? ', ' + getCountryName(shipment.destination) : ''));

  return (
    <div className="w-full p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <style jsx>{`
        .invoice-wrapper {
          max-width: 210mm;
          margin: 0 auto;
          min-height: 297mm;
        }
        
        .invoice-container {
          background: white;
          padding: 30px;
          border: 1px solid #ccc;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          min-height: 297mm;
          display: flex;
          flex-direction: column;
        }
        
        .invoice-title {
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 20px;
          text-decoration: underline;
        }
        
        .main-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        .main-table td {
          border: 1px solid #000;
          padding: 8px 12px;
          vertical-align: top;
          font-size: 14px;
        }
        
        .main-table .label {
          font-weight: bold;
          width: 140px;
          background-color: #f5f5f5;
          font-size: 14px;
          white-space: nowrap;
        }
        
        .main-table .value {
          min-width: 150px;
          font-size: 14px;
        }
        
        .section-header {
          font-weight: bold;
          background-color: #e0e0e0;
          padding: 8px 10px;
          font-size: 14px;
        }
        
        .address-block {
          line-height: 1.5;
          font-size: 14px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .items-table th {
          border: 1px solid #000;
          padding: 10px;
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
          font-size: 14px;
        }
        
        .items-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          text-align: center;
          font-size: 14px;
        }
        
        .items-table .description-col {
          text-align: left;
          min-width: 200px;
        }
        
        .total-row {
          background-color: #f5f5f5;
        }
        
        .total-row td {
          font-weight: bold;
          font-size: 14px;
        }
        
        .declaration-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 14px;
        }
        
        .declaration-table td {
          border: 1px solid #000;
          padding: 10px 12px;
          vertical-align: top;
          font-size: 14px;
        }
        
        .declaration-table .label-cell {
          font-weight: bold;
          width: 100px;
          background-color: #f5f5f5;
          font-size: 14px;
        }
        
        .declaration-table .content-cell {
          text-align: justify;
          font-size: 14px;
        }
        
        .signature-section {
          margin-top: 84px;
          padding-top: 24px;
          width: 280px;
        }
        
        .signature-line {
          border-bottom: 1px solid #000;
          height: 1px;
          margin-bottom: 4px;
        }
        
        .signature-label {
          font-size: 12px;
          color: #333;
        }
        
        .print-btn {
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
          transition: all 0.2s;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .print-btn:hover {
          transform: translateY(-2px);
          background: #059669;
        }
        
        .back-btn {
          position: fixed;
          bottom: 30px;
          left: 30px;
          z-index: 1000;
        }
        
        .no-print {
          /* Hidden only when printing current page */
        }
        
        @media print {
          @page { size: A4; margin: 1cm; }
          .print-btn, .back-btn, .no-print {
            display: none !important;
          }
          .invoice-container {
            border: none;
            padding: 0;
          }
          .items-table input {
            border: none !important;
            background: transparent !important;
            -webkit-appearance: none;
            appearance: none;
          }
        }
      `}</style>

      <div className="invoice-wrapper">
        <div className="invoice-container">
          {/* Title */}
          <div className="invoice-title">Performa Invoice</div>

          {/* Main Info Table */}
          <table className="main-table">
            <tbody>
              {/* Row 1: Sender/Consignor Header + Invoice Date */}
              <tr>
                <td className="section-header" colSpan={2}>Sender / Consignor</td>
                <td className="label">Invoice Date</td>
                <td className="value">{invoiceDate}</td>
              </tr>
              
              {/* Row 2: Sender Details + Invoice Number */}
              <tr>
                <td colSpan={2} rowSpan={4} className="address-block">
                  <strong>{shipment.senderName}</strong><br />
                  {senderFullAddr}
                </td>
                <td className="label">Invoice Number</td>
                <td className="value">{shipment.invoiceNumber}</td>
              </tr>
              
              {/* Row 3: CNIC Number */}
              <tr>
                <td className="label">CNIC/NTN No.</td>
                <td className="value">{customer?.DocumentNumber || ''}</td>
              </tr>

              {/* Row 5: Waybill Number */}
              <tr>
                <td className="label">Service Mode</td>
                <td className="value"> {shipment.serviceMode || ''}</td>
              </tr>
              
              {/* Row 6: Origin */}
              <tr>
                <td className="label">Origin</td>
                <td className="value">{shipment.office || 'LHE-PK'}</td>
              </tr>
              
              {/* Row 7: Recipient Header + Destination */}
              <tr>
                <td className="section-header" colSpan={2}>Receiver / Consignee</td>
                <td className="label">Destination</td>
                <td className="value">{getCountryName(shipment.destination)}</td>
              </tr>
              
              {/* Row 8: Recipient Details + Terms of Trade */}
              <tr>
                <td colSpan={2} rowSpan={5} className="address-block">
                  <strong>{shipment.recipientName}</strong><br />
                  {recipientFullAddr}
                </td>
                <td className="label">Terms Of Trade</td>
                <td className="value">DDU-Delivery Duty Unpaid</td>
              </tr>
              
              {/* Row 9: Net Weight */}
              <tr>
                <td className="label">Net Weight</td>
                <td className="value">{netWeight} KG</td>
              </tr>
              
              {/* Row 10: Dimensions */}
              <tr>
                <td className="label">Dims (cm)</td>
                <td className="value">{dimensions}</td>
              </tr>
              
              {/* Row 11: Shipment Pieces */}
              <tr>
                <td className="label">Shipment Pieces</td>
                <td className="value">{String(totalPieces).padStart(2, '0')}</td>
              </tr>
              
              {/* Row 12: Status */}
              <tr>
                <td className="label">Status</td>
                <td className="value">{shipment.packaging || shipment.packageDescription || 'GOODS'}</td>
              </tr>
            </tbody>
          </table>

          {/* Items Table - Editable */}
          <div className="no-print mb-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          </div>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Sr #</th>
                <th style={{ width: '70px' }}>Qty</th>
                <th>Description Of Contents</th>
                <th style={{ width: '90px' }}>HS Code</th>
                <th style={{ width: '100px' }}>Unit Value<br />USD $</th>
                <th style={{ width: '100px' }}>Sub Total<br />USD $</th>
                <th className="no-print" style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const subTotal = item.qty * item.unitValue;
                return (
                  <tr key={item.id}>
                    <td>{String(index + 1).padStart(2, '0')}</td>
                    <td>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty || ''}
                        onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                        className="h-9 w-14 text-center p-1 border-gray-300 text-base"
                      />
                    </td>
                    <td className="description-col">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Description"
                        className="h-9 min-w-[180px] border-gray-300 text-base"
                      />
                    </td>
                    <td>
                      <Input
                        value={item.hsCode}
                        onChange={(e) => updateItem(item.id, 'hsCode', e.target.value)}
                        placeholder="HS Code"
                        className="h-9 w-20 text-center p-1 border-gray-300 text-base"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitValue || ''}
                        onChange={(e) => updateItem(item.id, 'unitValue', parseFloat(e.target.value) || 0)}
                        className="h-9 w-20 text-center p-1 border-gray-300 text-base"
                      />
                    </td>
                    <td>{subTotal > 0 ? subTotal.toFixed(2) : ''}</td>
                    <td className="no-print">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeRow(item.id)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              
              {/* Total Row */}
              <tr className="total-row">
                <td colSpan={4} style={{ textAlign: 'right', paddingRight: '20px' }}>
                  {amountInWords}
                </td>
                <td style={{ textAlign: 'center' }}>Total Invoice Amount</td>
                <td>{totalInvoiceAmount > 0 ? `${totalInvoiceAmount.toFixed(2)} $` : '0.00 $'}</td>
                <td className="no-print"></td>
              </tr>
            </tbody>
          </table>

          {/* Note, Declaration, Undertaking */}
          <table className="declaration-table">
            <tbody>
              <tr>
                <td className="label-cell">Note</td>
                <td className="content-cell">Non-Commercial Value, Mentioned For Just Custom Purpose Only</td>
              </tr>
              <tr>
                <td className="label-cell">Declaration</td>
                <td className="content-cell">We/Shipper hereby certify that the information on this invoice is true and correct and the contents of this shipment are stated above</td>
              </tr>
            </tbody>
          </table>

          {/* Sender's Signature */}
          <div className="signature-section">
            <div className="signature-line" />
            <div className="signature-label">Sender's Signature & Thumb Impression</div>
          </div>
        </div>
      </div>

      {/* Print Button */}
      <button className="print-btn" onClick={handlePrint}>
        <Printer className="h-5 w-5" />
        Print Invoice
      </button>

      {/* Back Button */}
      <div className="back-btn">
        <Link href="/dashboard/shipments">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>
    </div>
  );
}
