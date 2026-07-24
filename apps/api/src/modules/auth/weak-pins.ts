/**
 * Weak-PIN blocklist (feature 0010 §7.3). A 6-digit PIN space is radically
 * non-uniform — a handful of choices (`123456`, `000000`, birth years, keypad
 * runs, repeated pairs) cover a wildly disproportionate share of real picks, so
 * `PIN_MAX_ATTEMPTS` tries against them is far more than a `1/1e6` gamble. We
 * reject the structurally-guessable classes outright, mirrored byte-for-byte on
 * the client (UX §12.5) so the rejection is instant there and authoritative
 * here. Membership is checked in constant algorithmic shape (no early-return
 * timing signal that matters — a rejected PIN is never stored, and the caller
 * maps every rejection to one uniform error).
 *
 * The classes:
 *   - all-same digit                (`000000`, `111111`, …)
 *   - a strict ascending run        (`123456`, `234567`, …, with wrap `567890`)
 *   - a strict descending run       (`654321`, `987654`, …, with wrap `210987`)
 *   - a repeated 1-digit unit       (covered by all-same)
 *   - a repeated 2-digit unit       (`121212`, `454545`, …)
 *   - a repeated 3-digit unit       (`123123`, `456456`, …)
 *   - a plausible date/year pattern (`19xx`/`20xx` prefixes, `DDMMYY`-ish)
 *   - an explicit hot-list of the most common leaked 6-digit PINs
 */

/** The most common leaked / trivially-guessed 6-digit PINs (curated hot-list). */
const COMMON_PINS = new Set<string>([
  '123456',
  '654321',
  '111111',
  '000000',
  '123123',
  '666666',
  '121212',
  '112233',
  '789456',
  '159753',
  '696969',
  '159357',
  '147258',
  '987654',
  '456789',
  '852456',
  '999999',
  '888888',
  '777777',
  '555555',
  '444444',
  '333333',
  '222222',
  '101010',
  '202020',
  '123321',
  '456654',
  '789987',
  '147852',
  '258456',
  '369369',
  '142536',
  '135790',
  '246810',
  '012345',
  '543210',
  '098765',
  '212121',
  '131313',
  '141414',
  '151515',
  '161616',
  '171717',
  '181818',
  '191919',
  '232323',
  '343434',
  '454545',
  '565656',
  '676767',
  '787878',
  '898989',
  '100000',
  '110011',
  '100100',
  '123654',
  '321321',
  '112211',
  '221100',
  '520520',
  '110110',
  '011011',
]);

/** All digits identical: `000000` … `999999`. */
function isAllSame(pin: string): boolean {
  return /^(\d)\1+$/.test(pin);
}

/** A strict ascending run mod 10 (…8,9,0,1…): each digit = prev + 1 (mod 10). */
function isAscendingRun(pin: string): boolean {
  for (let i = 1; i < pin.length; i += 1) {
    if ((Number(pin[i - 1]) + 1) % 10 !== Number(pin[i])) {
      return false;
    }
  }
  return true;
}

/** A strict descending run mod 10 (…1,0,9,8…): each digit = prev − 1 (mod 10). */
function isDescendingRun(pin: string): boolean {
  for (let i = 1; i < pin.length; i += 1) {
    if ((Number(pin[i - 1]) + 9) % 10 !== Number(pin[i])) {
      return false;
    }
  }
  return true;
}

/**
 * A short unit repeated to fill the PIN: unit length 1, 2 or 3 (`aa…`, `abab…`,
 * `abcabc…`). Length-1 is all-same; 2 and 3 catch `121212` / `123123` families.
 */
function isRepeatedUnit(pin: string): boolean {
  for (const unit of [1, 2, 3]) {
    if (pin.length % unit !== 0) {
      continue;
    }
    const head = pin.slice(0, unit);
    if (pin.match(new RegExp(`^(?:${head}){${pin.length / unit}}$`))) {
      return true;
    }
  }
  return false;
}

/**
 * A plausible birth-year / date pattern for a 6-digit PIN:
 *   - `19xx` or `20xx` anywhere as a 4-digit year prefix/suffix (`1990dd`, `dd1990`)
 *   - a full `DDMMYY` / `MMDDYY` shape (valid day/month) — a common date PIN.
 * These are heavily over-represented and offline-enumerable, so we exclude them.
 */
function isDatePattern(pin: string): boolean {
  if (pin.length !== 6) {
    // Year heuristics below assume a 6-digit PIN; other lengths fall through.
    return false;
  }
  // A 19xx / 20xx four-digit year sitting at the front or the back.
  const yearAtStart = /^(19|20)\d{2}/.test(pin);
  const yearAtEnd = /(19|20)\d{2}$/.test(pin);
  if (yearAtStart || yearAtEnd) {
    return true;
  }
  // DDMMYY: day 01–31, month 01–12.
  const dd = Number(pin.slice(0, 2));
  const mm = Number(pin.slice(2, 4));
  if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
    return true;
  }
  // MMDDYY: month 01–12, day 01–31.
  const mm2 = Number(pin.slice(0, 2));
  const dd2 = Number(pin.slice(2, 4));
  if (mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31) {
    return true;
  }
  return false;
}

/**
 * True when `pin` is structurally weak and MUST be rejected at set-time (§7.3).
 * Assumes a numeric string; non-digit input is treated as weak (it is never a
 * valid PIN). Callers still enforce length separately.
 */
export function isWeakPin(pin: string): boolean {
  if (!/^\d+$/.test(pin)) {
    return true;
  }
  return (
    COMMON_PINS.has(pin) ||
    isAllSame(pin) ||
    isAscendingRun(pin) ||
    isDescendingRun(pin) ||
    isRepeatedUnit(pin) ||
    isDatePattern(pin)
  );
}
