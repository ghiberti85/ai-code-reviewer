import { useState, useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'

interface Props {
  score: number
}

function getColor(score: number): string {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#88FF00'
  if (score >= 50) return '#FFD700'
  if (score >= 30) return '#FF8800'
  return '#FF2244'
}

function getInterpolatedColor(value: number): string {
  if (value >= 90) return '#00FF88'
  if (value >= 70) return '#88FF00'
  if (value >= 50) return '#FFD700'
  if (value >= 30) return '#FF8800'
  return '#FF2244'
}

function Particles({ score }: { score: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    if (score < 90) return
    // wait for the counter animation to finish before rendering particles
    const t = setTimeout(() => setVisible(true), 1050)
    return () => clearTimeout(t)
  }, [score])

  if (!visible) return null

  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360
    const distance = 55 + (i % 3) * 10
    const rad = (angle * Math.PI) / 180
    return {
      id: i,
      tx: 64 + Math.cos(rad) * distance,
      ty: 64 + Math.sin(rad) * distance,
      delay: i * 0.02,
    }
  })

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {particles.map(p => (
        <motion.circle
          key={p.id}
          cx={64}
          cy={64}
          r={2.5}
          fill="#00FF88"
          initial={{ cx: 64, cy: 64, opacity: 0, r: 2.5 }}
          animate={{ cx: p.tx, cy: p.ty, opacity: [0, 1, 0], r: 1 }}
          transition={{ duration: 0.35, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </svg>
  )
}

export function ScoreBadge({ score }: Props) {
  const [displayed, setDisplayed] = useState(0)
  const controls = useAnimation()
  const radius = 54
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    setDisplayed(0)
    const duration = 1000
    const steps = 60
    const interval = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const eased = 1 - Math.pow(1 - step / steps, 3)
      setDisplayed(Math.round(eased * score))
      if (step >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [score])

  useEffect(() => {
    if (score < 30) {
      controls.start({
        x: [0, -6, 6, -4, 4, -2, 2, 0],
        transition: { duration: 0.5, delay: 1.1 },
      })
    }
  }, [score, controls])

  const color = getColor(score)
  const displayedColor = getInterpolatedColor(displayed)
  const offset = circumference - (score / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <motion.div animate={controls} style={{ position: 'relative', width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#1E2220" strokeWidth="10" />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ transformOrigin: '64px 64px', rotate: '-90deg' }}
          />
          <motion.text
            x="64"
            y="64"
            textAnchor="middle"
            dominantBaseline="central"
            fill={displayedColor}
            fontSize="28"
            fontWeight="700"
            fontFamily="JetBrains Mono, monospace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {displayed}
          </motion.text>
        </svg>
        <Particles score={score} />
      </motion.div>
      <span style={{ color: '#8A9E95', fontFamily: 'Syne, sans-serif', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Quality Score
      </span>
    </div>
  )
}
