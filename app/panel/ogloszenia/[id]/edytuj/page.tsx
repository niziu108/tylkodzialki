import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth-options';
import { prisma } from '@/lib/prisma';
import DzialkaForm from '@/components/DzialkaForm';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EdytujOgloszeniePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    redirect('/auth');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user?.id) {
    redirect('/auth');
  }

  const { id } = await params;

  const dzialka = await prisma.dzialka.findFirst({
    where: {
      id,
      ownerId: user.id,
    },
    include: {
      zdjecia: {
        orderBy: { kolejnosc: 'asc' },
        select: {
          url: true,
          publicId: true,
          kolejnosc: true,
        },
      },
    },
  });

  if (!dzialka) {
    notFound();
  }

  return (
    <DzialkaForm
      mode="edit"
      initialData={{
        id: dzialka.id,
        tytul: dzialka.tytul,
        telefon: dzialka.telefon,
        email: dzialka.email,
        cenaPln: dzialka.cenaPln,
        powierzchniaM2: dzialka.powierzchniaM2,
        sprzedajacyTyp: dzialka.sprzedajacyTyp,
        numerOferty: dzialka.numerOferty,
        przeznaczenia: dzialka.przeznaczenia as any,
        opis: dzialka.opis,

        placeId: dzialka.placeId,
        locationFull: dzialka.locationFull,
        locationLabel: dzialka.locationLabel,
        lat: dzialka.lat,
        lng: dzialka.lng,
        mapsUrl: dzialka.mapsUrl,
        locationMode: dzialka.locationMode as any,
        parcelText: dzialka.parcelText,

        prad: dzialka.prad as any,
        woda: dzialka.woda as any,
        kanalizacja: dzialka.kanalizacja as any,
        gaz: dzialka.gaz as any,
        swiatlowod: dzialka.swiatlowod as any,

        wzWydane: dzialka.wzWydane,
        mpzp: dzialka.mpzp,
        projektDomu: dzialka.projektDomu,

        klasaZiemi: dzialka.klasaZiemi,
        wymiary: dzialka.wymiary,
        ksiegaWieczysta: dzialka.ksiegaWieczysta,

        zdjecia: dzialka.zdjecia,
      }}
    />
  );
}