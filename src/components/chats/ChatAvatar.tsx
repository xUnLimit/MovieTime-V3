import { cn } from '@/platform/utils/cn';
import { avatarHue, initialsFor } from './chat-format';

type ChatAvatarProps = {
  name: string;
  seed: string;
  size?: 'sm' | 'list' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: 'h-9 w-9 text-xs md:h-[43px] md:w-[43px] md:text-sm',
  list: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-[51px] w-[51px] text-base',
} as const;

// Tonos entre azul y violeta, como la paleta del prototipo de chats.
const HUE_START = 250;
const HUE_RANGE = 80;

// Iniciales sobre un tono estable por contacto; el color no transmite estado.
export function ChatAvatar({ name, seed, size = 'md', className }: ChatAvatarProps) {
  const hue = HUE_START + (avatarHue(seed) % HUE_RANGE);
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-[-0.03em]', SIZES[size], className)}
      style={{
        backgroundColor: `oklch(0.43 0.07 ${hue})`,
        color: `oklch(0.96 0.02 ${hue})`,
      }}
    >
      {initialsFor(name)}
    </span>
  );
}
