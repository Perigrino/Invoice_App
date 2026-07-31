"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Add Client
          </h1>
          <p className="text-sm text-gray-500">
            Create a new client profile
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="john@acme.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+1 (555) 000-0000" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input placeholder="Street, City, State, ZIP" />
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input placeholder="12-3456789" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href="/clients">Cancel</Link>
            </Button>
            <Button>
              <Save className="h-4 w-4" />
              Save Client
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
