import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { cleanPayload } from '../../lib/cleanPayload';
import { formatMoney, formatDate } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { ChevronLeft, Trash2, Pencil, X } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AuditLogPanel } from '../../components/AuditLogPanel';

interface LeaseForm {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  tenantResponsibility: string;
  programPayment: string;
  programType: string;
  securityDeposit: string;
  petFee: string;
  garageFee: string;
  status: string;
  notes: string;
}

export function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const { register, handleSubmit, reset } = useForm<LeaseForm>();

  const { data: lease, isLoading } = useQuery({
    queryKey: ['lease', id],
    queryFn: () => api.get<any>(`/leases/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/leases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease deleted');
      navigate('/leases');
    },
    onError: (err: any) => {
      toast.error(err.message);
      setShowDeleteConfirm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LeaseForm>) => api.put(`/leases/${id}`, cleanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease', id] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease updated');
      setEditing(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEditing = () => {
    if (!lease) return;
    reset({
      startDate: lease.startDate?.slice(0, 10) || '',
      endDate: lease.endDate?.slice(0, 10) || '',
      monthlyRent: lease.monthlyRent || '',
      tenantResponsibility: lease.tenantResponsibility || '',
      programPayment: lease.programPayment || '0',
      programType: lease.programType || 'NONE',
      securityDeposit: lease.securityDeposit || '0',
      petFee: lease.petFee || '0',
      garageFee: lease.garageFee || '0',
      status: lease.status || 'ACTIVE',
      notes: lease.notes || '',
    });
    setEditing(true);
  };

  if (isLoading) {
    return <div className="p-6"><div className="h-40 bg-gray-200 rounded-2xl animate-pulse" /></div>;
  }

  if (!lease) {
    return <div className="p-6 text-center text-gray-500">Lease not found.</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/leases')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> Leases
        </button>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={startEditing} className="p-2 text-gray-400 hover:text-brand-600" title="Edit lease">
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
            <h2 className="text-lg font-semibold">Edit Lease</h2>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" {...register('startDate')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" {...register('endDate')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rent</label>
                <input {...register('monthlyRent')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Responsibility</label>
                <input {...register('tenantResponsibility')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program Type</label>
                <select {...register('programType')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                  <option value="NONE">None</option>
                  <option value="WHA">WHA</option>
                  <option value="JDA">JDA</option>
                  <option value="CHD">CHD</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program Payment</label>
                <input {...register('programPayment')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
                <input {...register('securityDeposit')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pet Fee</label>
                <input {...register('petFee')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Garage Fee</label>
                <input {...register('garageFee')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register('status')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="ENDED">Ended</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={2} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{lease.tenant?.fullName}</h1>
            <p className="text-gray-500 mt-1">
              {lease.unit?.property?.name} — {lease.unit?.label}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            lease.status === 'ACTIVE' ? 'bg-green-50 text-green-700'
              : lease.status === 'PENDING' ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {lease.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-xs text-gray-400">Monthly Rent</p>
            <p className="font-semibold tabular-nums">{formatMoney(lease.monthlyRent)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tenant Pays</p>
            <p className="font-semibold tabular-nums">{formatMoney(lease.tenantResponsibility)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Start Date</p>
            <p className="font-semibold">{formatDate(lease.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">End Date</p>
            <p className="font-semibold">{lease.endDate ? formatDate(lease.endDate) : 'Ongoing'}</p>
          </div>
        </div>

        {(lease.securityDeposit !== '0' || lease.petFee !== '0' || lease.garageFee !== '0') && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-gray-400">Security Deposit</p>
              <p className="font-semibold tabular-nums">{formatMoney(lease.securityDeposit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Pet Fee</p>
              <p className="font-semibold tabular-nums">{formatMoney(lease.petFee)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Garage Fee</p>
              <p className="font-semibold tabular-nums">{formatMoney(lease.garageFee)}</p>
            </div>
          </div>
        )}

        {lease.programType !== 'NONE' && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-400">Program</p>
            <p className="font-semibold">{lease.programType} — {formatMoney(lease.programPayment)}/mo</p>
          </div>
        )}
      </div>
      )}

      {lease.notes && !editing && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{lease.notes}</p>
        </div>
      )}

      {/* Activity log */}
      {!editing && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <h2 className="font-semibold mb-3">Activity</h2>
          <AuditLogPanel entityType="Lease" entityId={lease.id} />
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Lease"
        message={`This will permanently delete the lease for ${lease.tenant?.fullName ?? 'this tenant'}. This action cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
