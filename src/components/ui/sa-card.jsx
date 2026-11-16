import { cn } from '../../lib/cn';

export function Card({ className, interactive = false, glow, ...props }) {
  return (
    <div
      className={cn(
        // Fondo zinc-900 en vez de #111118 — más distinguible del fondo zinc-950
        'rounded-xl border border-white/[0.10] bg-zinc-900 text-white relative overflow-hidden',
        'shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]',
        interactive && [
          'cursor-pointer transition-all duration-200',
          'hover:border-white/[0.16] hover:bg-zinc-800/80',
          'active:scale-[0.99]',
        ],
        glow && 'before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-blue-500/[0.05] before:to-transparent before:pointer-events-none',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    // Más visible: zinc-400 en vez de zinc-600
    <h3 className={cn('text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.10em]', className)} {...props} />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex items-center p-5 pt-0 border-t border-white/[0.05] mt-4', className)}
      {...props}
    />
  );
}
