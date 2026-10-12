import "server-only";

import pg, { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getEnv } from "@/src/lib/env";

pg.types.setTypeParser(20, (value) => Number.parseInt(value, 10));

declare global {
  var reservationPool: Pool | undefined;
}

function getPool() {
  if (!globalThis.reservationPool) {
    globalThis.reservationPool = new Pool({ connectionString: getEnv().DATABASE_URL });
  }

  return globalThis.reservationPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
