export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Tier {
  id: TierId
  label: string
  emoji: string
  color: string
  bg: string
  minYen: number
}

export const TIERS: Tier[] = [
  { id: 'bronze',   label: 'ブロンズ',   emoji: '🥉', color: '#92400e', bg: '#fef3c7', minYen: 0 },
  { id: 'silver',   label: 'シルバー',   emoji: '🥈', color: '#475569', bg: '#e2e8f0', minYen: 10000 },
  { id: 'gold',     label: 'ゴールド',   emoji: '🥇', color: '#a16207', bg: '#fef9c3', minYen: 50000 },
  { id: 'platinum', label: 'プラチナ',   emoji: '💎', color: '#0e7490', bg: '#cffafe', minYen: 200000 },
  { id: 'diamond',  label: 'ダイヤモンド', emoji: '👑', color: '#a21caf', bg: '#fae8ff', minYen: 500000 },
]

export function getTier(totalYen: number): Tier {
  return [...TIERS].reverse().find(t => totalYen >= t.minYen) ?? TIERS[0]
}

export function getNextTier(totalYen: number): Tier | null {
  return TIERS.find(t => t.minYen > totalYen) ?? null
}

export function getProgress(totalYen: number): { current: Tier; next: Tier | null; percent: number; remainYen: number } {
  const current = getTier(totalYen)
  const next = getNextTier(totalYen)
  if (!next) return { current, next: null, percent: 100, remainYen: 0 }
  const range = next.minYen - current.minYen
  const progressed = totalYen - current.minYen
  const percent = Math.min(100, Math.floor((progressed / range) * 100))
  return { current, next, percent, remainYen: next.minYen - totalYen }
}
