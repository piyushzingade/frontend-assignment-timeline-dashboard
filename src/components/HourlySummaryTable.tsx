import type { HourBucket } from '../types'
import { formatDurationMinutes, formatSeconds } from '../lib/time'

type Row = {
  label: string
  getValue: (bucket: HourBucket) => string | number | null
}

const rows: Row[] = [
  { label: 'Total', getValue: (bucket) => bucket.total },
  { label: 'Pass', getValue: (bucket) => bucket.pass },
  { label: 'Fail', getValue: (bucket) => bucket.fail },
  { label: 'Runtime', getValue: (bucket) => formatDurationMinutes(bucket.runtimeMinutes) },
  { label: 'Unplanned Production', getValue: (bucket) => formatDurationMinutes(bucket.unplannedProductionMinutes) },
  { label: 'Stoppage', getValue: (bucket) => formatDurationMinutes(bucket.stoppageMinutes) },
  { label: 'Unknown Downtime', getValue: (bucket) => formatDurationMinutes(bucket.unknownDowntimeMinutes) },
  { label: 'Ideal Cycle Time', getValue: (bucket) => formatSeconds(bucket.idealCycleSeconds) },
  { label: 'Actual Cycle Time', getValue: (bucket) => formatSeconds(bucket.actualCycleSeconds) },
]

export function HourlySummaryTable({ buckets }: { buckets: HourBucket[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">Hourly Production & Downtime Summary</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-800">
                Param
              </th>
              {buckets.map((bucket) => (
                <th className="border-b border-r border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-blue-900" key={bucket.key}>
                  {bucket.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="even:bg-slate-50/65" key={row.label}>
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-3 text-left font-medium text-slate-700">
                  {row.label}
                </th>
                {buckets.map((bucket) => {
                  const value = row.getValue(bucket)
                  return (
                    <td className="border-b border-r border-slate-200 px-4 py-3 text-center font-semibold text-slate-800" key={bucket.key}>
                      {value ?? ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
