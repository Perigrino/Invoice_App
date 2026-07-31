import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth/dal";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    return NextResponse.json(user?.company || {});
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const companyData = {
      name: body.name || body.fullName || "",
      logo: body.logo,
      address: body.address,
      email: body.email,
      phone: body.phone,
      website: body.website,
    };

    let company;
    if (user.companyId) {
      company = await prisma.company.update({
        where: { id: user.companyId },
        data: companyData,
      });
    } else {
      company = await prisma.company.create({
        data: { ...companyData, users: { connect: { id: userId } } },
      });
    }
    return NextResponse.json(company);
  } catch {
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}
