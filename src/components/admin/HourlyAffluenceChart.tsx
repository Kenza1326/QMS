import React from 'react';
import {Activity} from 'lucide-react';

type HourlyDatum = {slot: string; count: number; avgWait: number; isPeak: boolean};

export function HourlyAffluenceChart({data}: {data: HourlyDatum[]}) {
  const maxCount = Math.max(0, ...data.map((item) => item.count));
  if (!maxCount) return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-8 text-center" role="status">
      <Activity className="h-7 w-7 text-slate-400" />
      <p className="text-sm font-bold text-slate-700">Aucune arrivée enregistrée aujourd’hui</p>
      <p className="max-w-sm text-xs text-slate-500">Les arrivées et les délais par heure apparaîtront ici dès le premier ticket.</p>
    </div>
  );
  return (
    <div className="min-w-0 max-w-full">
      <p className="mb-2 text-xs text-slate-500">Faites défiler horizontalement pour consulter les 24 heures.</p>
      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600" role="region" aria-label="Affluence et délais par heure" tabIndex={0}>
        <div className="flex h-64 min-w-[1440px] items-end gap-2 border-b border-slate-100 px-2 pt-6 pb-3">
          {data.map((item) => (
            <div key={item.slot} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${item.slot} : ${item.count} clients, ${item.avgWait} min d’attente moyenne`}>
              <span className="mb-1 text-[10px] font-bold font-mono text-slate-600">{item.count}</span>
              <div className={`w-full max-w-[42px] shrink-0 rounded-t-lg ${item.isPeak ? 'bg-gradient-to-t from-amber-600 to-amber-400' : 'bg-gradient-to-t from-[#003B73] to-blue-400'}`} style={{height: `${Math.round(item.count / maxCount * 160)}px`}} />
              <span className="mt-2 whitespace-nowrap text-[10px] font-semibold font-mono text-slate-500">{item.slot}</span>
              <span className={`mt-1 rounded-md px-1.5 text-[9px] font-bold ${item.avgWait > 14 ? 'bg-rose-50 text-rose-700' : item.avgWait > 10 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.avgWait}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
