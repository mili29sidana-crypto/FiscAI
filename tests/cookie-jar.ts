export type StoredCookie = { name: string; value: string };
 
class CookieJar {
  private cookies = new Map<string, string>();
 
  store() {
    return {
      get: (name: string): StoredCookie | undefined => {
        const value = this.cookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string, _options?: unknown) => {
        this.cookies.set(name, value);
      },
      delete: (name: string) => {
        this.cookies.delete(name);
      },
      getAll: () => [...this.cookies].map(([name, value]) => ({ name, value })),
    };
  }
 
  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
 
  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
 
  set(name: string, value: string): void {
    this.cookies.set(name, value);
  }
 
  clear(): void {
    this.cookies.clear();
  }
 
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }
 
  restore(snapshot: Record<string, string>): void {
    this.cookies = new Map(Object.entries(snapshot));
  }
}
 
export const cookieJar = new CookieJar();