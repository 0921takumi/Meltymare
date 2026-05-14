'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DIAGNOSIS_QUESTIONS } from '@/lib/diagnosis'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function DiagnosisPage() {
  const router = useRouter()
  const [step, setStep] = useState(-1)
  const [answers, setAnswers] = useState<number[]>([])

  const total = DIAGNOSIS_QUESTIONS.length
  const progressPct = step < 0 ? 0 : Math.round((step / total) * 100)

  const handleSelect = (choiceIdx: number) => {
    const next = [...answers, choiceIdx]
    setAnswers(next)
    if (step + 1 >= total) {
      const tags: string[] = []
      next.forEach((ci, qi) => {
        DIAGNOSIS_QUESTIONS[qi].choices[ci].tags.forEach(t => tags.push(t))
      })
      const params = new URLSearchParams()
      params.set('tags', tags.join(','))
      params.set('vibe', DIAGNOSIS_QUESTIONS[0].choices[next[0]].tags[0])
      router.push(`/diagnosis/result?${params.toString()}`)
    } else {
      setStep(step + 1)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fff5f8 0%, #f4eef8 100%)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>

        <div style={{ marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--mm-text-muted)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> トップに戻る
          </Link>
        </div>

        {step < 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>💖</div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.15em', marginBottom: 10 }}>OSHI DIAGNOSIS</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 14, letterSpacing: '0.02em' }}>
              あなたにぴったりの推しを<br />見つけよう
            </h1>
            <p style={{ fontSize: 14, color: 'var(--mm-text-sub)', lineHeight: 1.8, marginBottom: 28 }}>
              5つの簡単な質問に答えるだけ。<br />
              <strong style={{ color: 'var(--mm-primary)' }}>あなたの推しタイプ</strong>と<strong style={{ color: 'var(--mm-primary)' }}>オススメのクリエイター</strong>を診断します。
            </p>
            <button
              onClick={() => setStep(0)}
              style={{
                background: 'linear-gradient(135deg, var(--mm-primary) 0%, #d946ef 100%)',
                color: 'white', border: 'none', borderRadius: 12,
                padding: '14px 48px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(217,70,239,0.3)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <Sparkles size={16} /> 診断スタート
            </button>
            <p style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 20 }}>所要時間：約30秒</p>
          </div>
        ) : (
          <div>
            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mm-primary)', letterSpacing: '0.1em' }}>
                  Q {step + 1} / {total}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mm-text-muted)' }}>{progressPct}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${((step + 1) / total) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--mm-primary), #d946ef)', transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Question */}
            <div style={{ background: 'white', borderRadius: 20, padding: '32px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{DIAGNOSIS_QUESTIONS[step].emoji}</div>
                <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.01em' }}>
                  {DIAGNOSIS_QUESTIONS[step].text}
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DIAGNOSIS_QUESTIONS[step].choices.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    style={{
                      background: 'var(--mm-bg)', border: '2px solid transparent',
                      borderRadius: 12, padding: '14px 18px', fontSize: 15, fontWeight: 600,
                      color: 'var(--mm-text)', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.borderColor = 'var(--mm-primary)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--mm-bg)'
                      e.currentTarget.style.borderColor = 'transparent'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{c.emoji}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {step > 0 && (
              <button
                onClick={() => {
                  setAnswers(answers.slice(0, -1))
                  setStep(step - 1)
                }}
                style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--mm-text-muted)', fontSize: 12, cursor: 'pointer' }}
              >
                ← 前の質問に戻る
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
