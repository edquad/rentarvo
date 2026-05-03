import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEntityStore } from '../../lib/entityStore';
import { formatMoney } from '../../lib/format';
import { FileDown, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';

export function ScheduleEPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectedEntityId = useEntityStore((s) => s.selectedEntityId);

  // Reset expanded state when year changes
  useEffect(() => {
    setExpanded(new Set());
  }, [year]);
  const entityParam = selectedEntityId ? `&entityId=${selectedEntityId}` : '';

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-e', year, selectedEntityId],
    queryFn: () => api.get<any>(`/reports/schedule-e?year=${year}${entityParam}`),
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDownloadCSV = () => {
    const token = localStorage.getItem('rentarvo_token');
    fetch(`/api/v1/reports/schedule-e/csv?year=${year}${entityParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule-e-${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Schedule E Report</h1>
        <button
          onClick={handleDownloadCSV}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-xl text-sm font-medium hover:bg-brand-800 shrink-0"
        >
          <FileDown size={16} /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setYear(Math.max(2000, year - 1))} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">←</button>
        <span className="font-semibold text-lg tabular-nums">{year}</span>
        <button onClick={() => setYear(Math.min(currentYear + 1, year + 1))} className="px-2 py-1 text-sm border rounded hover:bg-gray-50" disabled={year >= currentYear + 1}>→</button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !data?.properties?.length ? (
        <div className="text-center py-12">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No data for {year}.</p>
        </div>
      ) : (
        <>
          {data.properties.map((p: any) => {
            const isExpanded = expanded.has(p.property.id);
            return (
              <div key={p.property.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(p.property.id)}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="text-left">
                    <p className="font-semibold">{p.property.name}</p>
                    <p className="text-xs text-gray-400">{p.property.address}</p>
                  </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right min-w-0">
                      <p className={`font-semibold tabular-nums text-sm sm:text-base ${p.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatMoney(p.netIncome)}
                      </p>
                      <p className="text-xs text-gray-400">Net Income</p>
                    </div>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t">
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <h3 className="text-sm font-semibold text-green-700 mb-2">Income — {formatMoney(p.income.total)}</h3>
                        {Object.entries(p.income.byBucket).length === 0 ? (
                          <p className="text-xs text-gray-400">No income</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(p.income.byBucket).map(([bucket, amount]) => (
                              <div key={bucket} className="flex justify-between text-sm">
                                <span className="text-gray-600 cursor-help" title={`Aggregated IRS Schedule E category: ${bucket}`}>{bucket}</span>
                                <span className="tabular-nums font-medium">{formatMoney(amount as number)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2">Expenses — {formatMoney(p.expenses.total)}</h3>
                        {Object.entries(p.expenses.byBucket).length === 0 ? (
                          <p className="text-xs text-gray-400">No expenses</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(p.expenses.byBucket).map(([bucket, amount]) => (
                              <div key={bucket} className="flex justify-between text-sm">
                                <span className="text-gray-600 cursor-help" title={`Aggregated IRS Schedule E category: ${bucket}`}>{bucket}</span>
                                <span className="tabular-nums font-medium">{formatMoney(amount as number)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand Totals */}
          <div className="bg-gray-50 rounded-2xl border p-3 sm:p-4">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-sm sm:text-base">Grand Totals</span>
              <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center sm:text-right">
                <div className="px-1">
                  <p className="text-green-600 font-semibold tabular-nums text-xs sm:text-sm whitespace-nowrap">{formatMoney(data.grandTotals.totalIncome)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">Income</p>
                </div>
                <div className="px-1">
                  <p className="text-red-600 font-semibold tabular-nums text-xs sm:text-sm whitespace-nowrap">{formatMoney(data.grandTotals.totalExpenses)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">Expenses</p>
                </div>
                <div className="px-1">
                  <p className={`font-bold tabular-nums text-xs sm:text-sm whitespace-nowrap ${data.grandTotals.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(data.grandTotals.netIncome)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400">Net</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
