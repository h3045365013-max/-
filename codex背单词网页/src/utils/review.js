/** 复习间隔（从上一次答对开始计算，单位：天）。走完后保持每 30 天复习。 */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30]

export function createMemory() {
  return { level: 0, correct: 0, wrong: 0, dueAt: 0, lastReviewedAt: 0, reviewStep: 0, favorite: false }
}

export function updateMemory(memory, isCorrect, now = Date.now()) {
  const next = { ...createMemory(), ...memory, lastReviewedAt: now }
  if (isCorrect) {
    next.correct += 1
    next.reviewStep += 1
    next.level = next.reviewStep >= REVIEW_INTERVALS.length ? 2 : 1
    const days = REVIEW_INTERVALS[Math.min(next.reviewStep - 1, REVIEW_INTERVALS.length - 1)]
    next.dueAt = now + days * 24 * 60 * 60_000
  } else {
    next.wrong += 1
    next.level = 0
    next.reviewStep = 0
    // 错词安排到当前学习组末尾重测；如果用户离开页面，则下次打开仍会优先看到。
    next.dueAt = now
  }
  return next
}

/** 到期词始终排在前面，未到期词保留在队列中，逾期未学会持续累积。 */
export function orderForReview(words, memories, now = Date.now()) {
  return words.filter(word => {
    const memory = memories[word.word]
    if (!memory || !memory.reviewStep) return true
    if (memory.reviewStep >= REVIEW_INTERVALS.length) return false
    return !memory.dueAt || memory.dueAt <= now
  }).sort((a, b) => {
    const ma = memories[a.word] || createMemory()
    const mb = memories[b.word] || createMemory()
    const aDue = ma.dueAt || 0
    const bDue = mb.dueAt || 0
    return aDue - bDue || ma.level - mb.level
  })
}
