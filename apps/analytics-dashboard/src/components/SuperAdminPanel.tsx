import { useMemo, useState } from 'react';
import {
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
  FolderTree,
  UserCheck,
  UserX,
  Mail,
  UserPlus,
  Check,
} from 'lucide-react';
import { isProtectedSuperAdmin, type Event, type GuestLog, type UserProfile } from '../lib/analytics';

type AdminSection = 'users' | 'admins' | 'events' | 'guests';

interface SuperAdminPanelProps {
  users: UserProfile[];
  events: Event[];
  guests: GuestLog[];
  loading: boolean;
  currentAdminId?: string;
  onRefresh: () => void;
  onSyncUsers: () => void;
  onUpdateUserRole: (userId: string, role: string, delegatedBy?: string, roleType?: string) => void;
  onPromoteSuperAdmin?: (userId: string) => Promise<void> | void;
  onRevokeSuperAdmin?: (userId: string) => Promise<void> | void;
  onDeleteUser: (userId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteGuest: (guestId: string) => void;
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function getUserName(users: UserProfile[], id?: string) {
  if (!id) return 'Unassigned';
  const user = users.find(item => item.id === id);
  return user?.name || user?.email || id;
}

function RoleSelect({
  user,
  onChange,
}: {
  user: UserProfile;
  onChange: (role: string) => void;
}) {
  return (
    <select
      value={user.role || 'user'}
      onChange={event => onChange(event.target.value)}
      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
    >
      <option value="user">User</option>
      <option value="free">Free</option>
      <option value="starter">10 GB</option>
      <option value="basic">Basic</option>
      <option value="standard">Standard</option>
      <option value="premium">Premium</option>
      <option value="pro">200 GB</option>
      <option value="elite">Elite</option>
      <option value="ultimate">1 TB</option>
      <option value="admin">Super Admin</option>
    </select>
  );
}

export function SuperAdminPanel({
  users,
  events,
  guests,
  loading,
  currentAdminId,
  onRefresh,
  onSyncUsers,
  onUpdateUserRole,
  onPromoteSuperAdmin,
  onRevokeSuperAdmin,
  onDeleteUser,
  onDeleteEvent,
  onDeleteGuest,
}: SuperAdminPanelProps) {
  const [section, setSection] = useState<AdminSection>('users');

  const mainEvents = useMemo(
    () => events.filter(event => !event.parentId && event.type !== 'sub'),
    [events]
  );

  const subEventsByParent = useMemo(() => {
    const groups = new Map<string, Event[]>();
    events
      .filter(event => event.parentId || event.type === 'sub')
      .forEach(event => {
        const key = event.parentId || 'unassigned';
        const existing = groups.get(key) || [];
        existing.push(event);
        groups.set(key, existing);
      });
    return groups;
  }, [events]);

  const delegatedAdmins = useMemo(
    () => users.filter(user => user.role === 'admin' && user.delegatedBy),
    [users]
  );

  const globalAdmins = useMemo(
    () => users.filter(user => user.role === 'admin' && !user.delegatedBy),
    [users]
  );

  const sortedGuests = useMemo(
    () => [...guests].sort((a, b) => {
      const aTime = a.loginAt ? new Date(a.loginAt).getTime() : 0;
      const bTime = b.loginAt ? new Date(b.loginAt).getTime() : 0;
      return bTime - aTime;
    }),
    [guests]
  );

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionUserId, setAdminActionUserId] = useState<string | null>(null);
  const [addingAdminLoading, setAddingAdminLoading] = useState(false);

  const nonAdminUsers = useMemo(() => {
    return users.filter(user => user.role !== 'admin');
  }, [users]);

  const matchedUser = useMemo(() => {
    const trimmed = newAdminEmail.trim().toLowerCase();
    if (!trimmed) return null;
    return users.find(u => (u.email || '').trim().toLowerCase() === trimmed);
  }, [users, newAdminEmail]);

  const handleAddSuperAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newAdminEmail.trim().toLowerCase();
    if (!trimmed) return;

    const targetUser = users.find(u => (u.email || '').trim().toLowerCase() === trimmed);
    if (!targetUser) {
      alert(`No user found with email "${trimmed}". Please make sure the account is registered first.`);
      return;
    }

    if (targetUser.role === 'admin' && !targetUser.delegatedBy) {
      alert(`${targetUser.email} is already a Global Super Admin.`);
      return;
    }

    const confirmed = window.confirm(
      `Make ${targetUser.email} (${targetUser.name || 'Anonymous'}) a Super Admin?\n\nThis will give full Analytics Dashboard access and administrative privileges.`
    );
    if (!confirmed) return;

    setAddingAdminLoading(true);
    try {
      if (onPromoteSuperAdmin) {
        await onPromoteSuperAdmin(targetUser.id);
      } else {
        await onUpdateUserRole(targetUser.id, 'admin');
      }
      setNewAdminEmail('');
    } finally {
      setAddingAdminLoading(false);
    }
  };

