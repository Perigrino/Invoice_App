"use client";

import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
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
import type { SavedClient } from "@/store/client-store";

interface ClientRowMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ClientRowMenu({ open, onOpenChange, onEdit, onDelete }: ClientRowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  const itemClass = "flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 lg:py-1.5";

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 lg:h-8 lg:w-8"
        onClick={() => onOpenChange(!open)}
        aria-label="Client actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950">
          <button type="button" className={itemClass} onClick={() => { onEdit(); }}>
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            className={cn(itemClass, "text-red-500 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400")}
            onClick={() => { onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

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

  const openEdit = (client: SavedClient) => {
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
    if (window.confirm("Delete this client?")) {
      deleteClient(id);
    }
    setMenuOpen(null);
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const clientCard = (item: SavedClient) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            {initials(item.fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 dark:text-gray-50">
              {item.fullName}
            </p>
            {item.company && (
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {item.company}
              </p>
            )}
          </div>
        </div>
        <ClientRowMenu
          open={menuOpen === item.id}
          onOpenChange={(o) => setMenuOpen(o ? item.id : null)}
          onEdit={() => openEdit(item)}
          onDelete={() => handleDelete(item.id)}
        />
      </div>
      {(item.email || item.phone) && (
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {item.email && (
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{item.email}</span>
            </p>
          )}
          {item.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gray-400" />
              {item.phone}
            </p>
          )}
        </div>
      )}
    </div>
  );

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
        <Button onClick={openNew} className="hidden md:inline-flex">
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
                  {initials(item.fullName)}
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
            className: "w-14",
            cell: (item) => (
              <ClientRowMenu
                open={menuOpen === item.id}
                onOpenChange={(o) => setMenuOpen(o ? item.id : null)}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ),
          },
        ]}
        data={filtered}
        renderCard={clientCard}
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

      <Button
        onClick={openNew}
        aria-label="Add client"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 h-14 w-14 rounded-full p-0 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
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
                type="tel"
                inputMode="tel"
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="col-span-1 space-y-2 sm:col-span-2">
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
