import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }
  try {
    const company = await prisma.company.findUnique({ where: { workspaceId } });
    return NextResponse.json(company || {});
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
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
      where: { workspaceId },
      update: companyData,
      create: { ...companyData, workspaceId },
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}
