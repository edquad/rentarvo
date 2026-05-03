import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { cleanPayload } from '../../lib/cleanPayload';
import { toast } from '../../components/Toaster';
import { ChevronLeft } from 'lucide-react';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const optMoney = z.string().regex(MONEY_RE, 'Invalid amount').refine(v => parseFloat(v) >= 0, 'Must be non-negative').refine(v => parseFloat(v) < 100_000_000, 'Amount too large').or(z.literal('')).optional();

const propertySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  entityId: z.string().min(1, 'Entity is required'),
  addressLine1: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(1, 'ZIP is required'),
  propertyType: z.enum(['MULTI_FAMILY', 'SINGLE_FAMILY', 'ROOM_RENTAL', 'BED_RENTAL', 'COMMERCIAL', 'OTHER']),
  purchasePrice: optMoney,
  currentValue: optMoney,
  mortgageBalance: optMoney,
  monthlyMortgage: optMoney,
  monthlyTax: optMoney,
  monthlyInsurance: optMoney,
  monthlyHoa: optMoney,
  notes: z.string().max(2000, 'Notes must be 2000 characters or fewer').optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

const propertyTypes = [
  { value: 'SINGLE_FAMILY', label: 'Single Family' },
  { value: 'MULTI_FAMILY', label: 'Multi-Family' },
  { value: 'ROOM_RENTAL', label: 'Room Rental' },
  { value: 'BED_RENTAL', label: 'Bed Rental' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'OTHER', label: 'Other' },
];

export function PropertyFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => api.get<any[]>('/entities'),
  });

  const { data: existingProperty } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get<any>(`/properties/${id}`),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      propertyType: 'SINGLE_FAMILY',
      monthlyMortgage: '0',
      monthlyTax: '0',
      monthlyInsurance: '0',
    },
  });

  React.useEffect(() => {
    if (existingProperty) {
      reset({
        name: existingProperty.name || '',
        entityId: existingProperty.entityId || '',
        addressLine1: existingProperty.addressLine1 || '',
        city: existingProperty.city || '',
        state: existingProperty.state || '',
        zip: existingProperty.zip || '',
        propertyType: existingProperty.propertyType || 'SINGLE_FAMILY',
        purchasePrice: existingProperty.purchasePrice || '',
        currentValue: existingProperty.currentValue || '',
        mortgageBalance: existingProperty.mortgageBalance || '',
        monthlyMortgage: existingProperty.monthlyMortgage || '0',
        monthlyTax: existingProperty.monthlyTax || '0',
        monthlyInsurance: existingProperty.monthlyInsurance || '0',
        monthlyHoa: existingProperty.monthlyHoa || '',
        notes: existingProperty.notes || '',
      });
    }
  }, [existingProperty, reset]);

  const mutation = useMutation({
    mutationFn: (data: PropertyFormData) =>
      isEdit
        ? api.put(`/properties/${id}`, cleanPayload(data))
        : api.post('/properties', cleanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success(isEdit ? 'Property updated' : 'Property created');
      navigate(isEdit ? `/properties/${id}` : '/properties');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Property' : 'Add Property'}</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
          <input {...register('name')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Sunset Ridge Apartments" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity (LLC) *</label>
          <select {...register('entityId')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
            <option value="">Select entity...</option>
            {entities.map((e: any) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          {errors.entityId && <p className="text-xs text-red-500 mt-1">{errors.entityId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
          <select {...register('propertyType')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
            {propertyTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <input {...register('addressLine1')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="123 Main St" />
          {errors.addressLine1 && <p className="text-xs text-red-500 mt-1">{errors.addressLine1.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input {...register('city')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
            <input {...register('state')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" maxLength={2} placeholder="TX" />
            {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
            <input {...register('zip')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="78701" />
            {errors.zip && <p className="text-xs text-red-500 mt-1">{errors.zip.message}</p>}
          </div>
        </div>

        <hr className="my-2" />
        <h3 className="font-semibold text-gray-700">Financials (optional)</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
            <input {...register('purchasePrice')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
            <input {...register('currentValue')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mortgage Balance</label>
            <input {...register('mortgageBalance')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Mortgage</label>
            <input {...register('monthlyMortgage')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Tax</label>
            <input {...register('monthlyTax')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Insurance</label>
            <input {...register('monthlyInsurance')} className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
          </div>
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
            {mutation.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Property')}
        </button>
      </form>
    </div>
  );
}
