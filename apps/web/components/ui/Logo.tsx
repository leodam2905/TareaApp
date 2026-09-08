import Image from "next/image";

type LogoProps = {
  variant?: "full" | "icon" | "upright";
  size?: number;
  /** Use the white wordmark — for dark backgrounds (hero gradient, ink sidebar). */
  light?: boolean;
};

export default function Logo({ variant = "full", size = 36, light = false }: LogoProps) {
  const src = light ? "/tarea-logo-white.png" : "/tarea-logo.png?v=2";

  // The upright lockup (house mark above/beside the wordmark) ships as SVG, and
  // next/image will not optimise SVG without dangerouslyAllowSVG -- which is not
  // set here, and is not worth enabling for one asset. Plain <img> is already the
  // house pattern for SVG marks (see app/page.tsx's brandLogo).
  //
  // The dark-ground variant recolours ONLY the wordmark: the house carries a 12px
  // white stroke, so it reads as an outline on the hero gradient while keeping its
  // white dots and coloured bars. Filling the house white would erase the dots.
  if (variant === "upright") {
    return (
      <img
        src={light ? "/tarea-logo-upright-white.svg" : "/tarea-logo-upright.svg"}
        alt="Tarea"
        // w-fit, not the default: a flex column stretches its children, so an
        // <img> with width:auto spans the whole panel and object-contain then
        // centres the artwork inside it -- the logo drifts to the middle while
        // everything below it stays flush left. Fixing the width stops the
        // stretch in any flex direction.
        style={{ height: size }}
        className="object-contain w-fit"
      />
    );
  }

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
