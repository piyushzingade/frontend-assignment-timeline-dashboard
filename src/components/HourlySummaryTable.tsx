import type { HourBucket } from '../types'
import { formatDurationMinutes, formatSeconds } from '../lib/time'
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'

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
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">Hourly Production & Downtime Summary</h2>
      </div>
      <TableContainer>
        <Table className="min-w-[980px]" size="small">
          <TableHead>
            <TableRow>
              <TableCell className="sticky left-0 z-10 border-r border-slate-200 bg-white font-semibold text-slate-800">
                Param
              </TableCell>
              {buckets.map((bucket) => (
                <TableCell align="center" className="border-r border-slate-200 bg-slate-50 font-semibold text-blue-900" key={bucket.key}>
                  {bucket.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow className="even:bg-slate-50/65" key={row.label}>
                <TableCell component="th" scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-inherit font-medium text-slate-700">
                  {row.label}
                </TableCell>
                {buckets.map((bucket) => {
                  const value = row.getValue(bucket)
                  return (
                    <TableCell align="center" className="border-r border-slate-200 font-semibold text-slate-800" key={bucket.key}>
                      {value ?? ''}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
