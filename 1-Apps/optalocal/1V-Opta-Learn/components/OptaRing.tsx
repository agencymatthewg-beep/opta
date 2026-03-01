export function OptaRing({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="#a855f7"
        strokeWidth="1.5"
        strokeOpacity="0.6"
        fill="rgba(9,9,11,0.8)"
      />
      <circle cx="32" cy="32" r="28" stroke="#a855f7" strokeWidth="4" strokeOpacity="0.08" fill="none" />
      <ellipse
        cx="32"
        cy="32"
        rx="16"
        ry="7"
        stroke="#a855f7"
        strokeWidth="1"
        strokeOpacity="0.5"
        fill="none"
        transform="rotate(-30 32 32)"
      />
      <circle cx="32" cy="32" r="2.5" fill="#ffffff" fillOpacity="0.9" />
      <circle cx="32" cy="32" r="4" fill="#a855f7" fillOpacity="0.2" />
    </svg>
  );
}
