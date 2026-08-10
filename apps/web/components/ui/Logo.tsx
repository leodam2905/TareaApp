import Image from "next/image";

type LogoProps = {
  variant?: "full" | "icon";
  size?: number;
  /** Use the white wordmark — for dark backgrounds (hero gradient, ink sidebar). */
  light?: boolean;
};

export default function Logo({ variant = "full", size = 36, light = false }: LogoProps) {
  const src = light ? "/tarea-logo-white.png" : "/tarea-logo.png?v=2";

  if (variant === "icon") {
    return (
      <Image
        src={src}
        alt="Tarea"
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt="Tarea"
      width={200}
      height={size}
      className="object-contain"
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}
