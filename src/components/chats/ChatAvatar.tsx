import { cn } from '@/platform/utils/cn';
import { avatarHue, initialsFor } from './chat-format';

type ChatAvatarProps = {
  name: string;
  seed: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const;

// Iniciales sobre un tono estable por contacto; el color no transmite estado.
export function ChatAvatar({ name, seed, size = 'md', className }: ChatAvatarProps) {
  const hue = avatarHue(seed);
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', SIZES[size], className)}
      style={{
        backgroundColor: `oklch(0.42 0.09 ${hue})`,
        color: `oklch(0.95 0.03 ${hue})`,
      }}
    >
      {initialsFor(name)}
    </span>
  );
}
