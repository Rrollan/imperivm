const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

/** Next can normalize a loopback request URL to localhost. Keep the browser's exact local host. */
export function multiplayerOrigin(requestUrl: string, host: string | null, configured?: string): string {
  if (configured) return configured;
  const canonical = new URL(requestUrl);
  if (loopback(canonical.hostname) && host) {
    try {
      const local = new URL(`${canonical.protocol}//${host}`);
      if (loopback(local.hostname) && local.port === canonical.port && !local.username && !local.password && local.pathname === '/' && !local.search && !local.hash) return local.origin;
    } catch { /* A malformed Host never expands the trusted origin. */ }
  }
  return canonical.origin;
}
