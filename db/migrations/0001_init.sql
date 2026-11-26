-- Riuso — schema logico per un marketplace di seconda mano.
-- Eseguire con la connessione diretta (DATABASE_URL_UNPOOLED).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profilo applicativo collegato all'utente gestito da Neon Auth.
-- L'id coincide con il "sub" del JWT emesso da Neon Auth.
CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY,
  email         TEXT,
  display_name  TEXT NOT NULL,
  avatar_key    TEXT,
  bio           TEXT,
  city          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  icon  TEXT
);

CREATE TABLE IF NOT EXISTS sizes (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  size_id      INTEGER REFERENCES sizes(id) ON DELETE SET NULL,
  condition    TEXT NOT NULL DEFAULT 'buono'
               CHECK (condition IN ('nuovo', 'come_nuovo', 'ottimo', 'buono', 'discreto')),
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('draft', 'active', 'reserved', 'sold', 'archived')),
  city         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  buyer_id      TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id              UUID NOT NULL REFERENCES items(id),
  buyer_id             TEXT NOT NULL REFERENCES app_users(id),
  seller_id            TEXT NOT NULL REFERENCES app_users(id),
  amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  shipping_name        TEXT,
  shipping_address     TEXT,
  shipping_city        TEXT,
  shipping_postal_code TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

-- Pagamenti demo: nessun provider reale, il record documenta lo stato.
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'demo',
  status        TEXT NOT NULL DEFAULT 'paid'
                CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  amount_cents  INTEGER NOT NULL,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  carrier          TEXT,
  tracking_number  TEXT,
  status           TEXT NOT NULL DEFAULT 'preparing'
                   CHECK (status IN ('preparing', 'shipped', 'in_transit', 'delivered')),
  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES app_users(id),
  subject_id  TEXT NOT NULL REFERENCES app_users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (author_id <> subject_id)
);

CREATE INDEX IF NOT EXISTS items_status_created_idx ON items (status, created_at DESC);
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category_id);
CREATE INDEX IF NOT EXISTS items_seller_idx ON items (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS item_photos_item_idx ON item_photos (item_id, sort_order);
CREATE INDEX IF NOT EXISTS offers_item_status_idx ON offers (item_id, status);
CREATE INDEX IF NOT EXISTS offers_buyer_idx ON offers (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_subject_idx ON reviews (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_item_idx ON favorites (item_id);
