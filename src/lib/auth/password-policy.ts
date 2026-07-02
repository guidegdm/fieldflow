export const COGNITO_PASSWORD_REQUIREMENT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/

export function cognitoPasswordMessage() {
  return "Use at least 8 characters with uppercase, lowercase, number, and symbol."
}

export function isCognitoPassword(value: string) {
  return COGNITO_PASSWORD_REQUIREMENT.test(value)
}

export function createTemporaryPassword() {
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const digits = "23456789"
  const symbols = "!#$%&*+-=?@^_"
  const all = lower + upper + digits + symbols
  const chars = [
    pick(lower),
    pick(upper),
    pick(digits),
    pick(symbols),
    ...Array.from({ length: 12 }, () => pick(all)),
    pick(lower + upper + digits),
  ]
  return shuffle(chars).join("")
}

function pick(chars: string) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return chars[values[0] % chars.length]
}

function shuffle(chars: string[]) {
  const copy = [...chars]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    const swapIndex = values[0] % (index + 1)
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  const last = copy[copy.length - 1]
  if (/[^A-Za-z0-9]/.test(last)) {
    const safeIndex = copy.findIndex((char) => /[A-Za-z0-9]/.test(char))
    if (safeIndex >= 0) {
      ;[copy[copy.length - 1], copy[safeIndex]] = [copy[safeIndex], copy[copy.length - 1]]
    }
  }
  return copy
}
