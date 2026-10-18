'use client'

import React from 'react'

const style: React.CSSProperties = {
  marginTop: 8,
  padding: '10px 14px',
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  background: 'var(--theme-elevation-50, #f8fafc)',
  color: 'var(--theme-text, #334155)',
  fontSize: 13,
  lineHeight: 1.5,
}

/** Shown on the class create form — joins need a saved class before teachers/students can be added. */
export function RosterSaveHint() {
  return (
    <p style={style}>
      Save this class first. Once it exists, you can add teachers and students from the Teachers
      and Students tables above.
    </p>
  )
}
