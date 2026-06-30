"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Lock,
  UserCheck,
  Shield,
  Briefcase,
  User,
  Building,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Role interfaces
type RoleName = "Customer" | "Vendor" | "Employee" | "Admin" | "Super Admin";

interface PermissionItem {
  name: string;
  code: string;
}

interface PermissionCategory {
  name: string;
  code: string;
  permissions: PermissionItem[];
}

const permissionCategories: PermissionCategory[] = [
  {
    name: "Dashboard",
    code: "dashboard",
    permissions: [
      { name: "View activity", code: "view_activity" },
      { name: "View analytics", code: "view_analytics" },
      { name: "View KPIs", code: "view_kpis" },
      { name: "View map", code: "view_map" },
      { name: "View revenue", code: "view_revenue" },
      { name: "View dashboard", code: "view_dashboard" }
    ]
  },
  {
    name: "Shipments",
    code: "shipments",
    permissions: [
      { name: "View shipments", code: "view_shipments" },
      { name: "Create shipment", code: "create_shipment" },
      { name: "Edit shipment", code: "edit_shipment" },
      { name: "Delete shipment", code: "delete_shipment" },
      { name: "Bulk delete", code: "bulk_delete" },
      { name: "Export shipments", code: "export_shipments" },
      { name: "Update status", code: "update_status" }
    ]
  },
  {
    name: "Customers & Vendors",
    code: "contacts",
    permissions: [
      { name: "View customers", code: "view_customers" },
      { name: "Manage customers", code: "manage_customers" },
      { name: "View vendors", code: "view_vendors" },
      { name: "Manage vendors", code: "manage_vendors" }
    ]
  },
  {
    name: "Settings & Config",
    code: "settings",
    permissions: [
      { name: "View configuration", code: "view_config" },
      { name: "Manage statuses", code: "manage_statuses" },
      { name: "Manage services", code: "manage_services" },
      { name: "Manage HS codes", code: "manage_hscodes" },
      { name: "Manage billing", code: "manage_billing" }
    ]
  }
];

const totalPermissionsCount = 22; // 6 + 7 + 4 + 5

