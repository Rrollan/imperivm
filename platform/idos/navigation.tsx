import React, {useSyncExternalStore} from 'react';

// Static iDos hosting serves a single entry. Hash routes keep deep links and
// query parameters without relying on Next server endpoints or rewrite rules.
function subscribe(listener: () => void) {window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener);}
function current() {return window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/';}
export function usePathname() {return useSyncExternalStore(subscribe, current, () => '/').split('?')[0].split('#')[0];}
export function useSearchParams() {const route = useSyncExternalStore(subscribe, current, () => '/'); return new URLSearchParams(route.split('?')[1]?.split('#')[0] ?? '');}
function navigate(href: string, replace = false) {
  if (!href.startsWith('/')) {window.location.assign(href); return;}
  if (replace) {history.replaceState(null, '', `#${href}`); window.dispatchEvent(new HashChangeEvent('hashchange'));}
  else window.location.hash = href;
  window.scrollTo(0, 0);
}
export function useRouter() {return {push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), back: () => history.back(), refresh: () => window.location.reload(), prefetch: async () => {}};}
type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean};
export default function Link({href, prefetch, replace, scroll, onClick, ...props}: LinkProps) {
  return <a {...props} href={href.startsWith('/') ? `#${href}` : href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target || !href.startsWith('/')) return;
    event.preventDefault(); navigate(href, replace);
  }}/>;
}
