import { CollectionConfig } from 'payload'
// import { setId } from './hooks/setId.js'

export const CalendarSettings: CollectionConfig = {
  slug: 'calendar-settings',
  hooks: {
    // beforeChange: [setId],
  },
  fields: [
    {
      name: 'timezone',
      type: 'select',
      label: 'Timezone',
      admin: {
        style: {
          maxWidth: '480px',
        },
        position: 'sidebar',
      },
      options: [
        { label: 'Hawaii Time', value: 'Pacific/Honolulu' },
        { label: 'Alaska Time', value: 'America/Anchorage' },
        { label: 'Pacific Time', value: 'America/Los_Angeles' },
        { label: 'Mountain Time', value: 'America/Denver' },
        { label: 'Central Time', value: 'America/Chicago' },
        { label: 'Eastern Time', value: 'America/New_York' },
        { label: 'Atlantic Time', value: 'America/Halifax' },
        { label: 'Newfoundland Time', value: 'America/St_Johns' },
        { label: 'Greenwich Mean Time', value: 'Etc/GMT' },
        { label: 'British Summer Time', value: 'Europe/London' },
        { label: 'Central European Time', value: 'Europe/Berlin' },
        { label: 'Eastern European Time', value: 'Europe/Kiev' },
        { label: 'Moscow Time', value: 'Europe/Moscow' },
        { label: 'India Standard Time', value: 'Asia/Kolkata' },
        { label: 'China Standard Time', value: 'Asia/Shanghai' },
        { label: 'Japan Standard Time', value: 'Asia/Tokyo' },
        {
          label: 'Australian Eastern Standard Time',
          value: 'Australia/Sydney',
        },
        { label: 'New Zealand Standard Time', value: 'Pacific/Auckland' },
      ],
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'User',
      required: true,
      index: true,
      unique: true,
      access: {},
      admin: {
        position: 'sidebar',
        readOnly: true,
        style: {
          maxWidth: '470px',
        },
      },
    },
  ],
}
