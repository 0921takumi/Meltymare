export type DiagnosisQuestion = {
  id: string
  text: string
  emoji: string
  choices: { label: string; tags: string[]; emoji: string }[]
}

export const DIAGNOSIS_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: 'vibe',
    text: '好きな雰囲気は？',
    emoji: '✨',
    choices: [
      { label: '清楚・上品',   tags: ['清楚', '上品', '黒髪'],         emoji: '🌸' },
      { label: 'ギャル・華やか', tags: ['ギャル', '華やか', '金髪'],      emoji: '💅' },
      { label: '癒し系・ふんわり', tags: ['癒し', 'ふんわり', 'やさしい'],    emoji: '☁️' },
      { label: 'クール・お姉さん', tags: ['クール', 'お姉さん', '大人'],      emoji: '🖤' },
      { label: '元気・明るい',   tags: ['元気', '明るい', 'アイドル'],     emoji: '🌞' },
    ],
  },
  {
    id: 'content',
    text: '見たいコンテンツは？',
    emoji: '📸',
    choices: [
      { label: '写真をじっくり',      tags: ['写真', 'ポートレート'],    emoji: '🖼️' },
      { label: '動画で動く姿を',      tags: ['動画', 'ムービー'],        emoji: '🎥' },
      { label: '両方バランスよく',    tags: ['写真', '動画'],            emoji: '🎞️' },
    ],
  },
  {
    id: 'theme',
    text: '惹かれるテーマは？',
    emoji: '💫',
    choices: [
      { label: 'コスプレ・変身',     tags: ['コスプレ', 'コスチューム'], emoji: '👗' },
      { label: '日常・素の表情',     tags: ['日常', 'オフショット'],     emoji: '☕' },
      { label: '季節・イベント',     tags: ['季節', 'イベント'],         emoji: '🎀' },
      { label: '大人っぽい雰囲気',   tags: ['ランジェリー', 'セクシー'], emoji: '🌙' },
    ],
  },
  {
    id: 'budget',
    text: '月の応援予算感は？',
    emoji: '💰',
    choices: [
      { label: 'ライトに応援 (〜¥2,000)', tags: ['ライト', 'お手頃'],     emoji: '🌱' },
      { label: 'しっかり応援 (¥2,000〜¥5,000)', tags: ['スタンダード'],    emoji: '🌿' },
      { label: 'がっつり推し活 (¥5,000〜)',    tags: ['プレミアム', 'ガチ推し'], emoji: '🌳' },
    ],
  },
  {
    id: 'connection',
    text: '推しとの距離感は？',
    emoji: '💌',
    choices: [
      { label: 'そっと見守るタイプ',       tags: ['鑑賞', 'ひそか'],      emoji: '👀' },
      { label: 'メッセージで交流したい',   tags: ['交流', 'リクエスト'],  emoji: '💬' },
      { label: 'がっつり応援コメントしたい', tags: ['コメント', '応援'],   emoji: '📣' },
    ],
  },
]

export type DiagnosisResult = {
  personalityLabel: string
  personalityEmoji: string
  personalityDescription: string
  matchingTags: string[]
}

export function analyzeAnswers(answerTagSets: string[][]): DiagnosisResult {
  const allTags = answerTagSets.flat()
  const vibeTag = answerTagSets[0]?.[0] ?? 'オールマイティ'

  const personalityMap: Record<string, DiagnosisResult> = {
    '清楚': {
      personalityLabel: '清楚愛好家',
      personalityEmoji: '🌸',
      personalityDescription: '上品で透明感のあるクリエイターに惹かれる、癒されたいタイプ。',
      matchingTags: allTags,
    },
    'ギャル': {
      personalityLabel: '華やかさ求道者',
      personalityEmoji: '💅',
      personalityDescription: '明るく華やかな雰囲気で元気をもらいたい、エネルギー補充タイプ。',
      matchingTags: allTags,
    },
    '癒し': {
      personalityLabel: '癒されたい派',
      personalityEmoji: '☁️',
      personalityDescription: '優しくふんわりした空気に包まれたい、安らぎ重視タイプ。',
      matchingTags: allTags,
    },
    'クール': {
      personalityLabel: '大人の余裕派',
      personalityEmoji: '🖤',
      personalityDescription: 'クールでお姉さんっぽい魅力に惹かれる、大人の嗜みタイプ。',
      matchingTags: allTags,
    },
    '元気': {
      personalityLabel: '太陽チャージ派',
      personalityEmoji: '🌞',
      personalityDescription: '明るさ・元気をもらって一日のエネルギーに変えるタイプ。',
      matchingTags: allTags,
    },
  }

  return personalityMap[vibeTag] ?? {
    personalityLabel: 'オールマイティ派',
    personalityEmoji: '🌈',
    personalityDescription: '幅広い魅力を受け止められる、懐の深いタイプ。',
    matchingTags: allTags,
  }
}
