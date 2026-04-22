import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import AdminCrmIntegrationEditor from "@/components/AdminCrmIntegrationEditor";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminCrmUserPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      crmIntegrations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          name: true,
          provider: true,
          isActive: true,
          transportType: true,
          feedFormat: true,
          ftpHost: true,
          ftpPort: true,
          ftpUsername: true,
          ftpRemotePath: true,
          ftpPassive: true,
          expectedFilePattern: true,
          fullImportMode: true,
          lastUsedAt: true,
          lastSyncAt: true,
          lastSuccessAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          lastImportedOffers: true,
          lastCreatedCount: true,
          lastUpdatedCount: true,
          lastDeactivatedCount: true,
          lastSkippedCount: true,
          lastErrorCount: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/admin");
  }

  const integration = user.crmIntegrations[0] ?? null;
  const userLabel = user.name?.trim() || user.email || user.id;

  return (
    <main className="min-h-screen bg-[#131313] px-6 py-10 text-[#d9d9d9]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm text-white/55">
              <Link href="/admin" className="transition hover:text-white">
                Panel admina
              </Link>
              <span className="mx-2">/</span>
              <span>CRM użytkownika</span>
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl text-white">
              Konfiguracja CRM
            </h1>

            <p className="mt-2 text-sm text-[#bdbdbd]">
              Zarządzanie integracją FTP / DOMY.PL dla użytkownika{" "}
              <span className="text-white">{userLabel}</span>
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Wróć do admina
          </Link>
        </div>

        <AdminCrmIntegrationEditor
          userId={user.id}
          userLabel={userLabel}
          integration={integration}
        />
      </div>
    </main>
  );
}