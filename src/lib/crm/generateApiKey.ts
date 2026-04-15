import crypto from "crypto";

export function generateCrmApiKey() {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const apiKey = `TDCRM_${randomPart}`;
  const apiKeyPrefix = "TDCRM";
  const apiKeyLast4 = apiKey.slice(-4);

  return {
    apiKey,
    apiKeyPrefix,
    apiKeyLast4,
  };
}