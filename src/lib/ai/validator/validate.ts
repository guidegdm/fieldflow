import type { WorkflowDefinition } from "@/types/workflow"

export function validateWorkflow(wf: WorkflowDefinition): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!wf.states.some(s => s.isInitial)) errors.push("Aucun état initial défini")
  if (!wf.states.some(s => s.isTerminal)) warnings.push("Aucun état terminal défini")
  if (!wf.roles.length) errors.push("Aucun rôle défini")

  const initial = wf.states.find(s => s.isInitial)
  if (initial) {
    const reachable = new Set<string>([initial.id])
    const queue = [initial.id]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const t of wf.transitions.filter(t => t.fromState === current)) {
        if (!reachable.has(t.toState)) {
          reachable.add(t.toState)
          queue.push(t.toState)
        }
      }
    }
    for (const s of wf.states) {
      if (!reachable.has(s.id)) warnings.push(`État non atteignable: ${s.label}`)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  function hasCycle(stateId: string): boolean {
    if (inStack.has(stateId)) return true
    if (visited.has(stateId)) return false
    visited.add(stateId)
    inStack.add(stateId)
    for (const t of wf.transitions.filter(t => t.fromState === stateId)) {
      if (hasCycle(t.toState)) return true
    }
    inStack.delete(stateId)
    return false
  }
  for (const s of wf.states) {
    if (hasCycle(s.id)) { warnings.push("Transition circulaire détectée"); break }
  }

  const fieldWorkerPerms = wf.roles.find(r => r.key === "field_worker")?.permissions ?? []
  for (const r of wf.roles) {
    if (r.key === "field_worker") continue
    const grantsAdmin = r.permissions.some(p => p.startsWith("admin:") || p === "workflow:publish")
    if (grantsAdmin && r.key !== "org_admin") {
      errors.push(`Escalade de privilèges: ${r.label} ne devrait pas avoir de permissions admin`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
