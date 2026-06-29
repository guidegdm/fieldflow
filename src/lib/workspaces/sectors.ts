export const WORKSPACE_SECTORS = [
  "humanitarian",
  "health",
  "agriculture",
  "education",
  "logistics",
  "construction",
  "government",
  "ngo",
  "retail",
  "hospitality",
  "finance",
  "insurance",
  "technology",
  "field_services",
  "research",
  "other",
] as const

export type WorkspaceSector = (typeof WORKSPACE_SECTORS)[number]
