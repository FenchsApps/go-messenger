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
  { id: 'sticker-1', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fheart.png?alt=media&token=39a8a705-3e11-4777-a810-b490f8451b66', hint: 'heart' },
  { id: 'sticker-2', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Flike.png?alt=media&token=9635f756-330a-48aa-b935-4303359d9c4e', hint: 'thumbs up' },
  { id: 'sticker-3', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fshop.png?alt=media&token=91054366-419b-4654-8c88-2ba45244510b', hint: 'shopping bag' },
  { id: 'sticker-4', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fhome.png?alt=media&token=c1945d8b-3027-463d-a7e8-3a851b22295a', hint: 'home' },
  { id: 'sticker-5', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fschool.png?alt=media&token=26211833-8a3c-443b-a567-27b23f8582d9', hint: 'school' },
  { id: 'sticker-6', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fwork.png?alt=media&token=21f28e2c-3965-4f47-a859-478a10e19468', hint: 'work' },
  { id: 'sticker-7', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fyummy.png?alt=media&token=299942a9-0e95-4639-bde8-48b4d0087707', hint: 'yummy' },
  { id: 'sticker-8', url: 'https://firebasestorage.googleapis.com/v0/b/coo-messenger-dut4g.appspot.com/o/stickers%2Fsleeping.png?alt=media&token=78d5231c-3e61-460d-8547-b84784b15c9a', hint: 'sleeping' },
];
