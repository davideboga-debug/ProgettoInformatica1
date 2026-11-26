import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ensureUser } from "./db";

export type AppEnv = {
  Variables: {
    userId: string;
    userEmail?: string;
    userName?: string;
  };
};

const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const authBaseUrl = process.env.NEON_AUTH_BASE_URL;

const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;
const issuer = authBaseUrl ? new URL(authBaseUrl).origin : undefined;

/**
 * Verifica il JWT emesso da Neon Auth contro il JWKS iniettato sulla branch.
 * L'issuer è l'origine di NEON_AUTH_BASE_URL; se la versione di Better Auth
 * usa un issuer diverso, ricade sulla sola verifica firma + scadenza.
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  if (!jwks) {
    throw new Error("NEON_AUTH_JWKS_URL non impostata");
  }
  try {
    const { payload } = await jwtVerify(token, jwks, issuer ? { issuer } : {});
    return payload;
  } catch (error) {
    if (!issuer) throw error;
    const { payload } = await jwtVerify(token, jwks);
    return payload;
  }
}

function bearerToken(header?: string): string | null {
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Middleware opzionale: se c'è un Bearer valido popola userId, altrimenti
 * lascia passare la richiesta come anonima.
 */
export const attachUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerToken(c.req.header("authorization"));
  if (token) {
    try {
      const payload = await verifyToken(token);
      if (payload.sub) {
        const user = {
          id: payload.sub,
          email: typeof payload.email === "string" ? payload.email : undefined,
          name: typeof payload.name === "string" ? payload.name : undefined,
        };
        c.set("userId", user.id);
        c.set("userEmail", user.email);
        c.set("userName", user.name);
        await ensureUser(user);
      }
    } catch {
      // Token scaduto o non valido: la richiesta resta anonima.
    }
  }
  await next();
});

export function requireUserId(c: { get: (key: "userId") => string | undefined }): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new HTTPException(401, { message: "Devi accedere per continuare." });
  }
  return userId;
}
