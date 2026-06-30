"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Search, Plus, MoreVertical, Edit3, Trash2, Check, FileCode, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HsCodesPage() {
  const router = useRouter();
  const [hscodes, setHscodes] = useState<any[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal / Form States
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    code: "",
    description: "",
    category: "General",
    active: true
  });

  const fetchHsCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/hscodes");
      if (res.ok) {
        const data = await res.json();
        setHscodes(data);
        setFilteredCodes(data);
      } else {
        toast.error("Failed to load HS codes");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHsCodes();
  }, []);

  // Filter HS Codes
  useEffect(() => {
    let res = hscodes;
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(h => 
        h.code.toLowerCase().includes(q) || 
        h.description.toLowerCase().includes(q) ||
        (h.category || "").toLowerCase().includes(q)
      );
    }
    setFilteredCodes(res);
  }, [search, hscodes]);

  // Add / Update HS Code
  const handleSaveHsCode = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      toast.error("Please fill in HS Code and Description");
      return;
    }
    try {
      const url = "/api/settings/hscodes";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });

      if (res.ok) {
        toast.success(editingId ? "HS Code updated" : "HS Code created");
        setOpenModal(false);
        setEditingId(null);
        fetchHsCodes();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to save HS Code");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // Delete HS Code
  const handleDeleteHsCode = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this HS Code?")) return;
    try {
      const res = await fetch(`/api/settings/hscodes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("HS Code deleted successfully");
        fetchHsCodes();
      } else {
        toast.error("Failed to delete HS Code");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500">
        Loading HS Codes...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ml-0 min-h-[calc(100vh-64px)]">
      
      {/* Header section with back button */}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">HS Codes Configuration</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage HS codes for international shipments and customs clearance.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-zinc-850 pb-5 gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-[#4F46E5]" />
              HS Codes Catalog
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Available tariff codes for customs declaration.
            </CardDescription>
          </div>
          <Button 
            onClick={() => {
              setEditingId(null);
              setForm({ code: "", description: "", category: "General", active: true });
              setOpenModal(true);
            }}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add HS Code
          </Button>
        </CardHeader>
        <CardContent className="pt-6">

          {/* Search bar */}
          <div className="relative w-full max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search HS codes or descriptions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-lg border-gray-200"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-100 dark:border-zinc-850 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/40 text-[11px] font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                  <th className="px-5 py-4 w-1/4">HS Code</th>
                  <th className="px-5 py-4 w-1/2">Description</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Active</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-xs text-gray-700 dark:text-zinc-300">
                {filteredCodes.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900 dark:text-white">{h.code}</td>
                    <td className="px-5 py-4 text-gray-650 dark:text-zinc-400">{h.description}</td>
                    <td className="px-5 py-4 font-medium">{h.category || "General"}</td>
                    <td className="px-5 py-4">
                      {h.active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded border border-green-200/20">
                          <Check className="w-3.5 h-3.5" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingId(h.id);
                            setForm({ code: h.code, description: h.description, category: h.category || "General", active: h.active });
                            setOpenModal(true);
                          }} className="flex items-center gap-2">
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteHsCode(h.id)} className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-xs text-gray-400">
            Showing 1 to {filteredCodes.length} of {filteredCodes.length} entries
          </div>

        </CardContent>
      </Card>

      {/* Add / Edit HS Code Modal */}
      <Dialog open={openModal} onOpenChange={(open) => !open && setOpenModal(false)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit HS Code" : "Add HS Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">HS Code</Label>
              <Input 
                value={form.code} 
                onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. 0901.21"
                className="text-xs rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Input 
                value={form.description} 
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Roasted coffee"
                className="text-xs rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <Select 
                value={form.category} 
                onValueChange={(val) => setForm(prev => ({ ...prev, category: val }))}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                  <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
                  <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                  <SelectItem value="Packaging">Packaging</SelectItem>
                  <SelectItem value="Apparel">Apparel</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs">Active Status Status</Label>
              <Switch 
                checked={form.active} 
                onCheckedChange={(val) => setForm(prev => ({ ...prev, active: val }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(false)}>Cancel</Button>
            <Button onClick={handleSaveHsCode} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
