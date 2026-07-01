"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAgentStore } from "@/stores/agentStore"
import { Button } from "@/components/ui/button"

export function QuestionCard() {
  const { t } = useTranslation()
  const pendingQuestion = useAgentStore((s) => s.pendingQuestion)
  const answerQuestion = useAgentStore((s) => s.answerQuestion)
  const dismissQuestionAction = useAgentStore((s) => s.dismissQuestionAction)
  const phase = useAgentStore((s) => s.phase)

  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [customText, setCustomText] = useState("")

  if (phase !== "question" || !pendingQuestion) return null

  const isEmpty = selectedIndices.length === 0 && !customText.trim()

  const toggleIndex = (i: number) => {
    if (pendingQuestion.multiple) {
      setSelectedIndices((prev) =>
        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
      )
    } else {
      setSelectedIndices([i])
    }
  }

  const handleConfirm = () => {
    const answers: string[] = selectedIndices.map(
      (i) => pendingQuestion.options[i].label
    )
    if (pendingQuestion.custom && customText.trim()) {
      answers.push(customText.trim())
    }
    answerQuestion(answers)
  }

  const handleDismiss = () => {
    dismissQuestionAction()
  }

  return (
    <div className="absolute inset-0 z-40 flex min-h-0 items-start justify-center overflow-y-auto bg-ink-black/15 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-5">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-graph-line bg-white shadow-2xl">
        <div className="shrink-0 border-b border-graph-line px-5 py-4">
          <span className="mb-3 inline-flex rounded-full bg-clay/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-clay">
            {pendingQuestion.header}
          </span>
          <p className="text-sm leading-6 text-ink-black">{pendingQuestion.question}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {pendingQuestion.options.map((opt, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition-colors ${
                selectedIndices.includes(i)
                  ? "border-clay/40 bg-clay/5 text-soil"
                  : "border-graph-line text-soil hover:bg-graph-paper"
              }`}
            >
              <input
                type={pendingQuestion.multiple ? "checkbox" : "radio"}
                name="question-option"
                checked={selectedIndices.includes(i)}
                onChange={() => toggleIndex(i)}
                className="mt-0.5 accent-clay"
              />
              <div>
                <span className="font-medium text-ink-black">{opt.label}</span>
                {opt.description && (
                  <p className="mt-0.5 text-xs leading-5 text-pencil">{opt.description}</p>
                )}
              </div>
            </label>
          ))}

          {pendingQuestion.custom && (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t("ai.question.customPlaceholder", "Other...")}
              className="h-24 w-full resize-none rounded-md border border-graph-line px-3 py-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-clay"
            />
          )}
        </div>

        <div className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-graph-line px-5 py-4">
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={isEmpty}
            className="w-full"
          >
            {t("ai.question.confirm", "Confirm")}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md px-3 text-xs font-medium text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          >
            {t("ai.question.dismiss", "Skip")}
          </button>
        </div>
      </div>
    </div>
  )
}
