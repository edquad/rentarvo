import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { formatMoney, formatDate } from '../../lib/format';
import { Plus, FileText, Search } from 'lucide-react';

const statusFilters = ['ALL', 'ACTIVE', 'PENDING', 'ENDED'];

export function LeasesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);

  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['leases', selectedEntityId],
    queryFn: () => api.get<any[]>(selectedEntityId ? `/leases?entityId=${selectedEntityId}` : '/leases'),
  });

  const filtered = leases.filter((l: any) => {
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.tenant?.fullName?.toLowerCase().includes(s) ||
      l.unit?.property?.name?.toLowerCase().includes(s) ||
      l.unit?.label?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leases</h1>
        <Link
          to="/leases/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
        >
          <Plus size={16} />
          New Lease
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search leases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-brand-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{leases.length === 0 ? 'No leases yet. Create one after adding properties and tenants.' : 'No leases match your filters.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l: any) => (
            <Link
              key={l.id}
              to={`/leases/${l.id}`}
              className="block bg-white rounded-xl border p-4 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{l.tenant?.fullName}</p>
                  <p className="text-sm text-gray-500">
                    {l.unit?.property?.name} — {l.unit?.label}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    l.status === 'ACTIVE'
                      ? 'bg-green-50 text-green-700'
                      : l.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {l.status}
                </span>
              </div>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span>Rent: {formatMoney(l.monthlyRent)}</span>
                <span>{formatDate(l.startDate)} — {l.endDate ? formatDate(l.endDate) : 'Ongoing'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
