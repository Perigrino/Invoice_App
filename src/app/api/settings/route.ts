import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.setting.findFirst();
    return NextResponse.json(settings || {});
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const existing = await prisma.setting.findFirst();
    if (existing) {
      const settings = await prisma.setting.update({
        where: { id: existing.id },
        data: body,
      });
      return NextResponse.json(settings);
    } else {
      const settings = await prisma.setting.create({ data: body });
      return NextResponse.json(settings);
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
