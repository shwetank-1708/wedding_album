import React, { useMemo, useState } from 'react';
import { Mail, Search, Clock, ExternalLink } from 'lucide-react';
import type { ContactMessage, ContactMessageStatus } from '../lib/analytics';

type Props = {
  messages: ContactMessage[];
  onStatusChange: (id: string, status: ContactMessageStatus) => Promise<void> | void;
};

const statusOptions: ContactMessageStatus[] = ['new', 'read', 'replied', 'closed'];

function formatDate(value?: string) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: ContactMessageStatus) {
  if (status === 'new') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (status === 'read') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  if (status === 'replied') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
}

export const ContactMessagesGrid: React.FC<Props> = ({ messages, onStatusChange }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContactMessageStatus>('all');
  const [savingId, setSavingId] = useState('');

  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter(message => {
      const matchesStatus = statusFilter === 'all' || message.status === statusFilter;
      const haystack = `${message.firstName} ${message.lastName} ${message.email} ${message.message} ${message.source}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [messages, search, statusFilter]);

  const newCount = messages.filter(message => message.status === 'new').length;

  const handleStatusChange = async (id: string, status: ContactMessageStatus) => {
    setSavingId(id);
    try {
      await onStatusChange(id, status);
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Messages</p>
          <p className="mt-2 text-3xl font-black text-white">{messages.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">New</p>
          <p className="mt-2 text-3xl font-black text-white">{newCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Filtered</p>
          <p className="mt-2 text-3xl font-black text-white">{filteredMessages.length}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-white">Contact Messages</h3>
            <p className="text-sm text-slate-500 mt-1">Messages submitted from the website and mobile Contact Us forms.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search messages..."
                className="w-full sm:w-64 rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredMessages.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No contact messages found.</div>
          ) : (
            filteredMessages.map(message => (
              <article key={message.id} className="p-5 hover:bg-slate-800/20 transition-colors">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-black text-white">
                        {message.firstName} {message.lastName}
                      </h4>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(message.status)}`}>
                        {message.status}
                      </span>
                      <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                        {message.source}
                      </span>
                    </div>
                    <a href={`mailto:${message.email}`} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">
                      <Mail className="w-4 h-4" />
                      {message.email}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                      {message.message}
                    </p>
                  </div>

                  <div className="xl:w-52 shrink-0 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Clock className="w-4 h-4" />
                      {formatDate(message.createdAt)}
                    </div>
                    <select
                      value={message.status}
                      disabled={savingId === message.id}
                      onChange={event => handleStatusChange(message.id, event.target.value as ContactMessageStatus)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:border-indigo-500 disabled:opacity-60"
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
