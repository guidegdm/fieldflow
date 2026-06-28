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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-black/10">
      <div className="bg-white rounded-md border border-graph-line shadow-sm max-w-md w-full mx-4 p-5">
        <span className="text-[10px] bg-clay/10 text-clay px-2 py-0.5 rounded-full inline-block mb-3">
          {pendingQuestion.header}
        </span>
        <p className="text-sm text-ink-black mb-4">{pendingQuestion.question}</p>

        <div className="space-y-1.5 mb-4">
          {pendingQuestion.options.map((opt, i) => (
            <label
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors text-sm ${
                selectedIndices.includes(i)
                  ? "border-clay/40 bg-clay/5 text-soil"
                  : "border-graph-line text-soil hover:bg-kivu-paper"
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
                  <p className="text-xs text-pencil mt-0.5">{opt.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>

        {pendingQuestion.custom && (
          <div className="mb-4">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t("ai.question.customPlaceholder", "Other...")}
              className="w-full h-16 text-xs rounded border border-graph-line px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-clay"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isEmpty}
            className="flex-1"
          >
            {t("ai.question.confirm", "Confirm")}
          </Button>
          <button
            onClick={handleDismiss}
            className="text-xs text-pencil hover:text-ink-black transition-colors"
          >
            {t("ai.question.dismiss", "Skip")}
          </button>
        </div>
      </div>
    </div>
  )
}
