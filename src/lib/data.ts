import type { User, Message } from './types';

export const allUsers: User[] = [
  {
    id: 'rodion',
    name: 'Родион',
    avatar: 'https://placehold.co/100x100/FFDAB9/89B8FF?text=R',
    status: 'Online',
    phone: '79191352804',
    password: 'GGlim0060',
    isCreator: true,
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

export const messages: Message[] = [];

export const stickers = [
  { id: 'sticker-1', url: 'https://placehold.co/128x128/FFFFFF/ff0000?text=❤️', hint: 'heart' },
  { id: 'sticker-2', url: 'https://placehold.co/128x128/FFFFFF/000000?text=👍', hint: 'thumbs up' },
  { id: 'sticker-3', url: 'https://placehold.co/128x128/FFFFFF/000000?text=🛍️', hint: 'shopping bag' },
  { id: 'sticker-4', url: 'https://placehold.co/128x128/FFFFFF/000000?text=🏠', hint: 'home' },
  { id: 'sticker-5', url: 'https://placehold.co/128x128/FFFFFF/000000?text=🏫', hint: 'school' },
  { id: 'sticker-6', url: 'https://placehold.co/128x128/FFFFFF/000000?text=💼', hint: 'work' },
  { id: 'sticker-7', url: 'https://placehold.co/128x128/FFFFFF/000000?text=😋', hint: 'yummy' },
  { id: 'sticker-8', url: 'https://placehold.co/128x128/FFFFFF/000000?text=😴', hint: 'sleeping' },
];