import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
    'disabled:opacity-40 disabled:pointer-events-none',
    'cursor-pointer select-none',
    'active:scale-[0.97]',
    '[border:none] [padding:unset] [background:none]',
  ].join(' '),
  {
    variants: {
      variant: {
        default:   'bg-white text-zinc-950 hover:bg-zinc-100 shadow-[0_1px_2px_rgba(0,0,0,0.3)] px-4 py-2 font-semibold',
        primary:   'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(59,130,246,0.3)] px-4 py-2',
        secondary: 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.10] hover:text-white border border-white/[0.08] px-4 py-2',
        ghost:     'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] px-3 py-1.5',
        outline:   'border border-white/[0.10] text-zinc-400 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.18] px-4 py-2',
        danger:    'bg-red-500/[0.08] border border-red-500/[0.18] text-red-400 hover:bg-red-500/[0.15] hover:border-red-500/[0.30] px-4 py-2',
        success:   'bg-emerald-500/[0.08] border border-emerald-500/[0.18] text-emerald-400 hover:bg-emerald-500/[0.15] px-4 py-2',
        icon:      'bg-white/[0.04] border border-white/[0.07] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.14] hover:bg-white/[0.07] w-8 h-8 p-0 rounded-lg',
      },
      size: {
        default: '',
        xs:   'text-[11px] px-2.5 py-1 rounded-md gap-1',
        sm:   'text-xs px-3 py-1.5 rounded-lg',
        lg:   'px-5 py-2.5 text-[15px] rounded-xl',
        icon: 'w-8 h-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export function Button({ className, variant, size, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
