import { Database } from "duckdb";

let sharedDatabase: Database | null = null;

const defaultPath =
  process.env.DUCKDB_PATH ??
  `${process.cwd()}/.data/duckdb/analytics.duckdb`;

function ensureDatabase(): Database {
  if (sharedDatabase) {
    return sharedDatabase;
  }

  sharedDatabase = new Database(defaultPath);
  return sharedDatabase;
}

export async function runDuckDBQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = ensureDatabase();
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows as T[]);
    });
  });
}

export async function runDuckDBExec(
  sql: string,
  params: unknown[] = []
): Promise<void> {
  const db = ensureDatabase();
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

