import { useState } from 'react';

interface CountryFlagProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function CountryFlag({ src, alt, className = 'w-4 h-3' }: CountryFlagProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const code = (alt ?? '').slice(0, 3).toUpperCase() || '—';
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-[2px] bg-slate-200/80 text-[9px] font-mono font-medium text-slate-600 shrink-0 ${className}`}
      >
        {code.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? 'Flag'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover rounded-[2px] border border-slate-200/80 shrink-0 ${className}`}
    />
  );
}
