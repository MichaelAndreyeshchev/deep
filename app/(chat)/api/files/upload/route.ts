import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import {
  extractDocumentPages,
  chunkPages,
  generateCitationKey,
  SUPPORTED_FILE_TYPES,
  isSupportedFileType,
  getFileExtension,
  getMimeTypeFromExtension,
  type ProcessedDocument,
} from '@/lib/document-processor';
import { put } from '@/lib/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 30;

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['pdf', 'md', 'markdown', 'docx', 'csv'];

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: 'File size should be less than 10MB',
    })
    .refine(
      (file) => {
        // Check if mime type is supported OR if it's octet-stream (fallback)
        return isSupportedFileType(file.type) || file.type === 'application/octet-stream';
      },
      {
        message: `File type must be one of: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      }
    ),
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

    const processedDocs: ProcessedDocument[] = [];

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
      
      // Determine file type
      let mimeType = file.type;
      
      // If mime type is generic, try to determine from extension
      if (mimeType === 'application/octet-stream' || !mimeType) {
        const extension = getFileExtension(filename);
        mimeType = getMimeTypeFromExtension(extension);
      }
      
      // Validate that we support this mime type
      if (!isSupportedFileType(mimeType)) {
        return NextResponse.json({ 
          error: `File ${i + 1} (${filename}): Unsupported file type. Supported types: ${SUPPORTED_EXTENSIONS.join(', ')}` 
        }, { status: 400 });
      }
      
      const fileType = SUPPORTED_FILE_TYPES[mimeType];

      try {
        // Extract pages from document (PDF, Markdown, DOCX, or CSV)
        const pages = await extractDocumentPages(fileBuffer, mimeType);
        
        // Chunk the pages using Vectorless algorithm
        const chunks = chunkPages(pages, {
          maxCharsPerChunk: 1400,
          overlapRatio: 0.1,
          minChunkChars: 250,
        });

        // Upload to blob storage with appropriate folder
        const folder = fileType.toLowerCase();
        const blobData = await put(`documents/${folder}/${filename}`, fileBuffer, {
          access: 'public',
        });

        const documentId = `doc-${Date.now()}-${i}`;

        const processedDoc: ProcessedDocument = {
          id: documentId,
          filename,
          fileType,
          url: blobData.url,
          pages: pages.map(p => ({
            pageNumber: p.pageNumber,
            text: p.text,
            heading: p.heading,
          })),
          chunks: chunks.map(c => ({
            order: c.order,
            pageNumber: c.pageNumber,
            heading: c.heading,
            text: c.text,
            citationKey: generateCitationKey(documentId, c.order),
          })),
          totalPages: pages.length,
          totalChunks: chunks.length,
          metadata: {
            mimeType,
            uploadedAt: new Date().toISOString(),
            userId: session.user?.id,
          },
        };

        processedDocs.push(processedDoc);

      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
        return NextResponse.json({ 
          error: `Failed to process ${filename}: ${error}` 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      documents: processedDocs,
      message: `Successfully processed ${files.length} document(s)`,
      totalFiles: files.length,
      fileTypes: [...new Set(processedDocs.map(d => d.fileType))],
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
