import React from 'react';

export function ParallelServiceNote({peopleAhead, estimatedMinutes, requiresPresence = false}: {peopleAhead: number; estimatedMinutes: number | null; requiresPresence?: boolean}) {
  if (peopleAhead <= 0 || estimatedMinutes !== 0) return null;
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-blue-700" role="note">
      {requiresPresence ? 'Après validation de votre présence, un guichet peut vous appeler en parallèle des tickets avant vous.' : 'Un guichet peut vous appeler immédiatement, en parallèle des tickets avant vous.'}
    </p>
  );
}
