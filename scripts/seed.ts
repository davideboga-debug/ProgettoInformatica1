import { Client } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED / DATABASE_URL non impostata.");
}

const bucket = process.env.S3_BUCKET ?? "item-photos";
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("Credenziali Object Storage mancanti.");
}

const force = process.argv.includes("--force");

const s3 = new S3Client({
  endpoint,
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const categories = [
  ["donna", "Donna", "👗"],
  ["uomo", "Uomo", "🧥"],
  ["bambini", "Bambini", "🧸"],
  ["casa", "Casa", "🛋️"],
  ["elettronica", "Elettronica", "🎧"],
  ["sport", "Sport", "🎾"],
  ["accessori", "Accessori", "👜"],
] as const;

const sizes = ["XS", "S", "M", "L", "XL", "XXL", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "Unica"];

const sellers = [
  {
    id: "demo-giulia",
    email: "giulia@demo.riuso.app",
    name: "Giulia",
    city: "Rimini",
    bio: "Vendo capi che non uso più, tutto tenuto con cura. Spedisco in 24h.",
  },
  {
    id: "demo-marco",
    email: "marco@demo.riuso.app",
    name: "Marco",
    city: "Bologna",
    bio: "Sneaker, giacche e qualche chicca vintage. Trattative benvenute.",
  },
  {
    id: "demo-sara",
    email: "sara@demo.riuso.app",
    name: "Sara",
    city: "Milano",
    bio: "Casa, design e accessori. Ogni oggetto ha una storia.",
  },
];

type SeedItem = {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  size: string;
  condition: string;
  seller: string;
  city: string;
  emoji: string;
  from: string;
  to: string;
};

const items: SeedItem[] = [
  {
    slug: "giacca-vintage",
    title: "Giacca di pelle vintage",
    description: "Giacca in pelle marrone, taglia M. Indossata poche volte, interno foderato e zip perfettamente funzionante. Un classico senza tempo.",
    priceCents: 4500,
    category: "donna",
    size: "M",
    condition: "ottimo",
    seller: "demo-giulia",
    city: "Rimini",
    emoji: "🧥",
    from: "#7c2d12",
    to: "#f59e0b",
  },
  {
    slug: "sneaker-retro",
    title: "Sneaker retro running",
    description: "Sneaker unisex in pelle scamosciata, taglia 42. Suola pulita, nessun segno evidente. Ottime per tutti i giorni.",
    priceCents: 3800,
    category: "uomo",
    size: "42",
    condition: "come_nuovo",
    seller: "demo-marco",
    city: "Bologna",
    emoji: "👟",
    from: "#1e3a8a",
    to: "#38bdf8",
  },
  {
    slug: "borsa-cuoio",
    title: "Borsa in cuoio artigianale",
    description: "Borsa a tracolla in cuoio conciato al vegetale, prodotta da un artigiano locale. Capiente, con tracolla regolabile.",
    priceCents: 6200,
    category: "accessori",
    size: "Unica",
    condition: "ottimo",
    seller: "demo-sara",
    city: "Milano",
    emoji: "👜",
    from: "#78350f",
    to: "#d97706",
  },
  {
    slug: "cuffie-wireless",
    title: "Cuffie wireless over-ear",
    description: "Cuffie bluetooth con cancellazione del rumore, custodia rigida inclusa. Batteria ancora ottima, caricate poche volte.",
    priceCents: 5500,
    category: "elettronica",
    size: "Unica",
    condition: "come_nuovo",
    seller: "demo-marco",
    city: "Bologna",
    emoji: "🎧",
    from: "#111827",
    to: "#6b7280",
  },
  {
    slug: "vestito-fiore",
    title: "Vestito a fiori anni '90",
    description: "Vestito midi a fiori con bottoni in madreperla. Taglia S, vita elasticizzata. Perfetto per la primavera.",
    priceCents: 2900,
    category: "donna",
    size: "S",
    condition: "buono",
    seller: "demo-giulia",
    city: "Rimini",
    emoji: "👗",
    from: "#831843",
    to: "#f9a8d4",
  },
  {
    slug: "felpa-college",
    title: "Felpa college oversize",
    description: "Felpa pesante con interno felpato, taglia L. Colore panna, logo ricamato. Nessun difetto.",
    priceCents: 2400,
    category: "uomo",
    size: "L",
    condition: "ottimo",
    seller: "demo-marco",
    city: "Bologna",
    emoji: "🧢",
    from: "#374151",
    to: "#d1d5db",
  },
  {
    slug: "lampada-design",
    title: "Lampada da tavolo design",
    description: "Lampada in metallo laccato, stile anni '70. Funzionante, cavo nuovo. Ideale per scrivania o comodino.",
    priceCents: 3400,
    category: "casa",
    size: "Unica",
    condition: "buono",
    seller: "demo-sara",
    city: "Milano",
    emoji: "💡",
    from: "#92400e",
    to: "#fcd34d",
  },
  {
    slug: "racchetta-tennis",
    title: "Racchetta da tennis",
    description: "Racchetta in grafite, peso medio. Corda recente, impugnatura rifatta. Perfetta per chi inizia.",
    priceCents: 3200,
    category: "sport",
    size: "Unica",
    condition: "buono",
    seller: "demo-marco",
    city: "Bologna",
    emoji: "🎾",
    from: "#14532d",
    to: "#86efac",
  },
  {
    slug: "maglione-lana",
    title: "Maglione in lana merino",
    description: "Maglione girocollo in pura lana merino, taglia M. Caldo ma leggero, colore blu notte.",
    priceCents: 3100,
    category: "uomo",
    size: "M",
    condition: "come_nuovo",
    seller: "demo-giulia",
    city: "Rimini",
    emoji: "🧶",
    from: "#1e3a8a",
    to: "#93c5fd",
  },
  {
    slug: "set-bambino",
    title: "Set bimbo cotone organico",
    description: "Maglietta e pantaloncini in cotone organico, taglia 4 anni. Lavati delicatamente, come nuovi.",
    priceCents: 1500,
    category: "bambini",
    size: "XS",
    condition: "ottimo",
    seller: "demo-sara",
    city: "Milano",
    emoji: "🧸",
    from: "#0e7490",
    to: "#a5f3fc",
  },
  {
    slug: "orologio-vintage",
    title: "Orologio da polso vintage",
    description: "Orologio a carica manuale, quadrante bianco e cinturino in pelle. Revisionato, tiene bene il tempo.",
    priceCents: 7800,
    category: "accessori",
    size: "Unica",
    condition: "buono",
    seller: "demo-sara",
    city: "Milano",
    emoji: "⌚",
    from: "#422006",
    to: "#eab308",
  },
  {
    slug: "zaino-tecnico",
    title: "Zaino tecnico 25L",
    description: "Zaino impermeabile con scomparto laptop 15\", schienale traspirante. Usato per pochi viaggi.",
    priceCents: 4200,
    category: "accessori",
    size: "Unica",
    condition: "ottimo",
    seller: "demo-marco",
    city: "Bologna",
    emoji: "🎒",
    from: "#134e4a",
    to: "#5eead4",
  },
];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgFor(item: SeedItem): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${item.from}"/>
      <stop offset="1" stop-color="${item.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#bg)"/>
  <rect width="900" height="1200" fill="url(#glow)"/>
  <circle cx="720" cy="180" r="220" fill="#ffffff" opacity="0.08"/>
  <circle cx="130" cy="1030" r="260" fill="#000000" opacity="0.12"/>
  <text x="450" y="610" font-size="230" text-anchor="middle">${item.emoji}</text>
  <text x="450" y="820" font-family="Inter, -apple-system, Segoe UI, sans-serif" font-size="54" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(item.title)}</text>
  <text x="450" y="890" font-family="Inter, -apple-system, Segoe UI, sans-serif" font-size="30" fill="#ffffff" opacity="0.8" text-anchor="middle">${escapeXml(item.category.toUpperCase())} · ${escapeXml(item.size)}</text>
</svg>`;
}

const client = new Client({ connectionString });
await client.connect();

try {
  const existing = await client.query("SELECT count(*)::int AS count FROM items");
  if (existing.rows[0].count > 0 && !force) {
    console.log(`Seed saltato: ci sono già ${existing.rows[0].count} annunci. Usa --force per ricrearli.`);
  } else {
    if (force) {
      console.log("→ rimuovo i dati demo esistenti");
      await client.query("DELETE FROM orders WHERE seller_id LIKE 'demo-%' OR buyer_id LIKE 'demo-%'");
      await client.query("DELETE FROM app_users WHERE id LIKE 'demo-%'");
    }

    console.log("→ categorie e taglie");
    const categoryIds = new Map<string, number>();
    for (const [slug, name, icon] of categories) {
      const result = await client.query(
        `INSERT INTO categories (slug, name, icon) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon
         RETURNING id`,
        [slug, name, icon],
      );
      categoryIds.set(slug, result.rows[0].id);
    }

    const sizeIds = new Map<string, number>();
    for (let index = 0; index < sizes.length; index += 1) {
      const result = await client.query(
        `INSERT INTO sizes (label, sort_order) VALUES ($1, $2)
         ON CONFLICT (label) DO UPDATE SET sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [sizes[index], index],
      );
      sizeIds.set(sizes[index], result.rows[0].id);
    }

    console.log("→ venditori demo");
    for (const seller of sellers) {
      await client.query(
        `INSERT INTO app_users (id, email, display_name, city, bio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET display_name = EXCLUDED.display_name, city = EXCLUDED.city, bio = EXCLUDED.bio`,
        [seller.id, seller.email, seller.name, seller.city, seller.bio],
      );
    }

    console.log("→ foto su Object Storage");
    for (const item of items) {
      const key = `seed/${item.slug}.svg`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: svgFor(item),
          ContentType: "image/svg+xml",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    }

    console.log("→ annunci");
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO items
           (seller_id, title, description, price_cents, category_id, size_id, condition, city, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - ($9 || ' hours')::interval)
         RETURNING id`,
        [
          item.seller,
          item.title,
          item.description,
          item.priceCents,
          categoryIds.get(item.category),
          sizeIds.get(item.size),
          item.condition,
          item.city,
          String(items.indexOf(item) * 7),
        ],
      );
      await client.query(
        `INSERT INTO item_photos (item_id, storage_key, sort_order) VALUES ($1, $2, 0)`,
        [result.rows[0].id, `seed/${item.slug}.svg`],
      );
    }
    console.log(`✓ Seed completato: ${items.length} annunci, ${categories.length} categorie.`);
  }
} finally {
  await client.end();
}
