import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { attachUser, requireUserId, type AppEnv } from "./auth";
import { one, query, transaction } from "./db";
import { presignUpload, publicUrl } from "./storage";

type Row = Record<string, any>;

const app = new Hono<AppEnv>();

const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...(process.env.APP_ORIGIN?.split(",") ?? []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function originAllowed(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  if (origin && originAllowed(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.use("*", attachUser);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error("[api]", error);
  return c.json({ error: "Errore interno del server." }, 500);
});

app.notFound((c) => c.json({ error: "Endpoint non trovato." }, 404));

function asString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asOptionalString(value: unknown, max = 500): string | null {
  const text = asString(value, max);
  return text.length > 0 ? text : null;
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function photoUrl(key: string | null | undefined): string | null {
  return key ? publicUrl(key) : null;
}

function mapItem(row: Row) {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    priceCents: row.price_cents as number,
    condition: row.condition as string,
    status: row.status as string,
    city: (row.city as string | null) ?? null,
    createdAt: row.created_at as string,
    category: row.category_id
      ? {
          id: row.category_id as number,
          name: row.category_name as string,
          slug: row.category_slug as string,
        }
      : null,
    size: (row.size_label as string | null) ?? null,
    seller: {
      id: row.seller_id as string,
      name: row.seller_name as string,
      avatarUrl: photoUrl(row.seller_avatar_key),
    },
    coverUrl: photoUrl(row.cover_key),
    favoriteCount: Number(row.favorite_count ?? 0),
    isFavorite: Boolean(row.is_favorite),
  };
}

const ITEM_SELECT = `
  SELECT i.id, i.title, i.description, i.price_cents, i.condition, i.status,
         i.city, i.created_at, i.seller_id,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
         s.label AS size_label,
         u.display_name AS seller_name, u.avatar_key AS seller_avatar_key,
         (SELECT p.storage_key FROM item_photos p
           WHERE p.item_id = i.id ORDER BY p.sort_order, p.created_at LIMIT 1) AS cover_key,
         (SELECT count(*)::int FROM favorites f WHERE f.item_id = i.id) AS favorite_count,
         EXISTS (SELECT 1 FROM favorites f2 WHERE f2.item_id = i.id AND f2.user_id = $1) AS is_favorite
    FROM items i
    JOIN app_users u ON u.id = i.seller_id
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN sizes s ON s.id = i.size_id
`;

async function getSellerProfile(sellerId: string) {
  const seller = await one<Row>(
    `SELECT u.*,
            COALESCE((SELECT avg(r.rating)::numeric(3,1) FROM reviews r WHERE r.subject_id = u.id), 0) AS rating,
            (SELECT count(*)::int FROM reviews r WHERE r.subject_id = u.id) AS review_count,
            (SELECT count(*)::int FROM items i WHERE i.seller_id = u.id AND i.status = 'sold') AS sold_count
       FROM app_users u WHERE u.id = $1`,
    [sellerId],
  );
  if (!seller) return null;
  return {
    id: seller.id as string,
    name: seller.display_name as string,
    avatarUrl: photoUrl(seller.avatar_key),
    bio: (seller.bio as string | null) ?? null,
    city: (seller.city as string | null) ?? null,
    rating: Number(seller.rating ?? 0),
    reviewCount: Number(seller.review_count ?? 0),
    soldCount: Number(seller.sold_count ?? 0),
    joinedAt: seller.created_at as string,
  };
}

async function getReviews(subjectId: string) {
  const rows = await query<Row>(
    `SELECT r.id, r.rating, r.comment, r.created_at, a.display_name AS author_name,
            a.avatar_key AS author_avatar_key
       FROM reviews r JOIN app_users a ON a.id = r.author_id
      WHERE r.subject_id = $1
      ORDER BY r.created_at DESC LIMIT 20`,
    [subjectId],
  );
  return rows.map((row) => ({
    id: row.id as string,
    rating: Number(row.rating),
    comment: (row.comment as string | null) ?? null,
    createdAt: row.created_at as string,
    author: {
      name: row.author_name as string,
      avatarUrl: photoUrl(row.author_avatar_key),
    },
  }));
}

async function getItemDetail(itemId: string, userId?: string) {
  const row = await one<Row>(`${ITEM_SELECT} WHERE i.id = $2`, [userId ?? null, itemId]);
  if (!row) return null;
  const photos = await query<{ storage_key: string }>(
    `SELECT storage_key FROM item_photos WHERE item_id = $1 ORDER BY sort_order, created_at`,
    [itemId],
  );
  const seller = await getSellerProfile(row.seller_id as string);
  const reviews = await getReviews(row.seller_id as string);
  return {
    ...mapItem(row),
    photos: photos.map((photo) => publicUrl(photo.storage_key)),
    seller,
    sellerReviews: reviews,
  };
}

async function listItems(options: {
  userId?: string;
  category?: string | null;
  search?: string | null;
  sellerId?: string | null;
  limit?: number;
}) {
  const params: unknown[] = [options.userId ?? null];
  const where: string[] = ["i.status = 'active'"];

  if (options.category) {
    params.push(options.category);
    where.push(`c.slug = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    where.push(`(i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`);
  }
  if (options.sellerId) {
    params.push(options.sellerId);
    where.push(`i.seller_id = $${params.length}`);
  }

  const limit = Math.min(Math.max(options.limit ?? 60, 1), 100);
  params.push(limit);

  const rows = await query<Row>(
    `${ITEM_SELECT} WHERE ${where.join(" AND ")} ORDER BY i.created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapItem);
}

app.get("/", (c) =>
  c.json({
    name: "Riuso API",
    status: "ok",
    endpoints: [
      "GET /health",
      "GET /items",
      "GET /items/:id",
      "GET /categories",
      "GET /sizes",
      "GET /users/:id",
      "POST /uploads/presign",
      "GET /me",
      "PATCH /me",
      "GET /me/favorites",
      "GET /me/offers",
      "GET /me/orders",
    ],
  }),
);

app.get("/health", async (c) => {
  const row = await one<Row>("SELECT now()::text AS now, current_database() AS database");
  return c.json({
    ok: true,
    database: row?.database,
    time: row?.now,
    branch: process.env.NEON_BRANCH ?? null,
    services: {
      postgres: true,
      auth: Boolean(process.env.NEON_AUTH_BASE_URL),
      objectStorage: Boolean(process.env.AWS_ENDPOINT_URL_S3),
    },
  });
});

app.get("/categories", async (c) => {
  const rows = await query<Row>("SELECT id, slug, name, icon FROM categories ORDER BY name");
  return c.json(rows);
});

app.get("/sizes", async (c) => {
  const rows = await query<Row>("SELECT id, label FROM sizes ORDER BY sort_order, label");
  return c.json(rows);
});

app.get("/items", async (c) => {
  const items = await listItems({
    userId: c.get("userId"),
    category: c.req.query("category")?.trim() || null,
    search: c.req.query("q")?.trim() || null,
    sellerId: c.req.query("seller")?.trim() || null,
    limit: asInt(c.req.query("limit")) ?? 60,
  });
  return c.json({ items });
});

app.get("/items/:id", async (c) => {
  const item = await getItemDetail(c.req.param("id"), c.get("userId"));
  if (!item) throw new HTTPException(404, { message: "Annuncio non trovato." });
  return c.json(item);
});

app.post("/items", async (c) => {
  const userId = requireUserId(c);
  const body = (await c.req.json().catch(() => ({}))) as Row;

  const title = asString(body.title, 120);
  const description = asString(body.description, 4000);
  const priceCents = asInt(body.priceCents);
  const categoryId = asInt(body.categoryId);
  const sizeId = asInt(body.sizeId);
  const condition = asString(body.condition, 20) || "buono";
  const city = asOptionalString(body.city, 120);
  const photoKeys = Array.isArray(body.photoKeys)
    ? body.photoKeys.filter((key): key is string => typeof key === "string").slice(0, 6)
    : [];

  if (title.length < 3) throw new HTTPException(400, { message: "Il titolo è troppo corto." });
  if (priceCents === null || priceCents < 100) {
    throw new HTTPException(400, { message: "Il prezzo minimo è 1,00 €." });
  }
  if (!["nuovo", "come_nuovo", "ottimo", "buono", "discreto"].includes(condition)) {
    throw new HTTPException(400, { message: "Condizione non valida." });
  }
  for (const key of photoKeys) {
    if (!key.startsWith(`items/${userId}/`)) {
      throw new HTTPException(400, { message: "Foto non appartenente a questo utente." });
    }
  }

  const item = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO items (seller_id, title, description, price_cents, category_id, size_id, condition, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, title, description, priceCents, categoryId, sizeId, condition, city],
    );
    const itemId = result.rows[0].id as string;
    for (let index = 0; index < photoKeys.length; index += 1) {
      await client.query(
        `INSERT INTO item_photos (item_id, storage_key, sort_order) VALUES ($1, $2, $3)`,
        [itemId, photoKeys[index], index],
      );
    }
    return itemId;
  });

  const detail = await getItemDetail(item, userId);
  return c.json(detail, 201);
});

app.post("/items/:id/favorite", async (c) => {
  const userId = requireUserId(c);
  const itemId = c.req.param("id");
  const existing = await one<Row>(
    `SELECT 1 AS present FROM favorites WHERE user_id = $1 AND item_id = $2`,
    [userId, itemId],
  );
  if (existing) {
    await query(`DELETE FROM favorites WHERE user_id = $1 AND item_id = $2`, [userId, itemId]);
    return c.json({ favorited: false });
  }
  await query(`INSERT INTO favorites (user_id, item_id) VALUES ($1, $2)`, [userId, itemId]);
  return c.json({ favorited: true });
});

app.get("/me/favorites", async (c) => {
  const userId = requireUserId(c);
  const rows = await query<Row>(
    `${ITEM_SELECT}
       JOIN favorites fav ON fav.item_id = i.id AND fav.user_id = $1
      WHERE i.status = 'active'
      ORDER BY fav.created_at DESC`,
    [userId],
  );
  return c.json({ items: rows.map(mapItem) });
});

app.post("/items/:id/offers", async (c) => {
  const userId = requireUserId(c);
  const itemId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const amountCents = asInt(body.amountCents);
  const message = asOptionalString(body.message, 500);

  const item = await one<Row>(
    `SELECT id, seller_id, price_cents, status FROM items WHERE id = $1`,
    [itemId],
  );
  if (!item) throw new HTTPException(404, { message: "Annuncio non trovato." });
  if (item.seller_id === userId) {
    throw new HTTPException(400, { message: "Non puoi fare un'offerta sul tuo annuncio." });
  }
  if (item.status !== "active") {
    throw new HTTPException(400, { message: "L'annuncio non è più disponibile." });
  }
  if (amountCents === null || amountCents < 100) {
    throw new HTTPException(400, { message: "L'offerta minima è 1,00 €." });
  }

  const offer = await one<Row>(
    `INSERT INTO offers (item_id, buyer_id, amount_cents, message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [itemId, userId, amountCents, message],
  );
  return c.json(offer, 201);
});

app.get("/me/offers", async (c) => {
  const userId = requireUserId(c);
  const base = `
    SELECT o.*, i.title, i.price_cents,
           (SELECT p.storage_key FROM item_photos p
             WHERE p.item_id = i.id ORDER BY p.sort_order, p.created_at LIMIT 1) AS cover_key,
           b.display_name AS buyer_name, s.display_name AS seller_name
      FROM offers o
      JOIN items i ON i.id = o.item_id
      JOIN app_users b ON b.id = o.buyer_id
      JOIN app_users s ON s.id = i.seller_id
  `;
  const received = await query<Row>(`${base} WHERE i.seller_id = $1 ORDER BY o.created_at DESC`, [userId]);
  const sent = await query<Row>(`${base} WHERE o.buyer_id = $1 ORDER BY o.created_at DESC`, [userId]);

  const mapOffer = (row: Row) => ({
    id: row.id as string,
    itemId: row.item_id as string,
    title: row.title as string,
    coverUrl: photoUrl(row.cover_key),
    askingPriceCents: row.price_cents as number,
    amountCents: row.amount_cents as number,
    message: (row.message as string | null) ?? null,
    status: row.status as string,
    createdAt: row.created_at as string,
    buyerName: row.buyer_name as string,
    sellerName: row.seller_name as string,
  });

  return c.json({ received: received.map(mapOffer), sent: sent.map(mapOffer) });
});

app.post("/offers/:id/accept", async (c) => {
  const userId = requireUserId(c);
  const offerId = c.req.param("id");

  const orderId = await transaction(async (client) => {
    const offerResult = await client.query(
      `SELECT o.*, i.seller_id, i.status AS item_status
         FROM offers o JOIN items i ON i.id = o.item_id
        WHERE o.id = $1 FOR UPDATE`,
      [offerId],
    );
    const offer = offerResult.rows[0] as Row | undefined;
    if (!offer) throw new HTTPException(404, { message: "Offerta non trovata." });
    if (offer.seller_id !== userId) {
      throw new HTTPException(403, { message: "Solo il venditore può accettare l'offerta." });
    }
    if (offer.status !== "pending") {
      throw new HTTPException(400, { message: "L'offerta non è più in attesa." });
    }
    if (offer.item_status !== "active") {
      throw new HTTPException(400, { message: "L'annuncio non è più disponibile." });
    }

    const orderResult = await client.query(
      `INSERT INTO orders (item_id, buyer_id, seller_id, amount_cents, status)
       VALUES ($1, $2, $3, $4, 'paid') RETURNING id`,
      [offer.item_id, offer.buyer_id, offer.seller_id, offer.amount_cents],
    );
    const orderId = orderResult.rows[0].id as string;

    await client.query(
      `INSERT INTO payments (order_id, provider, status, amount_cents, paid_at)
       VALUES ($1, 'demo', 'paid', $2, now())`,
      [orderId, offer.amount_cents],
    );
    await client.query(`INSERT INTO shipments (order_id) VALUES ($1)`, [orderId]);
    await client.query(`UPDATE items SET status = 'sold', updated_at = now() WHERE id = $1`, [
      offer.item_id,
    ]);
    await client.query(
      `UPDATE offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [offerId],
    );
    await client.query(
      `UPDATE offers SET status = 'declined', responded_at = now()
        WHERE item_id = $1 AND id <> $2 AND status = 'pending'`,
      [offer.item_id, offerId],
    );
    return orderId;
  });

  return c.json({ orderId, status: "paid" }, 201);
});

