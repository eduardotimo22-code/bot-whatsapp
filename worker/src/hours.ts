// Cancún is permanently UTC-5 (no DST since 2015)
export function getCancunTime(): Date {
  const now = new Date()
  return new Date(now.getTime() - 5 * 60 * 60 * 1000)
}

export function isBusinessOpen(): boolean {
  const ct = getCancunTime()
  const day = ct.getUTCDay() // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const timeMin = ct.getUTCHours() * 60 + ct.getUTCMinutes()

  if (day === 3) return false // Wednesday closed
  return timeMin >= 17 * 60 && timeMin <= 23 * 60 + 40 // 5:00PM–11:40PM
}

export function getCancunDateStr(): string {
  return getCancunTime().toISOString().slice(0, 10)
}
