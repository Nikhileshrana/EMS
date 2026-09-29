import { WebhookReceiver } from 'livekit-server-sdk'
import { getPayload } from 'payload'

import config from '@payload-config'
import { endLiveSession } from '@/lib/attendance'
import { closeLiveKitRoom, livekitConfig, roomHasOtherPeople } from '@/lib/livekit'

export async function POST(request: Request) {
  const livekit = livekitConfig()
  if (!livekit) {
    return Response.json({ error: 'LiveKit is not configured.' }, { status: 503 })
  }

  const body = await request.text()
  const receiver = new WebhookReceiver(livekit.apiKey, livekit.apiSecret)

  let event: Awaited<ReturnType<WebhookReceiver['receive']>>
  try {
    event = await receiver.receive(body, request.headers.get('Authorization') ?? '')
  } catch {
    return Response.json({ error: 'Invalid webhook.' }, { status: 401 })
  }

  if (event.event !== 'participant_left' && event.event !== 'room_finished') {
    return Response.json({ ok: true })
  }

  const roomName = event.room?.name
  if (!roomName) return Response.json({ ok: true })

  const others = await roomHasOtherPeople(roomName, event.participant?.identity || '')
  if (others !== false) return Response.json({ ok: true })

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'sessions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ roomName: { equals: roomName } }, { status: { equals: 'live' } }],
    },
  })

  const session = found.docs[0]
  if (!session) return Response.json({ ok: true })

  await endLiveSession(payload, String(session.id))
  await closeLiveKitRoom(roomName)

  return Response.json({ ok: true })
}
