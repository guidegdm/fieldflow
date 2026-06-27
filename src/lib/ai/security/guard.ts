const ADMIN_ONLY_TOOLS = ["applyProposal", "publishWorkflow"]

const INJECTION_PATTERNS = /<\/?system>|<\/?instruction>|ignore previous|DAN|jailbreak/gi

export function sanitizeInput(input: string): string {
  return input.replace(INJECTION_PATTERNS, "[FILTERED]")
}

export function authorizeTool(role: string, toolName: string): boolean {
  if (ADMIN_ONLY_TOOLS.includes(toolName) && role !== "org_admin") return false
  return true
}

export function canAutoPublish(): false {
  return false
}

const DANGEROUS_PATTERNS = [
  { key: "status", value: "published" },
  { key: "role", value: "org_admin" },
]

export function validateOutput(output: any): boolean {
  if (!output || typeof output !== "object") return true
  if (output.status === "published") return false
  if (output.autoApprove === true) return false
  return true
}

export function auditLog(action: string, actor: string, details: any) {
  console.log(`[AI-AUDIT] ${new Date().toISOString()} ${actor}: ${action}`)
}
