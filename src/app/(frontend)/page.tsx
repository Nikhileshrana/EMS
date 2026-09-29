import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@payload-config'
import { roleList } from '@/access/roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function HomePage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  const roles = roleList(user)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h1>Education management</h1>
          </CardTitle>
          <CardDescription>
            Classes, students, study material, and live sessions live in the admin. Your roles decide
            which of those routes you can open.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user ? (
            <>
              <p className="text-sm">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sign in to open the admin.</p>
          )}
          <Button asChild className="w-fit">
            <Link href="/admin">{user ? 'Open admin' : 'Sign in'}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
