import { CalendarSettings } from '../../../payload-types.js'
import { CollectionBeforeChangeHook } from 'payload'

export const setId: CollectionBeforeChangeHook<CalendarSettings> = ({ data, operation }) => {
  if (operation === 'create' && data.id) {
    ;(data as any)['_id'] = data.id
  }
  return data
}
