import { prisma } from "@/lib/prisma";
import { hashCrmApiKey } from "@/lib/crm/hashApiKey";

export async function authenticateCrmRequest(
  authHeader: string | null | undefined
) {
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return null;
  }

  const apiKeyHash = hashCrmApiKey(token.trim());

  const integration = await prisma.crmIntegration.findFirst({
    where: {
      apiKeyHash,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          listingCredits: true,
        },
      },
    },
  });

  return integration;
}