app.post("/offers/:id/decline", async (c) => {
  const userId = requireUserId(c);
  const offerId = c.req.param("id");
  const offer = await one<Row>(
    `SELECT o.*, i.seller_id FROM offers o JOIN items i ON i.id = o.item_id WHERE o.id = $1`,
    [offerId],
  );
  if (!offer) throw new HTTPException(404, { message: "Offerta non trovata." });
  if (offer.seller_id !== userId) {
    throw new HTTPException(403, { message: "Solo il venditore può rifiutare l'offerta." });
  }
  if (offer.status !== "pending") {
    throw new HTTPException(400, { message: "L'offerta non è più in attesa." });
  }
  await query(`UPDATE offers SET status = 'declined', responded_at = now() WHERE id = $1`, [offerId]);
  return c.json({ status: "declined" });
});

app.post("/items/:id/buy", async (c) => {
  const userId = requireUserId(c);
  const itemId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const shippingName = asOptionalString(body.shippingName, 120);
  const shippingAddress = asOptionalString(body.shippingAddress, 250);
  const shippingCity = asOptionalString(body.shippingCity, 120);
  const shippingPostalCode = asOptionalString(body.shippingPostalCode, 20);

  const orderId = await transaction(async (client) => {
    const itemResult = await client.query(`SELECT * FROM items WHERE id = $1 FOR UPDATE`, [itemId]);
    const item = itemResult.rows[0] as Row | undefined;
    if (!item) throw new HTTPException(404, { message: "Annuncio non trovato." });
    if (item.seller_id === userId) {
      throw new HTTPException(400, { message: "Non puoi acquistare il tuo annuncio." });
    }
    if (item.status !== "active") {
      throw new HTTPException(400, { message: "L'annuncio non è più disponibile." });
    }

    const orderResult = await client.query(
      `INSERT INTO orders
         (item_id, buyer_id, seller_id, amount_cents, status,
          shipping_name, shipping_address, shipping_city, shipping_postal_code)
       VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8) RETURNING id`,
      [
        itemId,
        userId,
        item.seller_id,
        item.price_cents,
        shippingName,
        shippingAddress,
        shippingCity,
        shippingPostalCode,
      ],
    );
    const orderId = orderResult.rows[0].id as string;
    await client.query(
      `INSERT INTO payments (order_id, provider, status, amount_cents, paid_at)
       VALUES ($1, 'demo', 'paid', $2, now())`,
      [orderId, item.price_cents],
    );
    await client.query(`INSERT INTO shipments (order_id) VALUES ($1)`, [orderId]);
    await client.query(`UPDATE items SET status = 'sold', updated_at = now() WHERE id = $1`, [itemId]);
    await client.query(
      `UPDATE offers SET status = 'declined', responded_at = now()
        WHERE item_id = $1 AND status = 'pending'`,
      [itemId],
    );
    return orderId;
  });

  return c.json({ orderId, status: "paid" }, 201);
});

