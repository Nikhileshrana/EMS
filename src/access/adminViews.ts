import { isAdmin } from './roles'

/** Hide the document API tab for everyone except admins. */
export const adminOnlyApiTab = {
  api: {
    tab: {
      condition: ({ req }: { req: { user?: unknown } }) => isAdmin(req.user as never),
    },
  },
}
