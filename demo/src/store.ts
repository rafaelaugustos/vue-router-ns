import { reactive } from 'nativescript-vue'

export interface Message {
  id: number
  from: string
  subject: string
  body: string
  read: boolean
}

// plain on purpose: pages read it like they would read an API
const messages: Message[] = [
  {
    id: 1,
    from: 'Ana',
    subject: 'Lunch on Friday?',
    body: 'There is a new ramen place next to the office. 12:30?',
    read: false,
  },
  {
    id: 2,
    from: 'Build bot',
    subject: 'Release 2.4.0 is out',
    body: 'All checks passed. The changelog is attached.',
    read: false,
  },
  {
    id: 3,
    from: 'Marcos',
    subject: 'Slides for the meetup',
    body: 'Sent you the deck. Feedback before Tuesday would be great.',
    read: true,
  },
]

export const inbox = {
  list: () => messages.map((message) => ({ ...message })),
  find: (id: number) => messages.find((message) => message.id === id),
  markRead(id: number) {
    const message = messages.find((candidate) => candidate.id === id)
    if (message) message.read = true
  },
  unread: () => messages.filter((message) => !message.read).length,
}

export const session = reactive({ user: '' })
