// Lightweight single-user session: the cookie value is a SHA-256 hash of the
// server-only ENTRY_PASSWORD env var. There is only ever one valid password,
// so a matching hash is proof of knowing it. No separate secret/DB needed.
// Uses Web Crypto so it also works in the Edge runtime (proxy.ts).

export const SESSION_COOKIE = "entry_session";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedSessionToken(): Promise<string | null> {
  const password = process.env.ENTRY_PASSWORD;
  if (!password) return null;
  return sha256Hex(password);
}

export async function makeSessionToken(password: string): Promise<string> {
  return sha256Hex(password);
}
