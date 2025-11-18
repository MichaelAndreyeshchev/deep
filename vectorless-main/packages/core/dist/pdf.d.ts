import type { PageSlice } from "./chunking";
export declare function extractPdfPages(buffer: Buffer): Promise<PageSlice[]>;
