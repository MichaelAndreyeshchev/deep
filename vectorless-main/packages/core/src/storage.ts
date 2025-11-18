import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_DIR = path.join(process.cwd(), ".data/uploads");

function getStorageDir() {
  return process.env.FILE_STORAGE_DIR ?? DEFAULT_DIR;
}

export async function ensureStorageDir(): Promise<string> {
  const dir = getStorageDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function generateStorageFilename(originalName: string): string {
  const extension = path.extname(originalName);
  const slug = crypto.randomUUID();
  return `${slug}${extension}`;
}

export async function persistFile(
  data: Buffer,
  originalName: string
): Promise<{ absolutePath: string; relativePath: string }> {
  const dir = await ensureStorageDir();
  const filename = generateStorageFilename(originalName);
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, data);
  return { absolutePath, relativePath: filename };
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  const dir = await ensureStorageDir();
  return fs.readFile(path.join(dir, relativePath));
}

