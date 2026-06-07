import { motion } from 'framer-motion'

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

export function ScoreBadge({ score }: Props) {
  const color = getColor(score)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
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
          fill={color}
          fontSize="28"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.text>
      </svg>
      <span style={{ color: '#8A9E95', fontFamily: 'Syne, sans-serif', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Quality Score
      </span>
    </div>
  )
}
