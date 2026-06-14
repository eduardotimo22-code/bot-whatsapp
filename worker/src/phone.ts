// Utilidades de teléfono compartidas. El ID de conversación es el número
// normalizado (sin '+').

export function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}

// Compara dos teléfonos por sus últimos 10 dígitos (número nacional MX), ignorando
// prefijos de país (52 / 521) y cualquier formato. Evita los falsos positivos de
// endsWith con sufijos cortos: dos números distintos rara vez comparten 10 dígitos.
export function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '').slice(-10)
  const db = b.replace(/\D/g, '').slice(-10)
  return da.length === 10 && da === db
}

export function phoneInList(phone: string, list: string[]): boolean {
  return list.some((n) => samePhone(phone, n))
}

// Convierte una fecha de SQLite ("YYYY-MM-DD HH:MM:SS", UTC) en un timestamp ms.
// SQLite usa espacio en vez de 'T'; sin la 'T' el parseo no es ISO estricto y es
// frágil entre motores, así que normalizamos antes de construir el Date.
export function parseDbDateMs(s: string): number {
  return new Date(s.replace(' ', 'T') + 'Z').getTime()
}
