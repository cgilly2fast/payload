import type { CollectionConfig } from 'payload'

import { accountSetup } from './hooks/accountSetup.js'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 82800,
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'email',
    group: 'Account',
  },

  hooks: {
    beforeChange: [accountSetup],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
        },
        {
          name: 'lastName',
          type: 'text',
        },
      ],
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      hasMany: false,
      label: 'Profile Picture',
      displayPreview: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: 'user',

      options: [
        {
          label: 'Super Admin',
          value: 'super-admin',
        },
        {
          label: 'User',
          value: 'user',
        },
        {
          label: 'Domains API Access',
          value: 'domains-api',
        },
      ],
    },

    {
      name: 'calendarSettings',
      type: 'relationship',
      relationTo: 'calendar-settings',
      maxDepth: -1,
    },
  ],
}
