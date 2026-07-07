"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
  User,
  Building,
  Mail,
  Shield,
  CreditCard,
  Calendar,
  Wallet,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  KeyRound
} from "lucide-react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";

interface DecodedToken {
  name: string;
  email?: string;
  platformRole?: string | null;
  orgRole?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("Employee");
  const [userStatus, setUserStatus] = useState("Active");
  const [userJoined, setUserJoined] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgCurrency, setOrgCurrency] = useState("USD");
  const [planName, setPlanName] = useState("Free Plan");
  const [maxUsers, setMaxUsers] = useState(5);
  const [maxShipments, setMaxShipments] = useState(100);
  const [loading, setLoading] = useState(true);

  // Profile details states
  const [userPhone, setUserPhone] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password / 2FA change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  useEffect(() => {
    const fetchProfileAndOrg = async () => {
      setLoading(true);
      try {
        // 1. Decode token
        const token = Cookies.get("token");
        let email = "";
        if (token) {
          const decoded = jwtDecode<DecodedToken>(token);
          setUserName(decoded.name || "User");
          email = (decoded.email || "").trim().toLowerCase();
          setUserEmail(email);
          setIsSuperAdmin(decoded.platformRole === "SUPER_ADMIN");
        }

        // 2. Fetch User Profile
        const profileRes = await fetch("/api/profile/me");
        if (profileRes.ok) {
          const me = await profileRes.json();
          setUserName(me.name || "User");
          setUserEmail(me.email || "");
          setUserRole(me.orgRole || me.role || "Employee");
          setUserStatus(me.status || "Active");
          setUserPhone(me.phone || "");
          setUserAddress(me.address || "");
          setIsOwner(me.orgRole === "OWNER");
          if (me.createdAt) {
            setUserJoined(new Date(me.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            }));
          }
        }

        // 3. Fetch Org & Plan Details
        const orgRes = await fetch("/api/org/current");
        if (orgRes.ok) {
          const data = await orgRes.json();
          const o = data.organization;
          if (o) {
            setOrgName(o.name);
            setOrgSlug(o.slug);
            setOrgCurrency(o.currency || "USD");
            if (o.subscription?.status === "trialing") {
              setPlanName("14-Day Free Trial");
              setMaxUsers("Unlimited");
              setMaxShipments("Unlimited");
            } else if (o.subscription?.plan) {
              setPlanName(o.subscription.plan.name || "SaaS Plan");
              setMaxUsers(o.subscription.plan.maxUsers || 5);
              setMaxShipments(o.subscription.plan.maxShipmentsPerMonth || 100);
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load profile details");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndOrg();
  }, []);

  const handleUpdateProfile = async () => {
    if (!userName.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: userName.trim(),
          phone: userPhone.trim(),
          address: userAddress.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Profile details updated successfully!");
        setUserName(data.name);
        setUserPhone(data.phone || "");
        setUserAddress(data.address || "");
      } else {
        toast.error(data.error || "Failed to update profile details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestCode = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setIsSendingCode(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "send-2fa",
          currentPassword
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCodeSent(true);
        toast.success(data.message || "2FA verification code sent to your email!");
      } else {
        toast.error(data.error || "Failed to send verification code.");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const token = Cookies.get("token");
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "change-password",
          newPassword,
          code: verificationCode
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Your password has been changed successfully!");
        // Reset form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setVerificationCode("");
        setCodeSent(false);
      } else {
        toast.error(data.error || "Failed to change password.");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500">
        Loading Profile Details...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ml-0 min-h-[calc(100vh-64px)] text-sm">
      
      {/* Back button and title */}
      <div className="flex items-center gap-3 mb-8">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.back()} 
          className="h-9 w-9 rounded-lg border-gray-250 hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4 text-gray-650" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Profile Information</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            View your personal account settings and organization details.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: User details avatar card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-[#4F46E5] to-[#6366F1]" />
            <CardContent className="pt-0 pb-6 px-6 relative flex flex-col items-center">
              
              {/* Profile image avatar wrapper */}
              <div className="w-20 h-20 rounded-full border-4 border-white dark:border-zinc-900 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] flex items-center justify-center text-2xl font-extrabold shadow-sm -mt-10 select-none">
                {userName[0]?.toUpperCase()}
              </div>

              <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-4">{userName}</h2>
              <p className="text-xs text-gray-400 mt-1">{userEmail}</p>

              <div className="w-full border-t border-gray-100 dark:border-zinc-850 mt-6 pt-6 space-y-4">
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Role</span>
                  <Badge variant="outline" className="capitalize text-gray-700 font-bold px-2.5 py-0.5 rounded-full bg-slate-50 border-slate-200">
                    {userRole}
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Ownership</span>
                  <span className={`font-bold text-xs ${isOwner ? "text-[#4F46E5]" : "text-gray-500"}`}>
                    {isOwner ? "Organization Owner" : "Standard User / Member"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Status</span>
                  <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {userStatus}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider">Member Since</span>
                  <span className="text-gray-700 dark:text-zinc-300 font-medium">{userJoined || "N/A"}</span>
                </div>

              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Org, Subscription & Change Password info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 0: Personal Details */}
          <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-850 pb-5">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#4F46E5]" />
                Personal Profile Details
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">Update your contact details and home/work address.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">FULL NAME</Label>
                  <Input 
                    type="text"
                    value={userName} 
                    onChange={(e) => setUserName(e.target.value)} 
                    placeholder="Jane Doe"
                    className="text-sm rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">EMAIL ADDRESS</Label>
                  <Input 
                    type="email"
                    value={userEmail} 
                    disabled
                    placeholder="jane@company.com"
                    className="text-sm rounded-lg bg-gray-50 dark:bg-zinc-800 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">PHONE NUMBER</Label>
                  <Input 
                    type="text"
                    value={userPhone} 
                    onChange={(e) => setUserPhone(e.target.value)} 
                    placeholder="+1 (555) 000-0000"
                    className="text-sm rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">ADDRESS</Label>
                  <Input 
                    type="text"
                    value={userAddress} 
                    onChange={(e) => setUserAddress(e.target.value)} 
                    placeholder="123 Logistics Way, Suite 100"
                    className="text-sm rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button 
                  onClick={handleUpdateProfile}
                  disabled={isSavingProfile}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm"
                >
                  {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
                </Button>
              </div>

            </CardContent>
          </Card>
          
          {/* Card 1: Organization Details */}
          <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-850 pb-5">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-[#4F46E5]" />
                Organization details
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">Your organization and currency settings.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Organization Name</span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white mt-1">{orgName || "PSS default"}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Slug / Unique ID</span>
                  <span className="block text-sm font-mono text-gray-700 dark:text-zinc-350 mt-1">{orgSlug || "pss_default"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-50 dark:border-zinc-850">
                <div>
                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Default Currency</span>
                  <span className="block text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">{orgCurrency}</span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Card 2: Subscription Plan */}
          <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-855 pb-5">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#4F46E5]" />
                Subscription Plan
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">Details of your subscription quota and limits.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-indigo-550 uppercase tracking-wider">Current Plan</span>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white mt-0.5">{planName}</span>
                </div>
                <Badge className="ml-auto bg-[#4F46E5] text-white">Active</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div>
                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Users Limit</span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    {maxUsers === "Unlimited" ? "Unlimited" : `${maxUsers} Team Members`}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Monthly Shipment Quota</span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    {maxShipments === "Unlimited" ? "Unlimited" : `${maxShipments} Shipments/Month`}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Card 3: Security & Password Setting */}
          <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
            <CardHeader className="border-b border-gray-100 dark:border-zinc-855 pb-5">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#4F46E5]" />
                Security & Password
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">Securely update your password verified via 2FA code sent to your email.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              {!codeSent ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">CURRENT PASSWORD</Label>
                    <Input 
                      type="password"
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      placeholder="••••••••"
                      className="text-sm rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">NEW PASSWORD</Label>
                      <Input 
                        type="password"
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="••••••••"
                        className="text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">CONFIRM NEW PASSWORD</Label>
                      <Input 
                        type="password"
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="••••••••"
                        className="text-sm rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      onClick={handleRequestCode}
                      disabled={isSendingCode}
                      className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm"
                    >
                      {isSendingCode ? "Requesting Code..." : "Request 2FA Code"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-indigo-750 dark:text-indigo-300 uppercase tracking-wide">Enter 6-Digit Code sent to your email</Label>
                    <Input 
                      type="text"
                      maxLength={6}
                      value={verificationCode} 
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))} 
                      placeholder="e.g. 123456"
                      className="text-lg text-center tracking-[10px] font-mono h-12 rounded-lg border-indigo-200"
                    />
                    <p className="text-[11px] text-gray-500">We have sent a verification code to <strong>{userEmail}</strong>. Please check your inbox.</p>
                  </div>

                  <div className="pt-2 flex gap-3 justify-end">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setCodeSent(false);
                        setVerificationCode("");
                      }}
                      className="text-xs"
                    >
                      Back / Cancel
                    </Button>
                    <Button 
                      onClick={handleChangePasswordSubmit}
                      disabled={isSubmittingPassword}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm"
                    >
                      {isSubmittingPassword ? "Verifying..." : "Verify & Change Password"}
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

        </div>
      </div>

    </div>
  );
}
