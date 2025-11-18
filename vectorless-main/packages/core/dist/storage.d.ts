export declare function ensureStorageDir(): Promise<string>;
export declare function generateStorageFilename(originalName: string): string;
export declare function persistFile(data: Buffer, originalName: string): Promise<{
    absolutePath: string;
    relativePath: string;
}>;
export declare function readStoredFile(relativePath: string): Promise<Buffer>;
