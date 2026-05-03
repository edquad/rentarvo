import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { formatMoney, formatDate } from '../../lib/format';
import { toast } from '../../components/Toaster';
import { Plus, DollarSign, Search, CheckSquare, Trash2, Pencil, Filter } from 'lucide-react';
import { RecordIncomeModal } from './RecordIncomeModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function IncomeLedgerPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';

  const { data, isLoading } = useQuery({
    queryKey: ['income', selectedEntityId],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/income?limit=100${entityParam}`),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'income'],
    queryFn: () => api.get<any[]>('/categories?kind=INCOME'),
  });

  const transactions = data?.data || [];

  const filtered = useMemo(() => {
    let result = transactions;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((t: any) =>
        t.tenant?.fullName?.toLowerCase().includes(s) ||
        t.property?.name?.toLowerCase().includes(s) ||
        t.category?.name?.toLowerCase().includes(s)
      );
    }
    if (filterCategory) {
      result = result.filter((t: any) => t.categoryId === filterCategory);
    }
    if (dateFrom) {
      result = result.filter((t: any) => t.paymentDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((t: any) => t.paymentDate <= dateTo);
    }
    return result;
  }, [transactions, search, filterCategory, dateFrom, dateTo]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t: any) => t.id)));
    }
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/income/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${selected.size} transaction(s) deleted`);
      setSelected(new Set());
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/income/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transaction deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const selectedTotal = useMemo(() => {
    return filtered
      .filter((t: any) => selected.has(t.id))
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
  }, [filtered, selected]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Income</h1>
        <button
          onClick={() => { setEditData(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800 shrink-0"
        >
          <Plus size={16} /> Record Income
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl text-sm">
          <CheckSquare size={16} className="text-brand-600" />
          <span className="font-medium text-brand-700">{selected.size} selected</span>
          <span className="text-brand-500">({formatMoney(selectedTotal)})</span>
          <div className="flex-1" />
          <button
            onClick={() => bulkDeleteMutation.mutate()}
            disabled={bulkDeleteMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search income..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2.5 border rounded-xl flex items-center gap-1.5 text-sm ${
            showFilters || filterCategory || dateFrom || dateTo
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Filter size={14} />
          <span className="hidden sm:inline">Filter</span>
          {(filterCategory || dateFrom || dateTo) && (
            <span className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl border">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">All</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          {(filterCategory || dateFrom || dateTo) && (
            <div className="flex items-end">
              <button
                onClick={() => { setFilterCategory(''); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline pb-1.5"
              >
                Clear filters
              </button>
            </div>
          )}
          {dateFrom && dateTo && dateTo < dateFrom && (
            <p className="text-xs text-amber-600 self-end pb-1.5">'To' date is before 'From' date</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No income recorded yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No transactions match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Property / Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                    <tr key={t.id} className={`border-t hover:bg-gray-50 ${selected.has(t.id) ? 'bg-brand-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3">{formatDate(t.paymentDate)}</td>
                      <td className="px-4 py-3 font-medium">{t.tenant?.fullName || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {t.property?.name}{t.unit ? ` — ${t.unit.label}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        {t.category && (
                          <span className="inline-flex items-center gap-1.5">
                            {t.category.color && <span className="w-2 h-2 rounded-full" style={{ background: t.category.color }} />}
                            {t.category.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600">
                        {formatMoney(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditData(t); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-brand-600 rounded" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t.id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y">
            {filtered.map((t: any) => (
              <div key={t.id} className="p-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggleSelect(t.id)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-sm truncate min-w-0">{t.tenant?.fullName || t.property?.name || '—'}</p>
                    <span className="font-semibold text-sm tabular-nums text-green-600 whitespace-nowrap">{formatMoney(t.amount)}</span>
                  </div>
                  {t.tenant?.fullName && t.property?.name && (
                    <p className="text-xs text-gray-400 truncate">{t.property.name}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate">
                    {formatDate(t.paymentDate)}{t.category?.name ? ` · ${t.category.name}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => { setEditData(t); setShowForm(true); }} className="p-1 text-gray-400 hover:text-brand-600">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(t.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <RecordIncomeModal
          editData={editData}
          onClose={() => { setShowForm(false); setEditData(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transaction"
        message="This will permanently delete this income transaction. This action cannot be undone."
        onConfirm={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
