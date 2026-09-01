import { cn } from "@/lib/utils";

/**
 * The one place a tenant logo is rendered. Height is the governing dimension so
 * marks of any aspect ratio read at a consistent visual weight; `max-w` is
 * deliberately generous (~6× the height) so only an extreme banner ever gets
 * clamped — a too-tight `max-w` is what made some logos render short/small.
 * Always `object-contain object-left`, never distorted, never cropped.
 */

const SIZES = {
  xs: "h-6 max-w-[168px]", // dense chrome (mobile topbar)
  sm: "h-8 max-w-[208px]", // sidebar badge, mobile nav sheet
  md: "h-10 max-w-[248px]", // login, address page
  lg: "h-12 max-w-[288px]", // public program form header
} as const;

export type BrandLogoSize = keyof typeof SIZES;

export function BrandLogo({
  src,
  alt,
  size = "sm",
  className,
}: {
  src: string;
  alt: string;
  size?: BrandLogoSize;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        "w-auto object-contain object-left",
        SIZES[size],
        className,
      )}
    />
  );
}
