/**
 * Storage Service
 * 
 * Abstracts file storage to support both:
 * - Vercel Blob (production)
 * - Local filesystem (development/Docker)
 * 
 * Automatically detects environment and uses appropriate storage method.
 */

import { put as vercelPut } from '@vercel/blob';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface PutResult {
  url: string;
  pathname: string;
}

interface StorageOptions {
  access?: 'public';
}

/**
 * Check if we're using Vercel Blob storage
 * Returns true if BLOB_READ_WRITE_TOKEN is set and looks valid
 */
function isVercelBlobEnabled(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  
  // Vercel tokens start with 'vercel_blob_rw_'
  return !!token && token.startsWith('vercel_blob_rw_');
}

/**
 * Store a file using local filesystem
 */
async function putLocal(
  pathname: string,
  buffer: Buffer,
  options?: StorageOptions
): Promise<PutResult> {
  // Use public directory for local storage
  const publicDir = join(process.cwd(), 'public', 'uploads');
  const filePath = join(publicDir, pathname);
  const fileDir = join(publicDir, pathname.split('/').slice(0, -1).join('/'));

  // Ensure directory exists
  if (!existsSync(fileDir)) {
    await mkdir(fileDir, { recursive: true });
  }

  // Write file
  await writeFile(filePath, buffer);

  // Return URL that works in local development
  const url = `/uploads/${pathname}`;
  
  return {
    url,
    pathname,
  };
}

/**
 * Store a file using Vercel Blob storage
 */
async function putVercel(
  pathname: string,
  buffer: Buffer,
  options?: StorageOptions
): Promise<PutResult> {
  // Vercel Blob requires access to be set, default to 'public'
  const result = await vercelPut(pathname, buffer, { 
    access: options?.access || 'public' 
  });
  
  return {
    url: result.url,
    pathname: result.pathname,
  };
}

/**
 * Store a file (automatically chooses storage backend)
 * 
 * @param pathname - Path where file should be stored
 * @param buffer - File contents as Buffer
 * @param options - Storage options (e.g., access level)
 * @returns Object with url and pathname
 */
export async function put(
  pathname: string,
  buffer: Buffer,
  options?: StorageOptions
): Promise<PutResult> {
  const useVercel = isVercelBlobEnabled();
  
  console.log(`[Storage] Using ${useVercel ? 'Vercel Blob' : 'local filesystem'} storage`);
  
  if (useVercel) {
    return putVercel(pathname, buffer, options);
  } else {
    return putLocal(pathname, buffer, options);
  }
}

/**
 * Get the base URL for file storage
 */
export function getStorageBaseUrl(): string {
  if (isVercelBlobEnabled()) {
    return 'https://blob.vercel-storage.com';
  } else {
    // In Docker/local development, files are served from /uploads
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return `${baseUrl}/uploads`;
  }
}

