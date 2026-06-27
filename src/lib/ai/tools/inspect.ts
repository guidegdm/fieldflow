import { getStore } from "@/lib/api/in-memory-store"

export const inspectTools = {
  async getWorkflow(id: string) { return getStore().getWorkflow(id) },
  async getAllWorkflows() { return getStore().getAllWorkflows() },
  async getRecordsByWorkflow(wfId: string) { return getStore().getRecordsByWorkflow(wfId) },
  async getOrganizationContext() { return { workflows: getStore().getAllWorkflows() } },
}
