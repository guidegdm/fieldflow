import type { AgentQuestion, AgentAnswer } from "@/lib/ai/types"

let pendingQuestions = 0
let questionResolver: ((answer: AgentAnswer) => void) | null = null

export function resetQuestionCount() {
  pendingQuestions = 0
}

export function getQuestionCount() {
  return pendingQuestions
}

export function resolveQuestion(answer: AgentAnswer) {
  questionResolver?.(answer)
  questionResolver = null
}

export function dismissQuestion() {
  questionResolver?.([])
  questionResolver = null
}

export function showQuestion(
  params: {
    header: string
    question: string
    options: { label: string; description?: string }[]
    multiple: boolean
    custom: boolean
  }
): Promise<AgentAnswer> {
  pendingQuestions++
  return new Promise((resolve) => {
    questionResolver = resolve
    const detail: AgentQuestion = {
      id: crypto.randomUUID(),
      header: params.header,
      question: params.question,
      options: params.options,
      multiple: params.multiple,
      custom: params.custom,
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fieldflow:ai-question", { detail }))
    }
  })
}
