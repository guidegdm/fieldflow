"use client"

import type { WorkflowField } from "@/types/workflow"
import { formatFieldValue, fieldLabel } from "@/lib/workflows/runtime"

type Props = {
  field: WorkflowField
  value: unknown
  onChange?: (value: unknown) => void
  error?: string
  language?: string
  readOnly?: boolean
}

export function FieldRenderer({ field, value, onChange, error, language, readOnly }: Props) {
  const label = fieldLabel(field, language)
  if (readOnly) {
    return (
      <div className="grid gap-1 rounded-md border border-graph-line bg-white px-3 py-2 sm:grid-cols-[12rem_1fr] sm:items-baseline">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-pencil">{label}</span>
        <span className="min-w-0 text-sm text-ink-black">{formatFieldValue(value, field)}</span>
      </div>
    )
  }

  const common = {
    id: field.key,
    name: field.key,
    "aria-invalid": Boolean(error),
    className: "h-11 w-full rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue",
  }

  return (
    <div className="min-w-0">
      <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-pencil">
        {label}
        {field.required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          {...common}
          className={`${common.className} min-h-24 resize-y`}
          value={String(value ?? "")}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select {...common} value={String(value ?? "")} onChange={(event) => onChange?.(event.target.value)}>
          <option value="">-</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : field.type === "multi-select" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) && value.includes(option.value)
            return (
              <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-md border border-graph-line bg-white px-3 text-sm text-ink-black">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = Array.isArray(value) ? value.map(String) : []
                    onChange?.(selected ? current.filter((item) => item !== option.value) : [...current, option.value])
                  }}
                  className="h-4 w-4 accent-ink-blue"
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      ) : field.type === "number" && field.validation?.min !== undefined && field.validation?.max !== undefined && field.validation.max <= 10 ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            id={field.key}
            min={field.validation.min}
            max={field.validation.max}
            value={Number(value ?? field.validation.min)}
            onChange={(event) => onChange?.(Number(event.target.value))}
            className="h-11 flex-1 accent-ink-blue"
          />
          <span className="min-w-12 rounded-md border border-graph-line bg-kivu-paper px-2 py-1 text-center text-sm font-mono text-ink-black">
            {String(value ?? field.validation.min)}
          </span>
        </div>
      ) : field.type === "gps" || field.type === "photo" ? (
        <input
          {...common}
          value="Coming soon"
          disabled
          className={`${common.className} bg-graph-paper text-pencil`}
        />
      ) : (
        <input
          {...common}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          min={field.validation?.min}
          max={field.validation?.max}
          value={String(value ?? "")}
          onChange={(event) => onChange?.(field.type === "number" ? Number(event.target.value) : event.target.value)}
        />
      )}

      {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
    </div>
  )
}
