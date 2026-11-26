import { readFile } from "node:fs/promises";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const AUTH = process.env.NEON_AUTH_BASE_URL;
const API =
  process.env.VITE_API_URL ||
  (process.env.NEON_BRANCH_ID && process.env.NEON_FUNCTION_HOST_SUFFIX
    ? `https://${process.env.NEON_BRANCH_ID}-api${process.env.NEON_FUNCTION_HOST_SUFFIX}`
    : "");
const ORIGIN = "http://localhost:5173";

if (!AUTH || !API) {
  throw new Error("NEON_AUTH_BASE_URL o URL Functions mancante. Esegui `neon deploy`.");
}

const checks: string[] = [];

function pass(message: string) {
  checks.push(message);
  console.log(`✓ ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`✗ ${message}`);
}

class Session {
  private cookies = new Map<string, string>();

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const response = await fetch(url, { ...init, headers });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0];
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
}

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Risposta non JSON (${response.status}): ${text.slice(0, 200)}`);
  }
}

async function signUp(name: string) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const session = new Session();
  const response = await session.fetch(`${AUTH}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email, password: "Password123!", name }),
  });
  const body = await json<{ user?: { id: string }; token?: string; message?: string }>(response);
  assert(response.ok && body.user?.id, `sign-up ${name}: ${body.message ?? response.status}`);

  const tokenResponse = await session.fetch(`${AUTH}/token`, {
    headers: { origin: ORIGIN },
  });
  const tokenBody = await json<{ token?: string }>(tokenResponse);
  assert(tokenBody.token, `token JWT per ${name}`);

  pass(`Neon Auth: sign-up + JWT per ${name} (${email})`);
  return { email, id: body.user.id, token: tokenBody.token, session };
}

async function api<T>(
  token: string | null,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("origin", ORIGIN);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const body = await json<T & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${body.error ?? ""}`);
  }
  return body;
}

const health = await api<{
  ok: boolean;
  services: { postgres: boolean; auth: boolean; objectStorage: boolean };
}>(null, "/health");
assert(health.ok && health.services.postgres, "Postgres health");
pass(`Functions + Postgres: /health ok (branch ${process.env.NEON_BRANCH})`);

const unauthorized = await fetch(`${API}/me`);
assert(unauthorized.status === 401, "endpoint protetto senza token deve dare 401");
pass("Functions: /me senza token → 401");

const categories = await api<Array<{ id: number; slug: string }>>(null, "/categories");
assert(categories.length >= 5, "categorie seed");
pass(`Postgres: ${categories.length} categorie lette`);

const seller = await signUp("E2E Seller");
const buyer = await signUp("E2E Buyer");

const sellerMe = await api<{ profile: { id: string } }>(seller.token, "/me");
assert(sellerMe.profile.id === seller.id, "profilo seller allineato al JWT");
pass("Neon Auth → Postgres: profilo applicativo creato dal JWT");

const image = await readFile("public/icons/icon-192.png");
const presign = await api<{ key: string; uploadUrl: string; publicUrl: string }>(
  seller.token,
  "/uploads/presign",
  {
    method: "POST",
    body: JSON.stringify({ filename: "e2e.png", contentType: "image/png", kind: "item" }),
  },
);
const upload = await fetch(presign.uploadUrl, {
  method: "PUT",
  headers: { "content-type": "image/png" },
  body: image,
});
assert(upload.ok, `upload presigned (${upload.status})`);
const publicImage = await fetch(presign.publicUrl);
assert(publicImage.ok && publicImage.headers.get("content-type")?.includes("image/png"), "lettura pubblica immagine");
pass("Object Storage: presigned PUT + lettura pubblica della foto");

const item = await api<{ id: string; photos: string[] }>(seller.token, "/items", {
  method: "POST",
  body: JSON.stringify({
    title: "Annuncio E2E",
    description: "Creato dallo script end-to-end",
    priceCents: 2500,
    categoryId: categories[0].id,
    sizeId: null,
    condition: "ottimo",
    city: "Rimini",
    photoKeys: [presign.key],
  }),
});
assert(item.id && item.photos[0] === presign.publicUrl, "annuncio con foto");
pass("Postgres + Object Storage: annuncio creato e collegato alla foto");

const favorite = await api<{ favorited: boolean }>(buyer.token, `/items/${item.id}/favorite`, {
  method: "POST",
});
assert(favorite.favorited, "aggiunta preferito");
const favorites = await api<{ items: Array<{ id: string }> }>(buyer.token, "/me/favorites");
assert(favorites.items.some((entry) => entry.id === item.id), "preferito persistito");
pass("Postgres: preferiti (toggle + lettura)");

const offer = await api<{ id: string }>(buyer.token, `/items/${item.id}/offers`, {
  method: "POST",
  body: JSON.stringify({ amountCents: 2000, message: "Offerta E2E" }),
});
const received = await api<{ received: Array<{ id: string }> }>(seller.token, "/me/offers");
assert(received.received.some((entry) => entry.id === offer.id), "offerta ricevuta dal venditore");
pass("Postgres: offerta inviata e visibile al venditore");

const accepted = await api<{ orderId: string }>(seller.token, `/offers/${offer.id}/accept`, {
  method: "POST",
});
assert(accepted.orderId, "ordine creato dall'offerta");
pass("Postgres: offerta accettata, ordine + pagamento demo + spedizione creati");

const sellerOrders = await api<{ orders: Array<{ id: string; status: string; role: string }> }>(
  seller.token,
  "/me/orders",
);
const order = sellerOrders.orders.find((entry) => entry.id === accepted.orderId);
assert(order?.role === "seller" && order.status === "paid", "ordine venditore in stato paid");
pass("Postgres: ordine visibile al venditore in stato paid");

await api(seller.token, `/orders/${accepted.orderId}/ship`, {
  method: "POST",
  body: JSON.stringify({ carrier: "Poste Italiane", trackingNumber: "E2E123456" }),
});
pass("Postgres: spedizione registrata dal venditore");

const buyerOrders = await api<{ orders: Array<{ id: string; status: string }> }>(
  buyer.token,
  "/me/orders",
);
assert(
  buyerOrders.orders.find((entry) => entry.id === accepted.orderId)?.status === "shipped",
  "ordine acquirente in stato shipped",
);

await api(buyer.token, `/orders/${accepted.orderId}/deliver`, { method: "POST" });
pass("Postgres: consegna confermata dall'acquirente");

await api(buyer.token, `/orders/${accepted.orderId}/review`, {
  method: "POST",
  body: JSON.stringify({ rating: 5, comment: "Venditore consigliato (E2E)" }),
});
const sellerProfile = await api<{ reviews: Array<{ rating: number }> }>(
  buyer.token,
  `/users/${seller.id}`,
);
assert(sellerProfile.reviews.some((review) => review.rating === 5), "recensione sul profilo venditore");
pass("Postgres: recensione pubblicata e visibile sul profilo");

const soldItem = await api<{ status: string }>(buyer.token, `/items/${item.id}`);
assert(soldItem.status === "sold", "annuncio venduto");
pass("Postgres: annuncio passato a sold dopo l'ordine");

console.log("\n=== E2E PASS ===");
console.log(JSON.stringify({ api: API, checks: checks.length, orderId: accepted.orderId }, null, 2));
