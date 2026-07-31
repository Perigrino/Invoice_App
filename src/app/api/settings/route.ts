import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth/dal";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await prisma.setting.findUnique({
      where: { userId },
    });
    return NextResponse.json(settings || {});
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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
    const existing = await prisma.setting.findUnique({ where: { userId } });
    if (existing) {
      const settings = await prisma.setting.update({
        where: { userId },
        data: body,
      });
      return NextResponse.json(settings);
    } else {
      const settings = await prisma.setting.create({
        data: { userId, ...body },
      });
      return NextResponse.json(settings);
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
