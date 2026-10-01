/**
 * Two waveforms passing through each other: the outgoing track (light) fades out left to right
 * while the incoming one (amber) fades in. Drawn once on the server as SVG and slowly scrolled
 * with CSS so it costs nothing at runtime.
 */

const WIDTH = 1200;
const BAR = 4;
const GAP = 4;
const COUNT = WIDTH / (BAR + GAP);

function waveform(seed: number): number[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const v =
      0.55 * Math.abs(Math.sin(i * 0.31 + seed)) +
      0.3 * Math.abs(Math.sin(i * 0.097 + seed * 2.1)) +
      0.15 * Math.abs(Math.sin(i * 1.7 + seed * 0.7));
    return 0.1 + v * 0.9;
  });
}

function Bars({ seed, height, fill }: { seed: number; height: number; fill: string }) {
  const values = waveform(seed);
  return (
    <>
      {[0, WIDTH].map((offset) =>
        values.map((v, i) => {
          const h = Math.max(4, v * height);
          return (
            <rect
              key={`${offset}-${i}`}
              x={offset + i * (BAR + GAP)}
              y={300 - h / 2}
              width={BAR}
              height={h}
              rx={2}
              fill={fill}
            />
          );
        }),
      )}
    </>
  );
}

export function CrossfadeArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} 600`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="cf-out" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.15" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cf-in" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.9" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="cf-mask-out">
          <rect width={WIDTH} height="600" fill="url(#cf-out)" />
        </mask>
        <mask id="cf-mask-in">
          <rect width={WIDTH} height="600" fill="url(#cf-in)" />
        </mask>
      </defs>

      {/* The fade curves from the logo, drawn huge and faint. */}
      <path
        d="M-20 150 C 420 150, 780 450, 1220 450"
        fill="none"
        stroke="var(--color-fg)"
        strokeOpacity="0.08"
        strokeWidth="2"
      />
      <path
        d="M-20 450 C 420 450, 780 150, 1220 150"
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity="0.16"
        strokeWidth="2"
      />

      <g mask="url(#cf-mask-out)">
        <g className="animate-drift">
          <Bars seed={1.3} height={250} fill="var(--color-fg)" />
        </g>
      </g>
      <g mask="url(#cf-mask-in)">
        <g className="animate-drift [animation-duration:75s]">
          <Bars seed={4.1} height={330} fill="var(--color-accent)" />
        </g>
      </g>
    </svg>
  );
}
