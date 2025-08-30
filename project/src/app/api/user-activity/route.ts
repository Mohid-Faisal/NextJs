import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

// In-memory store for active users (in production, use Redis)
const activeUsers = new Map<string, { userId: number; lastActivity: Date }>();

export async function POST(req: NextRequest) {
  console.log("=== USER ACTIVITY POST ENDPOINT CALLED ===");
  console.log("🔧 Environment variables check:");
  console.log("  - JWT_SECRET exists:", !!process.env.JWT_SECRET);
  console.log("  - NODE_ENV:", process.env.NODE_ENV);
  
  try {
    const body = await req.json();
    console.log("Request body:", body);
    
    const { token } = body;
    
    if (!token) {
      console.log("❌ No token provided in request");
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    console.log("🔑 Token received:", token.substring(0, 20) + "...");

    // Verify JWT token
    const secret = process.env.JWT_SECRET || "your-secret-key";
    console.log("🔐 Using JWT secret:", secret ? "Secret exists" : "No secret found");
    
    try {
      const decoded = jwt.verify(token, secret) as { id: string; [key: string]: unknown };
      console.log("✅ JWT decoded successfully:", { userId: decoded.id, decodedKeys: Object.keys(decoded) });
      
      if (!decoded) {
        console.log("❌ JWT verification failed - decoded is null");
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }

      const userId = parseInt(decoded.id as string);
      console.log("👤 User ID parsed:", userId);
      
      // Update user activity
      const previousSize = activeUsers.size;
      activeUsers.set(token, {
        userId,
        lastActivity: new Date()
      });
      console.log("📝 User activity updated. Map size changed from", previousSize, "to", activeUsers.size);
      
      // Clean up old entries (older than 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      console.log("🧹 Cleaning up entries older than:", thirtyMinutesAgo.toISOString());
      
      let cleanedCount = 0;
      for (const [key, value] of activeUsers.entries()) {
        if (value.lastActivity < thirtyMinutesAgo) {
          activeUsers.delete(key);
          cleanedCount++;
        }
      }
      console.log("🧹 Cleaned up", cleanedCount, "old entries. New map size:", activeUsers.size);

      console.log("📊 Current active users map:", {
        size: activeUsers.size,
        entries: Array.from(activeUsers.entries()).map(([key, value]) => ({
          tokenPreview: key.substring(0, 20) + "...",
          userId: value.userId,
          lastActivity: value.lastActivity.toISOString()
        }))
      });

      return NextResponse.json({ 
        success: true, 
        activeUsers: activeUsers.size 
      });
    } catch (jwtError) {
      console.log("❌ JWT verification error:", jwtError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  } catch (error) {
    console.error("❌ Error in POST endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  console.log("=== USER ACTIVITY GET ENDPOINT CALLED ===");
  try {
    console.log("📊 Current active users map before cleanup:", {
      size: activeUsers.size,
      entries: Array.from(activeUsers.entries()).map(([key, value]) => ({
        tokenPreview: key.substring(0, 20) + "...",
        userId: value.userId,
        lastActivity: value.lastActivity.toISOString()
      }))
    });

    // Clean up old entries
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    console.log("🧹 Cleaning up entries older than:", thirtyMinutesAgo.toISOString());
    
    let cleanedCount = 0;
    for (const [key, value] of activeUsers.entries()) {
      if (value.lastActivity < thirtyMinutesAgo) {
        activeUsers.delete(key);
        cleanedCount++;
      }
    }
    console.log("🧹 Cleaned up", cleanedCount, "old entries. New map size:", activeUsers.size);

    // Get unique active users
    const uniqueActiveUsers = new Set();
    for (const value of activeUsers.values()) {
      uniqueActiveUsers.add(value.userId);
    }
    
    console.log("👥 Unique active users:", {
      totalSessions: activeUsers.size,
      uniqueUsers: uniqueActiveUsers.size,
      uniqueUserIds: Array.from(uniqueActiveUsers)
    });

    const response = { 
      activeUsers: uniqueActiveUsers.size,
      totalSessions: activeUsers.size
    };
    
    console.log("✅ GET endpoint response:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error in GET endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
