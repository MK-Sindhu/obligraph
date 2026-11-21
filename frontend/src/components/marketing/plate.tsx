// An illustration plate for the marketing pages: a flat signal-orange or graphite card with
// mono labels in the top corners, a monoline diagram and a condensed title. Server component.

import clsx from "clsx";
import { anton } from "./fonts";
import { ART_LABELS, PlateArt, type ArtName } from "./plate-art";

/** signal: orange with ink lines. teal / violet: graphite with chalk lines and that accent. */
export type PlateTone = "signal" | "teal" | "violet";

export function Plate({
  art,
  tone = "signal",
  index,
  tag,
  title,
  className,
}: {
  art: ArtName;
  tone?: PlateTone;
  /** Top-left mono label (position in a sequence, or the regulators). */
  index: string;
  /** Top-right mono label (what the module is). */
  tag: string;
  /** Condensed title along the bottom. */
  title: string;
  className?: string;
}) {
  return (
    <figure role="img" aria-label={ART_LABELS[art]} data-tone={tone} className={clsx("plate", anton.variable, className)}>
      <div className="absolute inset-0 flex flex-col p-[6cqw]">
        <div className="plate-meta flex items-start justify-between gap-4">
          <span>{index}</span>
          <span className="text-right">{tag}</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center py-[2.5cqw]">
          <PlateArt name={art} className="plate-art h-full max-h-full w-[94%]" />
        </div>
        <p className="plate-title">{title}</p>
      </div>
    </figure>
  );
}
