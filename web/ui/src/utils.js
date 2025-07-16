const format = v => Math.floor(v).toString().padStart(2, '0')
export function formatTime(value) {
    if (!value || !Number.isFinite(value)) return ''
    return `${format(value / 3600000)}:${format(value / 60000 % 60)}:${format(value / 1000 % 60)}.${Math.floor(value % 1000).toString().padStart(3, '0')}`
}
export function parseTime(value) {
  const parts = value.split(/[:.]/).map(parseFloat)
  let time = 0;
  let mul = 60;
  while(parts.length) {
    time = time * mul + parts.shift()
    if (parts.length === 1) mul = 1000
  }
  return time
}
export function formatDuree(value) {
    if (!value) return ''
    let s = `.${Math.floor(value % 1000).toString().padStart(3, '0')}`
    value = Math.floor(value / 1000)
    while (value) {
        s = `:${format(value % 60)}${s}`
        value = Math.floor(value / 60)
    }
    s = s.replace(/^:0*/, '')
    if (s[0] === '.') return `0${s}`
    return s
}
export function rankValue (equipe) {
    return -((equipe.tours || 0) + equipe.penalite) * 100 * 3600 * 1000 + (equipe.temps || 0)
}
