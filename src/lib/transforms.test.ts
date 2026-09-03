import { describe, expect, it } from 'vitest'
import type { MachineIntervals, ShiftDefinition } from '../types'
import { buildShiftOptions, getShiftWindow } from './time'
import { buildHourBuckets, thinMarkers } from './transforms'

describe('shift windows', () => {
  it('converts an IST shift window to UTC and wraps midnight', () => {
    const shifts: ShiftDefinition[] = [
      {
        id: 'shift-1',
        code: 'main',
        name: 'main',
        is_active: true,
        shift_timings: ['00:30', '12:30'],
      },
    ]
    const option = buildShiftOptions(shifts)[1]
    const window = getShiftWindow('2026-06-23', option)

    expect(window.fromIso).toBe('2026-06-23T07:00:00.000Z')
    expect(window.toIso).toBe('2026-06-23T19:00:00.000Z')
  })
})

describe('hourly bucketing', () => {
  it('splits segment minutes across shift-hour boundaries', () => {
    const intervals: MachineIntervals = {
      machine_ids: [1],
      runtimes: [
        {
          start_at: '2026-06-23T07:03:00Z',
          end_at: '2026-06-23T08:15:00Z',
          type: 'planned',
        },
      ],
      downtimes: [
        {
          start_at: '2026-06-23T08:15:00Z',
          end_at: '2026-06-23T08:30:00Z',
          type: 'unknown',
        },
      ],
      stoppages: [],
      produce_counts: [
        {
          bucket_start: '2026-06-23T07:00:00Z',
          part_model_id: 'part-a',
          ok_count: 3,
          ng_count: 1,
        },
        {
          bucket_start: '2026-06-23T07:00:00Z',
          part_model_id: 'part-b',
          ok_count: 2,
          ng_count: 0,
        },
      ],
    }

    const buckets = buildHourBuckets(
      new Date('2026-06-23T07:00:00Z'),
      new Date('2026-06-23T09:00:00Z'),
      intervals,
      [{ bucket_start: '2026-06-23T07:00:00Z', ideal_cycle_time_seconds: 307, actual_cycle_time_seconds: null }],
      new Date('2026-06-23T10:00:00Z'),
    )

    expect(buckets[0].runtimeMinutes).toBe(57)
    expect(buckets[1].runtimeMinutes).toBe(15)
    expect(buckets[1].unknownDowntimeMinutes).toBe(15)
    expect(buckets[0].total).toBe(6)
    expect(buckets[0].pass).toBe(5)
    expect(buckets[0].fail).toBe(1)
    expect(buckets[0].idealCycleSeconds).toBe(307)
    expect(buckets[0].actualCycleSeconds).toBeNull()
  })

  it('keeps future buckets blank during in-progress shifts', () => {
    const intervals: MachineIntervals = {
      machine_ids: [1],
      runtimes: [],
      downtimes: [],
      stoppages: [],
      produce_counts: [],
    }

    const buckets = buildHourBuckets(
      new Date('2026-06-23T07:00:00Z'),
      new Date('2026-06-23T10:00:00Z'),
      intervals,
      [],
      new Date('2026-06-23T08:30:00Z'),
    )

    expect(buckets[0].total).toBe(0)
    expect(buckets[1].total).toBe(0)
    expect(buckets[2].total).toBeNull()
  })
})

describe('marker thinning', () => {
  it('never drops FAIL markers', () => {
    const markers = Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      timestamp: new Date(index),
      timeMs: index,
      sequence: index + 1,
      result: index % 10 === 0 ? 'FAIL' : 'PASS',
      produceType: 'FIRST',
      partModelId: 'part-a',
    }))

    const thinned = thinMarkers(markers, 10)

    expect(thinned.filter((marker) => marker.result === 'FAIL')).toHaveLength(10)
    expect(thinned.length).toBeLessThan(markers.length)
  })
})
