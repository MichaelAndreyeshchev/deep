'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FileIcon,
  Trash2Icon,
  DownloadIcon,
  RefreshCwIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface Document {
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
  uploadedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getFileIcon(type: string) {
  switch (type) {
    case 'PDF':
      return <FileIcon className="h-5 w-5 text-red-500" />;
    case 'MARKDOWN':
      return <FileTextIcon className="h-5 w-5 text-blue-500" />;
    case 'DOCX':
      return <FileTextIcon className="h-5 w-5 text-blue-700" />;
    case 'CSV':
      return <FileSpreadsheetIcon className="h-5 w-5 text-green-500" />;
    default:
      return <FileIcon className="h-5 w-5 text-gray-500" />;
  }
}

export function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to load documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (doc: Document) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      return;
    }

    setDeleting(doc.path);
    try {
      const response = await fetch(
        `/api/documents?path=${encodeURIComponent(doc.path)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete document');

      toast.success(`Deleted ${doc.name}`);
      setDocuments((prev) => prev.filter((d) => d.path !== doc.path));
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCwIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileIcon className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No documents uploaded</h3>
        <p className="text-sm text-muted-foreground">
          Upload files to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Uploaded Documents ({documents.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDocuments}
          disabled={loading}
        >
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <Card
            key={doc.path}
            className="flex items-center justify-between p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getFileIcon(doc.type)}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm">{doc.name}</p>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{doc.type}</span>
                  <span>•</span>
                  <span>{formatFileSize(doc.size)}</span>
                  <span>•</span>
                  <span>{formatDate(doc.uploadedAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                title="Download"
              >
                <a href={doc.url} download={doc.name}>
                  <DownloadIcon className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDocument(doc)}
                disabled={deleting === doc.path}
                title="Delete"
                className="text-destructive hover:text-destructive"
              >
                {deleting === doc.path ? (
                  <RefreshCwIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2Icon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

