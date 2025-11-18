export interface PageSlice {
    pageNumber: number;
    text: string;
    heading?: string;
}
export interface ChunkDescriptor {
    order: number;
    pageNumber?: number;
    heading?: string;
    text: string;
}
export interface ChunkerOptions {
    maxCharsPerChunk?: number;
    overlapRatio?: number;
    minChunkChars?: number;
}
export declare function chunkPages(pages: PageSlice[], options?: ChunkerOptions): ChunkDescriptor[];
