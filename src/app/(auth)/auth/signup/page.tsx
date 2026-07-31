"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import { signup } from "@/app/actions/auth";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600">
            <FileText className="h-6 w-6 text-white" />
          </div>
        </div>
        <CardTitle className="text-xl">Create Account</CardTitle>
        <CardDescription>
          Sign up for a new InvoiceFlow account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="John Doe"
              required
            />
            {state?.errors?.name && (
              <p className="text-sm text-red-500">{state.errors.name[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              required
            />
            {state?.errors?.email && (
              <p className="text-sm text-red-500">{state.errors.email[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
            {state?.errors?.password && (
              <ul className="text-sm text-red-500 space-y-0.5">
                {state.errors.password.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            )}
          </div>
          {state?.message && (
            <p className="text-sm text-red-500">{state.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account..." : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/auth/signin" className="text-emerald-600 hover:underline">
            Sign in
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

