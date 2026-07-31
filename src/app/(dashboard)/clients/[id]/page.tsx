"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, MapPin, Building2, Edit3, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function ClientDetailPage() {
  const params = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Acme Corp
            </h1>
            <p className="text-sm text-gray-500">Client since June 2026</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-red-500">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                JD
              </div>
              <div>
                <p className="font-medium">John Doe</p>
                <p className="text-sm text-gray-500">Primary Contact</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                john@acme.com
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                +1 (555) 123-4567
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                123 Main St, New York, NY
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-400" />
                Tax ID: 12-3456789
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold mt-1">
                    {formatCurrency(12500)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-xl font-bold mt-1 text-red-500">
                    {formatCurrency(2500)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Invoices</p>
                  <p className="text-xl font-bold mt-1">5</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { id: "INV-00006", date: "07/15/2026", amount: 3200, status: "pending" },
                  { id: "INV-00004", date: "06/01/2026", amount: 2500, status: "paid" },
                  { id: "INV-00002", date: "05/15/2026", amount: 1800, status: "paid" },
                ].map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-800"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.id}</p>
                      <p className="text-xs text-gray-500">{inv.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">
                        {formatCurrency(inv.amount)}
                      </span>
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "paid"
                            : "pending"
                        }
                      >
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
