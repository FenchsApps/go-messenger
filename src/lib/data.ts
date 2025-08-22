import type { User, Message } from './types';

export const currentUser: User = {
  id: 'brother',
  name: 'Брат',
  avatar: 'https://placehold.co/100x100/FFDAB9/89B8FF?text=B',
  status: 'Online',
};

export const users: User[] = [
  {
    id: 'mom',
    name: 'Мама',
    avatar: 'https://placehold.co/100x100/89B8FF/F0F8FF?text=M',
    status: 'Online',
  },
  {
    id: 'dad',
    name: 'Папа',
    avatar: 'https://placehold.co/100x100/FFDAB9/89B8FF?text=P',
    status: 'Offline',
  },
  {
    id: 'sister',
    name: 'Сестра',
    avatar: 'https://placehold.co/100x100/89B8FF/F0F8FF?text=S',
    status: 'Online',
  },
];

export const messages: Message[] = [
  {
    id: 'msg-1',
    senderId: 'mom',
    text: 'Привет! Как дела?',
    timestamp: Date.now() - 1000 * 60 * 5,
    type: 'text',
  },
  {
    id: 'msg-2',
    senderId: 'brother',
    text: 'Привет, мам! Все хорошо, спасибо!',
    timestamp: Date.now() - 1000 * 60 * 4,
    type: 'text',
  },
  {
    id: 'msg-3',
    senderId: 'mom',
    text: 'Отлично! Не забудь купить хлеб по дороге домой.',
    timestamp: Date.now() - 1000 * 60 * 3,
    type: 'text',
  },
  {
    id: 'msg-4',
    senderId: 'brother',
    text: 'Хорошо, куплю!',
    timestamp: Date.now() - 1000 * 60 * 2,
    type: 'text',
  },
  {
    id: 'msg-5',
    senderId: 'sister',
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