app.get("/me/orders", async (c) => {
  const userId = requireUserId(c);
  const rows = await query<Row>(
    `SELECT o.*, i.title,
            (SELECT p.storage_key FROM item_photos p
              WHERE p.item_id = i.id ORDER BY p.sort_order, p.created_at LIMIT 1) AS cover_key,
            b.display_name AS buyer_name, s.display_name AS seller_name,
            pay.provider AS payment_provider, pay.status AS payment_status, pay.paid_at,
            sh.status AS shipment_status, sh.carrier, sh.tracking_number,
            sh.shipped_at, sh.delivered_at,
            r.id AS review_id, r.rating AS review_rating, r.comment AS review_comment
       FROM orders o
       JOIN items i ON i.id = o.item_id
       JOIN app_users b ON b.id = o.buyer_id
       JOIN app_users s ON s.id = o.seller_id
       LEFT JOIN payments pay ON pay.order_id = o.id
       LEFT JOIN shipments sh ON sh.order_id = o.id
       LEFT JOIN reviews r ON r.order_id = o.id
      WHERE o.buyer_id = $1 OR o.seller_id = $1
      ORDER BY o.created_at DESC`,
    [userId],
  );

  const orders = rows.map((row) => ({
    id: row.id as string,
    amountCents: row.amount_cents as number,
    status: row.status as string,
    createdAt: row.created_at as string,
    role: row.buyer_id === userId ? ("buyer" as const) : ("seller" as const),
    item: {
      id: row.item_id as string,
      title: row.title as string,
      coverUrl: photoUrl(row.cover_key),
    },
    buyer: { id: row.buyer_id as string, name: row.buyer_name as string },
    seller: { id: row.seller_id as string, name: row.seller_name as string },
    shipping: {
      name: (row.shipping_name as string | null) ?? null,
      address: (row.shipping_address as string | null) ?? null,
      city: (row.shipping_city as string | null) ?? null,
      postalCode: (row.shipping_postal_code as string | null) ?? null,
    },
    payment: {
      provider: (row.payment_provider as string | null) ?? null,
      status: (row.payment_status as string | null) ?? null,
      paidAt: (row.paid_at as string | null) ?? null,
    },
    shipment: {
      status: (row.shipment_status as string | null) ?? null,
      carrier: (row.carrier as string | null) ?? null,
      trackingNumber: (row.tracking_number as string | null) ?? null,
      shippedAt: (row.shipped_at as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
    },
    review: row.review_id
      ? {
          id: row.review_id as string,
          rating: Number(row.review_rating),
          comment: (row.review_comment as string | null) ?? null,
        }
      : null,
  }));

  return c.json({ orders });
});

app.post("/orders/:id/ship", async (c) => {
  const userId = requireUserId(c);
  const orderId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const carrier = asOptionalString(body.carrier, 80);
  const trackingNumber = asOptionalString(body.trackingNumber, 80);

  const order = await one<Row>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) throw new HTTPException(404, { message: "Ordine non trovato." });
  if (order.seller_id !== userId) {
    throw new HTTPException(403, { message: "Solo il venditore può spedire." });
  }
  if (order.status !== "paid") {
    throw new HTTPException(400, { message: "L'ordine non è in uno stato spedibile." });
  }

  await transaction(async (client) => {
    await client.query(
      `UPDATE orders SET status = 'shipped', updated_at = now() WHERE id = $1`,
      [orderId],
    );
    await client.query(
      `UPDATE shipments SET status = 'shipped', carrier = $2, tracking_number = $3, shipped_at = now()
        WHERE order_id = $1`,
      [orderId, carrier, trackingNumber],
    );
  });

  return c.json({ status: "shipped" });
});

