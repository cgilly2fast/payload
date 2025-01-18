import { User } from '../../../payload-types.js'
import { CollectionBeforeChangeHook } from 'payload'
import ObjectID from 'bson-objectid'

export const accountSetup: CollectionBeforeChangeHook<User> = async ({ operation, req, data }) => {
  const { payload } = req

  if (operation === 'create') {
    const id = new ObjectID().toHexString()

    // fire and forget
    payload.create({
      collection: 'calendar-settings',
      data: {
        id,
      },
    })

    data.calendar_settings = id
  }

  return data
}
