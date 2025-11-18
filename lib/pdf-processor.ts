import pdfParse from 'pdf-parse';

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

const defaultOptions: Required<ChunkerOptions> = {
  maxCharsPerChunk: 1200,
  overlapRatio: 0.1,
  minChunkChars: 250,
};

// Extract pages from PDF buffer
export async function extractPdfPages(buffer: Buffer): Promise<PageSlice[]> {
  const pages: PageSlice[] = [];
  
  await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text,
      });

      return text;
    },
  });

  return pages;
}

// Chunk pages with overlap (Vectorless algorithm)
export function chunkPages(
  pages: PageSlice[],
  options: ChunkerOptions = {}
): ChunkDescriptor[] {
  const settings = { ...defaultOptions, ...options };
  const results: ChunkDescriptor[] = [];
  let buffer = '';
  let bufferPage: number | undefined;
  let bufferHeading: string | undefined;
  let order = 0;

  const overlapChars = Math.floor(
    settings.maxCharsPerChunk * settings.overlapRatio
  );

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (!trimmed || trimmed.length < settings.minChunkChars) {
      buffer = '';
      return;
    }

    results.push({
      order,
      pageNumber: bufferPage,
      heading: bufferHeading,
      text: trimmed,
    });
    order += 1;

    buffer = trimmed.slice(-overlapChars);
  };

  pages.forEach((page) => {
    const segments = page.text
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    segments.forEach((segment) => {
      const prospectiveLength = buffer.length + segment.length + 1;
      if (prospectiveLength > settings.maxCharsPerChunk) {
        flushBuffer();
        buffer = '';
      }

      if (!buffer) {
        bufferPage = page.pageNumber;
        bufferHeading = page.heading;
      }

      buffer = [buffer, segment].filter(Boolean).join('\n\n');
    });
  });

  if (buffer.length) {
    flushBuffer();
  }

  return results;
}

// Generate citation key for a chunk
export function generateCitationKey(documentId: string, chunkOrder: number): string {
  return `DOC-${documentId}-${chunkOrder}`;
}

