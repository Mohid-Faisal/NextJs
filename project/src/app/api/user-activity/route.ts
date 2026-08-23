import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

// In-memory store for active users (in production, use Redis)
const activeUsers = new Map<string, { userId: number; lastActivity: Date }>();

export async function POST(req: NextRequest) {
  try {
    // SECURITY: identity comes from the httpOnly session cookie instead of a
    // raw JWT posted in the request body.
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = session.userId;

    // Update user activity
    const activityKey = `user:${userId}`;
    activeUsers.set(activityKey, {
      userId,
      lastActivity: new Date()
    });

    // Clean up old entries (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    for (const [key, value] of activeUsers.entries()) {
      if (value.lastActivity < thirtyMinutesAgo) {
        activeUsers.delete(key);
      }
    }

    return NextResponse.json({
      success: true,
      activeUsers: activeUsers.size
    });
  } catch (error) {
    console.error("Error in POST endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Clean up old entries
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    for (const [key, value] of activeUsers.entries()) {
      if (value.lastActivity < thirtyMinutesAgo) {
        activeUsers.delete(key);
      }
    }

    // Get unique active users
    const uniqueActiveUsers = new Set();
    for (const value of activeUsers.values()) {
      uniqueActiveUsers.add(value.userId);
    }

    return NextResponse.json({
      activeUsers: uniqueActiveUsers.size,
      totalSessions: activeUsers.size
    });
  } catch (error) {
    console.error("Error in GET endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
