import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getAppConfig() {
  let config = await prisma.appConfig.findFirst();

  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        paymentsEnabled: false,
        freeListingCredits: 0,
        freeListingCreditsDays: null,
        listingSinglePriceGrossPln: 1900,
        listingPack10PriceGrossPln: 14900,
        listingPack40PriceGrossPln: 39900,
        featuredSinglePriceGrossPln: 1900,
        featuredPack3PriceGrossPln: 3900,
      },
    });
  }

  return config;
}

export async function GET() {
  try {
    const config = await getAppConfig();

    return NextResponse.json({
      ok: true,
      pricing: {
        listingSinglePriceGrossPln: config.listingSinglePriceGrossPln,
        listingPack10PriceGrossPln: config.listingPack10PriceGrossPln,
        listingPack40PriceGrossPln: config.listingPack40PriceGrossPln,
        featuredSinglePriceGrossPln: config.featuredSinglePriceGrossPln,
        featuredPack3PriceGrossPln: config.featuredPack3PriceGrossPln,
      },
    });
  } catch (e: any) {
    console.error('PRICING_API_ERROR', e);

    return NextResponse.json(
      {
        ok: false,
        message: 'Nie udało się pobrać cennika.',
      },
      { status: 500 }
    );
  }
}