"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  MoreHorizontal,
  Edit3,
  Trash2,
} from "lucide-react";
import { useClientStore } from "@/store/client-store";

export function ClientList() {
  const { clients, hydrate, addClient, updateClient, deleteClient } = useClientStore();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => { hydrate() }, [hydrate]);

  const filtered = clients.filter(
    (c) =>
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ fullName: "", company: "", email: "", phone: "", address: "" });
    setDialogOpen(true);
  };

  const openEdit = (client: typeof clients[0]) => {
    setEditing(client.id);
    setForm({
      fullName: client.fullName,
      company: client.company,
      email: client.email,
      phone: client.phone,
      address: client.address,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateClient(editing, form);
    } else {
      addClient(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this client?")) {
      deleteClient(id);
    }
    setMenuOpen(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Clients
          </h1>
          <p className="text-sm text-gray-500">
            Manage your clients and their invoices
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Client",
            sortable: true,
            cell: (item) => (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
                  {item.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium">{item.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.company}</p>
                </div>
              </div>
            ),
          },
          {
            key: "email",
            header: "Contact",
            cell: (item) => (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  {item.email}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {item.phone}
                </div>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-12 relative",
            cell: (item) => (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen === item.id && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950"
                    onMouseLeave={() => setMenuOpen(null)}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={() => { openEdit(item); setMenuOpen(null) }}
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ),
          },
        ]}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No clients yet"
            description="Add your first client to start creating invoices."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            }
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Smith"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                placeholder="Acme Corp"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="john@acme.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Street, City, State, ZIP"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
