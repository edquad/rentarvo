import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { Plus, Search, Contact, X, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const PHONE_RE = /^[\d\s().+-]+$/;

const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name must be 200 characters or fewer'),
  organization: z.string().max(200).optional(),
  contactType: z.enum([
    'CASE_WORKER', 'CONTRACTOR', 'VENDOR', 'UTILITY', 'INSURANCE_AGENT',
    'ATTORNEY', 'ACCOUNTANT', 'MUNICIPAL', 'PROPERTY_MANAGER', 'OWNER_PARTNER',
    'EMERGENCY', 'OTHER',
  ]),
  phone: z.string().max(30, 'Phone too long').regex(PHONE_RE, 'Invalid phone format').refine(v => v.replace(/[\s().+-]/g, '').length >= 7, 'Phone must have at least 7 digits').refine(v => v.replace(/[\s().+-]/g, '').length <= 15, 'Phone must have at most 15 digits').or(z.literal('')).optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

const contactTypes = [
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'INSURANCE_AGENT', label: 'Insurance Agent' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'ATTORNEY', label: 'Attorney' },
  { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
  { value: 'CASE_WORKER', label: 'Case Worker' },
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'OWNER_PARTNER', label: 'Owner/Partner' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'OTHER', label: 'Other' },
];

export function ContactsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const { ref: focusTrapRef, handleKeyDown: focusTrapHandleKeyDown } = useFocusTrap<HTMLDivElement>(showForm);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => api.get<any[]>(`/contacts?search=${encodeURIComponent(search)}`),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contactType: 'VENDOR' },
  });

  const mutation = useMutation({
    mutationFn: (data: ContactFormData) => {
      const cleaned = cleanPayload(data);
      if (editingContact) {
        return api.put(`/contacts/${editingContact.id}`, cleaned);
      }
      return api.post('/contacts', cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(editingContact ? 'Contact updated' : 'Contact created');
      setShowForm(false);
      setEditingContact(null);
      reset({ contactType: 'VENDOR' });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setDeleteTarget(null);
    },
  });

  const openEdit = (contact: any) => {
    setEditingContact(contact);
    reset({
      fullName: contact.fullName || '',
      organization: contact.organization || '',
      contactType: contact.contactType || 'VENDOR',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
    });
    setShowForm(true);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button
          onClick={() => { setEditingContact(null); reset({ contactType: 'VENDOR' }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
        >
          <Plus size={16} /> Add Contact
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <Contact className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No contacts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{c.fullName}</p>
                  {c.organization && <p className="text-sm text-gray-500">{c.organization}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {c.email && <span className="flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {c.contactType.replace('_', ' ')}
                  </span>
                  <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {showForm && (
        <div ref={focusTrapRef} className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => { if (e.key === 'Escape') { setShowForm(false); setEditingContact(null); } focusTrapHandleKeyDown(e); }} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="contact-modal-title" className="text-lg font-semibold">{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button onClick={() => { setShowForm(false); setEditingContact(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input {...register('fullName')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input {...register('organization')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select {...register('contactType')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                  {contactTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" {...register('email')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" {...register('phone')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register('notes')} rows={2} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full py-2.5 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving...' : editingContact ? 'Save Changes' : 'Add Contact'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Contact"
        message={`This will permanently delete ${deleteTarget?.fullName ?? 'this contact'}. This action cannot be undone.`}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
