'use client'

import { isAdmin, isStudent, isTeacher } from '@/access/roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DefaultListView, useAuth, useListQuery } from '@payloadcms/ui'
import { ArrowRight, BookOpen, ClipboardCheck, FileText, Video } from 'lucide-react'
import type { ListViewClientProps } from 'payload'
import Link from 'next/link'
import React from 'react'

type EducationDocument = Record<string, unknown> & { id: number | string }

type CollectionDetails = {
  icon: typeof BookOpen
  metadataFields: string[]
  titleField: string
  titleFallback: string
}

const collectionDetails: Record<string, CollectionDetails> = {
  classes: { icon: BookOpen, titleField: 'title', titleFallback: 'Class', metadataFields: ['description'] },
  materials: { icon: FileText, titleField: 'title', titleFallback: 'Study material', metadataFields: ['class', 'source'] },
  sessions: { icon: Video, titleField: 'title', titleFallback: 'Live session', metadataFields: ['class', 'status'] },
  attendance: { icon: ClipboardCheck, titleField: 'name', titleFallback: 'Participant', metadataFields: ['session', 'timeInSession'] },
}

function displayValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const related = value as Record<string, unknown>
    const label = related.title ?? related.name ?? related.label
    if (typeof label === 'string' || typeof label === 'number') return String(label)
  }
  return undefined
}

function EducationDocumentCards({ collectionSlug }: { collectionSlug: string }) {
  const { data } = useListQuery()
  const details = collectionDetails[collectionSlug]
  const documents = (data?.docs ?? []) as EducationDocument[]

  if (!details) return null

  const Icon = details.icon

  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:gap-2.5">
      {documents.map((document) => {
        const title = displayValue(document[details.titleField]) ?? details.titleFallback
        const status = displayValue(document.status)
        const isPublished = document.published === true
        const metadata = details.metadataFields
          .map((field) => displayValue(document[field]))
          .filter((value): value is string => Boolean(value))
        const href = `/admin/collections/${collectionSlug}/${document.id}`

        return (
          <Card
            className="rounded-xl border border-border bg-card text-card-foreground"
            key={document.id}
          >
            <CardContent className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                <Icon aria-hidden className="size-3" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <Link className="block truncate text-sm font-semibold leading-snug text-foreground no-underline hover:underline sm:text-base" href={href}>
                  {title}
                </Link>
                {metadata.length > 0 ? (
                  <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                    {metadata.join(' · ')}
                  </p>
                ) : null}
              </div>
              <Button
                aria-label={`Open ${title}`}
                asChild
                className="size-7 shrink-0 rounded-full border-0 bg-muted text-foreground hover:bg-accent sm:size-8"
                size="icon-sm"
                variant="secondary"
              >
                <Link href={href}>
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function EducationListView(props: ListViewClientProps) {
  const { user } = useAuth()
  const isEducationUser = !isAdmin(user) && (isStudent(user) || isTeacher(user))

  if (!isEducationUser || !collectionDetails[props.collectionSlug]) {
    return <DefaultListView {...props} />
  }

  return (
    <DefaultListView
      {...props}
      BeforeListTable={<EducationDocumentCards collectionSlug={props.collectionSlug} />}
      Table={null}
      enableRowSelections={false}
    />
  )
}
