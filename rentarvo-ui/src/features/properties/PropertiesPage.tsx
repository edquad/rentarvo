import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { formatMoney } from '../../lib/format';
import { Plus, Search, Building2 } from 'lucide-react';

export function PropertiesPage() {
  const [search, setSearch] = useState('');
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties', search, selectedEntityId],
    queryFn: () => api.get<any[]>(`/properties?search=${encodeURIComponent(search)}&include=units${entityParam}`),
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold min-w-0">Properties</h1>
        <Link
          to="/properties/new"
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800 shrink-0 whitespace-nowrap"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Property</span>
          <span className="sm:hidden">Add</span>
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No properties yet. Add your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {properties.map((prop: any) => (
            <Link
              key={prop.id}
              to={`/properties/${prop.id}`}
              className="bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{prop.name}</h3>
                  <p className="text-sm text-gray-500">{prop.addressLine1}, {prop.city}, {prop.state}</p>
                  <p className="text-xs text-gray-400 mt-1">{prop.entity?.name}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-full">
                  {prop.propertyType.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-gray-500">{prop.units?.length || 0} {(prop.units?.length || 0) === 1 ? 'unit' : 'units'}</span>
                {prop.monthlyMortgage && parseFloat(String(prop.monthlyMortgage)) > 0 && (
                  <span className="text-gray-500">Mortgage: {formatMoney(prop.monthlyMortgage)}/mo</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
