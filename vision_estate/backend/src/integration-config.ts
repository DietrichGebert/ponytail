/** Configuration presence only; provider availability still requires a real response. */
export function integrationConfigured(url?: string, key?: string) {
  if (!url || !key?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
