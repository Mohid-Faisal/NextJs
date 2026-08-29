"use client";

import { useEffect } from "react";
import { getClientSession } from "@/lib/clientSession";

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

export default function SupportChat() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

  useEffect(() => {
    // Only load if a Crisp Website ID is configured
    if (!websiteId) return;

    // 1. Initialize Crisp configuration array if not already present
    window.$crisp = window.$crisp || [];
    window.CRISP_WEBSITE_ID = websiteId;

    // 2. Dynamically load Crisp client script
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    // 3. Show chat widget once script loaded
    window.$crisp.push(["do", "chat:show"]);

    // 4. Resolve user details from the session endpoint and set Crisp data
    const configureUserData = async () => {
      try {
        const user = await getClientSession();
        if (!user) return;

        if (user.email) {
          window.$crisp.push(["set", "user:email", [user.email]]);
        }
        if (user.name) {
          window.$crisp.push(["set", "user:nickname", [user.name]]);
        }

        // Fetch organization name
        const orgRes = await fetch("/api/org/current");
        const orgData = await orgRes.json();
        if (orgRes.ok && orgData.success && orgData.organization) {
          const orgName = orgData.organization.name;
          window.$crisp.push([
            "set",
            "session:data",
            [[["organization", orgName]]]
          ]);
        }
      } catch (err) {
        console.error("Error setting Crisp user data:", err);
      }
    };

    configureUserData();

    // 5. Cleanup on unmount (e.g. logging out or leaving dashboard)
    return () => {
      try {
        if (window.$crisp) {
          window.$crisp.push(["do", "chat:hide"]);
          window.$crisp.push(["do", "session:reset"]);
        }
        // Remove Crisp client script
        const scriptElement = document.querySelector("script[src*='crisp.chat']");
        if (scriptElement) {
          scriptElement.remove();
        }
        // Remove Crisp iframe containers
        const crispContainers = document.querySelectorAll("[class*='crisp']");
        crispContainers.forEach((el) => el.remove());
        const crispRoot = document.getElementById("crisp-client");
        if (crispRoot) {
          crispRoot.remove();
        }
      } catch (cleanupErr) {
        console.error("Error cleaning up Crisp widget:", cleanupErr);
      }
    };
  }, [websiteId]);

  return null;
}
