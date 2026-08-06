import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/user";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const company = await prisma.company.findUnique({ where: { userId } });
    return NextResponse.json(company || {});
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();

    const companyData = {
      name: body.name || body.fullName || "",
      logo: body.logo,
      address: body.address,
      email: body.email,
      phone: body.phone,
      website: body.website,
      taxId: body.taxId,
    };

    const company = await prisma.company.upsert({
      where: { userId },
      update: companyData,
      create: { ...companyData, userId },
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}
