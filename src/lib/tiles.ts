export const playerNames = [
  "你・東家",
  "Player 2・南家",
  "Player 3・西家",
  "Player 1・北家",
];
export const honorNames = ["東", "南", "西", "北", "中", "發", "白"];
export const suitNames = ["萬", "筒", "索"];

const svgAssets = import.meta.glob<string>("../../svg/*.svg", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});

// Game order: characters, circles, bamboos, then E/S/W/N/red/green/white.
const tileFiles = [
  ...Array.from(
    { length: 9 },
    (_, index) =>
      `${String(index + 8).padStart(2, "0")}-characters-${index + 1}`,
  ),
  ...Array.from(
    { length: 9 },
    (_, index) => `${index + 17}-circles-${index + 1}`,
  ),
  ...Array.from(
    { length: 9 },
    (_, index) => `${index + 26}-bamboos-${index + 1}`,
  ),
  "04-east-wind",
  "05-south-wind",
  "06-west-wind",
  "07-north-wind",
  "03-red-dragon",
  "02-green-dragon",
  "01-white-dragon",
];

export const tileImages = tileFiles.map(
  (file) => svgAssets[`../../svg/${file}.svg`],
);

export function tileLabel(tile: number): string {
  if (tile >= 27) return honorNames[tile - 27];
  return `${(tile % 9) + 1}${suitNames[Math.floor(tile / 9)]}`;
}

export function tileFace(tile: number): string {
  if (tile >= 27) return `honor honor-${tile - 27}`;
  return `suit-${Math.floor(tile / 9)}`;
}
