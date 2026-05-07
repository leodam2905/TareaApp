type LogoProps = {
  variant?: "full" | "icon";
  size?: number;
  light?: boolean; // white wordmark for dark backgrounds
};

export default function Logo({ variant = "full", size = 36, light = false }: LogoProps) {
  const iconSize = size;

  const icon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tarea-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="14" fill="url(#tarea-grad)" />
      {/* Horizontal bar — wrench shape */}
      <rect x="10" y="12" width="36" height="10" rx="5" fill="white" />
      {/* Wrench jaw opening (left) */}
      <path d="M 20 12 Q 10 12 10 17 Q 10 22 20 22" fill="url(#tarea-grad)" />
      {/* Vertical stem */}
      <rect x="23" y="18" width="10" height="26" rx="5" fill="white" />
      {/* Sky blue accent dot */}
      <circle cx="28" cy="48" r="3.5" fill="#38BDF8" />
    </svg>
  );

  if (variant === "icon") return icon;

  const textColor = light ? "#FFFFFF" : "#1E3A8A";
  const subColor = light ? "#E2E8F0" : "#0F172A";
  const fontSize = Math.round(iconSize * 0.78);

  return (
    <div className="flex items-center gap-2.5" aria-label="Tarea">
      {icon}
      <svg
        width={Math.round(fontSize * 3.2)}
        height={iconSize}
        viewBox={`0 0 ${Math.round(fontSize * 3.2)} ${iconSize}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y={Math.round(iconSize * 0.72)}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontSize={fontSize}
          fontWeight="900"
          fill={textColor}
          letterSpacing="-1"
        >
          T
        </text>
        <text
          x={Math.round(fontSize * 0.62)}
          y={Math.round(iconSize * 0.72)}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
          fontSize={fontSize}
          fontWeight="700"
          fill={subColor}
          letterSpacing="-0.5"
        >
          area
        </text>
      </svg>
    </div>
  );
}
