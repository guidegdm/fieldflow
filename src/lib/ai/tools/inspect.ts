import type { ToolDef } from "@/lib/ai/types"

export const inspectWorkflowTool: ToolDef = {
  name: "inspect_workflow",
  description:
    "Read the complete workflow structure: entity key, all fields (key, label, type, required, section, options), all states (key, label, color, initial/terminal), all transitions (key, from→to, required roles), all roles (key, permissions). Use this to understand what already exists before proposing changes.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_params, ctx) {
    const w = ctx.workflowSnapshot
    const lines = [
      `=== WORKFLOW: ${w.name} (${w.nameEn}) ===`,
      `Entity: ${w.entity.key} (${w.entity.label})`,
      ``,
      `--- FIELDS (${w.entity.fields.length}) ---`,
      ...w.entity.fields.map(
        (f) =>
          `  ${f.key}: "${f.label}" (${f.type})${f.required ? " REQUIRED" : ""}${f.section !== "default" ? ` section:${f.section}` : ""}${
            f.options?.length ? ` options:[${f.options.map((o) => `${o.value}="${o.label}"`).join(", ")}]` : ""
          }`
      ),
      ``,
      `--- STATES (${w.states.length}) ---`,
      ...w.states.map(
        (s) => `  ${s.key}: "${s.label}"${s.isInitial ? " [INITIAL]" : ""}${s.isTerminal ? " [TERMINAL]" : ""}`
      ),
      ``,
      `--- TRANSITIONS (${w.transitions.length}) ---`,
      ...w.transitions.map(
        (t) => `  ${t.key}: ${t.fromState} → ${t.toState} [roles: ${t.requiredRoles.join(", ") || "none"}]`
      ),
      ``,
      `--- ROLES (${w.roles.length}) ---`,
      ...w.roles.map((r) => `  ${r.key}: "${r.label}" (permissions: ${r.permissions.join(", ")})`),
    ]
    return { success: true, data: w, text: lines.join("\n") }
  },
}
