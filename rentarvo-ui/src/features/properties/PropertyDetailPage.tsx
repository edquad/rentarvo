import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { ChevronLeft, Plus, Pencil, Trash2, Home } from 'lucide-react';
import { UnitFormModal } from '../units/UnitFormModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AuditLogPanel } from '../../components/AuditLogPanel';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editUnit, setEditUnit] = useState<any>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get<any>(`/properties/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property deleted');
      navigate('/properties');
    },
    onError: (err: any) => {
      toast.error(err.message);
      setShowDeleteConfirm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6 text-center text-gray-500">Property not found.</div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/properties')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} /> Properties
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/properties/${id}/edit`)}
            className="p-2 text-gray-400 hover:text-brand-600"
            title="Edit property"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{property.name}</h1>
            <p className="text-gray-500 mt-1">{property.addressLine1}, {property.city}, {property.state} {property.zip}</p>
            {property.entity && <p className="text-sm text-brand-600 mt-1">{property.entity.name}</p>}
          </div>
          <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-full">
            {property.propertyType.replace('_', ' ')}
          </span>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Mortgage', value: property.monthlyMortgage, suffix: '/mo' },
            { label: 'Tax', value: property.monthlyTax, suffix: '/mo' },
            { label: 'Insurance', value: property.monthlyInsurance, suffix: '/mo' },
            { label: 'Current Value', value: property.currentValue, suffix: '' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="font-semibold tabular-nums">{item.value && parseFloat(String(item.value)) > 0 ? `${formatMoney(item.value)}${item.suffix}` : '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Units */}
      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Units ({property.units?.length || 0})</h2>
          <button
            onClick={() => { setEditUnit(null); setShowUnitForm(true); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-700 text-white rounded-lg text-sm hover:bg-brand-800"
          >
            <Plus size={14} /> Add Unit
          </button>
        </div>
        {!property.units?.length ? (
          <div className="p-8 text-center text-gray-400">
            <Home className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No units yet. Add your first unit.</p>
          </div>
        ) : (
          <div className="divide-y">
            {property.units.map((unit: any) => {
              const activeLease = unit.leases?.[0];
              return (
                <div key={unit.id} className="hover:bg-gray-50">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                  >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{unit.label}</p>
                    <p className="text-sm text-gray-500">
                      {(unit.unitType === 'ROOM' || unit.unitType === 'BED')
                        ? 'Single occupancy'
                        : (
                          <>
                            {unit.bedrooms != null && `${unit.bedrooms}BR`}
                            {unit.bathrooms != null && ` / ${unit.bathrooms}BA`}
                            {unit.squareFeet != null && ` · ${unit.squareFeet} sqft`}
                          </>
                        )}
                      {unit.marketRent && ` · ${formatMoney(unit.marketRent)}/mo`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditUnit(unit); setShowUnitForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                      title="Edit unit"
                    >
                      <Pencil size={14} />
                    </button>
                    {activeLease ? (
                      <Link to={`/leases/${activeLease.id}`} className="text-sm text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {activeLease.tenant?.fullName}
                      </Link>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Vacant</span>
                    )}
                  </div>
                  </div>
                  {expandedUnit === unit.id && (
                    <div className="px-4 pb-3 text-sm text-gray-500 border-t border-dashed mx-4 pt-2 space-y-1">
                      <div className="flex gap-4 flex-wrap">
                        <span>Type: <strong className="text-gray-700">{unit.unitType}</strong></span>
                        {unit.bedrooms != null && <span>Beds: <strong className="text-gray-700">{unit.bedrooms}</strong></span>}
                        {unit.bathrooms != null && <span>Baths: <strong className="text-gray-700">{unit.bathrooms}</strong></span>}
                        {unit.squareFeet != null && <span>Sqft: <strong className="text-gray-700">{unit.squareFeet}</strong></span>}
                        <span>Rentable: <strong className="text-gray-700">{unit.isRentable ? 'Yes' : 'No'}</strong></span>
                      </div>
                      {unit.notes && <p className="text-gray-600 italic">{unit.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {property.notes && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}

      {/* Activity log */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h2 className="font-semibold mb-3">Activity</h2>
        <AuditLogPanel entityType="Property" entityId={property.id} />
      </div>

      {showUnitForm && (
        <UnitFormModal
          propertyId={property.id}
          editData={editUnit}
          onClose={() => { setShowUnitForm(false); setEditUnit(null); }}
          onSuccess={() => {
            setShowUnitForm(false);
            setEditUnit(null);
            queryClient.invalidateQueries({ queryKey: ['property', id] });
          }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Property"
        message={`This will permanently delete ${property.name} and all its data. This action cannot be undone.`}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
