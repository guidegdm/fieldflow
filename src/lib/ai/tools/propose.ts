import { z } from "zod"
import type { ToolDef } from "@/lib/ai/types"

const proposedFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(256),
  labelEn: z.string().min(1).max(256).optional(),
  type: z.enum(["text", "number", "select", "multi-select", "date", "gps", "photo", "textarea"]),
  required: z.boolean(),
  section: z.string().min(1).max(64).optional().default("default"),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
})

const proposedStateSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(256),
  labelEn: z.string().min(1).max(256).optional(),
  color: z.string().optional(),
  isInitial: z.boolean(),
  isTerminal: z.boolean(),
})

const proposedTransitionSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(256),
  labelEn: z.string().min(1).max(256).optional(),
  fromState: z.string(),
  toState: z.string(),
  requiredRoles: z.array(z.string()),
})

const proposeChangesSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  nameEn: z.string().min(1).max(128).optional(),
  fields: z.array(proposedFieldSchema).optional().default([]),
  states: z.array(proposedStateSchema).optional().default([]),
  transitions: z.array(proposedTransitionSchema).optional().default([]),
  message: z.string().optional(),
})

export const proposeChangesTool: ToolDef = {
  name: "propose_changes",
  description:
    "Submit a structured proposal for workflow changes. Call this ONCE with all changes when you are ready. The proposal will be validated and shown to the user as ghost cards. Do NOT output raw JSON — use this tool.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Short French workflow name",
      },
      nameEn: {
        type: "string",
        description: "Short English workflow name",
      },
      fields: {
        type: "array",
        description: "New field definitions to add to the workflow",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Lowercase snake_case field key" },
            label: { type: "string", description: "French label" },
            labelEn: { type: "string", description: "English label (optional)" },
            type: { type: "string", enum: ["text", "number", "select", "multi-select", "date", "gps", "photo", "textarea"] },
            required: { type: "boolean" },
            section: { type: "string", description: "Section name (default: 'default')" },
            options: {
              type: "array",
              items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } },
              description: "Required for select/multi-select fields",
            },
          },
          required: ["key", "label", "type", "required"],
        },
      },
      states: {
        type: "array",
        description: "New state nodes to add to the workflow state machine",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Lowercase snake_case state key" },
            label: { type: "string", description: "French label" },
            labelEn: { type: "string", description: "English label (optional)" },
            color: { type: "string", description: "Hex color (optional, auto-assigned based on key)" },
            isInitial: { type: "boolean" },
            isTerminal: { type: "boolean" },
          },
          required: ["key", "label", "isInitial", "isTerminal"],
        },
      },
      transitions: {
        type: "array",
        description: "New transitions between states",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Lowercase snake_case transition key" },
            label: { type: "string", description: "French label" },
            labelEn: { type: "string", description: "English label (optional)" },
            fromState: { type: "string", description: "Source state key" },
            toState: { type: "string", description: "Target state key" },
            requiredRoles: { type: "array", items: { type: "string" }, description: "Roles that can trigger this transition" },
          },
          required: ["key", "label", "fromState", "toState", "requiredRoles"],
        },
      },
      message: {
        type: "string",
        description: "Natural language explanation of the proposed changes (shown to user)",
      },
    },
    required: [],
  },
  async execute(params) {
    const parsed = proposeChangesSchema.safeParse(params)
    if (!parsed.success) {
      return {
        success: false,
        text: `INVALID PROPOSAL: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        error: "INVALID_SCHEMA",
      }
    }
    return {
      success: true,
      data: parsed.data,
      text: [
        parsed.data.message ? `Message: ${parsed.data.message}` : "",
        parsed.data.name ? `Workflow name: ${parsed.data.name}` : "",
        parsed.data.fields.length ? `Fields to add: ${parsed.data.fields.length}` : "",
        parsed.data.states.length ? `States to add: ${parsed.data.states.length}` : "",
        parsed.data.transitions.length ? `Transitions to add: ${parsed.data.transitions.length}` : "",
        "Proposal received. The system will now validate it.",
      ]
        .filter(Boolean)
        .join("\n"),
    }
  },
}
