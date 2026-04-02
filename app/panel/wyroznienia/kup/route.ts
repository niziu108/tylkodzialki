import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";

import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const email = session.user.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);

  const plan = searchParams.get("plan");
  const dzialkaId = searchParams.get("dzialkaId");

  let price = 0;
  let credits = 0;
  let name = "";

  if (plan === "featured_1") {
    price = 1900;
    credits = 1;
    name = "Wyróżnienie ogłoszenia – 1 szt.";
  }

  if (plan === "featured_3") {
    price = 3900;
    credits = 3;
    name = "Pakiet wyróżnień – 3 szt.";
  }

  if (!price) {
    return NextResponse.json({ error: "Nieprawidłowy plan." }, { status: 400 });
  }

  const checkout = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",

    customer_email: user.email,

    line_items: [
      {
        price_data: {
          currency: "pln",
          product_data: {
            name,
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
    },

    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/panel/wyroznienia/sukces`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/panel/wyroznienia`,
  });

  return NextResponse.redirect(checkout.url!);
}