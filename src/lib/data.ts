
import type { User, Message, Chat } from './types';
import { HeartSticker, HomeSticker, SchoolSticker, ShopSticker, SleepSticker, ThumbsUpSticker, WorkSticker, YummySticker } from '@/components/stickers';

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

const familyChat: Chat = {
    id: 'family_chat',
    type: 'group',
    name: 'Семья',
    avatar: 'https://placehold.co/100x100/C2E0C6/000000?text=F',
    members: allUsers,
};

export const allChats: Chat[] = [
    familyChat,
    ...allUsers.map(user => ({
        id: user.id,
        type: 'private' as const,
        name: user.name,
        avatar: user.avatar,
        members: [user],
        status: user.status,
        lastSeen: user.lastSeen,
        isCreator: user.isCreator,
    }))
];

export const messages: Message[] = [];

export const stickers = [
  { id: 'heart', component: HeartSticker, hint: 'heart' },
  { id: 'like', component: ThumbsUpSticker, hint: 'thumbs up' },
  { id: 'shop', component: ShopSticker, hint: 'shopping bag' },
  { id: 'home', component: HomeSticker, hint: 'home' },
  { id: 'school', component: SchoolSticker, hint: 'school' },
  { id: 'work', component: WorkSticker, hint: 'work' },
  { id: 'yummy', component: YummySticker, hint: 'yummy' },
  { id: 'sleep', component: SleepSticker, hint: 'sleeping' },
];


    