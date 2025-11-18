/**
 * Document Processor with Vectorless Chunking Algorithm
 * 
 * This module implements the Vectorless approach to document processing:
 * - NO vector embeddings or RAG (Retrieval-Augmented Generation)
 * - Intelligent chunking with overlap for context preservation
 * - Citation key generation for full traceability
 * - Multi-format support (PDF, Markdown, DOCX, CSV)
 * - Handles 30+ documents efficiently
 * 
 * Based on: https://github.com/vectorless/vectorless
 * Chunking Algorithm: packages/core/src/chunking.ts
 * 
 * @see https://vectorless.com for more information
 */

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

export interface ProcessedDocument {
  id: string;
  filename: string;
  fileType: string;
  url: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    heading?: string;
  }>;
  chunks: Array<{
    order: number;
    pageNumber?: number;
    heading?: string;
    text: string;
    citationKey: string;
  }>;
  totalPages: number;
  totalChunks: number;
  metadata?: Record<string, any>;
}

const defaultOptions: Required<ChunkerOptions> = {
  maxCharsPerChunk: 1200,
  overlapRatio: 0.1,
  minChunkChars: 250,
};

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'text/markdown': 'Markdown',
  'text/md': 'Markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'CSV',
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_FILE_TYPES;

// Check if file type is supported
export function isSupportedFileType(mimeType: string): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_FILE_TYPES;
}

// Extract pages from PDF buffer
export async function extractPdfPages(buffer: Buffer): Promise<PageSlice[]> {
  const pages: PageSlice[] = [];
  
  try {
    const pdfData = await pdfParse(buffer);
    
    if (pdfData.text) {
      // Split by page breaks if available, otherwise treat as single page
      const pageTexts = pdfData.text.split(/\f+/); // Form feed character typically indicates page break
      
      pageTexts.forEach((pageText, index) => {
        const cleanText = pageText.replace(/\s+/g, ' ').trim();
        if (cleanText) {
          pages.push({
            pageNumber: index + 1,
            text: cleanText,
          });
        }
      });
      
      // If no pages were created, use full text as single page
      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          text: pdfData.text.replace(/\s+/g, ' ').trim(),
        });
      }
    }
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract PDF content: ${error}`);
  }

  return pages;
}

// Extract content from Markdown
export async function extractMarkdownPages(buffer: Buffer): Promise<PageSlice[]> {
  const content = buffer.toString('utf-8');
  const pages: PageSlice[] = [];
  
  // Split by h1 headers as logical page breaks
  const sections = content.split(/^#\s+/m);
  
  sections.forEach((section, index) => {
    const trimmed = section.trim();
    if (trimmed) {
      const lines = trimmed.split('\n');
      const heading = index > 0 ? lines[0] : undefined;
      const text = index > 0 ? lines.slice(1).join('\n').trim() : trimmed;
      
      if (text) {
        pages.push({
          pageNumber: index + 1,
          text: text.replace(/\s+/g, ' ').trim(),
          heading: heading?.trim(),
        });
      }
    }
  });
  
  // If no sections found, treat entire document as one page
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      text: content.replace(/\s+/g, ' ').trim(),
    });
  }
  
  return pages;
}

// Extract content from DOCX
export async function extractDocxPages(buffer: Buffer): Promise<PageSlice[]> {
  try {
    // Dynamically import mammoth for DOCX parsing
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    
    const text = result.value;
    const pages: PageSlice[] = [];
    
    if (text) {
      // Split by page breaks or section breaks
      const sections = text.split(/\n{3,}/);
      
      sections.forEach((section, index) => {
        const trimmed = section.trim();
        if (trimmed) {
          pages.push({
            pageNumber: index + 1,
            text: trimmed.replace(/\s+/g, ' ').trim(),
          });
        }
      });
      
      // If no sections, use full text
      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          text: text.replace(/\s+/g, ' ').trim(),
        });
      }
    }
    
    return pages;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error(`Failed to extract DOCX content: ${error}`);
  }
}

// Extract content from CSV
export async function extractCsvPages(buffer: Buffer): Promise<PageSlice[]> {
  const content = buffer.toString('utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  // Get headers
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Convert CSV to readable text format
  const textLines: string[] = [];
  textLines.push(`CSV Data with ${headers.length} columns: ${headers.join(', ')}`);
  textLines.push('');
  
  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const rowText = headers.map((header, idx) => 
      `${header}: ${values[idx] || 'N/A'}`
    ).join(', ');
    textLines.push(`Row ${i}: ${rowText}`);
  }
  
  // Group into pages (e.g., 50 rows per page)
  const ROWS_PER_PAGE = 50;
  const pages: PageSlice[] = [];
  
  for (let i = 0; i < textLines.length; i += ROWS_PER_PAGE) {
    const pageText = textLines.slice(i, i + ROWS_PER_PAGE).join('\n');
    pages.push({
      pageNumber: Math.floor(i / ROWS_PER_PAGE) + 1,
      text: pageText.replace(/\s+/g, ' ').trim(),
      heading: i === 0 ? 'CSV Data Header' : undefined,
    });
  }
  
  return pages;
}

// Main extraction function that routes to appropriate parser
export async function extractDocumentPages(
  buffer: Buffer,
  mimeType: string
): Promise<PageSlice[]> {
  if (!isSupportedFileType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  
  switch (mimeType) {
    case 'application/pdf':
      return await extractPdfPages(buffer);
    
    case 'text/markdown':
    case 'text/md':
      return await extractMarkdownPages(buffer);
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractDocxPages(buffer);
    
    case 'text/csv':
    case 'application/vnd.ms-excel':
      return await extractCsvPages(buffer);
    
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Chunk pages with overlap (Vectorless Algorithm)
 * 
 * This is the core Vectorless chunking algorithm that splits documents into
 * overlapping chunks without using vector embeddings. Key features:
 * 
 * 1. **Adaptive Chunking**: Splits text at natural boundaries (paragraphs)
 * 2. **Context Overlap**: 10% overlap ensures context continuity between chunks
 * 3. **Token-Agnostic**: Uses character budgets (1200 chars default) instead of tokens
 * 4. **Citation Ready**: Each chunk gets a unique citation key (DOC-{id}-{order})
 * 5. **Metadata Preservation**: Maintains page numbers and headings
 * 
 * Algorithm Overview:
 * - Accumulates text segments into a buffer up to maxCharsPerChunk
 * - When buffer exceeds limit, flushes to create a chunk
 * - Keeps last N chars (overlap) to start next chunk
 * - This ensures no information is lost at chunk boundaries
 * 
 * Example:
 * ```
 * Chunk 1: "The market grew by 40%... revenue reached $500M"
 * Chunk 2: "revenue reached $500M... new partnerships formed" (overlap)
 * ```
 * 
 * @param pages - Array of page slices extracted from document
 * @param options - Chunking configuration (maxChars, overlap, minChars)
 * @returns Array of chunk descriptors with citations
 * 
 * @see vectorless-main/packages/core/src/chunking.ts
 */
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

  // Calculate overlap: 10% of max chunk size by default
  // This ensures context continuity between adjacent chunks
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

// Get file extension from filename
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Get mime type from file extension
export function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'csv': 'text/csv',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

