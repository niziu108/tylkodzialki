import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const count = await prisma.dzialka.count();
  const last = await prisma.dzialka.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, tytul: true, createdAt: true },
  });

  const url = process.env.DATABASE_URL || "";
  const masked = url
    ? url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")
    : "";

  return NextResponse.json({
    ok: true,
    count,
    last,
    env: {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      databaseUrlMasked: masked,
    },
  });
}
