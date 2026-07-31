"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCurrentUser } from "@/lib/api";
import { updateProfile, changePassword } from "@/app/actions/account";

export function AccountSettings() {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    fetchCurrentUser().then((data) => {
      if (data) setUser(data);
    });
  }, []);

  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    undefined
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    undefined
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={user?.name || ""}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email || ""}
                placeholder="john@example.com"
                required
              />
            </div>
            {profileState?.message && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {profileState.message}
              </p>
            )}
            {profileState?.error && (
              <p className="text-sm text-red-500">{profileState.error}</p>
            )}
            <Button type="submit" disabled={profilePending || !user}>
              {profilePending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            {passwordState?.message && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {passwordState.message}
              </p>
            )}
            {passwordState?.error && (
              <p className="text-sm text-red-500">{passwordState.error}</p>
            )}
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
