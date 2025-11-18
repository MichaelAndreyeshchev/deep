export declare function runDuckDBQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
export declare function runDuckDBExec(sql: string, params?: unknown[]): Promise<void>;
