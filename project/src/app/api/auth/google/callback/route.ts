import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMembership, createOrganizationForSignup } from "@/lib/auth/membership";
import { signSessionToken } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/auth/login?error=Google authentication failed: no code provided", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!clientId || !clientSecret) {
      console.error("Google OAuth environment variables are missing.");
      return NextResponse.redirect(new URL("/auth/login?error=Google authentication is not configured on the server", req.url));
    }

    // 1. Exchange OAuth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Failed to exchange code for tokens:", errorText);
      return NextResponse.redirect(new URL("/auth/login?error=Failed to authenticate with Google", req.url));
    }

    const tokens = await tokenRes.json();

    // 2. Fetch Google profile info
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      console.error("Failed to fetch user profile from Google");
      return NextResponse.redirect(new URL("/auth/login?error=Failed to retrieve profile from Google", req.url));
    }

    const profile = await profileRes.json();
    const email = profile.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.redirect(new URL("/auth/login?error=No email address associated with your Google account", req.url));
    }

    // Read the google_signup_data cookie if it exists (meaning the user started from the signup page)
    const cookieHeader = req.headers.get("cookie") || "";
    const signupCookie = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("google_signup_data="))
      ?.split("=")[1];
    
    let signupData: { companyName: string; phone: string; address: string; name?: string } | null = null;
    if (signupCookie) {
      try {
        signupData = JSON.parse(decodeURIComponent(signupCookie));
      } catch (e) {
        console.error("Failed to parse signup cookie:", e);
      }
    }

    // 3. Match user in database or create new user
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      // If they clicked Google on Login page but have no account, ask them to sign up
      if (!signupData) {
        return NextResponse.redirect(
          new URL("/auth/signup?error=Please fill in your company details first to register with Google.", req.url)
        );
      }

      // Auto-create new user for sign up (requires admin approval)
      user = await prisma.user.create({
        data: {
          name: signupData.name || profile.name || "Google User",
          email: email,
          password: "", // Google users do not have a local password
          status: "PENDING_APPROVAL", // Requires admin approval
          isApproved: false, // Must be approved by admin
          phone: signupData.phone || null,
          address: signupData.address || null,
        },
      });
      isNewUser = true;
    }

    // Check if user is pending approval (both new and returning users)
    if (!user.isApproved && !isNewUser) {
      return NextResponse.redirect(
        new URL("/auth/login?error=Your account is pending approval. Please wait for an administrator to approve your account.", req.url)
      );
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 4. Resolve or create organization membership
    let membership = await resolveMembership(user.id);
    
    if (!membership) {
      const companyName = signupData?.companyName || `${profile.name || "Google User"}'s Workspace`;
      try {
        const organization = await createOrganizationForSignup(companyName, user.id, "trial");
        membership = {
          organizationId: organization.id,
          orgRole: "OWNER",
          orgStatus: "trial",
        };
      } catch (orgError) {
        console.error("Failed to auto-create organization for Google user:", orgError);
        // Clean up user if org creation failed
        if (isNewUser) {
          await prisma.user.delete({ where: { id: user.id } });
        }
        return NextResponse.redirect(new URL("/auth/login?error=Could not initialize your workspace. Please try standard sign up.", req.url));
      }
    }

    if (membership.orgStatus === "suspended") {
      return NextResponse.redirect(new URL("/auth/login?error=Your organization has been suspended. Contact support.", req.url));
    }



    // 6. Set token cookie and redirect
    let response: NextResponse;
    
    // If it is a new Google signup, redirect to plan selection page in signup flow
    // Do NOT issue a JWT token — the user isn't approved yet.
    if (isNewUser && signupData) {
      response = NextResponse.redirect(
        new URL(`/auth/signup?step=plan&userId=${user.id}&orgId=${membership.organizationId}`, req.url)
      );
      response.cookies.delete("google_signup_data");
    } else {
      // Returning approved user — issue JWT and redirect to dashboard
      const token = signSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organizationId,
        orgRole: membership.orgRole,
        orgStatus: membership.orgStatus,
        platformRole: user.platformRole,
      });

      response = NextResponse.redirect(new URL("/dashboard", req.url));
      response.cookies.set("token", token, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        httpOnly: false, // Must be false so client-side logout can clear it
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    console.error("Error in Google Auth callback:", error);
    return NextResponse.redirect(new URL("/auth/login?error=An unexpected error occurred during authentication", req.url));
  }
}
