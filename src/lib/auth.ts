export const LISTENER_COOKIE = "glatzenmann_listener";
export const ADMIN_COOKIE = "glatzenmann_admin";

export type AuthRole = "listener" | "admin";

export function getListenerPassword(): string {
  return process.env.LISTENER_PASSWORD?.trim() || "2026_Glatzenmann_FM";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "admin_glatzenmann";
}

function getSecret(): string {
  return process.env.AUTH_SECRET?.trim() || `${getListenerPassword()}__glatzenmann_hmac`;
}

async function hmacHex(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(role: AuthRole, ttlSeconds = 60 * 60 * 24 * 30): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${role}.${exp}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null, expectedRole: AuthRole): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  if (role !== expectedRole) return false;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacHex(`${role}.${expStr}`);
  return constantTimeEqual(sig, expectedSig);
}

export function checkPassword(input: string, expected: string): boolean {
  return constantTimeEqual(input.trim(), expected);
}