app.post("/orders/:id/deliver", async (c) => {
  const userId = requireUserId(c);
  const orderId = c.req.param("id");
  const order = await one<Row>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) throw new HTTPException(404, { message: "Ordine non trovato." });
  if (order.buyer_id !== userId) {
    throw new HTTPException(403, { message: "Solo l'acquirente può confermare la consegna." });
  }
  if (order.status !== "shipped") {
    throw new HTTPException(400, { message: "L'ordine non risulta ancora spedito." });
  }

  await transaction(async (client) => {
    await client.query(
      `UPDATE orders SET status = 'delivered', updated_at = now() WHERE id = $1`,
      [orderId],
    );
    await client.query(
      `UPDATE shipments SET status = 'delivered', delivered_at = now() WHERE order_id = $1`,
      [orderId],
    );
  });

  return c.json({ status: "delivered" });
});

app.post("/orders/:id/review", async (c) => {
  const userId = requireUserId(c);
  const orderId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const rating = asInt(body.rating);
  const comment = asOptionalString(body.comment, 1000);

  if (rating === null || rating < 1 || rating > 5) {
    throw new HTTPException(400, { message: "La valutazione deve essere da 1 a 5." });
  }

  const order = await one<Row>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) throw new HTTPException(404, { message: "Ordine non trovato." });
  if (order.buyer_id !== userId) {
    throw new HTTPException(403, { message: "Solo l'acquirente può lasciare una recensione." });
  }
  if (order.status !== "delivered") {
    throw new HTTPException(400, { message: "Puoi recensire solo un ordine consegnato." });
  }

  const review = await one<Row>(
    `INSERT INTO reviews (order_id, author_id, subject_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (order_id) DO NOTHING
     RETURNING *`,
    [orderId, userId, order.seller_id, rating, comment],
  );
  if (!review) {
    throw new HTTPException(409, { message: "Hai già recensito questo ordine." });
  }
  return c.json(review, 201);
});

