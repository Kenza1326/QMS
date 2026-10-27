export type AppMode = 'hub' | 'screen' | 'kiosk' | 'client' | 'admin';

export function resolveAppRoute(search = ''): {mode: AppMode; adminSubView: 'counter' | 'dashboard'} {
  const params = new URLSearchParams(search);
  const requested = params.get('mode');
  const mode: AppMode = requested === 'dashboard' ? 'admin'
    : requested && ['hub', 'screen', 'kiosk', 'client', 'admin'].includes(requested)
      ? requested as AppMode : 'client';
  const view = params.get('view');
  const adminSubView = view === 'dashboard' || view === 'counter' ? view
    : requested === 'dashboard' ? 'dashboard' : 'counter';
  return {mode, adminSubView};
}
