import React, {useEffect, useState} from 'react';
import {AlertCircle, Bell, Trash2, X} from 'lucide-react';
import {AppNotice, notifications} from '../../services/notificationService';

export function NotificationHost() {
  const [notices, setNotices] = useState<AppNotice[]>([]);
  useEffect(() => notifications.subscribe(setNotices), []);
  if (!notices.length) return null;
  return (
    <aside aria-label="Notifications" className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 pointer-events-none">
      {notices.map((notice) => {
        const confirmation = notice.kind === 'confirm';
        const Icon = notice.kind === 'error' ? AlertCircle : confirmation ? Trash2 : Bell;
        return (
          <section key={notice.id} role={confirmation ? 'group' : notice.kind === 'error' ? 'alert' : 'status'} aria-label={notice.title} aria-live={confirmation ? 'polite' : undefined}
            className="pointer-events-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_8px_32px_rgba(15,23,42,0.14)]">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${notice.kind === 'error' || notice.destructive ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5">{notice.title}</p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">{notice.message}</p>
              </div>
              <button type="button" aria-label="Fermer la notification" onClick={() => notifications.dismiss(notice.id)} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-4 w-4" /></button>
            </div>
            {confirmation && (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => notifications.dismiss(notice.id)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Annuler</button>
                <button type="button" onClick={() => notifications.dismiss(notice.id, true)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${notice.destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-700'}`}>{notice.actionLabel}</button>
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
