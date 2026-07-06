/** Wordmark "Dispara" + símbolo-foguete (BRAND.md §5). Baloo 2, laranja. */

/** Foguete-disparo ascendente, silhueta preenchida (bold) — herda a cor. */
export function RocketMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {/* corpo (teardrop apontando pra cima) */}
      <path d="M12 2.2c2.7 2.2 4.2 5.4 4.2 8.8 0 1.2-.2 2.4-.6 3.5H8.4c-.4-1.1-.6-2.3-.6-3.5 0-3.4 1.5-6.6 4.2-8.8Z" />
      {/* janela */}
      <circle cx="12" cy="9.2" r="1.55" className="fill-surface" />
      {/* aletas */}
      <path d="M8.1 14.8 6 16.6c-.5.4-.2 1.3.5 1.3l2.5-.1a11 11 0 0 1-.9-3ZM15.9 14.8c-.1 1.1-.4 2.1-.9 3l2.5.1c.7 0 1-.9.5-1.3l-2.1-1.8Z" />
      {/* chama */}
      <path d="M10.4 18.6h3.2L12 22.2l-1.6-3.6Z" />
    </svg>
  );
}

/** Assinatura "Dispara" com o foguete. `size` controla a escala do texto. */
export function Wordmark({ size = 'text-2xl' }: { size?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-brand">
      <RocketMark className="h-[1.1em] w-[1.1em]" />
      <span className={`font-display font-extrabold leading-none ${size}`}>Dispara</span>
    </span>
  );
}

/** Assinatura institucional discreta (BRAND.md §5). */
export function PoweredByAX({ className = '' }: { className?: string }) {
  return <span className={`text-xs font-medium text-muted ${className}`}>powered by AX</span>;
}
