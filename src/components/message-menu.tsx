import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { MoreHorizontal, Forward, Edit, Trash2 } from 'lucide-react';
import type { Message } from '@/lib/types';

interface MessageMenuProps {
  message: Message;
  onEdit?: () => void;
  onDelete?: () => void;
  onForward: () => void;
  isOtherUser?: boolean;
}

export function MessageMenu({ message, onEdit, onDelete, onForward, isOtherUser }: MessageMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {onForward && (
            <DropdownMenuItem onClick={onForward}>
                <Forward className="mr-2 h-4 w-4" />
                <span>Переслать</span>
            </DropdownMenuItem>
        )}
        {!isOtherUser && onEdit && message.type === 'text' && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Редактировать</span>
          </DropdownMenuItem>
        )}
        {!isOtherUser && onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-red-500">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Удалить</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
