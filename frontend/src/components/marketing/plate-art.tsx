// Monoline diagrams for the marketing plates: outlined shapes, small arrows, dot nodes,
// dashed connectors and one filled "active" element. Strokes use currentColor; the plate
// sets the accent, highlight and dot colours (see .plate in globals.css).

import type { ReactNode } from "react";

export type ArtName =
  | "pipeline"
  | "corpus"
  | "requirements"
  | "lineage"
  | "coverage"
  | "approvals"
  | "evidence"
  | "calendar"
  | "readiness"
  | "board"
  | "copilot"
  | "sbr";

/** What each illustration shows, for screen readers. */
export const ART_LABELS: Record<ArtName, string> = {
  pipeline: "Illustration: a circular becomes a checklist of requirements, linked in a graph and dated on a calendar",
  corpus: "Illustration: regulator feeds and uploads collected into one filterable library of circulars",
  requirements: "Illustration: a sentence in a circular split into requirements, each with a severity, a frequency and a due date",
  lineage: "Illustration: a knowledge graph above a timeline in which a 2019 circular is superseded in 2026",
  coverage: "Illustration: clauses of a circular matched to policy passages as covered, partial or missing",
  approvals: "Illustration: a maker's task approved by a checker, escalating to an owner when the SLA passes",
  evidence: "Illustration: an evidence file fingerprinted with SHA-256 and locked into the audit pack",
  calendar: "Illustration: a compliance calendar, a filed return and the recurring filing periods",
  readiness: "Illustration: readiness gauges for DPDP, CERT-In and KYC/AML",
  board: "Illustration: a board report with a coverage trend, exported as PDF",
  copilot: "Illustration: a Copilot answer citing three source documents",
  sbr: "Illustration: the four NBFC scale-based regulation layers, with the middle layer highlighted",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Horizontal arrow from (x, y), 22 units long. */
function Arrow({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y}H${x + 22}M${x + 16} ${y - 5}L${x + 22} ${y}L${x + 16} ${y + 5}`} />;
}

/** Arrowhead at (x, y) pointing along the unit vector (dx, dy). */
function Head({ x, y, dx, dy, className }: { x: number; y: number; dx: number; dy: number; className?: string }) {
  const bx = x - 6 * dx;
  const by = y - 6 * dy;
  return (
    <path
      className={className}
      d={`M${r1(bx - 4 * dy)} ${r1(by + 4 * dx)}L${x} ${y}L${r1(bx + 4 * dy)} ${r1(by - 4 * dx)}`}
    />
  );
}

/** A page with text lines; `fold` cuts the top-right corner; `bg` hides what is behind it. */
function Doc({ x, y, w, h, lines = 5, fold, bg }: { x: number; y: number; w: number; h: number; lines?: number; fold?: boolean; bg?: boolean }) {
  const pad = Math.max(10, w * 0.18);
  const f = Math.min(16, w * 0.24);
  const step = (h - pad * 2) / Math.max(1, lines - 1);
  return (
    <g>
      {fold ? (
        <path className={bg ? "p-bg" : undefined} d={`M${x} ${y}H${x + w - f}L${x + w} ${y + f}V${y + h}H${x}ZM${x + w - f} ${y}V${y + f}H${x + w}`} />
      ) : (
        <rect className={bg ? "p-bg" : undefined} x={x} y={y} width={w} height={h} rx={5} />
      )}
      {Array.from({ length: lines }, (_, i) => {
        const ly = r1(y + pad + i * step);
        const end = x + w - pad - (i === lines - 1 ? (w - 2 * pad) * 0.4 : fold && i === 0 ? f * 0.6 : 0);
        return <path key={i} d={`M${r1(x + pad)} ${ly}H${r1(end)}`} />;
      })}
    </g>
  );
}

/** Head and shoulders, `top` is the top of the head. */
function Person({ cx, top, s = 1 }: { cx: number; top: number; s?: number }) {
  return (
    <g>
      <circle cx={cx} cy={top + 13 * s} r={13 * s} />
      <path d={`M${cx - 24 * s} ${top + 62 * s}V${top + 54 * s}A${24 * s} ${22 * s} 0 0 1 ${cx + 24 * s} ${top + 54 * s}V${top + 62 * s}`} />
    </g>
  );
}

function Pipeline() {
  return (
    <>
      <Doc x={20} y={52} w={58} h={96} lines={6} />
      <Arrow x={90} y={100} />
      {[74, 100, 126].map((y) => (
        <g key={y}>
          <rect x={126} y={y - 6} width={12} height={12} rx={2.5} />
          <path d={`M150 ${y}H206`} />
        </g>
      ))}
      <Arrow x={218} y={100} />
      <path d="M258 94L306 64L346 104L298 132Z" />
      <path className="p-dash" d="M306 64L298 132" />
      <circle className="p-dot" cx={258} cy={94} r={5.5} />
      <circle className="p-fill" cx={306} cy={64} r={5} />
      <circle className="p-fill" cx={346} cy={104} r={5} />
      <circle className="p-fill" cx={298} cy={132} r={5} />
      <Arrow x={360} y={100} />
      <rect x={394} y={54} width={76} height={92} rx={6} />
      <path d="M394 74H470M412 46V62M452 46V62" />
      {[92, 109, 126].flatMap((y) =>
        [408, 424, 440, 456].map((x) =>
          x === 440 && y === 109 ? (
            <rect key={`${x}-${y}`} className="p-hi" x={434} y={103} width={12} height={12} rx={2} />
          ) : (
            <circle key={`${x}-${y}`} className="p-fill" cx={x} cy={y} r={2.2} />
          ),
        ),
      )}
    </>
  );
}

function Corpus() {
  const rows = [
    { y: 64, end: 380 },
    { y: 92, end: 356, hi: true },
    { y: 120, end: 384 },
    { y: 148, end: 340 },
  ];
  return (
    <>
      <circle className="p-fill" cx={34} cy={136} r={6} />
      <path d="M34 108A28 28 0 0 1 62 136M34 84A52 52 0 0 1 86 136" />
      <Arrow x={100} y={112} />
      <rect x={156} y={52} width={64} height={86} rx={5} />
      <rect className="p-bg" x={146} y={62} width={64} height={86} rx={5} />
      <Doc x={136} y={72} w={64} h={86} lines={5} bg />
      <Arrow x={222} y={112} />
      {rows.map((r) => (
        <g key={r.y}>
          <circle className="p-fill" cx={266} cy={r.y} r={4} />
          <path d={`M282 ${r.y}H${r.end}`} />
          <rect className={r.hi ? "p-hi-o" : undefined} x={398} y={r.y - 7} width={56} height={14} rx={7} />
        </g>
      ))}
    </>
  );
}

function Requirements() {
  const cards = [
    { y: 52, bars: 3, done: true },
    { y: 100, bars: 2 },
    { y: 148, bars: 1 },
  ];
  return (
    <>
      <Doc x={24} y={36} w={76} h={128} lines={7} />
      <rect className="p-acc p-dash" x={30} y={74} width={64} height={36} rx={4} />
      {cards.map((c) => (
        <g key={c.y}>
          <path className="p-acc" d={`M94 92C128 92 128 ${c.y} 158 ${c.y}`} />
          <Head className="p-acc" x={162} y={c.y} dx={1} dy={0} />
          <rect x={168} y={c.y - 15} width={220} height={30} rx={8} />
          <rect className={c.done ? "p-hi-o" : undefined} x={180} y={c.y - 5} width={10} height={10} rx={2} />
          <path d={`M202 ${c.y}H${300 - (3 - c.bars) * 16}`} />
          {[0, 1, 2].map((b) => (
            <path key={b} className={b < c.bars ? undefined : "p-faint"} d={`M${342 + b * 10} ${c.y + 7}V${c.y + 1 - b * 4}`} />
          ))}
        </g>
      ))}
      {/* due date, frequency, source sentence */}
      <circle cx={426} cy={52} r={11} />
      <path d="M426 46V52L431 55" />
      <path d="M437 100A11 11 0 1 1 431.5 90.5" />
      <Head x={431.5} y={90.5} dx={0.87} dy={0.5} />
      <text className="p-quote" x={426} y={166} textAnchor="middle">
        ”
      </text>
    </>
  );
}

function Lineage() {
  return (
    <>
      <path d="M160 64L204 32L284 44L336 78M160 64L240 92L284 44M240 92L336 78" />
      <path className="p-dash" d="M204 32L240 92" />
      <circle className="p-fill" cx={160} cy={64} r={5} />
      <circle className="p-fill" cx={204} cy={32} r={5} />
      <circle className="p-fill" cx={284} cy={44} r={5} />
      <circle className="p-bg" cx={336} cy={78} r={5} />
      <circle className="p-hi-o" cx={240} cy={92} r={7} />
      <path className="p-acc p-dash" d="M240 101V136" />
      <path className="p-faint" d="M40 150H70" />
      <path d="M89 150H229" />
      <path className="p-dash" d="M251 150H391" />
      <path className="p-acc p-dash" d="M88 138Q160 104 228 136" />
      <Head className="p-acc" x={228} y={136} dx={0.9} dy={0.43} />
      <circle className="p-bg" cx={80} cy={150} r={9} />
      <circle className="p-bg" cx={240} cy={150} r={11} />
      <circle className="p-fill" cx={240} cy={150} r={5} />
      <circle className="p-bg p-dash" cx={400} cy={150} r={9} />
      <text className="p-text" x={80} y={186} textAnchor="middle">2019</text>
      <text className="p-text" x={240} y={186} textAnchor="middle">2026</text>
      <text className="p-text" x={400} y={186} textAnchor="middle">NEXT</text>
    </>
  );
}

function Coverage() {
  return (
    <>
      <Doc x={28} y={36} w={96} h={128} lines={6} />
      <Doc x={356} y={36} w={96} h={128} lines={6} fold />
      <path d="M124 53C200 53 280 72 356 72" />
      <path d="M124 91C200 91 280 109 356 109" />
      <path className="p-acc p-dash" d="M124 128C176 128 204 140 228 141" />
      {/* covered, partial, missing */}
      <circle className="p-fill" cx={240} cy={62} r={7} />
      <circle className="p-bg" cx={240} cy={100} r={7} />
      <path className="p-fill" d="M240 93A7 7 0 0 1 240 107Z" />
      <circle className="p-bg" cx={240} cy={141} r={7} />
    </>
  );
}

function Approvals() {
  return (
    <>
      <Person cx={56} top={66} />
      <Arrow x={96} y={104} />
      <rect x={132} y={70} width={100} height={68} rx={8} />
      <rect x={144} y={84} width={12} height={12} rx={2.5} />
      <path d="M166 90H218M144 112H218M144 124H196" />
      <Arrow x={246} y={104} />
      <Person cx={310} top={66} />
      <circle className="p-hi-o" cx={384} cy={104} r={20} />
      <path d="M374 104L381 111L395 97" />
      {/* escalation to the owner when the SLA passes */}
      <path className="p-acc p-dash" d="M182 66C210 18 380 10 426 33" />
      <Head className="p-acc" x={426} y={33} dx={0.9} dy={0.45} />
      <circle className="p-bg" cx={298} cy={23} r={9} />
      <path d="M298 18V23L302 25" />
      <Person cx={452} top={30} s={0.55} />
    </>
  );
}

function Evidence() {
  return (
    <>
      <path d="M28 52H80L96 68V148H28ZM80 52V68H96M40 84H84M40 98H84M40 112H70" />
      <Arrow x={108} y={100} />
      <text className="p-text" x={144} y={74}>SHA-256</text>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} className={i === 5 ? "p-hi-o" : undefined} x={144 + i * 24} y={86} width={18} height={28} rx={6} />
      ))}
      <Arrow x={344} y={100} />
      <path d="M398 94V80A18 18 0 0 1 434 80V94" />
      <rect x={386} y={94} width={60} height={54} rx={8} />
      <circle className="p-hi" cx={416} cy={116} r={5} />
      <path d="M416 121V131" />
    </>
  );
}

function Calendar() {
  const cols = [52, 82, 112, 142, 172];
  const rows = [80, 104, 128, 152];
  return (
    <>
      <rect x={28} y={34} width={168} height={136} rx={8} />
      <path d="M28 60H196M58 24V42M166 24V42" />
      {rows.flatMap((y) =>
        cols.map((x) => {
          if (x === 142 && y === 104) return <rect key={`${x}-${y}`} className="p-hi" x={136} y={98} width={12} height={12} rx={2} />;
          return <circle key={`${x}-${y}`} className="p-fill" cx={x} cy={y} r={2.2} />;
        }),
      )}
      <circle cx={82} cy={128} r={8} />
      <Arrow x={210} y={100} />
      <Doc x={246} y={46} w={80} h={108} lines={4} fold />
      <circle className="p-hi-o" cx={306} cy={136} r={12} />
      <path d="M300 136L304 140L312 132" />
      <Arrow x={340} y={100} />
      <circle className="p-acc p-dash" cx={418} cy={100} r={36} />
      <Head className="p-acc" x={443.5} y={74.5} dx={0.71} dy={0.71} />
      <circle className="p-fill" cx={418} cy={64} r={5} />
      <circle className="p-fill" cx={454} cy={100} r={5} />
      <circle className="p-hi" cx={418} cy={136} r={6} />
      <circle className="p-fill" cx={382} cy={100} r={5} />
      <text className="p-text" x={418} y={104} textAnchor="middle">FY</text>
    </>
  );
}

function Readiness() {
  const packs = [
    { cx: 92, value: 56, name: "DPDP" },
    { cx: 240, value: 50, name: "CERT-IN" },
    { cx: 388, value: 41, name: "KYC/AML", low: true },
  ];
  const cy = 88;
  const r = 44;
  return (
    <>
      {packs.map((p) => {
        const a = ((-90 + 3.6 * p.value) * Math.PI) / 180;
        const ex = r1(p.cx + r * Math.cos(a));
        const ey = r1(cy + r * Math.sin(a));
        return (
          <g key={p.name}>
            <circle className="p-faint" cx={p.cx} cy={cy} r={r} />
            <path className="p-acc p-thick" d={`M${p.cx} ${cy - r}A${r} ${r} 0 ${p.value > 50 ? 1 : 0} 1 ${ex} ${ey}`} />
            <circle className={p.low ? "p-hi" : "p-fill"} cx={ex} cy={ey} r={p.low ? 6 : 4} />
            <text className="p-num" x={p.cx} y={cy + 10} textAnchor="middle">
              {p.value}
            </text>
            <text className="p-text" x={p.cx} y={170} textAnchor="middle">
              {p.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Board() {
  const bars = [30, 44, 38, 56, 66];
  return (
    <>
      <rect x={24} y={24} width={276} height={152} rx={8} />
      <path d="M44 46H140" />
      <path className="p-faint" d="M44 60H110" />
      <path d="M52 80V156H280" />
      {bars.map((h, i) => (
        <rect key={i} className={i === bars.length - 1 ? "p-hi-o" : undefined} x={76 + i * 40} y={156 - h} width={24} height={h} rx={3} />
      ))}
      <path className="p-acc p-dash" d="M88 114L128 100L168 106L208 88L248 76" />
      {[
        [88, 114],
        [128, 100],
        [168, 106],
        [208, 88],
        [248, 76],
      ].map(([x, y]) => (
        <circle key={x} className="p-fill" cx={x} cy={y} r={3.5} />
      ))}
      <Arrow x={314} y={100} />
      <rect x={362} y={42} width={80} height={108} rx={5} />
      <Doc x={352} y={52} w={80} h={108} lines={0} fold bg />
      <text className="p-text p-text-lg" x={392} y={112} textAnchor="middle">PDF</text>
    </>
  );
}

function Copilot() {
  const sources = [44, 100, 156];
  const from = [66, 88, 110];
  return (
    <>
      <path d="M40 40H220A16 16 0 0 1 236 56V120A16 16 0 0 1 220 136H76L48 160V136H40A16 16 0 0 1 24 120V56A16 16 0 0 1 40 40Z" />
      <path d="M48 66H196M48 88H212M48 110H158" />
      <rect className="p-hi" x={202} y={60} width={12} height={12} rx={3} />
      <rect x={166} y={104} width={12} height={12} rx={3} />
      {sources.map((y, i) => (
        <g key={y}>
          <path className="p-acc p-dash" d={`M236 ${from[i]}C290 ${from[i]} 290 ${y} 334 ${y}`} />
          <Doc x={340} y={y - 22} w={52} h={44} lines={2} fold />
          <text className="p-text" x={410} y={y + 4}>
            {i + 1}
          </text>
        </g>
      ))}
    </>
  );
}

function Sbr() {
  const cx = 200;
  const hw = (y: number) => 14 + (y - 26) * 0.9;
  const layers = [
    { name: "TOP", top: 26 },
    { name: "UPPER", top: 62 },
    { name: "MIDDLE", top: 98, current: true },
    { name: "BASE", top: 134 },
  ];
  return (
    <>
      {layers.map((l) => {
        const b = l.top + 30;
        const t = hw(l.top);
        const w = hw(b);
        const mid = l.top + 15;
        return (
          <g key={l.name}>
            <path className={l.current ? "p-hi-o" : undefined} d={`M${r1(cx - t)} ${l.top}H${r1(cx + t)}L${r1(cx + w)} ${b}H${r1(cx - w)}Z`} />
            <path className="p-faint p-dash" d={`M${r1(cx + hw(mid) + 12)} ${mid}H362`} />
            <text className="p-text" x={372} y={mid + 4}>
              {l.name}
            </text>
          </g>
        );
      })}
      {/* moving up a layer adds obligations */}
      <path className="p-acc p-dash" d="M104 113C66 113 62 77 112 77" />
      <Head className="p-acc" x={116} y={77} dx={1} dy={0} />
      <text className="p-text p-text-lg" x={52} y={100} textAnchor="middle">+</text>
    </>
  );
}

const ART: Record<ArtName, () => ReactNode> = {
  pipeline: Pipeline,
  corpus: Corpus,
  requirements: Requirements,
  lineage: Lineage,
  coverage: Coverage,
  approvals: Approvals,
  evidence: Evidence,
  calendar: Calendar,
  readiness: Readiness,
  board: Board,
  copilot: Copilot,
  sbr: Sbr,
};

export function PlateArt({ name, className }: { name: ArtName; className?: string }) {
  const Art = ART[name];
  return (
    <svg
      viewBox="0 0 480 200"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Art />
    </svg>
  );
}
