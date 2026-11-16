import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-blue-500/[0.10] border-blue-500/[0.20] text-blue-400',
        success:   'bg-emerald-500/[0.10] border-emerald-500/[0.20] text-emerald-400',
        warning:   'bg-amber-500/[0.10] border-amber-500/[0.20] text-amber-400',
        danger:    'bg-red-500/[0.10] border-red-500/[0.20] text-red-400',
        muted:     'bg-white/[0.04] border-white/[0.08] text-zinc-500',
        trial:     'bg-sky-500/[0.10] border-sky-500/[0.20] text-sky-400',
        active:    'bg-emerald-500/[0.10] border-emerald-500/[0.20] text-emerald-400',
        suspended: 'bg-red-500/[0.10] border-red-500/[0.20] text-red-400',
        pro:       'bg-violet-500/[0.10] border-violet-500/[0.20] text-violet-400',
        custom:    'bg-fuchsia-500/[0.10] border-fuchsia-500/[0.20] text-fuchsia-400',
        free:      'bg-white/[0.04] border-white/[0.08] text-zinc-500',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const dotColorMap = {
  success: 'bg-emerald-400', active: 'bg-emerald-400',
  danger: 'bg-red-400', suspended: 'bg-red-400',
  warning: 'bg-amber-400',
  trial: 'bg-sky-400',
  pro: 'bg-violet-400',
  custom: 'bg-fuchsia-400',
  default: 'bg-blue-400',
  muted: 'bg-zinc-500',
  free: 'bg-zinc-600',
};

export function Badge({ className, variant = 'default', dot, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm',
          dotColorMap[variant] || 'bg-zinc-500',
          (variant === 'active' || variant === 'success') && 'animate-pulse'
        )} />
      )}
      {props.children}
    </span>
  );
}
