const format = v => Math.floor(v).toString().padStart(2, '0')
export function formatTime(value) {
    if (!value) return ''
    return `${format(value / 3600000)}:${format(value / 60000 % 60)}:${format(value / 1000 % 60)}.${(value % 1000).toString().padStart(3, '0')}`
}
