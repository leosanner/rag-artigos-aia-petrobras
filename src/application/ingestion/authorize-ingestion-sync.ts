import { createHash, timingSafeEqual } from "node:crypto";

const BEARER_AUTHORIZATION_PATTERN = /^Bearer\s+(.+)$/i;

export function isAuthorizedIngestionSyncRequest(
  authorizationHeader: string | null,
  expectedSecret: string,
): boolean {
  if (expectedSecret.length === 0 || authorizationHeader === null) {
    return false;
  }

  const match = BEARER_AUTHORIZATION_PATTERN.exec(authorizationHeader.trim());

  if (!match) {
    return false;
  }

  const providedSecret = match[1]?.trim();

  if (!providedSecret) {
    return false;
  }

  return timingSafeEqual(sha256(providedSecret), sha256(expectedSecret));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
