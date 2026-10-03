import { hashString } from './shuffle';

// Only a hash of the PIN ships in the bundle, so it can't be read straight out of the page source.
// (Client-side check — it keeps the audience out of host controls, it is not real security.)
const PIN_HASH = 3557901315;
const AUTH_KEY = 'PARIVAR_ADMIN_AUTH_V3';

export const checkPin = (pin: string) => hashString('parivar-feud-host:' + pin.trim().toLowerCase()) === PIN_HASH;

/** True on a device where the host has unlocked the Admin panel (also unlocks Stage host controls). */
export function isAdminDevice() {
  try {
    return localStorage.getItem(AUTH_KEY) === String(PIN_HASH);
  } catch {
    return false;
  }
}

export function setAdminDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(AUTH_KEY, String(PIN_HASH));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* private mode — stays unlocked for this page only */
  }
}
