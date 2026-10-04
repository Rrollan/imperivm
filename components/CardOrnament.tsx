/** Small local vectors form the frame; the original illustration remains untouched. */
export default function CardOrnament({ spell, legendary }: { spell: boolean; legendary: boolean }) {
  return <svg className="card-ornament" viewBox="0 0 200 320" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {spell ? <>
      <path className="frame-metal" d="M5 32 22 7h57l21 9 21-9h57l17 25v248l-17 27h-57l-21-9-21 9H22L5 280Z" />
      <path className="frame-engraving" d="m10 55 9-9V25h25m146 30-9-9V25h-25M10 267l9 9v20h25m146-29-9 9v20h-25M8 90l8 8-8 8m184-16-8 8 8 8M8 222l8 8-8 8m184-16-8 8 8 8" />
      <path className="frame-crest" d="m100 4 15 12-15 13-15-13Zm0 5v14m-7-7h14" />
    </> : <>
      <path className="frame-metal" d="M5 49C5 20 38 6 100 6s95 14 95 43v243l-16 19H21L5 292Z" />
      <path className="frame-engraving" d="M10 54C10 25 43 12 100 12s90 13 90 42M12 66v205m176-205v205M8 88h9m166 0h9M8 255h9m166 0h9M12 294l10 9h31m135-9-10 9h-31" />
      <path className="frame-crest" d="m100 6 9 8-9 14-9-14Z" />
    </>}
    {legendary && <g className="frame-laurels">
      <path d="M100 27C77 27 65 18 60 4m40 23c23 0 35-9 40-23" fill="none" />
      <path d="M66 15q-13 2-15-9 12-2 15 9m8 6q-13 5-18-4 12-5 18 4m10 5q-13 7-20-1 11-7 20 1m50-11q13 2 15-9-12-2-15 9m-8 6q13 5 18-4-12-5-18 4m-10 5q13 7 20-1-11-7-20 1" />
      <path d="m100 2 12 9-12 17-12-17Z" />
    </g>}
  </svg>;
}
