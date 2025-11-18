import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { extractPdfPages, chunkPages, generateCitationKey } from '@/lib/pdf-processor';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 30;

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: 'File size should be less than 10MB',
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => ['application/pdf'].includes(file.type) || file.type.includes('pdf'), {
      message: 'File type should be PDF',
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as Blob[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ 
        error: `Maximum ${MAX_FILES} files allowed. You uploaded ${files.length} files.` 
      }, { status: 400 });
    }

    const processedDocs: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validatedFile = FileSchema.safeParse({ file });

      if (!validatedFile.success) {
        return NextResponse.json({ 
          error: `File ${i + 1}: ${validatedFile.error.errors.map((e) => e.message).join(', ')}` 
        }, { status: 400 });
      }

      // Get filename from formData since Blob doesn't have name property
      const filename = (formData.getAll('file')[i] as File).name;
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      try {
        // Extract pages from PDF
        const pages = await extractPdfPages(fileBuffer);
        
        // Chunk the pages using Vectorless algorithm
        const chunks = chunkPages(pages, {
          maxCharsPerChunk: 1400,
          overlapRatio: 0.1,
          minChunkChars: 250,
        });

        // Upload to blob storage
        const blobData = await put(`pdfs/${filename}`, fileBuffer, {
          access: 'public',
        });

        const documentId = `doc-${Date.now()}-${i}`;

        processedDocs.push({
          id: documentId,
          filename,
          url: blobData.url,
          pages: pages.map(p => ({
            pageNumber: p.pageNumber,
            text: p.text,
          })),
          chunks: chunks.map(c => ({
            order: c.order,
            pageNumber: c.pageNumber,
            text: c.text,
            citationKey: generateCitationKey(documentId, c.order),
          })),
          totalPages: pages.length,
          totalChunks: chunks.length,
        });

      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
        return NextResponse.json({ 
          error: `Failed to process ${filename}: ${error}` 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      documents: processedDocs,
      message: `Successfully processed ${files.length} PDF document(s)`,
      totalFiles: files.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