app.get("/users/:id", async (c) => {
  const userId = c.req.param("id");
  const profile = await getSellerProfile(userId);
  if (!profile) throw new HTTPException(404, { message: "Utente non trovato." });
  const items = await listItems({ userId: c.get("userId"), sellerId: userId, limit: 60 });
  const reviews = await getReviews(userId);
  return c.json({ profile, items, reviews });
});

app.get("/me", async (c) => {
  const userId = requireUserId(c);
  const profile = await getSellerProfile(userId);
  if (!profile) throw new HTTPException(404, { message: "Profilo non trovato." });
  const counts = await one<Row>(
    `SELECT
       (SELECT count(*)::int FROM items WHERE seller_id = $1 AND status = 'active') AS active_items,
       (SELECT count(*)::int FROM items WHERE seller_id = $1 AND status = 'sold') AS sold_items,
       (SELECT count(*)::int FROM orders WHERE buyer_id = $1) AS purchases,
       (SELECT count(*)::int FROM favorites WHERE user_id = $1) AS favorites,
       (SELECT count(*)::int FROM offers WHERE buyer_id = $1 AND status = 'pending') AS pending_offers`,
    [userId],
  );
  return c.json({
    profile,
    counts: {
      activeItems: Number(counts?.active_items ?? 0),
      soldItems: Number(counts?.sold_items ?? 0),
      purchases: Number(counts?.purchases ?? 0),
      favorites: Number(counts?.favorites ?? 0),
      pendingOffers: Number(counts?.pending_offers ?? 0),
    },
  });
});