  const handleRevokeAdminAccess = async (user: UserProfile) => {
    if (isProtectedSuperAdmin(user)) {
      alert('This Super Admin account is permanently protected and cannot be removed.');
      return;
    }

    if (user.id === currentAdminId) {
      alert('You cannot revoke your own Super Admin access.');
      return;
    }

    if (globalAdmins.length <= 1) {
      alert('Cannot remove this Super Admin: At least one Super Admin must remain in the system.');
      return;
    }

    const label = user.email || user.name || user.id;
    const confirmed = window.confirm(
      `Remove Super Admin role for ${label}?\n\nThis user will lose full dashboard access and will be moved to the standard Free plan.`
    );
    if (!confirmed) return;

    setAdminActionUserId(user.id);
    try {
      if (onRevokeSuperAdmin) {
        await onRevokeSuperAdmin(user.id);
      } else {
        await onUpdateUserRole(user.id, 'user');
      }
    } finally {
      setAdminActionUserId(null);
    }
  };

  const sections = [
    { id: 'users' as const, label: 'Users', icon: Users, count: users.length },
    { id: 'admins' as const, label: 'Admins', icon: UserCheck, count: globalAdmins.length + delegatedAdmins.length },
    { id: 'events' as const, label: 'Events', icon: FolderTree, count: events.length },
    { id: 'guests' as const, label: 'Guests', icon: UserX, count: guests.length },
  ];

  const confirmDeleteUser = (user: UserProfile) => {
    if (isProtectedSuperAdmin(user)) {
      alert('This Super Admin account is permanently protected and cannot be deleted.');
      return;
    }

    if (confirm(`Delete ${user.name || user.email || 'this user'} permanently?`)) {
      onDeleteUser(user.id);
    }
  };

  const confirmDeleteEvent = (event: Event) => {
    if (confirm(`Delete "${event.title}" and its nested content?`)) {
      onDeleteEvent(event.id);
    }
  };

