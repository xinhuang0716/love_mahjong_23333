export const playerNames = ['你・東家', '小晴・南家', '阿哲・西家', '小羽・北家'];
export const honorNames = ['東', '南', '西', '北', '中', '發', '白'];
export const suitNames = ['萬', '筒', '索'];

export function tileLabel(tile: number): string {
  if (tile >= 27) return honorNames[tile - 27];
  return `${(tile % 9) + 1}${suitNames[Math.floor(tile / 9)]}`;
}

export function tileFace(tile: number): { value: string; suit: string; kind: string } {
  if (tile >= 27) {
    return { value: honorNames[tile - 27], suit: '', kind: `honor honor-${tile - 27}` };
  }
  return {
    value: String((tile % 9) + 1),
    suit: suitNames[Math.floor(tile / 9)],
    kind: `suit-${Math.floor(tile / 9)}`
  };
}
