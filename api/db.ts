import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { attachDatabasePool } from "@neon/functions";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL non impostata. Esegui `neon deploy` o `neon env pull`.");
}

/**
 * Pool creato una sola volta a livello di modulo: Neon Functions riusa
 * l'isolate tra più richieste, quindi il pool va condiviso, non ricreato.
 */
export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
attachDatabasePool(pool);

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

/**
 * Crea o aggiorna il profilo applicativo collegato all'utente Neon Auth.
 * L'id è il `sub` del JWT, quindi non serve una seconda tabella utenti.
 */
export async function ensureUser(user: AuthUser): Promise<void> {
  const displayName =
    user.name?.trim() || user.email?.split("@")[0]?.trim() || "Utente Riuso";
  await query(
    `INSERT INTO app_users (id, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, app_users.email),
           updated_at = now()`,
    [user.id, user.email ?? null, displayName],
  );
}
