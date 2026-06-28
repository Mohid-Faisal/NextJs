"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Member = {
  id: number;
  role: string;
  userId: number;
  name: string;
  email: string;
  userStatus: string;
  isSelf: boolean;
};

const ROLES = ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"];
const MANAGE_ROLES = ["OWNER", "ADMIN"];

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canManage = MANAGE_ROLES.includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org/members");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load team");
      setMembers(data.members ?? []);
      setRole(data.role || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member");
      setMembers((prev) => [...prev, data.member]);
      setInviteEmail("");
      setInviteRole("STAFF");
      toast.success(`${data.member.email} added as ${data.member.role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (member: Member, newRole: string) => {
    if (newRole === member.role) return;
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/org/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
      toast.success(`${member.name || member.email} is now ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: Member) => {
    if (!window.confirm(`Remove ${member.name || member.email} from the organization?`)) return;
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/org/members/${member.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Member removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Team</h1>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <p className="font-semibold">Add a member</p>
            <p className="text-sm text-muted-foreground">
              The person must already have an account. They&apos;ll get access on their next login.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </div>
              <div className="space-y-2 sm:w-44">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="inviteRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addMember} disabled={adding}>
                <UserPlus className="h-4 w-4" />
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${members.length} member(s)`}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Account</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground py-8">
                    No members yet.
                  </TableCell>
                </TableRow>
              )}
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.name || "—"} {m.isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) => changeRole(m, v)}
                        disabled={busyId === m.id}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{m.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.userStatus === "ACTIVE" ? "default" : "outline"}>
                      {m.userStatus === "ACTIVE" ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === m.id}
                        onClick={() => removeMember(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
