import Image from "next/image";

type LogoProps = {
  variant?: "full" | "icon";
  size?: number;
  light?: boolean;
};

export default function Logo({ variant = "full", size = 36 }: LogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src="/tarea-logo.png"
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
      src="/tarea-logo.png"
      alt="Tarea"
      width={200}
      height={size}
      className="object-contain"
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}
