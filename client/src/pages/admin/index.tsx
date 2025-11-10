
import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";

type User = { id: string; email: string; role: "user" | "admin"; isActive: number; createdAt?: string; lastLoginAt?: string };

export default function AdminPanel() {
  const [me, setMe] = useState<{ email: string; role: "user" | "admin" } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const who = await fetch("/api/auth/whoami", { credentials: "include" });
        const w = who.ok ? await who.json() : null;
        setMe(w?.user || null);
        if (!w?.user || w.user.role !== "admin") return;
        const res = await fetch("/api/admin/users", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load users");
        const j = await res.json();
        setUsers(j.users || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!me) return <Redirect to="/login" />;
  if (me.role !== "admin") return <div className="p-6 text-red-600">Admin access required.</div>;

  async function updateUser(id: string, patch: Partial<User>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setUsers((u) => u.map(x => x.id === id ? { ...x, ...patch } as User : x));
    }
  }

  async function resetUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}/reset`, { method: "POST", credentials: "include" });
    const j = await res.json();
    alert(j.token ? `Reset token (test mode): ${j.token}` : "Reset requested (check email).");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin Panel</h1>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Active</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as any })}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={!!u.isActive}
                    onChange={(e) => updateUser(u.id, { isActive: e.target.checked ? 1 : 0 })}
                  />
                </td>
                <td className="p-2 flex gap-2">
                  <Button variant="outline" onClick={() => resetUser(u.id)}>Reset Password</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