  const confirmDeleteGuest = (guest: GuestLog) => {
    if (confirm(`Delete guest log for ${guest.name || guest.phone || guest.id}?`)) {
      onDeleteGuest(guest.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            Global Super Admin
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin Control</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage accounts, delegated admins, events, sub galleries, and guest access from the analytics app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onSyncUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <Users className="w-4 h-4" />
            Sync Auth Users
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sections.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`text-left border rounded-2xl p-4 transition-colors ${
                active
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-[#111827] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.count}</p>
            </button>
          );
        })}
      </div>

      {section === 'users' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">User Accounts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Created</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-100">{user.name || 'Anonymous'}</p>
                      <p className="text-xs text-slate-500">{user.email || user.phone || user.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      {isProtectedSuperAdmin(user) ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-300 select-none">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          Super Admin
                        </span>
                      ) : (
                        <RoleSelect user={user} onChange={role => onUpdateUserRole(user.id, role)} />
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      {!isProtectedSuperAdmin(user) ? (
                        <button
                          onClick={() => confirmDeleteUser(user)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg select-none">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'admins' && (
        <div className="space-y-6">
          {/* Card: Add Super Admin by Email ID */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <UserPlus className="w-4 h-4" />
                  Grant Privileges
                </div>
                <h2 className="text-lg font-bold text-white">Add Super Admin by Email</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter an account email to grant full Super Admin privileges and dashboard access.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddSuperAdmin} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Email text input */}
                <div className="lg:col-span-2 relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="Enter user email address (e.g. user@example.com)..."
                    value={newAdminEmail}
                    onChange={e => setNewAdminEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={addingAdminLoading || !newAdminEmail.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {addingAdminLoading ? 'Adding...' : 'Make Super Admin'}
                </button>
              </div>

              {/* Quick Select from non-admin accounts */}
              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                <span className="text-slate-500">Or pick from registered users:</span>
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) setNewAdminEmail(e.target.value);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Select a user account...</option>
                  {nonAdminUsers.map(u => (
                    <option key={u.id} value={u.email}>
                      {u.email} ({u.name || 'Anonymous'}) · {u.role || 'free'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status / Matching helper */}
              {newAdminEmail.trim() && (
                <div className="text-xs pt-1">
                  {matchedUser ? (
                    matchedUser.role === 'admin' && !matchedUser.delegatedBy ? (
                      <span className="text-amber-400 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {matchedUser.email} is already a Global Super Admin.
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Ready to promote: <strong className="text-white">{matchedUser.name}</strong> ({matchedUser.email}) · Current role: {matchedUser.role || 'free'}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500">
                      No user account matches this email yet. The user must sign up before being promoted.
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Section: Global Super Admins & Delegated Admins */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Global Super Admins List */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Global Super Admins
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {globalAdmins.length} account{globalAdmins.length === 1 ? '' : 's'} with full access
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {globalAdmins.map(user => {
                  const isCurrent = user.id === currentAdminId;
                  const isBusy = adminActionUserId === user.id;
                  const isProtected = isProtectedSuperAdmin(user);

                  return (
                    <div
                      key={user.id}
                      className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 transition-all hover:border-slate-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white text-sm truncate">
                              {user.name || 'Admin'}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                            {isProtected && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                Protected
                              </span>
                            )}
                            {user.username && (
                              <span className="text-[11px] font-mono text-indigo-300">
                                @{user.username}
                              </span>
                            )}
                          </div>
                          
                          {/* Prominent Email ID */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="font-mono truncate select-all">{user.email || 'No email'}</span>
                          </div>

                          <p className="text-[10px] text-slate-500 mt-1">
                            Joined: {formatDate(user.createdAt)}
                          </p>
                        </div>

                        {/* Actions: Protected accounts cannot be removed or demoted */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isProtected ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-300 select-none shadow-sm">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              Permanent Super Admin
                            </span>
                          ) : (
                            <>
                              {/* Role Chooser / Dropdown */}
                              <RoleSelect
                                user={user}
                                onChange={role => onUpdateUserRole(user.id, role)}
                              />

                              {/* Remove Super Admin button */}
                              <button
                                type="button"
                                disabled={isCurrent || isBusy}
                                onClick={() => handleRevokeAdminAccess(user)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title={isCurrent ? 'You cannot remove your own Super Admin access' : 'Remove Super Admin role for this email'}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                {isBusy ? 'Removing...' : 'Remove'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {globalAdmins.length === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">No global admins found.</p>
                )}
              </div>
            </div>

            {/* Delegated Admins List */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    Delegated Admins
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {delegatedAdmins.length} event-delegated administrator{delegatedAdmins.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {delegatedAdmins.map(user => (
                  <div key={user.id} className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{user.name || 'Delegated Admin'}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-mono truncate">{user.email}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Owner: {getUserName(users, user.delegatedBy)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Scope: {user.roleType || 'primary'}
                        </p>
                      </div>
                      <button
                        onClick={() => onUpdateUserRole(user.id, 'user')}
                        className="px-3 py-2 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
                {delegatedAdmins.length === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">No delegated admins found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'events' && (
        <div className="space-y-4">
          {mainEvents.map(event => {
            const subEvents = subEventsByParent.get(event.id) || [];
            const eventGuests = guests.filter(guest =>
              guest.eventId === event.id || guest.parentEventId === event.id
            );
            const eventAdmins = delegatedAdmins.filter(admin =>
              admin.delegatedBy === event.createdById &&
              (admin.roleType !== 'event' || admin.assignedEvents?.includes(event.id))
            );

            return (
              <div key={event.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white">{event.title}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Owner: {getUserName(users, event.createdById)} · {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => confirmDeleteEvent(event)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Event
                  </button>
                </div>
                <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {subEvents.map(subEvent => (
                    <div key={subEvent.id} className="rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{subEvent.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(subEvent.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => confirmDeleteEvent(subEvent)}
                          className="p-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                          aria-label="Delete sub event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {subEvents.length === 0 && (
                    <p className="text-sm text-slate-500">No sub galleries under this event.</p>
                  )}
                </div>
                <div className="mt-5 grid lg:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Delegated Admins</p>
                    <div className="space-y-2">
                      {eventAdmins.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{admin.name || 'Admin'}</p>
                            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                          </div>
                          <button
                            onClick={() => onUpdateUserRole(admin.id, 'user')}
                            className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                      {eventAdmins.length === 0 && (
                        <p className="text-sm text-slate-500">No delegated admins assigned.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recent Guests</p>
                    <div className="space-y-2">
                      {eventGuests.slice(0, 5).map(guest => (
                        <div key={guest.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{guest.name || 'Guest'}</p>
                            <p className="text-xs text-slate-500 truncate">{guest.email || guest.phone || guest.status}</p>
                          </div>
                          <button
                            onClick={() => confirmDeleteGuest(guest)}
                            className="p-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                            aria-label="Delete guest"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {eventGuests.length === 0 && (
                        <p className="text-sm text-slate-500">No guest traffic found.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {mainEvents.length === 0 && (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No events found.
            </div>
          )}
        </div>
      )}

      {section === 'guests' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">Guest Access Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3">Guest</th>
                  <th className="text-left px-5 py-3">Event</th>
                  <th className="text-left px-5 py-3">Access</th>
                  <th className="text-left px-5 py-3">Login</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-100">{guest.name || 'Guest User'}</p>
                      <p className="text-xs text-slate-500">{guest.email || guest.phone || guest.id}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{guest.eventTitle || guest.eventId || 'Unknown'}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {guest.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{formatDate(guest.loginAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => confirmDeleteGuest(guest)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
