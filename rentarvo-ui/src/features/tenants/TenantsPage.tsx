import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { Plus, Search, Users } from 'lucide-react';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants', search, selectedEntityId],
    queryFn: () => api.get<any[]>(`/tenants?search=${encodeURIComponent(search)}${entityParam}`),
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <Link
          to="/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
        >
          <Plus size={16} />
          Add Tenant
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tenants yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t: any) => {
            const activeLease = t.leases?.[0];
            const initials = t.fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <Link
                key={t.id}
                to={`/tenants/${t.id}`}
                className="flex items-center gap-3 bg-white rounded-xl border p-4 hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{t.fullName}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {activeLease
                      ? `${activeLease.unit?.property?.name} — ${activeLease.unit?.label}`
                      : 'Unassigned'}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
