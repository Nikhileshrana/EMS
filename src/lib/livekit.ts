import { AccessToken, RoomServiceClient, type VideoGrant } from 'livekit-server-sdk'
import { getPayload } from 'payload'

import config from '@payload-config'

export function livekitConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const serverUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !serverUrl) return null

  return { apiKey, apiSecret, serverUrl }
}

export async function issueClassroomToken(args: {
  identity: string
  name: string
  roomAdmin: boolean
  roomName: string
}) {
  const livekit = livekitConfig()
  if (!livekit) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL are required.')
  }

  const grant: VideoGrant = {
    room: args.roomName,
    roomJoin: true,
    roomAdmin: args.roomAdmin,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  }

  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity: args.identity,
    name: args.name,
  })
  token.addGrant(grant)

  return {
    participantToken: await token.toJwt(),
    serverUrl: livekit.serverUrl,
  }
}

function roomClient() {
  const livekit = livekitConfig()
  if (!livekit) return null
  const host = livekit.serverUrl.replace(/^ws/i, 'http')
  return new RoomServiceClient(host, livekit.apiKey, livekit.apiSecret)
}

function missingRoom(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return /not.?found|404/i.test(message)
}

export async function roomHasOtherPeople(roomName: string, leavingIdentity: string) {
  const client = roomClient()
  if (!client) return null

  try {
    const people = await client.listParticipants(roomName)
    return people.some((person) => person.identity !== leavingIdentity)
  } catch (error) {
    if (missingRoom(error)) return false
    return null
  }
}

export async function closeLiveKitRoom(roomName: string) {
  const client = roomClient()
  if (!client) return
  await client.deleteRoom(roomName).catch(() => undefined)
}

export async function payloadFromHeaders(headers: Headers) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  return { payload, user }
}
