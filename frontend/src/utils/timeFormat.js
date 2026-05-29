/**
 * Central time-formatting utility.
 * Reads the user's clock-format preference (12 / 24 hour) from localStorage
 * so every component automatically reflects the Date & Time settings choice.
 */

function isHour12() {
  try {
    const saved = JSON.parse(localStorage.getItem('netsupportai-datetime') || '{}')
    return saved.clockFormat === '12'
  } catch {
    return false
  }
}

/** HH:MM  (or  hh:MM AM/PM) */
export function fmtTime(date, extra = {}) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: isHour12(), ...extra,
  })
}

/** HH:MM:SS  (or  hh:MM:SS AM/PM) */
export function fmtTimeWithSeconds(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: isHour12(),
  })
}

/** DD Mon YYYY, HH:MM:SS */
export function fmtDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: isHour12(),
  })
}

/** Mon DD, YYYY, HH:MM */
export function fmtDateTimeShort(date) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: isHour12(),
  })
}
