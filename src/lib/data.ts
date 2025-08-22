import type { User, Message } from './types';

export const allUsers: User[] = [
  {
    id: 'rodion',
    name: 'Родион',
    avatar: 'https://placehold.co/100x100/FFDAB9/89B8FF?text=R',
    status: 'Online',
    phone: '79191352804',
    password: 'GGlim0060',
  },
  {
    id: 'sanya',
    name: 'Саня',
    avatar: 'https://placehold.co/100x100/FFC0CB/000000?text=S',
    status: 'Offline',
    phone: '79513256840',
    password: 'savoskoBBeast',
  },
  {
    id: 'mom',
    name: 'Мама',
    avatar: 'https://placehold.co/100x100/89B8FF/F0F8FF?text=M',
    status: 'Online',
    phone: '79191346438',
    password: '110682',
  },
  {
    id: 'yesenia',
    name: 'Есения',
    avatar: 'https://placehold.co/100x100/98FB98/000000?text=Y',
    status: 'Online',
    phone: '79191323436',
    password: 'glim0060',
  },
];

export const messages: Message[] = [
  {
    id: 'msg-1',
    senderId: 'mom',
    recipientId: 'rodion',
    text: 'Привет! Как дела?',
    timestamp: Date.now() - 1000 * 60 * 5,
    type: 'text',
  },
  {
    id: 'msg-2',
    senderId: 'rodion',
    recipientId: 'mom',
    text: 'Привет, мам! Все хорошо, спасибо!',
    timestamp: Date.now() - 1000 * 60 * 4,
    type: 'text',
  },
  {
    id: 'msg-3',
    senderId: 'mom',
    recipientId: 'rodion',
    text: 'Отлично! Не забудь купить хлеб по дороге домой.',
    timestamp: Date.now() - 1000 * 60 * 3,
    type: 'text',
  },
  {
    id: 'msg-4',
    senderId: 'rodion',
    recipientId: 'mom',
    text: 'Хорошо, куплю!',
    timestamp: Date.now() - 1000 * 60 * 2,
    type: 'text',
  },
  {
    id: 'msg-5',
    senderId: 'yesenia',
    recipientId: 'mom',
    text: 'Кто-нибудь видел мой синий шарф?',
    timestamp: Date.now() - 1000 * 60 * 10,
    type: 'text',
  },
];

export const stickers = [
  { id: 'sticker-1', url: 'https://placehold.co/128x128/FFFFFF/000000?text=👍', hint: 'thumbs up' },
  { id: 'sticker-2', url: 'https://placehold.co/128x128/FFFFFF/000000?text=❤️', hint: 'heart' },
  { id: 'sticker-3', url: 'https://placehold.co/128x128/FFFFFF/000000?text=😂', hint: 'laughing emoji' },
  { id: 'sticker-4', url: 'https://placehold.co/128x128/FFFFFF/000000?text=👋', hint: 'waving hand' },
  { id: 'sticker-5', url: 'https://placehold.co/128x128/FFFFFF/000000?text=🕊️', hint: 'pigeon' },
  { id: 'sticker-6', url: 'https://placehold.co/128x128/FFFFFF/000000?text=☕', hint: 'coffee' },
];
