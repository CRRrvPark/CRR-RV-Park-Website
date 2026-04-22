/**
 * UsersAdmin — manage users and roles.
 *
 * Owner-only for writes; any authenticated user can view the list.
 * Enforces the ≥2 active owners rule at the UI layer (warning when editing)
 * AND at the API layer (server rejects via SQL trigger).
 */

import { useEffect, useMemo, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { AuthGuard } from './AuthGuard';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client';
import { can, ROLE_DESCRIPTIONS, type UserRole } from '@lib/rbac';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { TextInput, Select } from './ui/Field';
import { Modal } from './ui/Modal';
import { EmptyState } from './ui/EmptyState';
import {
  IconUsers, IconPlus, IconAlert, IconTrash, IconSpinner,
  IconMail, IconCheck,
} from './ui/Icon';

interface AppUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_OPTIONS: UserRole[] = ['viewer', 'contributor', 'editor', 'owner'];

function UsersAdminInner() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [inviting, setInviting] = useState(false);

  const reload = () =>
    apiGet<{ users: AppUser[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch((err) => toast.error('Could not load users', { detail: err.message }));

  useEffect(() => { reload(); }, []);

  const activeOwners = useMemo(
    () => users?.filter((u) => u.role === 'owner' && u.is_active).length ?? 0,
    [users]
  );
  const canManage = can(me?.role, 'change_user_role');

  const changeRole = async (u: AppUser, role: UserRole) => {
    if (u.role === role) return;
    if (u.role === 'owner' && role !== 'owner' && activeOwners <= 2) {
      const ok = await confirm({
        title: 'Demote the last-but-one owner?',
        message: `There will only be ${activeOwners - 1} active owner(s) after this change. The system requires at least 2 for safety. Proceed anyway?`,
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await apiPatch('/api/users', { userId: u.id, role });
      toast.success(`Changed ${u.display_name} to ${role}`);
      reload();
    } catch (err: any) {
      if (err.status === 409) toast.warning(err.message);
      else toast.error('Role change failed', { detail: err.message });
    }
  };

  const toggleActive = async (u: AppUser) => {
    const nextActive = !u.is_active;
    if (!nextActive && u.role === 'owner' && activeOwners <= 2) {
      const ok = await confirm({
        title: 'Deactivate this owner?',
        message: `Only ${activeOwners - 1} owner(s) will remain active. Proceed?`,
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await apiPatch('/api/users', { userId: u.id, isActive: nextActive });
      toast.success(nextActive ? 'Activated' : 'Deactivated');
      reload();
    } catch (err: any) {
      if (err.status === 409) toast.warning(err.message);
      else toast.error('Update failed', { detail: err.message });
    }
  };

  const remove = async (u: AppUser) => {
    const ok = await confirm({
      title: `Remove ${u.display_name}?`,
      message: (
        <>
          <strong>{u.email}</strong> will no longer be able to sign in. You can
          reactivate the account later instead of removing it entirely.
        </>
      ),
      danger: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/users/${u.id}`);
      toast.success('Removed');
      reload();
    } catch (err: any) {
      if (err.status === 409) toast.warning(err.message);
      else toast.error('Remove failed', { detail: err.message });
    }
  };

  if (!users) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <IconSpinner size={24} /> <div className="text-muted mt-3">Loading users…</div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
      {activeOwners < 2 && (
        <div className="alert alert-danger">
          <IconAlert size={18} />
          <div>
            <div className="alert-title">Only {activeOwners} active owner</div>
            <div className="alert-body">
              The system requires at least 2 active owners as a safety net.
              Promote another user to owner as soon as possible.
            </div>
          </div>
        </div>
      )}

      {/* Role descriptions */}
      <Card>
        <CardHeader eyebrow="Cheat sheet" title="What each role can do" />
        <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 'var(--sp-3) var(--sp-5)' }}>
          {ROLE_OPTIONS.map((role) => (
            <div key={role} style={{ display: 'contents' }}>
              <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                <span className={`badge ${role === 'owner' ? 'badge-danger' : role === 'editor' ? 'badge-info' : role === 'contributor' ? 'badge-warning' : ''}`}>
                  {role}
                </span>
              </div>
              <div className="text-sm text-muted">{ROLE_DESCRIPTIONS[role]}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader
          title="Team"
          eyebrow={`${users.length} user${users.length === 1 ? '' : 's'} · ${activeOwners} owner${activeOwners === 1 ? '' : 's'}`}
          action={canManage ? (
            <Button onClick={() => setInviting(true)} leading={<IconPlus size={16} />}>
              Invite user
            </Button>
          ) : undefined}
        />

        {users.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={24} />}
            title="No users yet"
            body="Invite the first editor to get started."
            action={canManage ? <Button onClick={() => setInviting(true)} leading={<IconPlus size={16} />}>Invite user</Button> : null}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  {canManage && <th style={{ width: 120 }}></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--c-rust-soft)', color: 'var(--c-rust)',
                          display: 'grid', placeItems: 'center',
                          fontFamily: 'var(--font-serif)', fontWeight: 500,
                          flexShrink: 0,
                        }}>
                          {(u.display_name || u.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {u.display_name}
                            {u.id === me?.id && <span className="badge" style={{ marginLeft: 8 }}>You</span>}
                          </div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {canManage && me?.id !== u.id ? (
                        <select
                          className="select"
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value as UserRole)}
                          style={{ fontSize: 'var(--fs-sm)', padding: 'var(--sp-1) var(--sp-2)', width: 'auto' }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge" style={{ textTransform: 'capitalize' }}>{u.role}</span>
                      )}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-success"><span className="badge-dot" /> Active</span>
                      ) : (
                        <span className="badge badge-draft"><span className="badge-dot" /> Inactive</span>
                      )}
                    </td>
                    <td className="text-sm text-muted">
                      {u.last_login_at ? relativeTime(u.last_login_at) : 'Never'}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        {me?.id !== u.id && (
                          <div style={{ display: 'inline-flex', gap: 'var(--sp-1)' }}>
                            <button
                              type="button"
                              onClick={() => toggleActive(u)}
                              className="icon-btn"
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {u.is_active ? <IconAlert size={14} /> : <IconCheck size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(u)}
                              className="icon-btn is-danger"
                              title="Remove user"
                            ><IconTrash size={14} /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {inviting && (
        <InviteUserModal
          onClose={() => setInviting(false)}
          onInvited={() => { setInviting(false); reload(); }}
        />
      )}
    </div>
  );
}

function InviteUserModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !name.trim()) {
      toast.warning('Email and name are required');
      return;
    }
    setBusy(true);
    try {
      await apiPost('/api/users', { email: email.trim(), displayName: name.trim(), role });
      toast.success(`Invited ${email}`, { detail: 'They\'ll get an email with a link to set their password.' });
      onInvited();
    } catch (err: any) {
      toast.error('Invite failed', { detail: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Invite a user"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy} leading={<IconMail size={14} />}>Send invite</Button>
        </>
      }
    >
      <TextInput
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
      />
      <TextInput
        label="Display name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Their full name"
      />
      <Select
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        hint={ROLE_DESCRIPTIONS[role]}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
        ))}
      </Select>

      <div className="alert alert-info" style={{ marginTop: 'var(--sp-4)' }}>
        <div>
          <div className="alert-title">What happens next</div>
          <div className="alert-body">
            They get an invitation email with a link to set their password. They
            can sign in at <code>/admin/login</code> as soon as that's done.
            You can change their role or remove them later.
          </div>
        </div>
      </div>
    </Modal>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function UsersAdmin() {
  return (
    <AdminProviders>
      <AuthGuard requireCapability="view_users">
        <UsersAdminInner />
      </AuthGuard>
    </AdminProviders>
  );
}
