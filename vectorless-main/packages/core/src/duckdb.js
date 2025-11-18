import { Database } from "duckdb";
let sharedDatabase = null;
const defaultPath = process.env.DUCKDB_PATH ??
    `${process.cwd()}/.data/duckdb/analytics.duckdb`;
function ensureDatabase() {
    if (sharedDatabase) {
        return sharedDatabase;
    }
    sharedDatabase = new Database(defaultPath);
    return sharedDatabase;
}
export async function runDuckDBQuery(sql, params = []) {
    const db = ensureDatabase();
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(rows);
        });
    });
}
export async function runDuckDBExec(sql, params = []) {
    const db = ensureDatabase();
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
