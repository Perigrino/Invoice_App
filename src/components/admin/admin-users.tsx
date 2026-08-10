"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, UserPlus, X } from "lucide-react";
import {
  createUserAction,
  deleteUserAction,
  setUserVerifiedAction,
  updateRoleAction,
  type AdminActionResult,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { passwordRules } from "@/lib/validations/auth";
import { useActionState } from "react";

export interface AdminUser {
  id: string;
  username: string | null;
  name: string | null;
  email: string;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
}

type Feedback = { kind: "error" | "note"; text: string } | null;

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [password, setPassword] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [addState, addAction, addPending] = useActionState<
    AdminActionResult,
    FormData
  >(createUserAction, {});
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!addPending && addState && !addState.error) {
      setAddOpen(false);
      setPassword("");
      setFormKey((k) => k + 1);
      setFeedback(
        addState.note ? { kind: "note", text: addState.note } : null
      );
      track("admin_user_created", {});
      router.refresh();
    }
  }, [addPending, addState, router]);

  const changeRole = (userId: string, role: string) => {
    setPendingId(userId);
    setFeedback(null);
    startTransition(async () => {
      const r = await updateRoleAction(userId, role);
      if (r.error) setFeedback({ kind: "error", text: r.error });
      else track("admin_role_changed", { userId, role });
      setPendingId(null);
      router.refresh();
    });
  };

  const toggleVerified = (user: AdminUser) => {
    setPendingId(user.id);
    setFeedback(null);
    startTransition(async () => {
      const r = await setUserVerifiedAction(user.id, !user.emailVerified);
      if (r.error) setFeedback({ kind: "error", text: r.error });
      else track("admin_verification_toggled", { userId: user.id });
      setPendingId(null);
      router.refresh();
    });
  };

  const remove = (user: AdminUser) => {
    if (!window.confirm(`Delete the account for ${user.email}? This cannot be undone.`))
      return;
    setPendingId(user.id);
    setFeedback(null);
    startTransition(async () => {
      const r = await deleteUserAction(user.id);
      if (r.error) setFeedback({ kind: "error", text: r.error });
      else track("admin_user_deleted", { userId: user.id });
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            feedback.kind === "error"
              ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm">
              <UserPlus className="h-4 w-4" />
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a user</DialogTitle>
              <DialogDescription>
                Create an account for someone. They start unverified until they
                confirm their email or you verify them here.
              </DialogDescription>
            </DialogHeader>
            <form
              key={formKey}
              action={addAction}
              className="space-y-4"
              onSubmit={() => track("admin_add_user_started", {})}
            >
              {addState.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {addState.error}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  name="username"
                  type="text"
                  autoComplete="off"
                  required
                  placeholder="janedoe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Password</Label>
                <PasswordInput
                  id="new-password"
                  name="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {password && (
                  <ul className="mt-2 space-y-1">
                    {passwordRules.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-1.5 text-xs ${
                            ok
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-gray-400"
                          }`}
                        >
                          {ok ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800">
                <Label htmlFor="new-send-email" className="text-sm">
                  Send verification email
                </Label>
                <Switch
                  id="new-send-email"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                />
                <input
                  type="hidden"
                  name="sendEmail"
                  value={sendEmail ? "on" : "off"}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addPending} className="w-full sm:w-auto">
                  {addPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {addPending ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {users.map((u) => {
        const isSelf = u.id === currentUserId;
        const pending = pendingId === u.id;
        const display = u.username ? `@${u.username}` : u.name || u.email;
        const initials = (u.username || u.name || u.email).slice(0, 2).toUpperCase();
        const verified = !!u.emailVerified;

        return (
          <div
            key={u.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/60"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {display}
                    </p>
                    {isSelf && <Badge variant="default">You</Badge>}
                    <Badge variant={verified ? "paid" : "pending"}>
                      {verified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {u.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSelf || !!pending}
                  onClick={() => toggleVerified(u)}
                >
                  {verified ? "Unverify" : "Verify"}
                </Button>
                <Select
                  value={u.role}
                  disabled={isSelf || !!pending}
                  onValueChange={(v) => changeRole(u.id, v)}
                >
                  <SelectTrigger className="w-32" aria-label={`Role for ${u.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${u.email}`}
                  disabled={isSelf || !!pending}
                  onClick={() => remove(u)}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-500" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
