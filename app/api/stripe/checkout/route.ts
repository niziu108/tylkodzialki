import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { BuyerInvoiceType, ListingPackageType } from '@prisma/client';

type PackageConfig = {
  packageType: ListingPackageType;
  packageName: string;
  amountGrossPln: number;
  credits: number;
  featuredCredits: number;
  validityDays: number | null;
};

type CheckoutBody = {
  packageKey?: string;
  invoiceType?: 'NONE' | 'COMPANY';
  invoice?: {
    companyName?: string;
    nip?: string;
    addressLine1?: string;
    addressLine2?: string;
    postalCode?: string;
    city?: string;
    email?: string;
  };
};

const PACKAGE_MAP: Record<string, PackageConfig> = {
  single: {
    packageType: ListingPackageType.SINGLE,
    packageName: 'Pakiet 1',
    amountGrossPln: 1900,
    credits: 1,
    featuredCredits: 0,
    validityDays: null,
  },
  pack10: {
    packageType: ListingPackageType.PACK_10,
    packageName: 'Pakiet 10',
    amountGrossPln: 14900,
    credits: 10,
    featuredCredits: 1,
    validityDays: null,
  },
  pack40: {
    packageType: ListingPackageType.PACK_40,
    packageName: 'Pakiet 40',
    amountGrossPln: 39900,
    credits: 40,
    featuredCredits: 3,
    validityDays: null,
  },
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'Brak autoryzacji.' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Nie znaleziono użytkownika.' },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => null)) as CheckoutBody | null;
    const packageKey = String(body?.packageKey || '');
    const selected = PACKAGE_MAP[packageKey];

    if (!selected) {
      return NextResponse.json(
        { ok: false, message: 'Nieprawidłowy pakiet.' },
        { status: 400 }
      );
    }

    const invoiceType =
      body?.invoiceType === 'COMPANY'
        ? BuyerInvoiceType.COMPANY
        : BuyerInvoiceType.NONE;

    const invoice = body?.invoice || {};
    const companyName = (invoice.companyName || '').trim();
    const nip = onlyDigits(invoice.nip || '');
    const addressLine1 = (invoice.addressLine1 || '').trim();
    const addressLine2 = (invoice.addressLine2 || '').trim();
    const postalCode = (invoice.postalCode || '').trim();
    const city = (invoice.city || '').trim();
    const invoiceEmail = (invoice.email || user.email || '').trim().toLowerCase();

    if (invoiceType === BuyerInvoiceType.COMPANY) {
      if (
        !companyName ||
        !nip ||
        !addressLine1 ||
        !postalCode ||
        !city ||
        !invoiceEmail
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: 'Uzupełnij wszystkie dane do faktury firmowej.',
          },
          { status: 400 }
        );
      }

      if (nip.length !== 10) {
        return NextResponse.json(
          {
            ok: false,
            message: 'NIP musi mieć 10 cyfr.',
          },
          { status: 400 }
        );
      }
    }

    const order = await prisma.listingOrder.create({
      data: {
        userId: user.id,
        packageType: selected.packageType,
        packageName: selected.packageName,
        credits: selected.credits,
        featuredCredits: selected.featuredCredits,
        validityDays: selected.validityDays,
        amountGrossPln: selected.amountGrossPln,
        currency: 'PLN',
        status: 'PENDING',

        invoiceType,
        buyerCompanyName:
          invoiceType === BuyerInvoiceType.COMPANY ? companyName : null,
        buyerNip: invoiceType === BuyerInvoiceType.COMPANY ? nip : null,
        buyerAddressLine1:
          invoiceType === BuyerInvoiceType.COMPANY ? addressLine1 : null,
        buyerPostalCode:
          invoiceType === BuyerInvoiceType.COMPANY ? postalCode : null,
        buyerCity: invoiceType === BuyerInvoiceType.COMPANY ? city : null,
        buyerEmail: invoiceType === BuyerInvoiceType.COMPANY ? invoiceEmail : null,
      },
      select: {
        id: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      success_url: `${appUrl}/panel/pakiety/sukces?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/panel/pakiety?cancelled=1`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'pln',
            unit_amount: selected.amountGrossPln,
            product_data: {
              name: selected.packageName,
              description:
                selected.featuredCredits > 0
                  ? `${selected.credits} publikacji i ${selected.featuredCredits} wyróżnień`
                  : `${selected.credits} publikacja`,
            },
          },
        },
      ],
      metadata: {
        orderId: order.id,
        userId: user.id,
        packageType: selected.packageType,
        credits: String(selected.credits),
        featuredCredits: String(selected.featuredCredits),

        buyerType:
          invoiceType === BuyerInvoiceType.COMPANY ? 'company' : 'none',
        companyName:
          invoiceType === BuyerInvoiceType.COMPANY ? companyName : '',
        nip: invoiceType === BuyerInvoiceType.COMPANY ? nip : '',
        addressLine1:
          invoiceType === BuyerInvoiceType.COMPANY ? addressLine1 : '',
        addressLine2:
          invoiceType === BuyerInvoiceType.COMPANY ? addressLine2 : '',
        postalCode:
          invoiceType === BuyerInvoiceType.COMPANY ? postalCode : '',
        city: invoiceType === BuyerInvoiceType.COMPANY ? city : '',
        country: 'PL',
        invoiceEmail:
          invoiceType === BuyerInvoiceType.COMPANY ? invoiceEmail : '',
      },
    });

    await prisma.listingOrder.update({
      where: { id: order.id },
      data: {
        stripeSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (e: any) {
    console.error('STRIPE CHECKOUT ERROR:', e);

    return NextResponse.json(
      {
        ok: false,
        message: 'Nie udało się utworzyć płatności.',
        error: e?.message || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}