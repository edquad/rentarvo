import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { cleanPayload } from '../../lib/cleanPayload';
import { formatMoney, formatDate } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { ChevronLeft, Trash2, Mail, Phone, Pencil, X } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AuditLogPanel } from '../../components/AuditLogPanel';

interface TenantForm {
  fullName: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const { data: tenant, isLoading, isError, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get<any>(`/tenants/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant deleted');
      navigate('/tenants');
    },
    onError: (err: any) => {
      toast.error(err.message);
      setShowDeleteConfirm(false);
    },
  });

  const { register, handleSubmit, reset } = useForm<TenantForm>();

  const updateMutation = useMutation({
    mutationFn: (data: TenantForm) => api.put(`/tenants/${id}`, cleanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated');
      setEditing(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEditing = () => {
    if (tenant) {
      reset({
        fullName: tenant.fullName || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        emergencyContactName: tenant.emergencyContactName || '',
        emergencyContactPhone: tenant.emergencyContactPhone || '',
        notes: tenant.notes || '',
      });
      setEditing(true);
    }
  };

  if (isLoading) {
    return <div className="p-6"><div className="h-40 bg-gray-200 rounded-2xl animate-pulse" /></div>;
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-red-500 mb-2">{(error as any)?.message || 'Failed to load tenant'}</p>
        <button onClick={() => navigate('/tenants')} className="text-sm text-brand-600 hover:underline">Back to Tenants</button>
      </div>
    );
  }

  if (!tenant) {
    return <div className="p-6 text-center text-gray-500">Tenant not found.</div>;
  }

  const initials = tenant.fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/tenants')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> Tenants
        </button>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              onClick={startEditing}
              className="p-2 text-gray-400 hover:text-brand-600"
              title="Edit tenant"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Edit Tenant</h2>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input {...register('fullName')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" {...register('email')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" {...register('phone')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                <input {...register('emergencyContactName')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                <input type="tel" {...register('emergencyContactPhone')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={3} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 py-2.5 border rounded-xl font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="flex-1 py-2.5 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tenant.fullName}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              {tenant.email && <span className="flex items-center gap-1"><Mail size={14} /> {tenant.email}</span>}
              {tenant.phone && <span className="flex items-center gap-1"><Phone size={14} /> {tenant.phone}</span>}
            </div>
            {(tenant.emergencyContactName || tenant.emergencyContactPhone) && (
              <p className="text-xs text-gray-400 mt-2">
                Emergency: {tenant.emergencyContactName}{tenant.emergencyContactPhone ? ` · ${tenant.emergencyContactPhone}` : ''}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <span className={`text-xs px-2 py-1 rounded-full ${tenant.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Lease history */}
      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Leases</h2>
        </div>
        {!tenant.leases?.length ? (
          <div className="p-8 text-center text-gray-400">No leases found.</div>
        ) : (
          <div className="divide-y">
            {tenant.leases.map((l: any) => (
              <Link key={l.id} to={`/leases/${l.id}`} className="block p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{l.unit?.property?.name} — {l.unit?.label}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(l.startDate)} — {l.endDate ? formatDate(l.endDate) : 'Ongoing'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatMoney(l.monthlyRent)}/mo</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {l.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {tenant.notes && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{tenant.notes}</p>
        </div>
      )}

      {/* Activity log */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h2 className="font-semibold mb-3">Activity</h2>
        <AuditLogPanel entityType="Tenant" entityId={tenant.id} />
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Tenant"
        message={`This will permanently delete ${tenant.fullName}. This action cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
