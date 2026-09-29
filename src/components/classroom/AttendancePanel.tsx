'use client'

import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'

type AttendanceRow = {
  id: string
  inSession: boolean
  name: string
  time: string
}

export function AttendancePanel({
  connected,
  sessionId,
}: {
  connected: boolean
  sessionId: string
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const visit = useRef(0)

  useEffect(() => {
    if (!connected) return

    const id = ++visit.current

    const post = (action: 'join' | 'leave') =>
      fetch(`/api/classroom/${sessionId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        keepalive: action === 'leave',
      })

    void post('join')
    const interval = window.setInterval(() => {
      if (visit.current === id) void post('join')
    }, 15000)

    const leave = () => {
      if (visit.current === id) void post('leave')
    }
    window.addEventListener('pagehide', leave)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pagehide', leave)
      window.setTimeout(leave, 1500)
    }
  }, [connected, sessionId])

  useEffect(() => {
    let stopped = false

    const load = async () => {
      const response = await fetch(`/api/classroom/${sessionId}/attendance`)
      if (!response.ok || stopped) return
      const body = (await response.json()) as { attendance?: AttendanceRow[] }
      if (!stopped) setRows(body.attendance || [])
    }

    void load()
    const interval = window.setInterval(() => void load(), 5000)
    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [sessionId])

  const present = rows.filter((row) => row.inSession).length

  return (
    <aside className="flex w-full shrink-0 flex-col border-l bg-background text-foreground md:w-72">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">In this session</h2>
        <Badge variant="secondary">{present}</Badge>
      </div>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nobody has joined yet.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {row.inSession ? row.time : `Left · ${row.time}`}
              </span>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
