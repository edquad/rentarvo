import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { ChevronLeft } from 'lucide-react';

const PHONE_RE = /^[\d\s().+-]+$/;

const tenantSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name must be 200 characters or fewer'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().max(30, 'Phone too long').regex(PHONE_RE, 'Invalid phone format').refine(v => v.replace(/[\s().+-]/g, '').length >= 7, 'Phone must have at least 7 digits').refine(v => v.replace(/[\s().+-]/g, '').length <= 15, 'Phone must have at most 15 digits').or(z.literal('')).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).regex(PHONE_RE, 'Invalid phone format').refine(v => v.replace(/[\s().+-]/g, '').length >= 7, 'At least 7 digits').refine(v => v.replace(/[\s().+-]/g, '').length <= 15, 'At most 15 digits').or(z.literal('')).optional(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});

type TenantFormData = z.infer<typeof tenantSchema>;

export function TenantFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: TenantFormData) => api.post('/tenants', cleanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created');
      navigate('/tenants');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-bold mb-6">Add Tenant</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input {...register('fullName')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Jane Doe" />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" {...register('email')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="jane@email.com" />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" {...register('phone')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="512-555-0101" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
          <input {...register('emergencyContactName')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
          <input type="tel" {...register('emergencyContactPhone')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea {...register('notes')} rows={3} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Add Tenant'}
        </button>
      </form>
    </div>
  );
}
