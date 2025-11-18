/**
 * Vectorless Chunking Algorithm Tests
 * 
 * These tests validate that the Vectorless chunking algorithm works correctly
 * and matches the behavior from vectorless-main/packages/core/src/chunking.ts
 */

import { chunkPages, type PageSlice, type ChunkDescriptor } from '../document-processor';

describe('Vectorless Chunking Algorithm', () => {
  describe('Basic Chunking', () => {
    it('should create chunks from single page', () => {
      const pages: PageSlice[] = [
        {
          pageNumber: 1,
          text: 'This is a test document with some content that should be chunked properly.',
        },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 50,
        overlapRatio: 0.1,
        minChunkChars: 10,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].order).toBe(0);
      expect(chunks[0].pageNumber).toBe(1);
    });

    it('should maintain chunk order', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'A'.repeat(1000) },
        { pageNumber: 2, text: 'B'.repeat(1000) },
      ];

      const chunks = chunkPages(pages);

      chunks.forEach((chunk, index) => {
        expect(chunk.order).toBe(index);
      });
    });
  });

  describe('Context Overlap', () => {
    it('should create overlapping chunks (10% default)', () => {
      const pages: PageSlice[] = [
        {
          pageNumber: 1,
          text: 'A'.repeat(1500), // Long enough to create multiple chunks
        },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 500,
        overlapRatio: 0.1,
      });

      expect(chunks.length).toBeGreaterThan(1);
      
      // Check overlap exists between consecutive chunks
      if (chunks.length > 1) {
        const chunk1End = chunks[0].text.slice(-50);
        const chunk2Start = chunks[1].text.slice(0, 50);
        
        // Should have some overlap
        expect(chunk2Start).toContain(chunk1End.slice(0, 20));
      }
    });

    it('should respect custom overlap ratio', () => {
      const longText = 'X'.repeat(2000);
      const pages: PageSlice[] = [{ pageNumber: 1, text: longText }];

      // 20% overlap
      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 500,
        overlapRatio: 0.2,
        minChunkChars: 100,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('Paragraph Boundaries', () => {
    it('should split at paragraph boundaries (double newlines)', () => {
      const pages: PageSlice[] = [
        {
          pageNumber: 1,
          text: 'Paragraph one with some text.\n\nParagraph two with more text.\n\nParagraph three.',
        },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 50,
        minChunkChars: 10,
      });

      // Should create multiple chunks respecting paragraph boundaries
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Minimum Chunk Size', () => {
    it('should not create chunks smaller than minChunkChars', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'Short text' },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 1000,
        minChunkChars: 50, // Larger than the text
      });

      // Should create no chunks because text is too small
      expect(chunks.length).toBe(0);
    });

    it('should create chunks when text exceeds minimum', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'A'.repeat(300) },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 1200,
        minChunkChars: 250,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text.length).toBeGreaterThanOrEqual(250);
    });
  });

  describe('Multi-Page Documents', () => {
    it('should handle multiple pages', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'Page 1 content ' + 'A'.repeat(1000) },
        { pageNumber: 2, text: 'Page 2 content ' + 'B'.repeat(1000) },
        { pageNumber: 3, text: 'Page 3 content ' + 'C'.repeat(1000) },
      ];

      const chunks = chunkPages(pages);

      expect(chunks.length).toBeGreaterThan(3);
      
      // Each chunk should have a page number
      chunks.forEach(chunk => {
        expect(chunk.pageNumber).toBeDefined();
        expect(chunk.pageNumber).toBeGreaterThanOrEqual(1);
        expect(chunk.pageNumber).toBeLessThanOrEqual(3);
      });
    });

    it('should preserve page numbers in chunks', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'Short page 1' },
        { pageNumber: 2, text: 'A'.repeat(2000) }, // Long page
        { pageNumber: 3, text: 'Short page 3' },
      ];

      const chunks = chunkPages(pages);

      // Find chunks from page 2
      const page2Chunks = chunks.filter(c => c.pageNumber === 2);
      expect(page2Chunks.length).toBeGreaterThan(1); // Long page should create multiple chunks
    });
  });

  describe('Heading Preservation', () => {
    it('should preserve headings from pages', () => {
      const pages: PageSlice[] = [
        {
          pageNumber: 1,
          text: 'Content for section 1',
          heading: 'Section 1: Introduction',
        },
        {
          pageNumber: 2,
          text: 'Content for section 2',
          heading: 'Section 2: Analysis',
        },
      ];

      const chunks = chunkPages(pages);

      // Chunks should have headings from their source pages
      const chunk1 = chunks.find(c => c.text.includes('section 1'));
      const chunk2 = chunks.find(c => c.text.includes('section 2'));

      expect(chunk1?.heading).toBe('Section 1: Introduction');
      expect(chunk2?.heading).toBe('Section 2: Analysis');
    });
  });

  describe('Large Document Handling (30+ documents)', () => {
    it('should efficiently process 30 documents', () => {
      const documents: PageSlice[][] = [];
      
      // Create 30 mock documents with 10 pages each
      for (let doc = 0; doc < 30; doc++) {
        const pages: PageSlice[] = [];
        for (let page = 1; page <= 10; page++) {
          pages.push({
            pageNumber: page,
            text: `Document ${doc + 1}, Page ${page}. ` + 'Content. '.repeat(200),
            heading: `Document ${doc + 1} - Page ${page}`,
          });
        }
        documents.push(pages);
      }

      // Process all documents
      const startTime = Date.now();
      const allChunks = documents.map(pages => chunkPages(pages));
      const endTime = Date.now();

      const totalChunks = allChunks.reduce((sum, chunks) => sum + chunks.length, 0);

      expect(documents.length).toBe(30);
      expect(totalChunks).toBeGreaterThan(300); // Should create multiple chunks per page
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('Citation Key Format', () => {
    it('should maintain consistent ordering for citation keys', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'A'.repeat(3000) },
      ];

      const chunks = chunkPages(pages, {
        maxCharsPerChunk: 500,
      });

      // Orders should be sequential
      chunks.forEach((chunk, index) => {
        expect(chunk.order).toBe(index);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pages array', () => {
      const chunks = chunkPages([]);
      expect(chunks).toEqual([]);
    });

    it('should handle pages with empty text', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: '' },
        { pageNumber: 2, text: '   ' },
      ];

      const chunks = chunkPages(pages);
      expect(chunks.length).toBe(0);
    });

    it('should handle very long single-line text', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'X'.repeat(10000) },
      ];

      const chunks = chunkPages(pages);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(1200);
      });
    });
  });

  describe('Default Options', () => {
    it('should use default options when none provided', () => {
      const pages: PageSlice[] = [
        { pageNumber: 1, text: 'A'.repeat(2000) },
      ];

      const chunks = chunkPages(pages); // No options

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        // Should respect default max of 1200 chars
        expect(chunk.text.length).toBeLessThanOrEqual(1200);
      });
    });
  });
});

