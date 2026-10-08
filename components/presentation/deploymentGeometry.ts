export type FighterBounds = { width: number; height: number; spacing: number };
export type SpritePlacement = { width: number; height: number; offsetY: number; depth: number; group: number; alpha: number };

// The painted table and settled cards share the camera's XY plane. A contact
// ring must therefore be circular in that plane, never a perspective ellipse.
export function landingDiameter(bounds: FighterBounds, heavy: boolean) {
  return Math.min(bounds.height * (heavy ? 1.24 : 1.12), bounds.spacing * 1.45);
}

const apparitions: Record<string, { footY: number; visibleWidth: number; visibleHeight: number }> = {
  '23-zeus-apparition': { footY: .94, visibleWidth: .64, visibleHeight: .94 },
  '24-athena-apparition': { footY: .97, visibleWidth: .72, visibleHeight: .97 },
  '25-hades-apparition': { footY: .94, visibleWidth: .68, visibleHeight: .94 },
  '33-poseidon-apparition': { footY: .845, visibleWidth: .75, visibleHeight: .85 },
  '34-hephaestus-apparition': { footY: .90, visibleWidth: .67, visibleHeight: .85 },
  '35-dionysus-apparition': { footY: .82, visibleWidth: .62, visibleHeight: .77 },
};

export const isSurfaceLanding=(id:string)=>/^(2[6-9]|3[0-2])-/.test(id);

/** Size authored content, including its black padding, against the real row. */
export function spritePlacement(id: string, fallbackWidth: number, bounds?: FighterBounds): SpritePlacement {
  const appearance = apparitions[id];
  if (appearance && bounds) {
    const width = Math.min(
      bounds.height * 1.12 / (appearance.visibleHeight * 9 / 16),
      bounds.spacing * 1.1 / appearance.visibleWidth,
    );
    const height = width * 9 / 16;
    // Source feet attach to the card's centre. Black padding must not shift
    // the character's ground point as its shield/robe changes shape.
    return { width, height, offsetY: height * (appearance.footY - .5), depth: -.9, group: 1, alpha: .92 };
  }
  if (isSurfaceLanding(id) && bounds) {
    const height=landingDiameter(bounds,id==='32-colossus-landing');
    return {width:height*16/9,height,offsetY:0,depth:.35,group:0,alpha:.94};
  }
  if ((id==='36-relay-impact'||id==='37-oracle-impact') && bounds) {
    const height=Math.min(bounds.height*1.1,bounds.spacing*1.3);
    return {width:height*16/9,height,offsetY:0,depth:-.9,group:1,alpha:.92};
  }
  if (/^1[0-5]-deploy/.test(id) && bounds) {
    const width = Math.min(bounds.width * 1.45, bounds.spacing * .98) / .46;
    return { width, height: width * 9 / 16, offsetY: 0, depth: .35, group: 0, alpha: .86 };
  }
  return { width: fallbackWidth, height: fallbackWidth * 9 / 16, offsetY: 0, depth: -9, group: 2, alpha: .88 };
}
