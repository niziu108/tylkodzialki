import KupSearch from './KupSearch';

export const dynamic = 'force-dynamic';

export default function KupPage() {
  return (
    <main className="px-4 pt-10 pb-20">
      <KupSearch />
    </main>
  );
}