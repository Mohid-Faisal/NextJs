import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// In-memory storage for templates (replace with database when models are available)
let templates: any[] = [
  {
    id: 1,
    name: "Welcome Email",
    subject: "Welcome to Our Service!",
    body: "Dear {{name}},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Team",
    category: "Welcome",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: "Shipment Update",
    subject: "Your Shipment Status Update",
    body: "Dear {{name}},\n\nYour shipment {{tracking_id}} has been updated.\n\nCurrent Status: {{status}}\n\nThank you for choosing our service.\n\nBest regards,\nThe Team",
    category: "Shipment",
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: "Payment Reminder",
    subject: "Payment Reminder",
    body: "Dear {{name}},\n\nThis is a friendly reminder that payment for invoice {{invoice_number}} is due.\n\nAmount: {{amount}}\nDue Date: {{due_date}}\n\nPlease process the payment at your earliest convenience.\n\nBest regards,\nThe Team",
    category: "Payment",
    createdAt: new Date().toISOString()
  }
];

let nextId = 4;

export async function GET(req: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      jwt.verify(token, secret);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";

    // Build where clause
    let filteredTemplates = templates;
    
    if (category) {
      filteredTemplates = filteredTemplates.filter(t => t.category === category);
    }
    
    if (search) {
      filteredTemplates = filteredTemplates.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.body.toLowerCase().includes(search.toLowerCase())
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredTemplates
    });

  } catch (error) {
    console.error("Error in email templates endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      jwt.verify(token, secret);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { name, subject, body, category } = await req.json();

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Template body is required" }, { status: 400 });
    }

    if (!category || !category.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Create template
    const template = {
      id: nextId++,
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      category: category.trim(),
      createdAt: new Date().toISOString()
    };

    templates.push(template);

    return NextResponse.json({
      success: true,
      message: "Template created successfully",
      data: template
    });

  } catch (error) {
    console.error("Error in email templates POST endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      jwt.verify(token, secret);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { id, name, subject, body, category } = await req.json();

    // Validate required fields
    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Template body is required" }, { status: 400 });
    }

    if (!category || !category.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    // Find and update template
    const templateIndex = templates.findIndex(t => t.id === parseInt(id));
    if (templateIndex === -1) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updatedTemplate = {
      ...templates[templateIndex],
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      category: category.trim()
    };

    templates[templateIndex] = updatedTemplate;

    return NextResponse.json({
      success: true,
      message: "Template updated successfully",
      data: updatedTemplate
    });

  } catch (error) {
    console.error("Error in email templates PUT endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    try {
      jwt.verify(token, secret);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    // Find and delete template
    const templateIndex = templates.findIndex(t => t.id === parseInt(id));
    if (templateIndex === -1) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const deletedTemplate = templates.splice(templateIndex, 1)[0];

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
      data: deletedTemplate
    });

  } catch (error) {
    console.error("Error in email templates DELETE endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
