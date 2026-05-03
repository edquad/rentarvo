import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { toast } from '../../components/Toaster';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEntityStore } from '../../lib/entityStore';
import { Upload, FileText, Trash2, Download, Search, FolderOpen, Image, FileSpreadsheet } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'LEASE', label: 'Lease' },
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet;
  return FileText;
}

function formatDateTime(value: string | Date): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const { ref: focusTrapRef, handleKeyDown: focusTrapHandleKeyDown } = useFocusTrap<HTMLDivElement>(showUpload);
  const [uploadCategory, setUploadCategory] = useState('OTHER');
  const [uploadPropertyId, setUploadPropertyId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', selectedEntityId],
    queryFn: () => api.get<any[]>(selectedEntityId ? `/properties?entityId=${selectedEntityId}` : '/properties'),
  });

  const queryParams = new URLSearchParams();
  if (filterCategory) queryParams.set('category', filterCategory);
  queryParams.set('limit', '100');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', filterCategory],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/documents?${queryParams}`),
  });

  const documents = data?.data || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      if (uploadPropertyId) formData.append('propertyId', uploadPropertyId);
      return api.post('/documents', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded');
      setShowUpload(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = (doc: any) => {
    const token = localStorage.getItem('rentarvo_token');
    const url = `/api/v1/documents/${doc.id}/download`;
    const a = document.createElement('a');
    // Use fetch to download with auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = doc.originalFilename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => toast.error('Download failed'));
  };

  const filtered = documents.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.originalFilename?.toLowerCase().includes(s) || d.category?.toLowerCase().includes(s);
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
        >
          <Upload size={16} /> Upload
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">File</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Size</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Uploaded</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc: any) => {
                  const Icon = getFileIcon(doc.mimeType);
                  return (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className="text-gray-400 shrink-0" />
                          <span className="font-medium truncate max-w-xs">{doc.originalFilename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {CATEGORY_OPTIONS.find(c => c.value === doc.category)?.label || doc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(doc.sizeBytes)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(doc.uploadedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((doc: any) => {
              const Icon = getFileIcon(doc.mimeType);
              return (
                <div key={doc.id} className="p-4 flex items-center gap-3">
                  <Icon size={20} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.originalFilename}</p>
                    <p className="text-xs text-gray-400">{formatBytes(doc.sizeBytes)} · {formatDateTime(doc.uploadedAt)}</p>
                  </div>
                  <button onClick={() => handleDownload(doc)} className="p-2 text-gray-400">
                    <Download size={16} />
                  </button>
                  <button onClick={() => setDeleteId(doc.id)} className="p-2 text-gray-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div ref={focusTrapRef} className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => { if (e.key === 'Escape') setShowUpload(false); focusTrapHandleKeyDown(e); }} role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowUpload(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm mx-4 z-10 space-y-4">
            <h2 id="upload-modal-title" className="text-lg font-semibold">Upload Document</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property (optional)</label>
              <select
                value={uploadPropertyId}
                onChange={(e) => setUploadPropertyId(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              >
                <option value="">None</option>
                {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50"
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Choose File'}
              </button>
              <p className="text-xs text-gray-400 mt-1">PDF, images, Excel, CSV — max 25 MB</p>
            </div>
            <button onClick={() => setShowUpload(false)} className="w-full py-2.5 text-gray-500 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          open={!!deleteId}
          title="Delete Document"
          message="This will permanently delete this document."
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