export default function UsersAndTeamsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "permissions">("users");
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [orgPlan, setOrgPlan] = useState<any>(null);

  const getPlanAllowedPermissionsCount = () => {
    let count = 0;
    permissionCategories.forEach(category => {
      category.permissions.forEach(p => {
        if (orgPlan) {
          const features = orgPlan.features || {};
          if (p.code === "view_revenue" || p.code === "manage_billing") {
            if (features.accounts !== true) return;
          }
          if (p.code === "bulk_delete") {
            if (features.bulkUpload !== true) return;
          }
        }
        count++;
      });
    });
    return count || 1; // Avoid divide by zero
  };

  // Role permissions mapping state
  const [rolePermissions, setRolePermissions] = useState<Record<RoleName, string[]>>({
    "Customer": [],
    "Vendor": [],
    "Employee": [],
    "Admin": [],
    "Super Admin": []
  });

  // Collapsed sections in permissions list
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    dashboard: false,
    shipments: false,
    contacts: false,
    settings: false
  });

  // Modal / Form States
  const [openModal, setOpenModal] = useState<"invite" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Employee",
    status: "Active",
    branch: "HQ",
    department: "—"
  });

  const fetchUsersAndPermissions = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
        setFilteredUsers(data);
      }

      // 2. Fetch Role Permissions Settings
      const permRes = await fetch("/api/settings/custom?key=settings_role_permissions");
      if (permRes.ok) {
        const data = await permRes.json();
        if (data.value) {
          setRolePermissions(JSON.parse(data.value));
        }
      }

      // 3. Fetch Org Current Plan Features
      const orgRes = await fetch("/api/org/current");
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        if (orgData.success && orgData.organization) {
          setOrgPlan(orgData.organization.subscription?.plan || null);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<any>(token);
        const isSuper = decoded.platformRole === "SUPER_ADMIN";
        const isOwner = decoded.orgRole === "OWNER";
        if (decoded.userId) {
          setCurrentUserId(Number(decoded.userId));
        }
        if (isSuper || isOwner) {
          setIsAuthorized(true);
          fetchUsersAndPermissions();
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error("Token decoding error", err);
        setIsAuthorized(false);
      }
    } else {
      setIsAuthorized(false);
    }
  }, []);

  // Filter users
  useEffect(() => {
    let res = users;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    }
    setFilteredUsers(res);
  }, [searchTerm, users]);

  // Invite/Save User
  const handleInviteUser = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editingUser && !form.password.trim())) {
      toast.error("Please fill in name, email and password fields");
      return;
    }
    try {
      const isEditing = !!editingUser;
      const url = isEditing ? `/api/users/${editingUser.id}` : "/api/users";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing 
        ? { name: form.name, email: form.email, role: form.role, status: form.status }
        : { name: form.name, email: form.email, password: form.password, role: form.role };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? "User details updated" : "User invited successfully");
        setOpenModal(null);
        setEditingUser(null);
        fetchUsersAndPermissions();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to process user registration");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // Delete User
  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User removed successfully");
        fetchUsersAndPermissions();
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // Toggle single permission for a role
  const handleTogglePermission = async (role: RoleName, code: string, checked: boolean) => {
    if (role === "Super Admin") return; // Super admin has locked access

    const updatedRoles = { ...rolePermissions };
    const list = updatedRoles[role] || [];
    if (checked) {
      if (!list.includes(code)) {
        updatedRoles[role] = [...list, code];
      }
    } else {
      updatedRoles[role] = list.filter(item => item !== code);
    }

    setRolePermissions(updatedRoles);

    // Save configuration immediately to backend
    try {
      await fetch("/api/settings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "settings_role_permissions",
          value: JSON.stringify(updatedRoles)
        })
      });
      toast.success(`Permissions updated for role ${role}`);
    } catch {
      toast.error("Failed to sync permissions mapping to database");
    }
  };

  const getRoleCardClass = (role: RoleName) => {
    switch (role) {
      case "Customer": return { bg: "bg-pink-50/50 dark:bg-pink-950/10 border-pink-100 dark:border-pink-900/30", iconBg: "bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300", progressBg: "bg-pink-500", text: "text-pink-900 dark:text-pink-200" };
      case "Vendor": return { bg: "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30", iconBg: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300", progressBg: "bg-amber-500", text: "text-amber-900 dark:text-amber-200" };
      case "Employee": return { bg: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30", iconBg: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300", progressBg: "bg-emerald-500", text: "text-emerald-900 dark:text-emerald-200" };
      case "Admin": return { bg: "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30", iconBg: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300", progressBg: "bg-blue-500", text: "text-blue-900 dark:text-blue-200" };
      case "Super Admin": return { bg: "bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30", iconBg: "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300", progressBg: "bg-indigo-500", text: "text-indigo-900 dark:text-indigo-200" };
    }
  };

  const getRoleIcon = (role: RoleName) => {
    switch (role) {
      case "Customer": return User;
      case "Vendor": return Building;
      case "Employee": return Briefcase;
      case "Admin": return ShieldCheck;
      case "Super Admin": return Shield;
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full text-sm text-gray-500 bg-gray-50 dark:bg-zinc-950">
        Checking permissions...
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full p-4 bg-gray-50 dark:bg-zinc-950">
        <Card className="max-w-md w-full shadow-lg border border-red-100 dark:border-red-950/30 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="h-2 bg-red-500" />
          <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              You do not have permission to view the Users & Teams page. This section is restricted to Super Administrators and Organization Owners.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="mt-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500">
        Loading Users & Teams...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ml-0 min-h-[calc(100vh-64px)]">
      
      {/* Top Tabs navbar */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 mb-8">
        <button 
          onClick={() => setActiveTab("users")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${
            activeTab === "users" 
              ? "border-[#4F46E5] text-[#4F46E5]" 
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
          }`}
        >
          Users & Teams
        </button>
        <button 
          onClick={() => setActiveTab("permissions")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${
            activeTab === "permissions" 
              ? "border-[#4F46E5] text-[#4F46E5]" 
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
          }`}
        >
          Roles & Permissions
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          
          {/* TAB 1: Users & Teams */}
          {activeTab === "users" && (
            <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Users & Teams</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your organization's users and their access permissions.</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingUser(null);
                    setForm({ name: "", email: "", password: "", role: "Employee", status: "Active", branch: "HQ", department: "—" });
                    setOpenModal("invite");
                  }}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Invite User
                </Button>
              </div>
              <div className="p-6">
                
                {/* Search / Filters */}
                <div className="flex justify-between items-center gap-4 mb-6">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                      placeholder="Search users by name or email..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 text-sm rounded-lg border-gray-200 dark:border-zinc-800"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-gray-100 dark:border-zinc-850 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                        <th className="px-5 py-4 w-1/4">Users</th>
                        <th className="px-5 py-4">Role</th>
                        <th className="px-5 py-4">2FA</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Last Login</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-900 dark:text-white">{u.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                          </td>
                          <td className="px-5 py-4 capitalize font-semibold">{u.role || "Employee"}</td>
                          <td className="px-5 py-4">
                            <Shield className="w-4 h-4 text-gray-300 dark:text-zinc-700" />
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-[#A5B4FC] rounded-full text-xs font-bold border border-indigo-200/20">
                              {u.status === 'PENDING' ? 'Pending' : (u.status || 'Active')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-gray-400">Never</td>
                          <td className="px-5 py-4 text-right">
                            {u.id === currentUserId ? (
                              <span className="text-xs text-gray-400 font-medium italic pr-2 select-none">Logged In (You)</span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingUser(u);
                                    setForm({
                                      name: u.name,
                                      email: u.email,
                                      password: "",
                                      role: u.role || "Employee",
                                      status: u.status || "Active",
                                      branch: "HQ",
                                      department: "—"
                                    });
                                    setOpenModal("edit");
                                  }} className="flex items-center gap-2">
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-2 text-red-650">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-between items-center text-sm text-gray-400">
                  <span>Showing 1 to {filteredUsers.length} of {filteredUsers.length} entries</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" disabled>Prev</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" disabled>Next</Button>
                  </div>
                </div>

              </div>
            </Card>
          )}

          {/* TAB 2: Roles & Permissions */}
          {activeTab === "permissions" && (
            <div className="space-y-8">
              
              {/* Role Indicator Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(["Customer", "Vendor", "Employee", "Admin", "Super Admin"] as RoleName[]).map((r) => {
                  const styles = getRoleCardClass(r);
                  const Icon = getRoleIcon(r);
                  const permList = rolePermissions[r] || [];
                  const maxAllowedCount = getPlanAllowedPermissionsCount();
                  const allowedPermList = permList.filter(code => {
                    if (orgPlan) {
                      const features = orgPlan.features || {};
                      if (code === "view_revenue" || code === "manage_billing") {
                        return features.accounts === true;
                      }
                      if (code === "bulk_delete") {
                        return features.bulkUpload === true;
                      }
                    }
                    return true;
                  });
                  const checkedCount = r === "Super Admin" ? maxAllowedCount : allowedPermList.length;
                  const progressPct = Math.round((checkedCount / maxAllowedCount) * 100);

                  return (
                    <Card key={r} className={`shadow-sm border rounded-xl p-4 flex flex-col justify-between relative ${styles?.bg}`}>
                      
                      <div className="flex justify-between items-start">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles?.iconBg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {r === "Super Admin" && <Lock className="w-3.5 h-3.5 text-indigo-400 absolute top-3.5 right-3.5" />}
                      </div>

                      <div className="mt-4">
                        <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">{r}</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                            {r === "Super Admin" ? "All" : `${checkedCount} / ${maxAllowedCount}`}
                          </span>
                        </div>

                        {/* Progress line */}
                        <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className={`h-full ${styles?.progressBg}`} style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 mt-1.5 block">{progressPct}% access</span>
                      </div>

                    </Card>
                  );
                })}
              </div>

              {/* Roles matrix checkbox table */}
              <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6">
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-950 dark:text-white">Roles & Permissions Matrix</h3>
                    <p className="text-sm text-gray-500 mt-1">Review and manage access control for each role. Assign permissions to users.</p>
                  </div>
                  
                  {/* Search inside permissions */}
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <Input 
                      placeholder="Search permissions..." 
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      className="pl-8 h-9 text-sm rounded-lg border-gray-200"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-150 dark:border-zinc-850 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-150 dark:border-zinc-800">
                        <th className="px-5 py-4 w-1/3">FEATURE</th>
                        {(["Customer", "Vendor", "Employee", "Admin", "Super Admin"] as RoleName[]).map((r) => (
                          <th key={r} className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-gray-900 dark:text-white">{r}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 dark:divide-zinc-800 text-sm">
                      
                      {permissionCategories.map((category) => {
                        const isCollapsed = collapsedSections[category.code];
                         const filteredPerms = category.permissions.filter(p => {
                           const matchesSearch = p.name.toLowerCase().includes(permSearch.toLowerCase());
                           if (!matchesSearch) return false;
                           if (orgPlan) {
                             const features = orgPlan.features || {};
                             if (p.code === "view_revenue" || p.code === "manage_billing") {
                               return features.accounts === true;
                             }
                             if (p.code === "bulk_delete") {
                               return features.bulkUpload === true;
                             }
                           }
                           return true;
                         });

                        if (filteredPerms.length === 0) return null;

                        return (
                          <>
                            {/* Category Header Row */}
                            <tr key={category.code} className="bg-gray-100/50 dark:bg-zinc-800/20 font-bold text-gray-600 dark:text-zinc-400">
                              <td colSpan={6} className="px-4 py-2.5 text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none" onClick={() => {
                                setCollapsedSections(prev => ({ ...prev, [category.code]: !prev[category.code] }));
                              }}>
                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {category.name}
                                <span className="bg-[#4F46E5]/10 text-[#4F46E5] text-xs px-1.5 py-0.5 rounded ml-2">
                                  {filteredPerms.length}
                                </span>
                              </td>
                            </tr>

                            {/* Permission Rows */}
                            {!isCollapsed && filteredPerms.map((perm) => (
                              <tr key={perm.code} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/20 text-sm text-gray-700 dark:text-zinc-300">
                                <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-gray-200 pl-8">{perm.name}</td>
                                
                                {(["Customer", "Vendor", "Employee", "Admin", "Super Admin"] as RoleName[]).map((role) => {
                                  const isChecked = role === "Super Admin" || (rolePermissions[role] || []).includes(perm.code);
                                  const isDisabled = role === "Super Admin";

                                  return (
                                    <td key={role} className="px-5 py-3.5 text-center">
                                      <div className="flex justify-center items-center">
                                        {isDisabled ? (
                                          <div className="w-4 h-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 rounded flex items-center justify-center">
                                            <Lock className="w-2.5 h-2.5 text-indigo-500" />
                                          </div>
                                        ) : (
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => handleTogglePermission(role, perm.code, !!checked)}
                                            className="h-4 w-4 data-[state=checked]:bg-[#4F46E5] border-gray-300"
                                          />
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </>
                        );
                      })}

                    </tbody>
                  </table>
                </div>

              </Card>

            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Invite/Edit User Dialog */}
      <Dialog open={openModal !== null} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User Details" : "Invite New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">Full Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Maria Transport"
                className="text-xs rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Email Address</Label>
              <Input 
                value={form.email} 
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g. maria.transport@demo.co"
                className="text-xs rounded-lg"
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label className="text-xs">Initial Password</Label>
                <Input 
                  type="password"
                  value={form.password} 
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password"
                  className="text-xs rounded-lg"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Role</Label>
              <Select 
                value={form.role} 
                onValueChange={(val) => setForm(prev => ({ ...prev, role: val }))}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Vendor">Vendor</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser && (
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select 
                  value={form.status} 
                  onValueChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={handleInviteUser} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
