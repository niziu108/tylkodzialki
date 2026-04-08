import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new NextResponse("Brak autoryzacji", { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return new NextResponse("Brak dostępu", { status: 403 });
  }

  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message: "KSeF jest tymczasowo wyłączony.",
    },
    { status: 503 }
  );
}