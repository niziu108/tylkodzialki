import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth-options';
import { getFavoriteOffers } from '@/lib/favorites';
import UlubioneWidok from './UlubioneWidok';

export default async function UlubionePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/logowanie?callbackUrl=/ulubione');
  }

  const items = await getFavoriteOffers(userId);

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg sm:px-8">
      <section className="mx-auto max-w-6xl">
        <h1 className="sr-only">Ulubione działki</h1>

        <UlubioneWidok items={items} />
      </section>
    </main>
  );
}
