import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { ChevronLeft } from 'lucide-react';

const leaseSchema = z.object({
  unitId: z.string().min(1, 'Unit is required'),
  tenantId: z.string().min(1, 'Tenant is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  monthlyRent: z.string().min(1, 'Rent is required').regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount'),
  tenantResponsibility: z.string().min(1, 'Tenant responsibility is required').regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount'),
  programPayment: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount').optional().or(z.literal('')),
  programType: z.enum(['WHA', 'JDA', 'CHD', 'NONE', 'OTHER']),
  securityDeposit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount').optional().or(z.literal('')),
  petFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount').optional().or(z.literal('')),
  garageFee: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid non-negative amount').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'PENDING', 'ENDED']),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    if (!data.endDate) return true;
    return new Date(data.endDate) > new Date(data.startDate);
  },
  { message: 'End date must be after start date', path: ['endDate'] },
);

type LeaseFormData = z.infer<typeof leaseSchema>;

export function LeaseFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', selectedEntityId],
    queryFn: () => api.get<any[]>(`/properties?include=units${entityParam}`),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedEntityId],
    queryFn: () => api.get<any[]>(`/tenants?activeOnly=true${entityParam}`),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LeaseFormData>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      programType: 'NONE',
      status: 'ACTIVE',
      programPayment: '0',
      securityDeposit: '0',
      petFee: '0',
      garageFee: '0',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: LeaseFormData) => api.post('/leases', cleanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease created');
      navigate('/leases');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Build flat unit list from properties
  const allUnits = properties.flatMap((p: any) =>
    (p.units || [])
      .filter((u: any) => u.isRentable)
      .map((u: any) => ({ ...u, propertyName: p.name }))
  );

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-bold mb-6">New Lease</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
          <select {...register('tenantId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
            <option value="">Select tenant...</option>
            {tenants.map((t: any) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </select>
          {errors.tenantId && <p className="text-xs text-red-500 mt-1">{errors.tenantId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
          <select {...register('unitId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
            <option value="">Select unit...</option>
            {allUnits.map((u: any) => (
              <option key={u.id} value={u.id}>{u.propertyName} — {u.label}</option>
            ))}
          </select>
          {errors.unitId && <p className="text-xs text-red-500 mt-1">{errors.unitId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input type="date" {...register('startDate')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" {...register('endDate')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Rent *</label>
            <input {...register('monthlyRent')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="1200.00" />
            {errors.monthlyRent && <p className="text-xs text-red-500 mt-1">{errors.monthlyRent.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Responsibility *</label>
            <input {...register('tenantResponsibility')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="1200.00" />
            {errors.tenantResponsibility && <p className="text-xs text-red-500 mt-1">{errors.tenantResponsibility.message}</p>}
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
            <input {...register('programPayment')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
            <input {...register('securityDeposit')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Fee</label>
            <input {...register('petFee')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Garage Fee</label>
            <input {...register('garageFee')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
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

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Create Lease'}
        </button>
      </form>
    </div>
  );
}
