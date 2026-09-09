'use client';

import { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/lib/toast';
import { TenancyApi, type Tenant } from '../tenancy.api';

export function TenantAccessModal({ tenant, onClose, onSaved }: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<Tenant | null>(null);
  const [scope, setScope] = useState('');
  const [action, setAction] = useState<'active' | 'suspended'>('suspended');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    TenancyApi.getTenant(tenant.id)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load branches. Close and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant.id]);

  const branch = detail?.branches.find((item) => item.id === scope);
  const wholeClub = scope === 'all';
  const targetName = wholeClub ? detail?.name : branch?.name;
  const canSubmit = Boolean(detail && (wholeClub || branch) && detail.status !== 'cancelled' && !detail.deletedAt);
  const verb = action === 'suspended' ? 'Suspend' : 'Activate';

  const selectScope = (value: string) => {
    setScope(value);
    setError(null);
    const selectedBranch = detail?.branches.find((item) => item.id === value);
    setAction(value === 'all'
      ? (detail?.status === 'suspended' ? 'active' : 'suspended')
      : (selectedBranch?.isActive === false ? 'active' : 'suspended'));
  };

  const save = async () => {
    if (!canSubmit || !detail || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (wholeClub) {
        await TenancyApi.updateTenantStatus(detail.id, action);
      } else {
        await TenancyApi.updateTenantBranchStatus(detail.id, scope, action);
      }
      toast.success(`${wholeClub ? 'Club' : 'Branch'} ${targetName} is now ${action}.`);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update access. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ConfirmModal
      isOpen
      title='Suspend / Activate'
      description={`Choose a branch in ${tenant.name}, or explicitly select the entire club.`}
      confirmText={scope ? `${verb} ${wholeClub ? 'entire club' : 'selected branch'}` : 'Select a branch first'}
      confirmDisabled={loading || !canSubmit}
      isLoading={saving}
      variant={action === 'suspended' ? 'warning' : 'primary'}
      onConfirm={() => void save()}
      onCancel={() => { if (!savingRef.current) onClose(); }}
    >
      <div className='space-y-4'>
        {error && <Alert variant='error'>{error}</Alert>}
        {loading ? <p className='text-sm text-slate-500'>Loading branches...</p> : detail && (
          <>
            <label className='block text-sm font-medium text-slate-700'>
              Branch / scope
              <Select className='mt-1' value={scope} onChange={(event) => selectScope(event.target.value)} disabled={saving}>
                <option value=''>Select a branch...</option>
                <option value='all'>Entire club (all branches) - {detail.status}</option>
                {detail.branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id} - {item.isActive ? 'Active' : 'Suspended / inactive'}{item.address ? ` (${item.address})` : ''}
                  </option>
                ))}
              </Select>
            </label>
            {detail.branches.length === 0 && <p className='text-sm text-slate-500'>This club has no branches.</p>}
            {scope && (
              <>
                <label className='block text-sm font-medium text-slate-700'>
                  Action
                  <Select className='mt-1' value={action} onChange={(event) => setAction(event.target.value as 'active' | 'suspended')} disabled={saving}>
                    <option value='suspended'>Suspend</option>
                    <option value='active'>Activate</option>
                  </Select>
                </label>
                <p className='rounded-lg bg-slate-50 p-3 text-sm text-slate-700'>
                  {verb} <strong>{targetName}</strong>?
                  {wholeClub
                    ? (action === 'suspended'
                      ? ' This suspends the entire club and its current subscription.'
                      : ' This activates the club. Individually suspended branches remain suspended.')
                    : ' Only this branch changes. Other branches and the subscription stay unchanged.'}
                </p>
                {!wholeClub && detail.status === 'suspended' && (
                  <p className='text-sm text-amber-700'>The entire club is suspended. Activating a branch does not lift the club suspension.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ConfirmModal>
  );
}