app.patch("/me", async (c) => {
  const userId = requireUserId(c);
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const displayName = asOptionalString(body.displayName, 80);
  const bio = asOptionalString(body.bio, 500);
  const city = asOptionalString(body.city, 120);
  const avatarKey = asOptionalString(body.avatarKey, 300);

  if (avatarKey && !avatarKey.startsWith(`avatars/${userId}/`)) {
    throw new HTTPException(400, { message: "Avatar non valido." });
  }

  const profile = await one<Row>(
    `UPDATE app_users
        SET display_name = COALESCE($2, display_name),
            bio = COALESCE($3, bio),
            city = COALESCE($4, city),
            avatar_key = COALESCE($5, avatar_key),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [userId, displayName, bio, city, avatarKey],
  );
  return c.json(profile);
});

app.post("/uploads/presign", async (c) => {
  const userId = requireUserId(c);
  const body = (await c.req.json().catch(() => ({}))) as Row;
  const filename = asString(body.filename, 200);
  const contentType = asString(body.contentType, 100).toLowerCase();
  const kind = body.kind === "avatar" ? "avatars" : "items";

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  };
  const extension =
    extensions[contentType] ||
    (filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined);
  if (!extension || !/^[a-z0-9]{2,5}$/.test(extension)) {
    throw new HTTPException(400, { message: "Formato immagine non supportato." });
  }

  const key = `${kind}/${userId}/${randomUUID()}.${extension}`;
  const uploadUrl = await presignUpload(key, contentType || "application/octet-stream");
  return c.json({
    key,
    uploadUrl,
    publicUrl: publicUrl(key),
    headers: { "Content-Type": contentType },
    expiresIn: 600,
  });
});

export default app;
