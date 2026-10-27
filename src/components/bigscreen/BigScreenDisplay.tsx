import {calledTicketsNewestFirst,callTime,isLiveCall} from '../../services/callLifecycle';
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ArrowLeft,
  Tv,
  Clock,
  QrCode,
  Users,
  CheckCircle,
  Building,
} from 'lucide-react';
import { QueueSystemConfig, QueueTicket, CounterStation } from '../../types/queueTypes';
import { queueStore, QueueState } from '../../services/queueStore';
import { DEFAULT_QUEUE_CONFIG } from '../../config/defaultQueueConfig';
import { BankLogo } from '../common/BankLogo';
import { QrCodeView } from '../common/QrCodeView';
import { getPublicUrl } from '../../utils/urlUtils';

interface BigScreenDisplayProps {
  config: QueueSystemConfig;
  queueState: QueueState;
  onOpenClientApp?: () => void;
  onBackToHub?: () => void;
}

export const BigScreenDisplay: React.FC<BigScreenDisplayProps> = ({
  config,
  queueState,
  onOpenClientApp,
  onBackToHub,
}) => {
  const [isCallingPulse, setIsCallingPulse] = useState(false);

  const agencies = config?.agencies?.length ? config.agencies : DEFAULT_QUEUE_CONFIG.agencies;
  const agency = agencies.find((a) => a.id === config?.selectedAgencyId) || agencies[0];

  const exchangeRates = config?.exchangeRates?.length
    ? config.exchangeRates
    : DEFAULT_QUEUE_CONFIG.exchangeRates;

  const lastCalled = calledTicketsNewestFirst(queueState.tickets)[0] || null;

  // A reload never re-announces a call that is already old or finished.
  useEffect(() => {
    if(!isLiveCall(lastCalled)){setIsCallingPulse(false);return;}
    setIsCallingPulse(true);
    const timer=setTimeout(()=>setIsCallingPulse(false),Math.max(0,8000-(Date.now()-callTime(lastCalled!))));
    return ()=>clearTimeout(timer);
  },[lastCalled?.id,lastCalled?.calledAt,lastCalled?.lastRecalledAt,lastCalled?.status]);

  // Public LAN URL for QR code (never localhost)
  const clientPublicUrl = getPublicUrl('?mode=client');

  const waitingTicketsCount = queueState.tickets.filter((t) => t.status === 'waiting').length;
  const activeCountersCount = queueState.counters.filter((c) => c.status !== 'closed').length;

  return (
    <div className="h-screen w-screen max-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col justify-between overflow-hidden font-sans select-none aspect-video">
      {/* 1. TOP BRAND HEADER FOR TV (LIGHT THEME) */}
      <header className="bg-white border-b-2 border-slate-200/90 px-6 sm:px-10 py-3 flex items-center justify-between gap-4 shadow-xs shrink-0">
        <div className="flex items-center gap-4">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              title="Retourner au Hub"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <BankLogo brand={config.brand} size="lg" variant="light" />
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <span className="text-xs uppercase tracking-widest text-slate-500 block font-extrabold">
              {agency?.name}
            </span>
            <span className="text-base sm:text-lg font-black text-[#0055D4] font-mono">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN TV BODY (16:9 NO SCROLL LAYOUT) */}
      <main className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[2100px] mx-auto w-full items-stretch">
        {/* LEFT COLUMN: HERO CALLED TICKET + RECENT CALLS (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 justify-between">
          {/* A. HERO CALLING STAGE (GIANT FONT, READABLE FROM AFAR) */}
          <div
            className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 bg-white ${
              isCallingPulse
                ? 'border-2 border-amber-400 shadow-xl ring-2 ring-amber-400/30'
                : 'border-2 border-slate-200 shadow-lg'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-4 h-4 rounded-full ${
                    isCallingPulse ? 'bg-[#FFB800] animate-ping' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-[#0055D4]">
                  {isCallingPulse ? 'APPEL EN COURS' : lastCalled ? 'DERNIER TICKET APPELÉ' : 'EN ATTENTE D’UN APPEL'}
                </span>
              </div>
              <span className="text-sm font-black text-slate-500 font-mono">
                {lastCalled?.calledAt
                  ? new Date(callTime(lastCalled)).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--'}
              </span>
            </div>

            {/* Huge Called Ticket Number & Counter */}
            {lastCalled ? (
              <div className="my-auto py-2 text-center">
                <div className="inline-block relative">
                  <span className="text-xs sm:text-sm uppercase font-black tracking-widest text-slate-500 block mb-1">
                    NUMÉRO DU TICKET
                  </span>

                  {/* GIANT TICKET PILL (HIGH CONTRAST & VISIBILITY FROM AFAR) */}
                  <div
                    className={`inline-flex items-center justify-center px-10 sm:px-14 py-4 sm:py-5 rounded-3xl font-mono text-6xl sm:text-8xl lg:text-9xl font-black tracking-wider text-white shadow-md transition-transform ${
                      isCallingPulse ? 'scale-105 ring-4 ring-amber-400/40 animate-pulse' : ''
                    }`}
                    style={{
                      backgroundColor: config.brand.primaryColor || '#0055D4',
                    }}
                  >
                    {lastCalled.tokenNumber}
                  </div>
                </div>

                {/* COUNTER ANNOUNCEMENT (GIANT BOLD BADGE) */}
                <div className="mt-5 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-[#FFB800] text-slate-950 font-black text-2xl sm:text-4xl lg:text-5xl tracking-tight shadow-md animate-bounce">
                    <ArrowRight className="w-8 h-8 sm:w-10 sm:h-10 text-slate-950" />
                    <span>{lastCalled.counterName || 'GUICHET'}</span>
                  </div>
                  <span className="mt-3 text-base sm:text-xl text-slate-800 font-extrabold tracking-wide">
                    {lastCalled.subOperationName}
                    <span className="mt-2 block text-xs font-bold uppercase text-slate-600">{lastCalled.status === 'noshow' ? 'Client absent' : lastCalled.status === 'completed' ? 'Service terminé' : lastCalled.status === 'in_service' ? 'En service' : lastCalled.status === 'cancelled' ? 'Ticket annulé' : 'Présentation attendue au guichet'}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="my-auto py-8 text-center text-slate-400">
                <Tv className="w-16 h-16 mx-auto mb-3 opacity-40 animate-pulse text-[#0055D4]" />
                <p className="text-xl font-black text-slate-700">En attente du prochain appel...</p>
                <p className="text-sm font-semibold text-slate-400 mt-1">
                  Les prochains tickets appelés s'afficheront ici en grand format
                </p>
              </div>
            )}

            {/* Bottom Status bar */}
            <div className="mt-2 pt-3 border-t border-slate-200 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-600">
              <span className="flex items-center gap-2 text-slate-500 font-semibold">
                <Users className="w-4 h-4 text-[#0055D4]" />
                <span>File d'attente agence en direct</span>
              </span>
              <span className="font-extrabold text-[#0055D4] bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200">
                {waitingTicketsCount} client(s) en attente
              </span>
            </div>
          </div>

          {/* B. RECENT CALLS TABLE (LARGER BOLD FONT FOR DISTANCE) */}
          <div className="bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-lg flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#0055D4]" />
                <span>Historique des Derniers Appels</span>
              </h3>
              <span className="text-xs font-bold text-slate-500">Derniers passages au guichet</span>
            </div>

            <div className="overflow-hidden flex-1 flex flex-col justify-center">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 uppercase text-xs font-black tracking-wider">
                    <th className="pb-2">Ticket</th>
                    <th className="pb-2">Guichet</th>
                    <th className="pb-2">Opération</th>
                    <th className="pb-2 text-right">Heure</th>
                    <th className="pb-2 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {queueState.recentCalledHistory.slice(0, 4).map((item, idx) => (
                    <tr
                      key={`${item.ticketNumber}-${idx}`}
                      className={`transition-colors ${
                        idx === 0 ? 'bg-blue-50/60 font-black' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 font-black text-lg sm:text-xl text-[#0055D4]">
                        {item.ticketNumber}
                      </td>
                      <td className="py-2.5 font-sans font-black text-slate-900 text-sm sm:text-base">
                        {item.counterName}
                      </td>
                      <td className="py-2.5 font-sans text-slate-700 text-xs sm:text-sm font-bold truncate max-w-[200px]">
                        {item.categoryLabel}
                      </td>
                      <td className="py-2.5 text-right text-slate-600 text-xs sm:text-sm font-bold">
                        {item.calledAt
                          ? new Date(item.calledAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </td>
                      <td className="py-2.5 text-right font-sans">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                            item.status === 'in_service'
                              ? 'bg-blue-100 text-[#0055D4]'
                              : item.status === 'called'
                              ? 'bg-amber-100 text-amber-900 animate-pulse'
                              : item.status === 'noshow' ? 'bg-rose-100 text-rose-800' : item.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.status === 'in_service'
                            ? 'En cours'
                            : item.status === 'called'
                            ? 'Appelé'
                            : item.status === 'noshow' ? 'Absent' : item.status === 'cancelled' ? 'Annulé' : 'Servi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {queueState.recentCalledHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 font-sans font-bold text-sm">
                        Aucun ticket appelé pour le moment
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EXCHANGE RATES + PUBLIC QR CODE + HALL STATS (5 cols) */}
        {/* MARKETING CAROUSEL / HIGHLIGHT OF WHAT'S NEW IS COMPLETELY REMOVED AS REQUESTED */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-between overflow-hidden">
          {/* A. REAL-TIME CURRENCY EXCHANGE RATES TABLE (LARGE & BOLD) */}
          <div className="bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                  Cours de Change (DZD)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-bold font-mono">Banque d'Algérie</span>
            </div>

            <div className="overflow-hidden">
              <table className="w-full text-left text-sm font-mono">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-500 uppercase text-xs font-black">
                    <th className="pb-2">Devise</th>
                    <th className="pb-2 text-right">Achat</th>
                    <th className="pb-2 text-right">Vente</th>
                    <th className="pb-2 text-right">Tendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exchangeRates.map((rate) => (
                    <tr key={rate.currencyCode} className="hover:bg-slate-50">
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="text-lg">{rate.flag}</span>
                        <div>
                          <span className="font-black text-slate-900 text-sm">{rate.currencyCode}</span>
                          <span className="text-[10px] text-slate-500 block font-sans font-semibold">
                            {rate.currencyName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-emerald-700 font-black text-sm sm:text-base">
                        {rate.buyRate.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-amber-700 font-black text-sm sm:text-base">
                        {rate.sellRate.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right">
                        {rate.trend === 'up' ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-black text-xs">
                            <TrendingUp className="w-3.5 h-3.5" /> +0.12%
                          </span>
                        ) : rate.trend === 'down' ? (
                          <span className="inline-flex items-center gap-0.5 text-rose-700 font-black text-xs">
                            <TrendingDown className="w-3.5 h-3.5" /> -0.08%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-slate-500 font-bold text-xs">
                            <Minus className="w-3.5 h-3.5" /> 0.00%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2 text-right font-medium">
              Taux indicatifs actualisés en temps réel
            </span>
          </div>

          {/* B. PUBLIC QR CODE TO JOIN / TRACK ON MOBILE (NEVER LOCALHOST) */}
          <div
            onClick={onOpenClientApp}
            className="bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-lg flex items-center gap-5 cursor-pointer hover:border-[#0055D4] hover:shadow-xl transition-all group"
            title="Scannez ce QR Code avec votre smartphone pour rejoindre la file"
          >
            <div className="shrink-0 bg-slate-50 p-2 rounded-2xl border-2 border-slate-200 group-hover:scale-105 transition-transform shadow-xs">
              <QrCodeView value={clientPublicUrl} size={110} />
            </div>

            <div className="flex-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#0055D4] flex items-center gap-1.5 mb-1">
                <QrCode className="w-4 h-4" />
                <span>File d'Attente sur Smartphone</span>
              </span>
              <h4 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-[#0055D4] transition-colors leading-snug">
                Scannez pour Suivre Votre Tour
              </h4>
              <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                Prenez un ticket ou suivez votre position en direct sur votre téléphone sans rester debout dans la salle d'attente.
              </p>
            </div>
          </div>

          {/* C. LIVE HALL STATUS & CAPACITY STATS */}
          <div className="bg-gradient-to-r from-blue-50 via-white to-amber-50 rounded-3xl p-5 border-2 border-blue-200 shadow-md flex items-center justify-around text-center">
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-500 block">
                Guichets Actifs
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {activeCountersCount} / {queueState.counters.length}
              </span>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-500 block">
                En Attente
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#0055D4] font-mono">
                {waitingTicketsCount}
              </span>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-500 block">
                Temps Moyen
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                {queueState.counters.every((c)=>c.status === 'closed'||c.status === 'paused') ? 'Indisponible' : queueState.tickets.some((t)=>t.status==='waiting'&&queueStore.getTicketEstimate(t).estimatedMinutes===null) ? 'Indisponible' : waitingTicketsCount === 0 ? '< 1 min' : `~${Math.round(queueState.tickets.filter((t) => t.status === 'waiting').reduce((n,t) => n+(queueStore.getTicketEstimate(t).estimatedMinutes??0),0)/waitingTicketsCount)} min`}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. BOTTOM TV TICKER */}
      <footer className="bg-white border-t-2 border-slate-200 py-2.5 px-8 flex items-center justify-between text-xs sm:text-sm text-slate-700 font-bold shrink-0">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0055D4] animate-ping" />
          <span className="font-black text-slate-900">
            {config.brand.name} :
          </span>
          <span className="truncate">
            Bienvenue dans votre agence {agency?.name} • Horaires : {agency?.openingHours}
          </span>
        </div>
        <span className="font-mono text-slate-500 hidden sm:inline font-bold">
          {agency?.phone}
        </span>
      </footer>
    </div>
  );
};
