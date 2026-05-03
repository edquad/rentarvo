import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { CurrencyInput } from '../../components/CurrencyInput';
import { X } from 'lucide-react';

const unitSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  unitType: z.enum(['FLOOR', 'APARTMENT', 'ROOM', 'BED', 'OTHER']),
  isRentable: z.boolean(),
  bedrooms: z.coerce.number().int().nullable().optional(),
  bathrooms: z.coerce.number().nullable().optional(),
  squareFeet: z.coerce.number().int().nullable().optional(),
  marketRent: z.string().optional(),
  notes: z.string().optional(),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface Props {
  propertyId: string;
  editData?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnitFormModal({ propertyId, editData, onClose, onSuccess }: Props) {
  const { ref: focusTrapRef, handleKeyDown: focusTrapHandleKeyDown } = useFocusTrap<HTMLDivElement>(true);
  const isEdit = !!editData;
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: editData
      ? {
          label: editData.label || '',
          unitType: editData.unitType || 'APARTMENT',
          isRentable: editData.isRentable ?? true,
          bedrooms: editData.bedrooms ?? null,
          bathrooms: editData.bathrooms ?? null,
          squareFeet: editData.squareFeet ?? null,
          marketRent: editData.marketRent || '',
          notes: editData.notes || '',
        }
      : { unitType: 'APARTMENT', isRentable: true },
  });

  const mutation = useMutation({
    mutationFn: (data: UnitFormData) =>
      isEdit
        ? api.put(`/units/${editData.id}`, { ...cleanPayload(data), propertyId })
        : api.post('/units', { ...cleanPayload(data), propertyId }),
    onSuccess: () => {
      toast.success(isEdit ? 'Unit updated' : 'Unit created');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); focusTrapHandleKeyDown(e); }} role="dialog" aria-modal="true" aria-labelledby="unit-modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="unit-modal-title" className="text-lg font-semibold">{isEdit ? 'Edit Unit' : 'Add Unit'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Label *</label>
            <input {...register('label')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. 101, Unit A" />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
            <select {...register('unitType')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
              <option value="APARTMENT">Apartment</option>
              <option value="ROOM">Room</option>
              <option value="BED">Bed</option>
              <option value="FLOOR">Floor</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" {...register('isRentable')} id="isRentable" className="rounded border-gray-300" />
            <label htmlFor="isRentable" className="text-sm text-gray-700">Rentable unit</label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beds</label>
              <input type="number" {...register('bedrooms')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baths</label>
              <input type="number" step="0.5" {...register('bathrooms')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sqft</label>
              <input type="number" {...register('squareFeet')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Market Rent</label>
            <CurrencyInput
              value={watch('marketRent') || ''}
              onChange={(v) => setValue('marketRent', v, { shouldValidate: true })}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="0.00"
            />
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
            {mutation.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Add Unit')}
          </button>
        </form>
      </div>
    </div>
  );
}
