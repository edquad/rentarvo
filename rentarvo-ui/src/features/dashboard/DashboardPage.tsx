import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { formatMoney, formatPercent } from '../../lib/format';
import { Building2, DollarSign, Receipt, Users, Plus, Upload, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardSummary {
  month: string;
  totals: {
    expectedIncome: string;
    actualIncome: string;
    incomeDifference: string;
    expectedExpenses: string;
    actualExpenses: string;
    netCashFlow: string;
  };
  occupancy: { totalUnits: number; occupiedUnits: number; rate: number };
  portfolio: { totalValue: string; totalDebt: string; totalEquity: string };
  byProperty: Array<{
    propertyId: string;
    name: string;
    expectedIncome: string;
    actualIncome: string;
    expenses: string;
    net: string;
    occupancyRate: number;
  }>;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', selectedMonth, selectedEntityId],
    queryFn: () => api.get(`/dashboard/summary?month=${selectedMonth}${entityParam}`),
  });

  const { data: tenantBalances = [] } = useQuery<Array<{
    tenantId: string; tenantName: string; propertyName: string; unitLabel: string;
    expected: string; paid: string; balance: string; status: string;
  }>>({
    queryKey: ['dashboard', 'tenant-balances', selectedMonth, selectedEntityId],
    queryFn: () => api.get(`/dashboard/tenant-balances?month=${selectedMonth}${entityParam}`),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Couldn't load dashboard</h2>
          <p className="text-gray-500 mb-4 text-sm">{(error as any)?.message || 'Something went wrong'}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state — onboarding
  if (!data || (data.byProperty ?? []).length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        {/* KPI cards — show zeros */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <TrendingUp size={14} className="text-gray-300" />
              Net Cash Flow
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-400">{formatMoney('0')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <DollarSign size={14} className="text-gray-300" />
              Actual Income
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-400">{formatMoney('0')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Receipt size={14} className="text-gray-300" />
              Actual Expenses
            </div>
            <p className="text-xl font-bold tabular-nums text-gray-400">{formatMoney('0')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Users size={14} className="text-gray-300" />
              Occupancy
            </div>
            <p className="text-xl font-bold text-gray-400">0%</p>
            <p className="text-xs text-gray-400 mt-1">0/0 units</p>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center max-w-md">
            <Building2 className="w-16 h-16 text-brand-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Rentarvo</h2>
            <p className="text-gray-500 mb-6">
              Start by adding your first property — or import your existing Excel workbook.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/properties/new"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-700 text-white rounded-xl font-medium hover:bg-brand-800 transition-colors"
              >
                <Plus size={18} />
                Add Property
              </Link>
              <Link
                to="/import"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-brand-700 text-brand-700 rounded-xl font-medium hover:bg-brand-50 transition-colors"
              >
                <Upload size={18} />
                Import from Excel
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const netCashFlow = parseFloat(data.totals?.netCashFlow ?? '0');
  const incomeDiff = parseFloat(data.totals?.incomeDifference ?? '0');
  const byProperty = data.byProperty ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold truncate">Dashboard</h1>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[140px] text-center">
            {formatMonthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            disabled={selectedMonth >= currentMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setSelectedMonth(currentMonth)}
            disabled={selectedMonth === currentMonth}
            className={`ml-1 text-xs px-2 py-1 rounded-lg ${
              selectedMonth === currentMonth
                ? 'bg-gray-100 text-gray-400 cursor-default'
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm mb-1 truncate">
            {netCashFlow >= 0 ? <TrendingUp size={14} className="shrink-0 text-green-500" /> : <TrendingDown size={14} className="shrink-0 text-red-500" />}
            <span className="truncate">Net Cash Flow</span>
          </div>
          <p className={`text-lg sm:text-xl font-bold tabular-nums break-all ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(data.totals.netCashFlow)}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm mb-1 truncate">
            <DollarSign size={14} className="shrink-0 text-green-500" />
            <span className="truncate">Actual Income</span>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums break-all">{formatMoney(data.totals?.actualIncome ?? '0')}</p>
          <p className={`text-xs mt-1 truncate ${incomeDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {incomeDiff >= 0 ? '+' : ''}{formatMoney(data.totals?.incomeDifference ?? '0')} vs expected
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm mb-1 truncate">
            <Receipt size={14} className="shrink-0 text-red-400" />
            <span className="truncate">Actual Expenses</span>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums break-all">{formatMoney(data.totals?.actualExpenses ?? '0')}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm mb-1 truncate">
            <Users size={14} className="shrink-0 text-blue-500" />
            <span className="truncate">Occupancy</span>
          </div>
          <p className="text-lg sm:text-xl font-bold">{formatPercent(Math.min(data.occupancy?.rate ?? 0, 100))}</p>
          <p className="text-xs text-gray-400 mt-1">
            {data.occupancy?.occupiedUnits ?? 0}/{data.occupancy?.totalUnits ?? 0} units
          </p>
        </div>
      </div>

      {/* By Property table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">By Property</h2>
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Property</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Expected</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actual</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Expenses</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Net</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {byProperty.map((p) => (
                <tr key={p.propertyId} className="border-t hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/properties/${p.propertyId}`} className="hover:text-brand-600">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.expectedIncome)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.actualIncome)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.expenses)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${parseFloat(p.net) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMoney(p.net)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatPercent(p.occupancyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="sm:hidden divide-y">
          {byProperty.map((p) => (
            <Link
              key={p.propertyId}
              to={`/properties/${p.propertyId}`}
              className="block p-4 hover:bg-gray-50"
            >
              <p className="font-medium">{p.name}</p>
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>Actual: {formatMoney(p.actualIncome)}</span>
                <span className={parseFloat(p.net) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  Net: {formatMoney(p.net)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Portfolio snapshot */}
      {(parseFloat(data.portfolio?.totalValue ?? '0') > 0 || parseFloat(data.portfolio?.totalDebt ?? '0') > 0) && (
        <div className="bg-white rounded-2xl p-4 border shadow-sm">
          <h2 className="font-semibold mb-3">Portfolio Snapshot</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Total Value</p>
              <p className="font-bold tabular-nums">{formatMoney(data.portfolio?.totalValue ?? '0')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Debt</p>
              <p className="font-bold tabular-nums">{formatMoney(data.portfolio?.totalDebt ?? '0')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Equity</p>
              <p className="font-bold tabular-nums text-green-600">{formatMoney(data.portfolio?.totalEquity ?? '0')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Balances */}
      {tenantBalances.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Tenant Balances</h2>
            {tenantBalances.some((t) => t.status !== 'PAID') && (
              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full flex items-center gap-1">
                <AlertCircle size={12} />
                {tenantBalances.filter((t) => t.status !== 'PAID').length} outstanding
              </span>
            )}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Property / Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Expected</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Balance</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenantBalances.map((t) => (
                  <tr key={t.tenantId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/tenants/${t.tenantId}`} className="hover:text-brand-600">{t.tenantName}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.propertyName} — {t.unitLabel}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(t.expected)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(t.paid)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${parseFloat(t.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {parseFloat(t.balance) > 0 ? formatMoney(t.balance) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'PAID' ? 'bg-green-50 text-green-700'
                          : t.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y">
            {tenantBalances.map((t) => (
              <Link key={t.tenantId} to={`/tenants/${t.tenantId}`} className="block p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.tenantName}</p>
                    <p className="text-xs text-gray-400">{t.propertyName} — {t.unitLabel}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'PAID' ? 'bg-green-50 text-green-700'
                        : t.status === 'PARTIAL' ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                    }`}>
                      {t.status}
                    </span>
                    {parseFloat(t.balance) > 0 && (
                      <p className="text-sm font-semibold text-red-600 mt-1">{formatMoney(t.balance)} due</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
