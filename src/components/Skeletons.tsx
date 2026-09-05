import { Paper, Skeleton } from '@mui/material'

// 1:1 placeholders that mirror the real cards — same outer padding,
// same row order, same heights — so loading swaps in without layout shift.

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

const CHART_LEGEND_WIDTHS = ['w-20', 'w-32', 'w-28', 'w-20']
const CHART_X_TICKS = 7

export function ChartSkeleton() {
  return (
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-hidden>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton animation="wave" className="w-40" height={22} />
          <Skeleton animation="wave" className="mt-1 w-56" height={18} />
        </div>
        <div className="flex flex-wrap gap-3">
          {CHART_LEGEND_WIDTHS.map((width, index) => (
            <span className="inline-flex items-center gap-1.5" key={index}>
              <Skeleton animation="wave" className="h-3 w-3" variant="rounded" />
              <Skeleton animation="wave" className={width} height={14} />
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-5">
        <Skeleton animation="wave" className="w-32" height={20} variant="rounded" />
        <Skeleton animation="wave" className="w-48" height={20} variant="rounded" />
      </div>

      {/* Graph area: same h-[390px] bordered canvas, with a y-axis gutter,
          a plot rect, x ticks, and the "Shift time" caption in real positions. */}
      <div className="flex h-[390px] w-full flex-col rounded-md border border-slate-200 bg-slate-50/60 p-3">
        <Skeleton animation="wave" className="ml-11 w-36" height={12} />
        <div className="mt-2 flex min-h-0 flex-1 gap-0">
          <div className="flex w-11 flex-col items-end justify-between py-1 pr-2">
            <Skeleton animation="wave" className="w-7" height={11} />
            <Skeleton animation="wave" className="w-7" height={11} />
            <Skeleton animation="wave" className="w-4" height={11} />
          </div>
          <Skeleton animation="wave" className="min-h-0 flex-1" variant="rounded" />
        </div>
        <div className="ml-11 mt-2 flex items-center justify-between">
          {Array.from({ length: CHART_X_TICKS }).map((_, index) => (
            <Skeleton animation="wave" className="w-10" height={12} key={index} />
          ))}
        </div>
        <Skeleton animation="wave" className="mx-auto mt-1 w-16" height={12} />
      </div>

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

const TABLE_HOUR_COLUMNS = 11
const TABLE_BODY_ROWS = 9

export function TableSkeleton() {
  return (
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-hidden>
      <div className="border-b border-slate-200 p-4">
        <Skeleton animation="wave" className="w-72" height={22} />
      </div>
      {/* Table grid: sticky param column + one column per hour, header row
          plus one row per metric — the same shape as the real summary table. */}
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div
            className="grid gap-px bg-slate-200"
            style={{ gridTemplateColumns: `160px repeat(${TABLE_HOUR_COLUMNS}, minmax(0, 1fr))` }}
          >
            <div className="bg-slate-50 px-3 py-2">
              <Skeleton animation="wave" className="w-14" height={16} />
            </div>
            {Array.from({ length: TABLE_HOUR_COLUMNS }).map((_, index) => (
              <div className="bg-slate-50 px-2 py-2" key={index}>
                <Skeleton animation="wave" className="mx-auto w-20" height={16} />
              </div>
            ))}
            {Array.from({ length: TABLE_BODY_ROWS }).map((_, row) => (
              <div className="contents" key={row}>
                <div className="bg-white px-3 py-2">
                  <Skeleton animation="wave" className="w-24" height={14} />
                </div>
                {Array.from({ length: TABLE_HOUR_COLUMNS }).map((_, column) => (
                  <div className="bg-white px-2 py-2" key={column}>
                    <Skeleton animation="wave" className="mx-auto w-12" height={14} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Paper>
  )
}
