import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/Toaster';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEntityStore } from '../../lib/entityStore';
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  formatBytes,
  formatDateTime,
  fetchDocumentBlob,
  guessCategoryFromFilename,
  DocumentPreviewModal,
  DocumentCard,
  DocumentPreviewImage,
} from './documentHelpers';
import { Upload, Search, FolderOpen, LayoutGrid, List, Eye, Download, Trash2 } from 'lucide-react';

type ViewMode = 'gallery' | 'list';

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [dragOver, setDragOver] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('RECEIPT');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadPropertyId, setUploadPropertyId] = useState('');
  const [uploadLeaseId, setUploadLeaseId] = useState('');
  const [uploadTenantId, setUploadTenantId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', selectedEntityId],
    queryFn: () => api.get<any[]>(selectedEntityId ? `/properties?entityId=${selectedEntityId}` : '/properties'),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ['leases', selectedEntityId],
    queryFn: () => api.get<any[]>('/leases'),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedEntityId],
    queryFn: () => api.get<any[]>('/tenants'),
  });

  const queryParams = new URLSearchParams();
  if (filterCategory) queryParams.set('category', filterCategory);
  queryParams.set('limit', '100');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', selectedEntityId, filterCategory],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/documents?${queryParams}`),
  });

  const documents = data?.data || [];
  const propertyMap = Object.fromEntries(properties.map((p: any) => [p.id, p.name]));

  const resolveCategory = (file: File) =>
    uploadCategory !== 'OTHER' ? uploadCategory : guessCategoryFromFilename(file.name);

  const uploadOne = async (file: File) => {
    const cat = resolveCategory(file);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', cat);
    if (cat === 'OTHER') {
      formData.append('description', uploadDescription.trim());
    }
    if (uploadPropertyId) formData.append('propertyId', uploadPropertyId);
    if (uploadLeaseId) formData.append('leaseId', uploadLeaseId);
    if (uploadTenantId) formData.append('tenantId', uploadTenantId);
    await api.post('/documents', formData);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const needsOtherLabel = files.some((f) => resolveCategory(f) === 'OTHER');
    if (needsOtherLabel && !uploadDescription.trim()) {
      toast.error('Enter what this document is (required for Other category)');
      return;
    }
    setUploadingCount(files.length);
    let ok = 0;
    for (const file of files) {
      try {
        await uploadOne(file);
        ok++;
      } catch (err: any) {
        toast.error(`${file.name}: ${err.message || 'Upload failed'}`);
      }
    }
    setUploadingCount(0);
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    if (ok) toast.success(ok === 1 ? 'Document uploaded' : `${ok} documents uploaded`);
  };

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.size > 0);
    if (!files.length) return;
    const max = 25 * 1024 * 1024;
    const tooBig = files.find((f) => f.size > max);
    if (tooBig) {
      toast.error(`${tooBig.name} is over 25 MB`);
      return;
    }
    uploadFiles(files);
  }, [uploadCategory, uploadDescription, uploadPropertyId, uploadLeaseId, uploadTenantId]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleDownload = (doc: any) => {
    fetchDocumentBlob(doc.id)
      .then((blob) => {
        const a = document.createElement('a');
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
    return (
      d.originalFilename?.toLowerCase().includes(s) ||
      d.category?.toLowerCase().includes(s) ||
      d.description?.toLowerCase().includes(s) ||
      d.property?.name?.toLowerCase().includes(s)
    );
  });

  const isUploading = uploadingCount > 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">Leases, bills, photos, receipts — drag files here or browse.</p>
      </div>

      {/* Upload panel */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {uploadCategory === 'OTHER' && (
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                What is this document? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="e.g. HOA letter, parking permit, vendor contract"
                maxLength={500}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Shown as &quot;Other — your text&quot; in the document list.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Property</label>
            <select
              value={uploadPropertyId}
              onChange={(e) => { setUploadPropertyId(e.target.value); setUploadLeaseId(''); }}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">Any property</option>
              {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lease</label>
            <select
              value={uploadLeaseId}
              onChange={(e) => setUploadLeaseId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">Optional</option>
              {leases
                .filter((l: any) => !uploadPropertyId || l.unit?.propertyId === uploadPropertyId || l.unit?.property?.id === uploadPropertyId)
                .map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.tenant?.fullName || 'Tenant'} — {l.unit?.label || l.unit?.property?.name || 'Unit'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tenant</label>
            <select
              value={uploadTenantId}
              onChange={(e) => setUploadTenantId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">Optional</option>
              {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative rounded-xl border-2 border-dashed py-10 px-4 text-center transition-colors ${
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50/80 hover:border-brand-400'
          } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Upload className={`mx-auto mb-2 ${dragOver ? 'text-brand-600' : 'text-gray-400'}`} size={32} />
          <p className="text-sm font-medium text-gray-700">
            {isUploading ? `Uploading ${uploadingCount} file(s)…` : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">or</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
          >
            Browse files
          </button>
          <p className="text-xs text-gray-400 mt-3">PDF, images, Excel, CSV · up to 25 MB each · multiple files OK</p>
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or property…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border rounded-xl bg-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="flex rounded-lg border bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={`px-3 py-2 ${viewMode === 'gallery' ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:bg-gray-50'}`}
            title="Gallery view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:bg-gray-50'}`}
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
        <span className="text-sm text-gray-500">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[4/3] bg-gray-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border">
          <FolderOpen className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No documents yet</p>
          <p className="text-sm text-gray-400 mt-1">Drag files into the upload area above</p>
        </div>
      ) : viewMode === 'gallery' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc: any) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              propertyName={doc.property?.name || propertyMap[doc.propertyId]}
              onView={() => setPreviewDoc(doc)}
              onDownload={() => handleDownload(doc)}
              onDelete={() => setDeleteId(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="divide-y">
            {filtered.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <button type="button" onClick={() => setPreviewDoc(doc)} className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border">
                  <DocumentPreviewImage doc={doc} className="w-full h-full" />
                </button>
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={() => setPreviewDoc(doc)} className="font-medium truncate block text-left hover:text-brand-700">
                    {doc.originalFilename}
                  </button>
                  <p className="text-sm text-gray-500">{categoryLabel(doc.category, doc.description)}</p>
                  {(doc.property?.name || propertyMap[doc.propertyId]) && (
                    <p className="text-xs text-gray-400 truncate">{doc.property?.name || propertyMap[doc.propertyId]}</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 hidden sm:block shrink-0">{formatBytes(doc.sizeBytes)}</p>
                <p className="text-xs text-gray-400 hidden md:block shrink-0">{formatDateTime(doc.uploadedAt)}</p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPreviewDoc(doc)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg" title="View"><Eye size={18} /></button>
                  <button onClick={() => handleDownload(doc)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg" title="Download"><Download size={18} /></button>
                  <button onClick={() => setDeleteId(doc.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg" title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

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
