import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cleanPayload } from '../../lib/cleanPayload';
import { useEntityStore } from '../../lib/entityStore';
import { toast } from '../../components/Toaster';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Lock, Unlock, DollarSign, Shield, AlertTriangle } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [lockMonth, setLockMonth] = useState<number | null>(null);

  // Entities
  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => api.get<any[]>('/entities'),
  });

  const { selectedEntityId: globalEntityId, setSelectedEntityId: setGlobalEntityId } = useEntityStore();
  const [selectedEntityId, setLocalEntityId] = useState<string>('');

  const setSelectedEntityId = (id: string) => {
    setLocalEntityId(id);
    if (id) setGlobalEntityId(id);
  };

  // Sync with global entity store, or auto-select first entity
  React.useEffect(() => {
    if (entities.length > 0) {
      if (globalEntityId && entities.some((e: any) => e.id === globalEntityId)) {
        setLocalEntityId(globalEntityId);
      } else if (!selectedEntityId || !entities.some((e: any) => e.id === selectedEntityId)) {
        setLocalEntityId(entities[0].id);
      }
    }
  }, [entities, globalEntityId]);

  // Period Locks
  const { data: locks = [] } = useQuery({
    queryKey: ['period-locks', selectedEntityId, selectedYear],
    queryFn: () => api.get<any[]>(`/period-locks?entityId=${selectedEntityId}&year=${selectedYear}`),
    enabled: !!selectedEntityId,
  });

  const lockMutation = useMutation({
    mutationFn: (month: number) =>
      api.post('/period-locks', { entityId: selectedEntityId, year: selectedYear, month }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-locks'] });
      toast.success('Period locked');
      setLockMonth(null);
    },
    onError: (err: any) => { toast.error(err.message); setLockMonth(null); },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/period-locks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-locks'] });
      toast.success('Period unlocked');
      setUnlockId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Late Fee Rule
  const { data: lateFeeRule } = useQuery({
    queryKey: ['late-fee-rule', selectedEntityId],
    queryFn: () => api.get<any>(`/late-fees/${selectedEntityId}`),
    enabled: !!selectedEntityId,
  });

  const [feeForm, setFeeForm] = useState({
    gracePeriodDays: 5,
    feeType: 'FLAT' as 'FLAT' | 'PERCENT',
    feeAmount: '50',
    maxFeeAmount: '',
    isActive: false,
  });

  React.useEffect(() => {
    if (lateFeeRule) {
      setFeeForm({
        gracePeriodDays: lateFeeRule.gracePeriodDays,
        feeType: lateFeeRule.feeType,
        feeAmount: String(lateFeeRule.feeAmount),
        maxFeeAmount: lateFeeRule.maxFeeAmount ? String(lateFeeRule.maxFeeAmount) : '',
        isActive: lateFeeRule.isActive,
      });
    } else {
      setFeeForm({ gracePeriodDays: 5, feeType: 'FLAT', feeAmount: '50', maxFeeAmount: '', isActive: false });
    }
  }, [lateFeeRule]);

  const saveFeeMutation = useMutation({
    mutationFn: () =>
      api.put(`/late-fees/${selectedEntityId}`, cleanPayload(feeForm)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['late-fee-rule'] });
      toast.success('Late fee rule saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const lockedMonths = new Set(locks.map((l: any) => l.month));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Entity Selector */}
      {entities.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white text-sm"
          >
            {entities.map((e: any) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Period Locks */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-brand-600" />
          <h2 className="text-lg font-semibold">Period Locks</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Lock a month to prevent new income or expense entries from being created in that period.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            ←
          </button>
          <span className="font-semibold tabular-nums">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {MONTHS.map((month, idx) => {
            const monthNum = idx + 1;
            const isLocked = lockedMonths.has(monthNum);
            const lockObj = locks.find((l: any) => l.month === monthNum);

            return (
              <button
                key={month}
                onClick={() => {
                  if (isLocked) {
                    setUnlockId(lockObj?.id);
                  } else {
                    setLockMonth(monthNum);
                  }
                }}
                disabled={lockMutation.isPending}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-colors ${
                  isLocked
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-200'
                }`}
              >
                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                <span className="font-medium">{month.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Late Fee Rules */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-amber-600" />
          <h2 className="text-lg font-semibold">Late Fee Rules</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Configure automatic late fee calculation for overdue rent payments.
        </p>

        <div className="space-y-4 max-w-sm">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button
              type="button"
              onClick={() => setFeeForm({ ...feeForm, isActive: !feeForm.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                feeForm.isActive ? 'bg-brand-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  feeForm.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
            <input
              type="number"
              min={0}
              max={30}
              value={feeForm.gracePeriodDays}
              onChange={(e) => setFeeForm({ ...feeForm, gracePeriodDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
            <select
              value={feeForm.feeType}
              onChange={(e) => setFeeForm({ ...feeForm, feeType: e.target.value as 'FLAT' | 'PERCENT' })}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
            >
              <option value="FLAT">Flat ($)</option>
              <option value="PERCENT">Percentage (%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fee Amount {feeForm.feeType === 'PERCENT' ? '(%)' : '($)'}
            </label>
            <input
              type="text"
              value={feeForm.feeAmount}
              onChange={(e) => setFeeForm({ ...feeForm, feeAmount: e.target.value })}
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Fee Cap ($, optional)</label>
            <input
              type="text"
              value={feeForm.maxFeeAmount}
              onChange={(e) => setFeeForm({ ...feeForm, maxFeeAmount: e.target.value })}
              placeholder="No cap"
              className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <button
            onClick={() => saveFeeMutation.mutate()}
            disabled={saveFeeMutation.isPending}
            className="px-4 py-2.5 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 disabled:opacity-50"
          >
            {saveFeeMutation.isPending ? 'Saving...' : 'Save Late Fee Rule'}
          </button>

          {/* Preview */}
          {feeForm.isActive && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">Preview</p>
              <p>
                If rent of <strong>$1,500</strong> is paid{' '}
                {feeForm.gracePeriodDays > 0
                  ? `more than ${feeForm.gracePeriodDays} day${feeForm.gracePeriodDays === 1 ? '' : 's'} late`
                  : 'late'}
                , the fee would be{' '}
                <strong>
                  {feeForm.feeType === 'FLAT'
                    ? `$${parseFloat(feeForm.feeAmount || '0').toFixed(2)}`
                    : `$${Math.min(
                        (1500 * parseFloat(feeForm.feeAmount || '0')) / 100,
                        feeForm.maxFeeAmount ? parseFloat(feeForm.maxFeeAmount) : Infinity
                      ).toFixed(2)} (${feeForm.feeAmount}%)`}
                  {feeForm.maxFeeAmount && feeForm.feeType === 'PERCENT' ? `, capped at $${parseFloat(feeForm.maxFeeAmount).toFixed(2)}` : ''}
                </strong>
                .
              </p>
            </div>
          )}
        </div>
      </div>

      {unlockId && (
        <ConfirmDialog
          open={!!unlockId}
          title="Unlock Period"
          message="This will allow new transactions to be created in this period. Are you sure?"
          onConfirm={() => unlockMutation.mutate(unlockId)}
          onCancel={() => setUnlockId(null)}
          loading={unlockMutation.isPending}
          confirmLabel="Unlock"
        />
      )}

      {lockMonth !== null && (
        <ConfirmDialog
          open={lockMonth !== null}
          title="Lock Period"
          message={`Locking ${MONTHS[lockMonth - 1]} ${selectedYear} will prevent any new income or expense entries from being created in that month. Are you sure?`}
          onConfirm={() => lockMutation.mutate(lockMonth)}
          onCancel={() => setLockMonth(null)}
          loading={lockMutation.isPending}
          confirmLabel="Lock"
        />
      )}
    </div>
  );
}
