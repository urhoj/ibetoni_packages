/**
 * Europe/Helsinki wall-clock parsing.
 *
 * Ecofleet emits timestamps two ways: `at` as "YYYY-MM-DD HH:mm:ss+HHMM" and
 * `lastEngineOnTime` as an OFFSET-LESS "YYYY-MM-DD HH:mm:ss" that is Helsinki
 * wall clock. `new Date(offsetless)` / `Date.parse` read that as the process
 * zone (UTC on Azure, the browser zone on a laptop), which is how the cron stored
 * +3 h and /kartta computed engine-off durations from the wrong instant
 * (/kentta spec 5.5 P3). This is the ONE parser both sides use.
 */
const HELSINKI_TZ = "Europe/Helsinki";
const RAW_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s*(Z|[+-]\d{2}:?\d{2})?$/;

let dtf = null;
function partsAt(utcMs) {
  dtf ??= new Intl.DateTimeFormat("en-US", {
    timeZone: HELSINKI_TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const out = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) out[p.type] = p.value;
  return out;
}

/** Helsinki UTC offset in minutes at a UTC instant (+120 winter, +180 summer). */
function helsinkiOffsetMinutes(utcMs) {
  const p = partsAt(utcMs);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * @param {string|null|undefined} str
 * @returns {Date|null}
 */
function parseHelsinkiLocal(str) {
  if (str == null) return null;
  const m = RAW_RE.exec(String(str).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms, off] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms ? +ms.padEnd(3, "0") : 0);
  if (Number.isNaN(wall)) return null;
  // Date.UTC normalises 13/40/99 silently; reject anything that moved.
  const back = new Date(wall);
  if (back.getUTCMonth() !== +mo - 1 || back.getUTCDate() !== +d || back.getUTCHours() !== +h || back.getUTCMinutes() !== +mi) return null;
  if (off) {
    if (off === "Z") return back;
    const sign = off[0] === "-" ? -1 : 1;
    const digits = off.slice(1).replace(":", "");
    const offMin = sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4));
    return new Date(wall - offMin * 60000);
  }
  // Offset-less = Helsinki wall clock. Two passes: the offset at the wall time
  // read as UTC is a first guess; re-evaluating at the guessed instant fixes the
  // hour around a DST switch. Inside the spring gap the second pass settles on a
  // real instant instead of throwing.
  let guess = wall - helsinkiOffsetMinutes(wall) * 60000;
  guess = wall - helsinkiOffsetMinutes(guess) * 60000;
  return new Date(guess);
}

module.exports = { parseHelsinkiLocal, helsinkiOffsetMinutes };
