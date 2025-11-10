
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivateRoute } from "@/components/auth/private-route";

type User = {
  id: string;
  email: string;
  role: "user" | "admin";
  isActive: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(u: User) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: u.role === "admin" ? "user" : "admin" }),
    });
    if (res.ok) load();
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: u.isActive ? 0 : 1 }),
    });
    if (res.ok) load();
  }

  return (
    <PrivateRoute>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div>Loading…</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!loading && !error && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.isActive ? "Active" : "Inactive"}</td>
                      <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                      <td className="flex gap-2 justify-end py-2">
                        <Button variant="outline" onClick={() => toggleRole(u)}>
                          Make {u.role === "admin" ? "User" : "Admin"}
                        </Button>
                        <Button variant="outline" onClick={() => toggleActive(u)}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
