import React, { useState, useEffect } from 'react';
import { toast } from '../../components/Toaster';
import { FileText, Image, FileSpreadsheet, X, Download, Trash2, Eye } from 'lucide-react';

export const CATEGORY_OPTIONS = [
  { value: 'LEASE', label: 'Lease' },
  { value: 'BILL', label: 'Bill / Utility' },
  { value: 'TENANT_ID', label: 'Tenant ID' },
  { value: 'SECTION_8', label: 'Section 8' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'PROPERTY_PHOTO', label: 'Property Photo' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'TAX', label: 'Tax' },
  { value: 'ANALYSIS', label: 'Analysis' },
  { value: 'OTHER', label: 'Other' },
] as const;

const blobCache = new Map<string, string>();

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet;
  return FileText;
}

export function categoryLabel(category: string, description?: string | null) {
  const base = CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category;
  if (category === 'OTHER' && description?.trim()) {
    return `Other — ${description.trim()}`;
  }
  return base;
}

export function formatDateTime(value: string | Date): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function fetchDocumentBlob(docId: string): Promise<Blob> {
  const token = localStorage.getItem('rentarvo_token');
  const res = await fetch(`/api/v1/documents/${docId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Could not load file');
  return res.blob();
}

export async function getDocumentBlobUrl(docId: string): Promise<string> {
  const cached = blobCache.get(docId);
  if (cached) return cached;
  const blob = await fetchDocumentBlob(docId);
  const url = URL.createObjectURL(blob);
  blobCache.set(docId, url);
  return url;
}

export function revokeDocumentBlobUrl(docId: string) {
  const url = blobCache.get(docId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(docId);
  }
}

export function guessCategoryFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lease')) return 'LEASE';
  if (n.includes('bill') || n.includes('utility') || n.includes('electric') || n.includes('water')) return 'BILL';
  if (n.includes('receipt')) return 'RECEIPT';
  if (n.includes('invoice')) return 'INVOICE';
  if (n.includes('insurance')) return 'INSURANCE';
  if (n.includes('tax')) return 'TAX';
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(n)) return 'PROPERTY_PHOTO';
  return 'OTHER';
}

export function DocumentPreviewModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = doc.mimeType?.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  useEffect(() => {
    getDocumentBlobUrl(doc.id)
      .then(setBlobUrl)
      .catch(() => toast.error('Could not load preview'))
      .finally(() => setLoading(false));
  }, [doc.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{doc.originalFilename}</h2>
            <p className="text-xs text-gray-500">{categoryLabel(doc.category, doc.description)} · {formatBytes(doc.sizeBytes)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 rounded-lg shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[240px] bg-gray-50">
          {loading && <p className="text-gray-500">Loading preview…</p>}
          {!loading && blobUrl && isImage && (
            <img src={blobUrl} alt={doc.originalFilename} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm" />
          )}
          {!loading && blobUrl && isPdf && (
            <iframe src={blobUrl} title={doc.originalFilename} className="w-full h-[75vh] rounded-lg border bg-white" />
          )}
          {!loading && blobUrl && !isImage && !isPdf && (
            <p className="text-gray-500 text-center">Preview not available. Use Download.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentPreviewImage({ doc, className = '' }: { doc: any; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const isImage = doc.mimeType?.startsWith('image/');
  const Icon = getFileIcon(doc.mimeType);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getDocumentBlobUrl(doc.id)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [doc.id, isImage]);

  if (!isImage) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <Icon size={40} className="text-gray-400" />
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img src={src} alt="" className={`object-cover ${className}`} />;
}

export function DocumentCard({
  doc,
  propertyName,
  onView,
  onDownload,
  onDelete,
}: {
  doc: any;
  propertyName?: string;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isImage = doc.mimeType?.startsWith('image/');

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      <button type="button" onClick={onView} className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 text-left">
        <DocumentPreviewImage doc={doc} className="w-full h-full group-hover:scale-[1.02] transition-transform" />
        {isImage && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
            <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow" size={28} />
          </span>
        )}
      </button>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <button type="button" onClick={onView} className="font-medium text-sm text-left truncate hover:text-brand-700" title={doc.originalFilename}>
          {doc.originalFilename}
        </button>
        <p className="text-xs text-gray-500">{categoryLabel(doc.category, doc.description)}</p>
        {propertyName && <p className="text-xs text-gray-400 truncate">{propertyName}</p>}
        <p className="text-xs text-gray-400 mt-auto">{formatBytes(doc.sizeBytes)} · {formatDateTime(doc.uploadedAt)}</p>
      </div>
      <div className="flex border-t divide-x">
        <button type="button" onClick={onView} className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
          <Eye size={14} /> View
        </button>
        <button type="button" onClick={onDownload} className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
          <Download size={14} /> Save
        </button>
        <button type="button" onClick={onDelete} className="flex-1 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center justify-center gap-1">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
