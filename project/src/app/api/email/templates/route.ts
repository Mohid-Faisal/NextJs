import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * SECURITY hardening vs. previous version:
 *  - Full session validation (user status/approval) instead of raw jwt.verify.
 *  - Templates are namespaced per organization — previously ANY authenticated
 *    user could read/mutate/delete templates belonging to other tenants, and
 *    unbounded growth allowed memory exhaustion.
 */

// In-memory storage for templates (replace with database when models are available)
const defaultTemplates: any[] = [
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

type OrgTemplates = { templates: any[]; nextId: number };
const orgTemplateStore = new Map<number, OrgTemplates>();
const MAX_TEMPLATES_PER_ORG = 100;

function getOrgTemplates(organizationId: number): OrgTemplates {
  let entry = orgTemplateStore.get(organizationId);
  if (!entry) {
    // Seed with shared defaults; defaults are copied so mutations by one
    // org never affect another.
    entry = {
      templates: defaultTemplates.map((t, i) => ({ ...t, id: i + 1 })),
      nextId: defaultTemplates.length + 1,
    };
    orgTemplateStore.set(organizationId, entry);
  }
  return entry;
}

function requireAdminRole(session: SessionPayload): NextResponse | null {
  const privileged =
    session.platformRole === "SUPER_ADMIN" ||
    session.orgRole === "OWNER" ||
    session.orgRole === "ADMIN";

  if (!privileged) {
    return NextResponse.json(
      { error: "Forbidden: only organization admins can manage templates." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const denied = requireAdminRole(session);
    if (denied) return denied;

    const store = getOrgTemplates(session.organizationId);

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";

    // Build where clause
    let filteredTemplates = store.templates;

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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const denied = requireAdminRole(session);
    if (denied) return denied;

    const store = getOrgTemplates(session.organizationId);

    if (store.templates.length >= MAX_TEMPLATES_PER_ORG) {
      return NextResponse.json(
        { error: `Template limit reached (${MAX_TEMPLATES_PER_ORG})` },
        { status: 400 }
      );
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
      id: store.nextId++,
      name: String(name).trim().slice(0, 200),
      subject: String(subject).trim().slice(0, 300),
      body: String(body).trim().slice(0, 20000),
      category: String(category).trim().slice(0, 100),
      createdAt: new Date().toISOString()
    };

    store.templates.push(template);

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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const denied = requireAdminRole(session);
    if (denied) return denied;

    const store = getOrgTemplates(session.organizationId);

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

    // Find and update template (org-scoped)
    const templateIndex = store.templates.findIndex(t => t.id === parseInt(id));
    if (templateIndex === -1) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updatedTemplate = {
      ...store.templates[templateIndex],
      name: String(name).trim().slice(0, 200),
      subject: String(subject).trim().slice(0, 300),
      body: String(body).trim().slice(0, 20000),
      category: String(category).trim().slice(0, 100)
    };

    store.templates[templateIndex] = updatedTemplate;

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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const denied = requireAdminRole(session);
    if (denied) return denied;

    const store = getOrgTemplates(session.organizationId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    // Find and delete template (org-scoped)
    const templateIndex = store.templates.findIndex(t => t.id === parseInt(id));
    if (templateIndex === -1) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const deletedTemplate = store.templates.splice(templateIndex, 1)[0];

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
