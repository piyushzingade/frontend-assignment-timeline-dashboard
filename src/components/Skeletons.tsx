import { Paper, Skeleton } from '@mui/material'

// 1:1 placeholders that mirror the real cards so loading feels premium.
// Each skeleton matches the size and spacing of the section it replaces.

function FieldSkeleton({ boxClassName, labelWidth }: { boxClassName: string; labelWidth: string }) {
  return (
    <div>
      <Skeleton animation="wave" className={labelWidth} height={14} />
      <Skeleton animation="wave" className={boxClassName} height={40} variant="rounded" />
    </div>
  )
}

export function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-hidden>
      <FieldSkeleton boxClassName="w-36" labelWidth="w-20" />
      <FieldSkeleton boxClassName="w-56" labelWidth="w-12" />
      <FieldSkeleton boxClassName="w-48" labelWidth="w-32" />
      <FieldSkeleton boxClassName="w-36" labelWidth="w-10" />
      <FieldSkeleton boxClassName="w-56" labelWidth="w-12" />
      <Skeleton animation="wave" className="w-28" height={40} variant="rounded" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-hidden>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton animation="wave" className="w-40" height={22} />
          <Skeleton animation="wave" className="mt-1 w-56" height={18} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton animation="wave" className="w-24" height={16} />
          <Skeleton animation="wave" className="w-32" height={16} />
          <Skeleton animation="wave" className="w-28" height={16} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-5">
        <Skeleton animation="wave" className="w-32" height={20} variant="rounded" />
        <Skeleton animation="wave" className="w-48" height={20} variant="rounded" />
      </div>

      <Skeleton animation="wave" className="h-[390px] w-full" variant="rounded" />

      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton animation="wave" className="w-80" height={26} variant="rounded" />
        <Skeleton animation="wave" className="w-96" height={26} variant="rounded" />
      </div>

      <div className="mt-2 flex flex-col items-start gap-2">
        <Skeleton animation="wave" className="w-72" height={26} variant="rounded" />
        <Skeleton animation="wave" className="w-64" height={26} variant="rounded" />
      </div>
    </Paper>
  )
}

export function TableSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-hidden>
      <div className="border-b border-slate-200 p-4">
        <Skeleton animation="wave" className="w-72" height={22} />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: rows + 1 }).map((_, index) => (
          <Skeleton
            animation="wave"
            className="w-full"
            height={index === 0 ? 34 : 30}
            key={index}
            variant="rounded"
          />
        ))}
      </div>
    </Paper>
  )
}
