"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"
import { useAgentStore } from "@/stores/agentStore"
import type { WorkflowTransition, WorkflowState } from "@/types/workflow"

const STATE_COLORS: Record<string, string> = {
  brouillon: "#6B7280",
  soumis: "#D97706",
  verifie: "#2563EB",
  approuve: "#16A34A",
  reserve: "#C17A4E",
  distribue: "#059669",
  confirme: "#1B4F72",
}

export function WorkflowFlow() {
  const { i18n } = useTranslation()
  const { workflow, selectedStateId } = useWorkflowStore()
  const proposals = useAgentStore((s) => s.proposals)

  const svgArrows = useMemo(() => {
    if (!workflow) return []
    return workflow.transitions
      .map((tr) => {
        const from = workflow.states.find((s) => s.id === tr.fromState)
        const to = workflow.states.find((s) => s.id === tr.toState)
        if (!from || !to) return null
        return { transition: tr, from, to }
      })
      .filter(Boolean) as {
      transition: WorkflowTransition
      from: WorkflowState
      to: WorkflowState
    }[]
  }, [workflow])

  if (!workflow) return null

  const stateColor = (key: string) => STATE_COLORS[key] ?? "#6B7280"
  const english = (i18n.resolvedLanguage || i18n.language)?.startsWith("en")

  // Resolve state position (check real + ghost states)
  const getStatePos = (stateKey: string) => {
    const real = workflow.states.find((s) => s.id === stateKey)
    if (real) return { x: real.x + 80, y: real.y + 28 }
    const ghost = proposals?.states.find(
      (s) => s.state.key === stateKey || s.state.id === stateKey
    )
    if (ghost) return { x: ghost.state.x + 80, y: ghost.state.y + 28 }
    return null
  }

  return (
    <div className="flex-1 relative bg-kivu-paper overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {svgArrows.map(({ transition, from, to }) => {
          const hw = 80
          const hh = 28
          const fcx = from.x + hw
          const fcy = from.y + hh
          const tcx = to.x + hw
          const tcy = to.y + hh
          const dx = tcx - fcx
          const dy = tcy - fcy
          const edge = (cx: number, cy: number, sx: number, sy: number) => {
            if (sx === 0 && sy === 0) return { x: cx, y: cy }
            const scale = 1 / Math.max(Math.abs(sx) / hw, Math.abs(sy) / hh)
            return { x: cx + sx * scale, y: cy + sy * scale }
          }
          const start = edge(fcx, fcy, dx, dy)
          const end = edge(tcx, tcy, -dx, -dy)
          return (
            <line
              key={transition.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#708090"
              strokeWidth="2"
              strokeDasharray={transition.requiredRoles.length ? "0" : "6,3"}
              markerEnd="url(#arrowhead-flow)"
            />
          )
        })}

        {/* Ghost transitions */}
        {proposals?.transitions.map((pt) => {
          const fromPos = getStatePos(pt.transition.fromState)
          const toPos = getStatePos(pt.transition.toState)
          if (!fromPos || !toPos) return null
          return (
            <line
              key={`ghost-${pt.id}`}
              x1={fromPos.x}
              y1={fromPos.y}
              x2={toPos.x}
              y2={toPos.y}
              stroke="#708090"
              strokeWidth="1.5"
              strokeDasharray="8,6"
              opacity={0.5}
            />
          )
        })}

        <defs>
          <marker id="arrowhead-flow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#708090" />
          </marker>
        </defs>
      </svg>

      {workflow.states.map((state) => (
        <div
          key={state.id}
          onClick={() => useWorkflowStore.setState({ selectedStateId: state.id })}
          className={`absolute flex items-center justify-center w-40 h-14 rounded-md border-2 cursor-pointer transition-shadow text-sm font-medium ${
            selectedStateId === state.id ? "shadow-lg ring-2 ring-clay" : "shadow-sm"
          }`}
          style={{
            left: state.x,
            top: state.y,
            backgroundColor: stateColor(state.key) + "15",
            borderColor: stateColor(state.key),
            color: stateColor(state.key),
          }}
        >
          {english ? state.labelEn || state.label : state.label}
        </div>
      ))}

      {/* Ghost state nodes */}
      {proposals?.states.map((ps) => (
        <div
          key={`ghost-state-${ps.id}`}
          className="absolute flex items-center justify-center w-40 h-14 rounded-md border-2 border-dashed cursor-help group"
          style={{
            left: ps.state.x,
            top: ps.state.y,
            borderColor: stateColor(ps.state.key) + "60",
            backgroundColor: stateColor(ps.state.key) + "08",
            color: stateColor(ps.state.key) + "60",
          }}
          title="AI Proposal"
        >
          <span className="text-xs opacity-70">
            {english ? ps.state.labelEn || ps.state.label : ps.state.label}
          </span>
          <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                useAgentStore.getState().applyProposal("state", ps.id)
              }}
              className="w-5 h-5 bg-success-500 text-white rounded-full text-[10px] flex items-center justify-center shadow-sm"
            >
              ✓
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                useAgentStore.getState().dismissProposal("state", ps.id)
              }}
              className="w-5 h-5 bg-danger-500 text-white rounded-full text-[10px] flex items-center justify-center shadow-sm"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
