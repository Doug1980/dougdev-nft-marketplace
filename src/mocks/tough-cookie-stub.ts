/**
 * Minimal replacement for `tough-cookie`, aliased in vite.config.ts.
 *
 * MSW imports tough-cookie (plus its public-suffix list, ~260 KB) only to emulate a cookie jar for
 * mocked `Set-Cookie` responses. This app authenticates with a Bearer token and none of its handlers
 * read or set cookies, so the jar is always empty. The stub keeps MSW's cookie code working
 * (no cookies stored, none returned) and removes that weight from the startup path.
 */
export class Cookie {
  key = ''
  value = ''
  static fromJSON(): Cookie | null {
    return null
  }
}

export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}

export class CookieJar {
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}
