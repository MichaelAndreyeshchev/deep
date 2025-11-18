# Storage Setup Documentation

## Problem Fixed

The application was failing to upload files with the error:
```
Error: Vercel Blob: Access denied, please provide a valid token for this resource.
```

## Root Cause

The application was using `@vercel/blob` which requires a Vercel-specific token (`BLOB_READ_WRITE_TOKEN`) to store files on Vercel's cloud storage. In local Docker development, this token was not available, causing all file uploads to fail.

## Solution

Created a **storage abstraction layer** (`lib/storage.ts`) that automatically detects the environment and uses the appropriate storage backend:

### 1. Production (Vercel)
When a valid Vercel Blob token is detected (starts with `vercel_blob_rw_`), files are uploaded to Vercel Blob storage.

### 2. Development/Docker (Local Filesystem)
When no Vercel token is available, files are stored locally in the `public/uploads/` directory, making them accessible via HTTP.

## How It Works

### Storage Abstraction Layer (`lib/storage.ts`)

```typescript
export async function put(
  pathname: string,
  buffer: Buffer,
  options?: StorageOptions
): Promise<PutResult>
```

This function:
1. Checks if `BLOB_READ_WRITE_TOKEN` is set and starts with `vercel_blob_rw_`
2. If YES → Uses Vercel Blob storage
3. If NO → Saves files to local filesystem (`public/uploads/`)

### File Upload Route (`app/(chat)/api/files/upload/route.ts`)

Updated to use the new storage abstraction:
```typescript
import { put } from '@/lib/storage';  // Instead of '@vercel/blob'

// Later in code:
const blobData = await put(`documents/${folder}/${filename}`, fileBuffer, {
  access: 'public',
});
```

## File Storage Structure

Files are organized by type in the `public/uploads/` directory:

```
public/
└── uploads/
    └── documents/
        ├── pdfs/           # PDF files
        ├── markdowns/      # Markdown files
        ├── docxs/          # Word documents
        └── csvs/           # CSV files
```

## Multi-Format Support

The system now supports multiple file formats:
- **PDF** (.pdf) - Extracted using `pdf-parse`
- **Markdown** (.md, .markdown) - Plain text parsing
- **Word** (.docx) - Extracted using `mammoth`
- **CSV** (.csv) - Parsed as CSV data

## Docker Configuration

### Dockerfile Updates
Created upload directories during build:
```dockerfile
RUN mkdir -p /app/public/uploads/documents/pdfs && \
    mkdir -p /app/public/uploads/documents/markdowns && \
    mkdir -p /app/public/uploads/documents/docxs && \
    mkdir -p /app/public/uploads/documents/csvs
```

### .gitignore Updates
Added to prevent uploaded files from being committed:
```
# uploaded files
public/uploads/
```

## Vectorless Chunking Algorithm

All uploaded documents are processed using the **Vectorless chunking algorithm** implemented in `lib/document-processor.ts`:

### Key Features:
1. **No RAG (Retrieval-Augmented Generation)** - No vector embeddings needed
2. **Intelligent Chunking** - Splits text at natural boundaries (paragraphs)
3. **Context Overlap** - 10% overlap between chunks to maintain context
4. **Token-Agnostic** - Uses character budgets (1400 chars default)
5. **Citation Ready** - Each chunk gets a unique citation key (DOC-{id}-{order})
6. **Handles 30+ Documents** - Efficiently processes large document sets

### Processing Flow:

```
1. Upload File → Extract Text (based on format)
2. Split into Pages → Chunk Pages (Vectorless algorithm)
3. Store File → Generate Citation Keys
4. Return Processed Document → Ready for AI analysis
```

## Environment Variables

### Required for Vercel Blob (Production):
- `BLOB_READ_WRITE_TOKEN` - Must start with `vercel_blob_rw_`

### Local Development (Docker):
- No blob token needed
- Files stored in `public/uploads/`
- Served via HTTP at `/uploads/{path}`

## Benefits

✅ **Works in Docker** - No cloud dependencies for local development  
✅ **Zero Configuration** - Automatically detects environment  
✅ **Consistent API** - Same code works in both environments  
✅ **Multi-Format** - Supports PDF, Markdown, DOCX, CSV  
✅ **Vectorless Processing** - Efficient chunking without embeddings  
✅ **Scalable** - Handles 30+ documents simultaneously  

## Testing

To test file uploads:
1. Start Docker containers: `docker compose up -d --build`
2. Access the app at http://localhost:13000
3. Upload a PDF, DOCX, Markdown, or CSV file
4. Check logs: `docker logs deep-app-1`
5. Verify files are stored: `ls public/uploads/documents/`

## File Size Limits

- **Max file size**: 10MB per file
- **Max files**: 30 files per upload
- **Supported formats**: PDF, MD, DOCX, CSV

## URLs

### Local Development:
- Files accessible at: `http://localhost:13000/uploads/documents/{type}/{filename}`
- Example: `http://localhost:13000/uploads/documents/pdfs/report.pdf`

### Production (Vercel):
- Files stored on Vercel Blob storage
- Permanent URLs provided by Vercel
- Example: `https://blob.vercel-storage.com/...`

## Troubleshooting

### Issue: Files not uploading
**Solution**: Check Docker logs for storage method being used:
```bash
docker logs deep-app-1 | grep Storage
```
Should show: `[Storage] Using local filesystem storage`

### Issue: Files return 404
**Solution**: Verify upload directory exists in container:
```bash
docker exec deep-app-1 ls -la /app/public/uploads/documents/
```

### Issue: "Access denied" error
**Solution**: This means the app is trying to use Vercel Blob but token is invalid. Either:
1. Remove/fix the `BLOB_READ_WRITE_TOKEN` in `.env`
2. Or get a valid token from Vercel dashboard

## Migration from Vercel Blob to Local Storage

If you already have files in Vercel Blob and want to migrate:

1. Download files from Vercel Blob storage
2. Place them in `public/uploads/documents/{type}/`
3. Update database URLs from `https://blob.vercel-storage.com/...` to `/uploads/documents/{type}/{filename}`

## Security Considerations

- Files are stored in `public/` directory, meaning they're publicly accessible
- In production, Vercel Blob provides CDN caching and DDoS protection
- For local development, files are served directly by Next.js static file serving
- Consider implementing authentication middleware for file access if needed

## Performance

### Local Storage (Docker):
- Fast read/write from filesystem
- No network latency
- Limited by disk I/O

### Vercel Blob (Production):
- Global CDN distribution
- Optimized for large files
- Automatic caching
- Built-in rate limiting

## Future Enhancements

Potential improvements:
1. Add MinIO support for S3-compatible local storage
2. Implement file compression for large documents
3. Add virus scanning for uploaded files
4. Implement file versioning
5. Add automatic cleanup of old files
6. Support for additional formats (e.g., PPTX, TXT, RTF)

