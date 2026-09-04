type FieldLabelProps = {
  children: React.ReactNode
  htmlFor?: string
  id?: string
}

// Small uppercase label rendered above an input, matching the
// reference filter bar (ASSET, DATE, SHIFT, ...).
export function FieldLabel({ children, htmlFor, id }: FieldLabelProps) {
  return (
    <label
      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
      htmlFor={htmlFor}
      id={id}
    >
      {children}
    </label>
  )
}
