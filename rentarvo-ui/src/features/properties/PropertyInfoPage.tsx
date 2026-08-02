import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/Toaster';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Key,
  ShieldCheck,
  Zap,
  Wrench,
  StickyNote,
  Tag,
  Save,
  X,
} from 'lucide-react';

const SECTIONS = [
  { key: 'KEYS', label: 'Keys & Locks', icon: Key, color: 'text-amber-600 bg-amber-50' },
  { key: 'ACCESS', label: 'Access Codes', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50' },
  { key: 'UTILITIES', label: 'Utilities', icon: Zap, color: 'text-green-600 bg-green-50' },
  { key: 'VENDORS', label: 'Vendors & Contacts', icon: Wrench, color: 'text-purple-600 bg-purple-50' },
  { key: 'NOTES', label: 'Notes', icon: StickyNote, color: 'text-orange-600 bg-orange-50' },
  { key: 'CUSTOM', label: 'Custom Fields', icon: Tag, color: 'text-gray-600 bg-gray-50' },
] as const;

interface InfoItem {
  id: string;
  propertyId: string;
  section: string;
  label: string;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface InfoResponse {
  items: InfoItem[];
  grouped: Record<string, InfoItem[]>;
}

export function PropertyInfoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.key)),
  );
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formValue, setFormValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: property } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get<any>(`/properties/${id}`),
    enabled: !!id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['property-info', id],
    queryFn: () => api.get<InfoResponse>(`/properties/${id}/info`),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: (body: { section: string; label: string; value: string }) =>
      api.post(`/properties/${id}/info`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-info', id] });
      toast.success('Item added');
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: string; label: string; value: string }) =>
      api.put(`/properties/${id}/info/${itemId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-info', id] });
      toast.success('Item updated');
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/properties/${id}/info/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-info', id] });
      toast.success('Item deleted');
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  function resetForm() {
    setAddingSection(null);
    setEditingItem(null);
    setFormLabel('');
    setFormValue('');
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startEdit(item: InfoItem) {
    setEditingItem(item.id);
    setFormLabel(item.label);
    setFormValue(item.value);
    setAddingSection(null);
  }

  function startAdd(sectionKey: string) {
    setAddingSection(sectionKey);
    setFormLabel('');
    setFormValue('');
    setEditingItem(null);
    if (!expandedSections.has(sectionKey)) {
      setExpandedSections((prev) => new Set(prev).add(sectionKey));
    }
  }

  function handleSave(section: string) {
    if (!formLabel.trim() || !formValue.trim()) {
      toast.error('Both label and value are required');
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ itemId: editingItem, label: formLabel.trim(), value: formValue.trim() });
    } else {
      createMutation.mutate({ section, label: formLabel.trim(), value: formValue.trim() });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const grouped = data?.grouped || {};

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/properties/${id}`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={16} /> Back to Property
        </button>
      </div>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Property Info</h1>
        {property && (
          <p className="text-gray-500 mt-1">{property.name} &mdash; {property.addressLine1}</p>
        )}
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const items = grouped[section.key] || [];
        const isExpanded = expandedSections.has(section.key);
        const isAdding = addingSection === section.key;

        return (
          <div key={section.key} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* Section header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 select-none"
              onClick={() => toggleSection(section.key)}
            >
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-lg ${section.color}`}>
                  <Icon size={18} />
                </span>
                <h2 className="font-semibold">{section.label}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startAdd(section.key);
                  }}
                  className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50"
                  title={`Add ${section.label}`}
                >
                  <Plus size={16} />
                </button>
                {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t">
                {/* Existing items */}
                {items.length === 0 && !isAdding && (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    No items yet. Click + to add one.
                  </div>
                )}

                {items.map((item) => (
                  <div key={item.id} className="border-b last:border-b-0">
                    {editingItem === item.id ? (
                      /* Inline edit form */
                      <div className="p-4 bg-brand-50/30 space-y-3">
                        <input
                          type="text"
                          value={formLabel}
                          onChange={(e) => setFormLabel(e.target.value)}
                          placeholder="Label"
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                          autoFocus
                        />
                        <textarea
                          value={formValue}
                          onChange={(e) => setFormValue(e.target.value)}
                          placeholder="Value / Details"
                          rows={3}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={resetForm}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                          >
                            <X size={14} className="inline mr-1" /> Cancel
                          </button>
                          <button
                            onClick={() => handleSave(section.key)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-sm bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Save size={14} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="p-4 flex items-start justify-between gap-4 hover:bg-gray-50 group">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap break-words">
                            {item.value}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new item form */}
                {isAdding && (
                  <div className="p-4 bg-brand-50/30 border-t space-y-3">
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="Label (e.g. Front Door Lockbox)"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      autoFocus
                    />
                    <textarea
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder="Value / Details"
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={resetForm}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                      >
                        <X size={14} className="inline mr-1" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSave(section.key)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-sm bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-semibold text-lg">Delete Item</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this item? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
