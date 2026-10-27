/**
 * Utility to construct public LAN / accessible URLs for QR codes
 * Avoids 'localhost' which fails when scanned by mobile phones
 */

export const DEFAULT_LAN_IP = '192.168.0.111';
export const DEFAULT_PORT = '3000';

export function getPublicUrl(pathOrQuery: string = ''): string {
  if (typeof window === 'undefined') {
    return `http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}${pathOrQuery}`;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  const lanIp = (typeof localStorage !== 'undefined' && localStorage.getItem('custom_lan_ip')) || DEFAULT_LAN_IP;
  const port = window.location.port ? `:${window.location.port}` : (isLocalhost ? `:${DEFAULT_PORT}` : '');
  const protocol = window.location.protocol;
  const host = isLocalhost ? `${lanIp}${port}` : window.location.host;
  const pathname = window.location.pathname.replace(/\/$/, '');

  const normalizedQuery = pathOrQuery.startsWith('?') || pathOrQuery.startsWith('/')
    ? pathOrQuery
    : `/${pathOrQuery}`;

  const url = new URL(`${protocol}//${host}${pathname}${normalizedQuery}`);
  const agency = new URLSearchParams(window.location.search).get('agency') || sessionStorage.getItem('queue_agency');
  if (agency) url.searchParams.set('agency', agency);
  return url.toString();
}
