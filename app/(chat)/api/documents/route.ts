import { NextResponse } from 'next/server';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/app/(auth)/auth';

/**
 * GET /api/documents
 * List all uploaded documents
 */
export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents');
    const types = ['pdfs', 'markdowns', 'docxs', 'csvs'];
    const documents: Array<{
      name: string;
      type: string;
      size: number;
      url: string;
      path: string;
      uploadedAt: string;
    }> = [];

    for (const type of types) {
      const typeDir = join(uploadsDir, type);
      try {
        const files = await readdir(typeDir);
        for (const file of files) {
          const filePath = join(typeDir, file);
          const stats = await stat(filePath);
          documents.push({
            name: file,
            type: type.slice(0, -1).toUpperCase(), // 'pdfs' -> 'PDF'
            size: stats.size,
            url: `/uploads/documents/${type}/${file}`,
            path: `documents/${type}/${file}`,
            uploadedAt: stats.mtime.toISOString(),
          });
        }
      } catch (error) {
        // Directory might not exist, skip
        console.log(`Directory ${typeDir} not found, skipping`);
      }
    }

    // Sort by upload date (most recent first)
    documents.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?path=...
 * Delete a specific document
 */
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const docPath = searchParams.get('path');

    if (!docPath) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // Security: ensure path is within documents directory
    if (!docPath.startsWith('documents/')) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), 'public', 'uploads', docPath);

    // Delete the file
    await unlink(filePath);

    return NextResponse.json({ 
      success: true,
      message: 'Document deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

