import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";

import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CheckoutBody = {
  packageKey?: "featured_1" | "featured_3";
  dzialkaId?: string | null;
  invoiceType?: "NONE" | "COMPANY";
  invoice?: {
    companyName?: string;
    nip?: string;
    addressLine1?: string;
    postalCode?: string;
    city?: string;
    email?: string;
  };
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Brak autoryzacji." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as CheckoutBody | null;
    const packageKey = body?.packageKey;
    const dzialkaId =
      typeof body?.dzialkaId === "string" && body.dzialkaId.trim()
        ? body.dzialkaId.trim()
        : null;

    const email = session.user.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Nie znaleziono użytkownika." },
        { status: 404 }
      );
    }

    const invoiceType = body?.invoiceType === "COMPANY" ? "COMPANY" : "NONE";
    const invoice = body?.invoice || {};

    const companyName = (invoice.companyName || "").trim();
    const nip = onlyDigits(invoice.nip || "");
    const addressLine1 = (invoice.addressLine1 || "").trim();
    const postalCode = (invoice.postalCode || "").trim();
    const city = (invoice.city || "").trim();
    const invoiceEmail = (invoice.email || user.email || "")
      .trim()
      .toLowerCase();

    if (invoiceType === "COMPANY") {
      if (
        !companyName ||
        !nip ||
        !addressLine1 ||
        !postalCode ||
        !city ||
        !invoiceEmail
      ) {
        return NextResponse.json(
          { message: "Uzupełnij wszystkie dane do faktury firmowej." },
          { status: 400 }
        );
      }

      if (nip.length !== 10) {
        return NextResponse.json(
          { message: "NIP musi mieć 10 cyfr." },
          { status: 400 }
        );
      }
    }

    let price = 0;
    let credits = 0;
    let name = "";

    if (packageKey === "featured_1") {
      price = 1900;
      credits = 1;
      name = "Wyróżnienie ogłoszenia";
    }

    if (packageKey === "featured_3") {
      price = 3900;
      credits = 3;
      name = "Pakiet 3 wyróżnień";
    }

    if (!price) {
      return NextResponse.json(
        { message: "Nieprawidłowy pakiet." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const successUrl = new URL("/panel", appUrl);
    successUrl.searchParams.set("success", "featured");

    if (dzialkaId) {
      successUrl.searchParams.set("autoFeatured", "1");
      successUrl.searchParams.set("dzialkaId", dzialkaId);
    }

    const cancelUrl = new URL("/panel/wyroznienia", appUrl);
    if (dzialkaId) {
      cancelUrl.searchParams.set("dzialkaId", dzialkaId);
    }

    const checkout = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email || undefined,

      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: {
              name,
              description:
                credits === 1
                  ? "1 wyróżnienie ogłoszenia na 7 dni"
                  : "3 wyróżnienia ogłoszeń na 7 dni",
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],

      metadata: {
        type: "featured",
        userId: user.id,
        featuredCredits: credits.toString(),
        dzialkaId: dzialkaId ?? "",

        buyerType: invoiceType === "COMPANY" ? "company" : "none",
        companyName: invoiceType === "COMPANY" ? companyName : "",
        nip: invoiceType === "COMPANY" ? nip : "",
        addressLine1: invoiceType === "COMPANY" ? addressLine1 : "",
        addressLine2: "",
        postalCode: invoiceType === "COMPANY" ? postalCode : "",
        city: invoiceType === "COMPANY" ? city : "",
        country: "PL",
        invoiceEmail: invoiceType === "COMPANY" ? invoiceEmail : "",
      },

      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e: any) {
    console.error("STRIPE FEATURED CHECKOUT ERROR:", e);

    return NextResponse.json(
      {
        message: "Nie udało się utworzyć płatności.",
        error: e?.message || "UNKNOWN_ERROR",
      },
      { status: 500 }
    );
  }
}