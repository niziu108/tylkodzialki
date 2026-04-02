import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/buildInvoicePdf";

type RouteContext = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
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

  if (!currentUser) {
    return new NextResponse("Nie znaleziono użytkownika", { status: 404 });
  }

  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return new NextResponse("Nie znaleziono faktury", { status: 404 });
  }

  const isOwner = invoice.userId === currentUser.id;
  const isAdmin = currentUser.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return new NextResponse("Brak dostępu", { status: 403 });
  }

  const pdfBytes = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber || "FAKTURA",
    createdAt: invoice.issuedAt || invoice.createdAt,
    amountGross: invoice.amountGross,
    currency: invoice.currency,
    buyerType: invoice.buyerType,
    companyName: invoice.companyName,
    nip: invoice.nip,
    addressLine1: invoice.addressLine1,
    addressLine2: invoice.addressLine2,
    postalCode: invoice.postalCode,
    city: invoice.city,
    country: invoice.country,
    invoiceEmail: invoice.invoiceEmail,
    itemName: invoice.itemName,
    quantity: invoice.quantity,
  });

  const safeFileName = (invoice.invoiceNumber || "faktura").replace(
    /[\/\\:*?"<>|]/g,
    "-"
  );

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}