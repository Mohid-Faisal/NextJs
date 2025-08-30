import { NextResponse } from "next/server";

export async function GET() {
  console.log("=== USER ACTIVITY TEST ENDPOINT CALLED ===");
  
  return NextResponse.json({ 
    message: "User activity test endpoint is working",
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET
    }
  });
}
