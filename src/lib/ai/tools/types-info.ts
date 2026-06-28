import type { ToolDef } from "@/lib/ai/types"

export const getWorkflowTypesTool: ToolDef = {
  name: "get_workflow_types",
  description:
    "Get the valid field types, state colors, role permissions, and other constraints for this workflow system.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute() {
    return {
      success: true,
      text: [
        `Valid field types: text, number, select, multi-select, date, gps, photo, textarea`,
        `Valid state colors (key → hex): draft=#6B7280, submitted=#2563EB, verified=#2563EB, approved=#16A34A, reserved=#C17A4E, distributed=#059669, confirmed=#1B4F72`,
        `Standard roles: field_worker="Agent terrain", supervisor="Superviseur", org_admin="Administrateur"`,
        `Standard role permissions:`,
        `  field_worker: record:create, record:read_own, record:update_own, sync:push, sync:pull`,
        `  supervisor: record:read_team, record:verify, record:approve, conflict:resolve, sync:pull`,
        `  org_admin: workflow:publish, admin:manage_users, audit:view`,
        `Standard state transitions: draft→submitted (field_worker), submitted→verified (supervisor), verified→approved (supervisor), approved→reserved (supervisor), reserved→distributed (field_worker), distributed→confirmed (supervisor)`,
        `Field keys must be lowercase, underscore-separated, no spaces or special chars.`,
        `State keys follow the same pattern.`,
        `label is French, labelEn is English. Both should be provided.`,
      ].join("\n"),
    }
  },
}
