"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Lock,
  Shield,
  MoreVertical
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

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "PENDING";

export default function UsersAndTeamsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  // Data State
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);

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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
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
          fetchUsers();
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

  // Filter users based on search term & status filter
  useEffect(() => {
    let res = users;

    // Apply status filter
    if (statusFilter !== "ALL") {
      res = res.filter(u => {
        const userStatus = (u.status || "ACTIVE").toUpperCase();
        return userStatus === statusFilter;
      });
    }

    // Apply search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    }

    setFilteredUsers(res);
  }, [searchTerm, statusFilter, users]);

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
        fetchUsers();
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
        fetchUsers();
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // Status metrics counts
  const totalCount = users.length;
  const activeCount = users.filter(u => (u.status || "ACTIVE").toUpperCase() === "ACTIVE").length;
  const inactiveCount = users.filter(u => (u.status || "ACTIVE").toUpperCase() === "INACTIVE").length;
  const pendingCount = users.filter(u => (u.status || "ACTIVE").toUpperCase() === "PENDING").length;

  const getRoleBadgeStyle = (role: string) => {
    const r = role || "Employee";
    switch (r.toLowerCase()) {
      case "customer":
        return "bg-pink-50 dark:bg-pink-950/20 text-pink-650 dark:text-pink-400 border-pink-200/20";
      case "vendor":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-650 dark:text-amber-400 border-amber-200/20";
      case "employee":
        return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 border-emerald-200/20";
      case "admin":
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-650 dark:text-blue-400 border-blue-200/20";
      case "super admin":
        return "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 border-indigo-200/20";
      default:
        return "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200/20";
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = status || "ACTIVE";
    switch (s.toUpperCase()) {
      case "ACTIVE":
        return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-250/20";
      case "PENDING":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-650 dark:text-amber-450 border-amber-250/20";
      case "INACTIVE":
        return "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200/20";
      case "SUSPENDED":
        return "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/20";
      default:
        return "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200/20";
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full text-sm text-gray-500 bg-white dark:bg-zinc-900">
        Checking permissions...
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full p-4 bg-white dark:bg-zinc-900">
        <Card className="max-w-md w-full shadow-lg border border-red-100 dark:border-red-950/30 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
          <div className="h-2 bg-red-500" />
          <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              You do not have permission to view the Users & Teams page. This section is restricted to Super Administrators and Organization Owners.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500 bg-white dark:bg-zinc-900">
        Loading Users & Teams...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0 min-h-[calc(100vh-64px)]">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <Users className="w-8 sm:w-10 h-8 sm:h-10 text-blue-600" />
            Users & Teams
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your organization's users and their roles
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium text-capitalize">
            {statusFilter === "ALL"
              ? `Showing all ${filteredUsers.length} registered users`
              : `Showing only ${statusFilter.toLowerCase()} users (${filteredUsers.length})`}
          </p>
        </div>

        {/* Status filters matching Customers */}
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[100px] ${
              statusFilter === "ALL"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-650 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-blue-900/20"
            }`}
          >
            <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-300">{totalCount}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">Total Users</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[100px] ${
              statusFilter === "ACTIVE"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-650 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20"
            }`}
          >
            <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-300">{activeCount}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">Active</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[100px] ${
              statusFilter === "PENDING"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-650 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-amber-50/60 dark:hover:bg-amber-900/20"
            }`}
          >
            <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-300">{pendingCount}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">Pending</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[100px] ${
              statusFilter === "INACTIVE"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-655 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-800/40"
            }`}
          >
            <span className="text-base sm:text-lg font-bold text-gray-600 dark:text-gray-400">{inactiveCount}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">Inactive</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Search users by name, email or role..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm rounded-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button 
            onClick={() => {
              setEditingUser(null);
              setForm({ name: "", email: "", password: "", role: "Employee", status: "Active", branch: "HQ", department: "—" });
              setOpenModal("invite");
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <Card className="border border-gray-150 dark:border-zinc-800 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2 sm:border-spacing-y-4 px-6 pb-6 pt-2">
              <thead>
                <tr className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-3 w-1/3">User Info</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-center">2FA Status</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <AnimatePresence>
                  {filteredUsers.map((u, i) => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.02, duration: 0.2 }}
                      className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/10 text-gray-700 dark:text-zinc-300"
                    >
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 rounded-l-xl border-t border-b border-l border-gray-100 dark:border-zinc-850">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shadow-sm">
                            {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{u.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 border-t border-b border-gray-100 dark:border-zinc-850">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getRoleBadgeStyle(u.role)}`}>
                          {u.role || "Employee"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 border-t border-b border-gray-100 dark:border-zinc-850 text-center">
                        <div className="flex justify-center">
                          <Shield className="w-4 h-4 text-gray-300 dark:text-zinc-700" />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 border-t border-b border-gray-100 dark:border-zinc-850">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeStyle(u.status)}`}>
                          {u.status === "PENDING" ? "Pending" : (u.status || "Active")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 border-t border-b border-gray-100 dark:border-zinc-850 text-gray-405">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                      </td>
                      <td className="px-5 py-3.5 bg-gray-50/30 dark:bg-zinc-800/5 rounded-r-xl border-t border-b border-r border-gray-100 dark:border-zinc-850 text-right">
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
                              <DropdownMenuItem onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-2 text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 flex justify-between items-center border-t border-gray-100 dark:border-zinc-800/60 text-sm text-gray-400 bg-gray-50/10 dark:bg-zinc-900/50">
            <span>Showing {filteredUsers.length} of {users.length} users</span>
          </div>
        </CardContent>
      </Card>

      {/* Invite/Edit User Dialog */}
      <Dialog open={openModal !== null} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              {editingUser ? "Edit User Details" : "Invite New User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Full Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Maria Transport"
                className="text-xs rounded-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</Label>
              <Input 
                value={form.email} 
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g. maria.transport@demo.co"
                className="text-xs rounded-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Initial Password</Label>
                <Input 
                  type="password"
                  value={form.password} 
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password"
                  className="text-xs rounded-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Role</Label>
              <Select 
                value={form.role} 
                onValueChange={(val) => setForm(prev => ({ ...prev, role: val }))}
              >
                <SelectTrigger className="w-full text-xs border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <SelectTriggerContent>
                    <SelectValue placeholder="Select Role" />
                  </SelectTriggerContent>
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-850">
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
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</Label>
                <Select 
                  value={form.status} 
                  onValueChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                >
                  <SelectTrigger className="w-full text-xs border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <SelectTriggerContent>
                      <SelectValue placeholder="Select Status" />
                    </SelectTriggerContent>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-850">
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpenModal(null)} className="text-xs rounded-lg">Cancel</Button>
            <Button onClick={handleInviteUser} className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg px-4">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

const SelectTriggerContent = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center justify-between w-full">{children}</div>;
};
