"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll parallax for decorative layers. The element drifts vertically by
 * `speed` × its distance from the viewport center (positive = slower than the
 * page, negative = faster). Only runs while on screen; disabled when the
 * visitor prefers reduced motion. Uses the `translate` property, so Tailwind
 * `rotate-*` utilities on the same element keep working.
 */
export function Parallax({
  speed,
  className,
  style,
  children,
}: {
  speed: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let visible = false;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const fromCenter = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.translate = `0 ${(-fromCenter * speed).toFixed(1)}px`;
    };
    const onScroll = () => {
      if (visible && !frame) frame = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) onScroll();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: "translate", ...style }}>
      {children}
    </div>
  );
}
