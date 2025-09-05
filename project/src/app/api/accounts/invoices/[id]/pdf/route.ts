import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const invID = searchParams.get('invID');
    const formData = searchParams.get('data');
    const shipmentId = id;
    
    console.log('PDF API called with:', { shipmentId, invID, hasFormData: !!formData });
    
    if (!invID) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Redirect to HTML invoice with print parameter for PDF generation
    const queryParams = new URLSearchParams({
      invID: invID,
      data: formData || '',
      print: 'true'
    });
    
    const invoiceUrl = `/api/accounts/invoices/${shipmentId}/invoice?${queryParams.toString()}`;
    
    // Return HTML that will trigger PDF download
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice PDF</title>
  <style>
    body { margin: 0; padding: 0; }
    iframe { width: 100%; height: 100vh; border: none; }
  </style>
</head>
<body>
  <iframe src="${invoiceUrl}" onload="setTimeout(() => { window.print(); }, 1000);"></iframe>
  <script>
    window.addEventListener('beforeprint', function() {
      // Ensure the iframe content is loaded before printing
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="Invoice_${invID}.html"`,
      },
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
