import logo from "@/assets/branding/logo.png";

const LOGO_WIDTH = 960;
const LOGO_HEIGHT = 320;

const logoSrc = typeof logo === "string" ? logo : logo.src;

interface BrandLogoProps {
  className?: string;
  alt?: string;
}


export function BrandLogo({ className = "", alt = "CueCloud" }: BrandLogoProps) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      draggable={false}
      className={className}
    />
  );
}