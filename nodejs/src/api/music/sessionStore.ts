import crypto from "crypto";

interface QrSession {
  qrId: string;
  cookie: string;
  createdAt: number;
  updatedAt: number;
}

interface TokenSession {
  token: string;
  cookie: string;
  userId: string;
  profile: {
    userId: string;
    username: string;
    avatarUrl: string;
  };
  createdAt: number;
  updatedAt: number;
}

const qrMap = new Map<string, QrSession>();
const tokenMap = new Map<string, TokenSession>();

const QR_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();

  qrMap.forEach((value, key) => {
    if (now - value.updatedAt > QR_TTL_MS) {
      qrMap.delete(key);
    }
  });

  tokenMap.forEach((value, key) => {
    if (now - value.updatedAt > TOKEN_TTL_MS) {
      tokenMap.delete(key);
    }
  });
}

export function saveQrSession(qrId: string, initialCookie = "") {
  cleanExpired();
  const now = Date.now();
  qrMap.set(qrId, {
    qrId,
    cookie: initialCookie,
    createdAt: now,
    updatedAt: now,
  });
}

export function getQrSession(qrId: string): QrSession | null {
  cleanExpired();
  const session = qrMap.get(qrId);
  if (!session) return null;
  return session;
}

export function updateQrSessionCookie(qrId: string, cookie: string) {
  const session = qrMap.get(qrId);
  if (!session) return;
  session.cookie = cookie;
  session.updatedAt = Date.now();
  qrMap.set(qrId, session);
}

export function saveTokenSession(input: Omit<TokenSession, "token" | "createdAt" | "updatedAt">): string {
  cleanExpired();
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  tokenMap.set(token, {
    token,
    cookie: input.cookie,
    userId: input.userId,
    profile: input.profile,
    createdAt: now,
    updatedAt: now,
  });
  return token;
}

export function getTokenSession(token: string): TokenSession | null {
  cleanExpired();
  const session = tokenMap.get(token);
  if (!session) return null;
  session.updatedAt = Date.now();
  tokenMap.set(token, session);
  return session;
}
