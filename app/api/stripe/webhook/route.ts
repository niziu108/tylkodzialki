import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { InvoiceBuyerType, KsefStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { generateInvoiceNumber } from '@/lib/invoices';

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getItemName(params: {
  type?: string;
  credits?: number;
  featuredCredits?: number;
  packageType?: string;
}) {
  const { type, credits = 0, featuredCredits = 0, packageType } = params;

  if (type === 'featured') {
    if (featuredCredits === 1) return 'Pakiet 1 wyróżnienia';
    if (featuredCredits === 3) return 'Pakiet 3 wyróżnień';
    return `Pakiet wyróżnień (${featuredCredits})`;
  }

  if (packageType === 'SINGLE' || credits === 1) {
    return 'Pakiet 1 publikacji';
  }

  if (packageType === 'PACK_10' || credits === 10) {
    return 'Pakiet 10 publikacji';
  }

  if (packageType === 'PACK_40' || credits === 40) {
    return 'Pakiet 40 publikacji';
  }

  return `Pakiet publikacji (${credits})`;
}

type ResolvedBuyer = {
  buyerType: InvoiceBuyerType;
  buyerName: string | null;
  companyName: string | null;
  nip: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  invoiceEmail: string | null;
};

function resolveBuyerFromMetadata(metadata: Record<string, string>): ResolvedBuyer {
  const buyerType: InvoiceBuyerType =
    metadata.buyerType === 'company'
      ? InvoiceBuyerType.COMPANY
      : InvoiceBuyerType.PRIVATE;

  const buyerName = (metadata.buyerName || '').trim() || null;
  const companyName = (metadata.companyName || '').trim() || null;
  const nip = (metadata.nip || '').trim() || null;
  const addressLine1 = (metadata.addressLine1 || '').trim() || null;
  const addressLine2 = (metadata.addressLine2 || '').trim() || null;
  const postalCode = (metadata.postalCode || '').trim() || null;
  const city = (metadata.city || '').trim() || null;
  const country = (metadata.country || '').trim() || 'PL';
  const invoiceEmail = (metadata.invoiceEmail || '').trim() || null;

  return {
    buyerType,
    buyerName,
    companyName,
    nip,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    country,
    invoiceEmail,
  };
}

export async function POST(req: Request) {
  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature) {
    console.error('[STRIPE WEBHOOK] Brak stripe-signature');
    return new NextResponse('Brak stripe-signature', { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[STRIPE WEBHOOK] Brak STRIPE_WEBHOOK_SECRET');
    return new NextResponse('Brak STRIPE_WEBHOOK_SECRET', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] constructEvent error:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('[STRIPE WEBHOOK] event.type =', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    console.log('[STRIPE WEBHOOK] metadata =', metadata);

    const orderId = metadata.orderId;
    const userId = metadata.userId;
    const credits = Number(metadata.credits || 0);
    const featuredCredits = Number(metadata.featuredCredits || 0);
    const type = metadata.type;

    const buyer = resolveBuyerFromMetadata(metadata);
    const amountGross = session.amount_total ?? 0;
    const currency = (session.currency || 'pln').toUpperCase();

    try {
      if (type === 'featured' && userId && featuredCredits > 0) {
        console.log('[STRIPE WEBHOOK] featured branch', {
          userId,
          featuredCredits,
          buyer,
        });

        const existingInvoice = await prisma.invoice.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true },
        });

        if (existingInvoice) {
          console.log(
            '[STRIPE WEBHOOK] featured invoice already exists, pomijam'
          );
          return NextResponse.json({ received: true });
        }

        const now = new Date();
        const invoiceNumber = await generateInvoiceNumber(now);

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: {
              featuredCredits: {
                increment: featuredCredits,
              },
            },
          });

          await tx.invoice.create({
            data: {
              userId,
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
              stripeCheckoutUrl: session.url ?? null,

              invoiceNumber,
              type: 'FEATURED_PACKAGE',
              status: 'PAID',
              source: 'INTERNAL',

              amountGross,
              currency,

              buyerType: buyer.buyerType,
              buyerName:
                buyer.buyerType === InvoiceBuyerType.PRIVATE
                  ? buyer.buyerName
                  : null,
              companyName:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.companyName
                  : null,
              nip:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.nip
                  : null,
              addressLine1:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.addressLine1
                  : null,
              addressLine2:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.addressLine2
                  : null,
              postalCode:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.postalCode
                  : null,
              city:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.city
                  : null,
              country: buyer.country,
              invoiceEmail:
                buyer.invoiceEmail || session.customer_details?.email || null,

              itemName: getItemName({
                type,
                featuredCredits,
              }),
              quantity: 1,

              issuedAt: now,
              paidAt: now,

              ksefRequired: true,
              ksefStatus: KsefStatus.READY,
            },
          });
        });

        console.log('[STRIPE WEBHOOK] featuredCredits + invoice dodane pomyślnie');
        return NextResponse.json({ received: true });
      }

      if (orderId && userId) {
        await prisma.$transaction(async (tx) => {
          const order = await tx.listingOrder.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              status: true,
              credits: true,
              featuredCredits: true,
              validityDays: true,
              packageType: true,
              packageName: true,
              stripeSessionId: true,
              invoiceNumber: true,
            },
          });

          if (!order) {
            throw new Error('ORDER_NOT_FOUND');
          }

          if (order.status === 'PAID') {
            console.log('[STRIPE WEBHOOK] order już opłacone, pomijam');
            return;
          }

          const existingInvoice = await tx.invoice.findUnique({
            where: { stripeSessionId: session.id },
            select: { id: true },
          });

          if (existingInvoice) {
            console.log(
              '[STRIPE WEBHOOK] invoice already exists for session, pomijam'
            );
            return;
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              listingCredits: true,
              featuredCredits: true,
            },
          });

          if (!user) {
            throw new Error('USER_NOT_FOUND');
          }

          const now = new Date();
          const invoiceNumber = await generateInvoiceNumber(now);

          const nextListingCredits = (user.listingCredits ?? 0) + credits;
          const nextFeaturedCredits =
            (user.featuredCredits ?? 0) + featuredCredits;

          await tx.user.update({
            where: { id: userId },
            data: {
              listingCredits: {
                increment: credits,
              },
              featuredCredits: {
                increment: featuredCredits,
              },
              listingCreditsExpiresAt: order.validityDays
                ? addDays(now, order.validityDays)
                : undefined,
              featuredCreditsExpiresAt: order.validityDays
                ? addDays(now, order.validityDays)
                : undefined,
            },
          });

          await tx.listingOrder.update({
            where: { id: orderId },
            data: {
              status: 'PAID',
              paidAt: now,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
              invoiceNumber,
              invoiceIssuedAt: now,
            },
          });

          if (credits > 0) {
            await tx.listingCreditTransaction.create({
              data: {
                userId,
                delta: credits,
                balanceAfter: nextListingCredits,
                sourceType:
                  credits === 1 ? 'SINGLE_PURCHASE' : 'PACKAGE_PURCHASE',
                note: `Zakup: ${metadata.packageType ?? 'PACKAGE'}`,
                orderId,
              },
            });
          }

          await tx.invoice.create({
            data: {
              userId,
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : null,
              stripeCheckoutUrl: session.url ?? null,

              invoiceNumber,
              type:
                type === 'featured' ? 'FEATURED_PACKAGE' : 'LISTING_PACKAGE',
              status: 'PAID',
              source: 'INTERNAL',

              amountGross,
              currency,

              buyerType: buyer.buyerType,
              buyerName:
                buyer.buyerType === InvoiceBuyerType.PRIVATE
                  ? buyer.buyerName
                  : null,
              companyName:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.companyName
                  : null,
              nip:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.nip
                  : null,
              addressLine1:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.addressLine1
                  : null,
              addressLine2:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.addressLine2
                  : null,
              postalCode:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.postalCode
                  : null,
              city:
                buyer.buyerType === InvoiceBuyerType.COMPANY
                  ? buyer.city
                  : null,
              country: buyer.country,
              invoiceEmail:
                buyer.invoiceEmail || session.customer_details?.email || null,

              itemName: getItemName({
                type,
                credits,
                featuredCredits,
                packageType: metadata.packageType,
              }),
              quantity: 1,

              issuedAt: now,
              paidAt: now,

              ksefRequired: true,
              ksefStatus: KsefStatus.READY,
            },
          });

          console.log('[STRIPE WEBHOOK] standard order processed', {
            nextListingCredits,
            nextFeaturedCredits,
            invoiceNumber,
            buyer,
          });
        });
      } else {
        console.log(
          '[STRIPE WEBHOOK] brak orderId i brak featured flow, nic nie robię'
        );
      }
    } catch (e: any) {
      console.error('[STRIPE WEBHOOK] processing failed:', e);
      return new NextResponse('Webhook processing failed', { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}