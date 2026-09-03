import { addDays, addHours, format } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { ShiftDefinition, ShiftOption } from '../types'

export const IST_ZONE = 'Asia/Kolkata'

export function buildShiftOptions(shifts: ShiftDefinition[]): ShiftOption[] {
  return shifts
    .filter((shift) => shift.is_active && shift.shift_timings.length > 0)
    .flatMap((shift) => {
      const timings = shift.shift_timings.filter(isValidTime).toSorted()
      return timings.map((startTime, index) => {
        const endTime = timings[(index + 1) % timings.length]
        return {
          key: `${shift.id}:${index}`,
          shiftId: shift.id,
          shiftName: shift.name || shift.code,
          startTime,
          endTime,
          label: `${shift.name || shift.code} (${startTime} - ${endTime})`,
        }
      })
    })
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function getShiftWindow(date: string, option: ShiftOption) {
  const from = fromZonedTime(`${date}T${option.startTime}:00`, IST_ZONE)
  const endDate = option.endTime <= option.startTime ? format(addDays(`${date}T00:00:00`, 1), 'yyyy-MM-dd') : date
  const to = fromZonedTime(`${endDate}T${option.endTime}:00`, IST_ZONE)

  return { from, to, fromIso: from.toISOString(), toIso: to.toISOString() }
}

export function formatIst(date: Date | string, pattern = 'dd MMM, HH:mm:ss') {
  return formatInTimeZone(date, IST_ZONE, pattern)
}

export function formatDurationMinutes(minutes: number | null) {
  if (minutes === null) return ''
  if (minutes === 0) return '0 mins'
  const rounded = Math.round(minutes * 10) / 10
  return Number.isInteger(rounded) ? `${rounded} mins` : `${rounded.toFixed(1)} mins`
}

export function formatSeconds(seconds: number | null) {
  if (seconds === null) return ''
  if (seconds === 0) return '0 secs'
  const rounded = Math.round(seconds * 10) / 10
  return Number.isInteger(rounded) ? `${rounded} secs` : `${rounded.toFixed(1)} secs`
}

export function makeHourBoundaries(from: Date, to: Date) {
  const boundaries: Date[] = [from]
  let cursor = addHours(from, 1)
  while (cursor < to) {
    boundaries.push(cursor)
    cursor = addHours(cursor, 1)
  }
  boundaries.push(to)
  return boundaries
}

export function hourKey(date: Date | string) {
  return formatInTimeZone(date, IST_ZONE, "yyyy-MM-dd'T'HH:mm")
}
