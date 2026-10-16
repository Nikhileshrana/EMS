'use client'

import { isAdmin, isStudent, isTeacher } from '@/access/roles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@payloadcms/ui'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Slide = {
  title: string
  description: string
  image: string
  href: string
  action: string
}

const studentSlides: Slide[] = [
  {
    title: 'Find your next great lesson',
    description: 'Your classes, notes, and learning resources are all in one place.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/classes',
    action: 'View classes',
  },
  {
    title: 'Pick up where you left off',
    description: 'Open the study materials your teachers have shared with you.',
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/materials',
    action: 'Browse materials',
  },
  {
    title: 'Learn together, live',
    description: 'See your upcoming sessions and join when class begins.',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/sessions',
    action: 'View sessions',
  },
]

const teacherSlides: Slide[] = [
  {
    title: 'Make every class count',
    description: 'See your classes and keep your teaching organized.',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/classes',
    action: 'Manage classes',
  },
  {
    title: 'Share something worth learning',
    description: 'Add notes and resources for the students in your classes.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/materials',
    action: 'Manage materials',
  },
  {
    title: 'Bring your classroom together',
    description: 'Prepare a session and meet your students live.',
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1600&q=90',
    href: '/admin/collections/sessions',
    action: 'Open sessions',
  },
]

export function EducationWelcomeCarousel() {
  const { user } = useAuth()
  const slides = isAdmin(user) ? [] : isTeacher(user) ? teacherSlides : isStudent(user) ? studentSlides : []
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length)
    }, 7000)

    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const slide = slides[activeIndex % slides.length]

  return (
    <Card
      aria-label="Education highlights"
      aria-roledescription="carousel"
      className="relative mx-4 my-4 min-h-[190px] overflow-hidden rounded-3xl border-0 bg-slate-900 py-0 shadow-xl sm:mx-6 sm:min-h-[230px] lg:min-h-[280px]"
    >
      <div
        aria-label={slide.title}
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
        key={activeIndex}
        role="img"
        style={{ backgroundImage: `url("${slide.image}")` }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/10" />
      <CardHeader
        aria-live="polite"
        className="absolute inset-x-0 bottom-0 z-10 w-[min(75%,38rem)] gap-2 p-5 text-white sm:p-8 lg:p-10"
        key={`copy-${activeIndex}`}
      >
        <CardTitle className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          {slide.title}
        </CardTitle>
        <CardDescription className="max-w-xl text-pretty text-sm leading-relaxed text-white/85 sm:text-base">
          {slide.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="absolute bottom-5 right-5 z-10 p-0 sm:bottom-8 sm:right-8">
        <Button
          aria-label={slide.action}
          asChild
          className="size-11 rounded-full bg-white text-slate-950 shadow-lg hover:bg-white/90 sm:size-12"
          size="icon-lg"
          title={slide.action}
        >
          <Link href={slide.href}>
            <ArrowRight aria-hidden size={22} />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
