export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC45A" />
          <stop offset="1" stopColor="#F7A028" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7.5" fill="url(#ig)" />
      <path d="M9 9h14M9 14h14M9 19h8" stroke="#2A1700" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 25h16" stroke="#C4231C" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
