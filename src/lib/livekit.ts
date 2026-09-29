import { AccessToken, type VideoGrant } from 'livekit-server-sdk'
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
  roomName: string
  roomAdmin: boolean
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

export async function payloadFromHeaders(headers: Headers) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  return { payload, user }
}
