import { cn } from '@/platform/utils';

interface LogoProps {
  className?: string;
}

/** Marca "M" de MovieTime. Hereda el color del texto (`currentColor`), por lo que sirve en claro y oscuro. */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      aria-label="MovieTime"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-6 shrink-0', className)}
    >
      <path
        fill="currentColor"
        d="M168,40V176a8,8,0,0,1-16,0V50.8L89.2,210.8a8.2,8.2,0,0,1-7.2,4.4,8.1,8.1,0,0,1-7.2-4.4L42.2,50.8V176a8,8,0,0,1-16,0V40a8,8,0,0,1,8-32h48a8,8,0,0,1,7.2,4.4L128,100.8l28.8-88.4a8,8,0,0,1,7.2-4.4h48a8,8,0,0,1,8,32Z"
      />
    </svg>
  );
}
