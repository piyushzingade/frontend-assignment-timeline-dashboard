import { describe, expect, it } from 'vitest'
import type { MachineIntervals, ShiftDefinition } from '../types'
import { buildShiftOptions, getShiftWindow } from './time'
import { buildHourBuckets, normalizeSegments, thinMarkers } from './transforms'

describe('shift windows', () => {
  it('builds sorted shift options from more than two starts', () => {
    const shifts: ShiftDefinition[] = [
      {
        id: 'shift-1',
        code: 'main',
        name: 'main',
        is_active: true,
        shift_timings: ['16:00', '00:00', '08:00'],
      },
    ]

    expect(buildShiftOptions(shifts).map((option) => `${option.startTime}-${option.endTime}`)).toEqual([
      '00:00-08:00',
      '08:00-16:00',
      '16:00-00:00',
    ])
  })

  it('ignores invalid shift timings', () => {
    const shifts: ShiftDefinition[] = [
      {
        id: 'shift-1',
        code: 'main',
        name: 'main',
        is_active: true,
        shift_timings: ['08:00', '25:00'],
      },
    ]

    const options = buildShiftOptions(shifts)
    expect(options).toHaveLength(1)
    expect(options[0].startTime).toBe('08:00')
    expect(options[0].endTime).toBe('08:00')
  })

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
      normalizeSegments(intervals),
      intervals.produce_counts,
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

  it('matches cycle-time buckets by their IST hour and preserves nulls', () => {
    const intervals: MachineIntervals = {
      machine_ids: [1],
      runtimes: [],
      downtimes: [],
      stoppages: [],
      produce_counts: [],
    }

    const buckets = buildHourBuckets(
      new Date('2026-06-23T07:00:00Z'),
      new Date('2026-06-23T08:00:00Z'),
      normalizeSegments(intervals),
      intervals.produce_counts,
      [{ bucket_start: '2026-06-23T07:00:00Z', ideal_cycle_time_seconds: null, actual_cycle_time_seconds: 412.5 }],
      new Date('2026-06-23T09:00:00Z'),
    )

    expect(buckets[0].idealCycleSeconds).toBeNull()
    expect(buckets[0].actualCycleSeconds).toBe(412.5)
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
      normalizeSegments(intervals),
      intervals.produce_counts,
      [],
      new Date('2026-06-23T08:30:00Z'),
    )

    expect(buckets[0].total).toBe(0)
    expect(buckets[1].total).toBe(0)
    expect(buckets[2].total).toBeNull()
  })
})

describe('segment normalization', () => {
  it('drops invalid intervals and clamps segments to the selected window', () => {
    const intervals: MachineIntervals = {
      machine_ids: [1],
      runtimes: [
        { start_at: 'bad', end_at: '2026-06-23T08:00:00Z', type: 'planned' },
        { start_at: '2026-06-23T07:30:00Z', end_at: '2026-06-23T07:30:00Z', type: 'planned' },
        { start_at: '2026-06-23T06:30:00Z', end_at: '2026-06-23T07:30:00Z', type: 'planned' },
      ],
      downtimes: [],
      stoppages: [],
      produce_counts: [],
    }

    const segments = normalizeSegments(intervals, new Date('2026-06-23T07:00:00Z'), new Date('2026-06-23T08:00:00Z'))

    expect(segments).toHaveLength(1)
    expect(segments[0].startMs).toBe(Date.parse('2026-06-23T07:00:00Z'))
    expect(segments[0].endMs).toBe(Date.parse('2026-06-23T07:30:00Z'))
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

describe('exact produces', () => {
  it('flattens and sorts unsorted produce buckets', async () => {
    const { flattenProduces } = await import('./transforms')
    const markers = flattenProduces([
      {
        bucket_start: '2026-06-23T07:00:00Z',
        part_model_id: 'part-a',
        produces: [
          {
            produce_id: 'late',
            first_seen_ts: '2026-06-23T07:02:00Z',
            result: 'PASS',
            produce_type: 'FIRST',
            part_model_id: 'part-a',
          },
          {
            produce_id: 'early',
            first_seen_ts: '2026-06-23T07:01:00Z',
            result: 'FAIL',
            produce_type: 'FIRST',
            part_model_id: 'part-a',
          },
        ],
      },
    ])

    expect(markers.map((marker) => marker.id)).toEqual(['early', 'late'])
    expect(markers.map((marker) => marker.sequence)).toEqual([1, 2])
  })
})
