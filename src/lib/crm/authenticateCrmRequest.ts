import { prisma } from "@/lib/prisma";
import { hashCrmApiKey } from "@/lib/crm/hashApiKey";

export async function authenticateCrmRequest(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7).trim();

  if (!apiKey) {
    return null;
  }

  const apiKeyHash = hashCrmApiKey(apiKey);

  const integration = await prisma.crmIntegration.findUnique({
    where: {
      apiKeyHash,
    },
    include: {
      user: true,
    },
  });

  if (!integration || !integration.isActive) {
    return null;
  }

  return integration;
}