import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { useEntityStore } from '../../lib/entityStore';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { CurrencyInput } from '../../components/CurrencyInput';
import { X } from 'lucide-react';

const incomeSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  leaseId: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required').regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid positive amount (e.g. 1200.50)'),
  paymentDate: z.string().min(1, 'Date is required'),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type IncomeFormData = z.infer<typeof incomeSchema>;

interface Props {
  onClose: () => void;
  editData?: any;
}

export function RecordIncomeModal({ onClose, editData }: Props) {
  const { ref: focusTrapRef, handleKeyDown: focusTrapHandleKeyDown } = useFocusTrap<HTMLDivElement>(true);
  const queryClient = useQueryClient();
  const isEdit = !!editData;
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  // In edit mode, don't filter by entity so existing property/tenant always appear in dropdowns
  const entityParam = (!isEdit && selectedEntityId) ? `&entityId=${selectedEntityId}` : '';

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', isEdit ? 'all' : selectedEntityId],
    queryFn: () => api.get<any[]>(`/properties?include=units${entityParam}`),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'income'],
    queryFn: () => api.get<any[]>('/categories?kind=INCOME'),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', isEdit ? 'all' : selectedEntityId],
    queryFn: () => api.get<any[]>(`/tenants?activeOnly=true${entityParam}`),
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      paymentDate: editData?.paymentDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      propertyId: editData?.propertyId || localStorage.getItem('lastPropertyId') || '',
      unitId: editData?.unitId || '',
      tenantId: editData?.tenantId || '',
      categoryId: editData?.categoryId || '',
      amount: editData?.amount || '',
      paymentMethod: editData?.paymentMethod || '',
      referenceNumber: editData?.referenceNumber || '',
      notes: editData?.notes || '',
    },
  });

  // Re-sync form once dropdown data arrives so the <select> shows the correct option
  useEffect(() => {
    if (isEdit && properties.length > 0) {
      reset({
        paymentDate: editData?.paymentDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        propertyId: editData?.propertyId || '',
        unitId: editData?.unitId || '',
        tenantId: editData?.tenantId || '',
        categoryId: editData?.categoryId || '',
        amount: editData?.amount || '',
        paymentMethod: editData?.paymentMethod || '',
        referenceNumber: editData?.referenceNumber || '',
        notes: editData?.notes || '',
      });
    }
  }, [isEdit, properties.length, tenants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select when only one property exists
  useEffect(() => {
    if (!isEdit && properties.length === 1) {
      const currentPid = watch('propertyId');
      if (!currentPid || !properties.find((p: any) => p.id === currentPid)) {
        setValue('propertyId', properties[0].id);
      }
    }
  }, [properties.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPropertyId = watch('propertyId');
  const units = properties.find((p: any) => p.id === selectedPropertyId)?.units || [];

  const mutation = useMutation({
    mutationFn: (data: IncomeFormData) => {
      if (data.propertyId) localStorage.setItem('lastPropertyId', data.propertyId);
      return isEdit
        ? api.put(`/income/${editData.id}`, cleanPayload(data))
        : api.post('/income', cleanPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(isEdit ? 'Income updated' : 'Income recorded');
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); focusTrapHandleKeyDown(e); }} role="dialog" aria-modal="true" aria-labelledby="income-modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="income-modal-title" className="text-lg font-semibold">{isEdit ? 'Edit Income' : 'Record Income'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
            <select {...register('propertyId')} value={watch('propertyId') || ''} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="">Select property...</option>
              {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.propertyId && <p className="text-xs text-red-500 mt-1">{errors.propertyId.message}</p>}
          </div>

          {units.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select {...register('unitId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                <option value="">All / Property-level</option>
                {units.map((u: any) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
            <select {...register('tenantId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="">Select tenant...</option>
              {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select {...register('categoryId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="">Select category...</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <CurrencyInput
                value={watch('amount') || ''}
                onChange={(v) => setValue('amount', v, { shouldValidate: true })}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="1200.00"
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" {...register('paymentDate')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              {errors.paymentDate && <p className="text-xs text-red-500 mt-1">{errors.paymentDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select {...register('paymentMethod')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="">—</option>
              {['CASH', 'CHECK', 'ACH', 'ZELLE', 'VENMO', 'CASHAPP', 'CARD', 'OTHER'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
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
            {mutation.isPending ? (isEdit ? 'Saving...' : 'Recording...') : (isEdit ? 'Save Changes' : 'Record Income')}
          </button>
        </form>
      </div>
    </div>
  );
}
