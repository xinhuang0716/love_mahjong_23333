export type Phase =
  "draw" | "discard" | "claim" | "thinking" | "waiting" | "end";

export interface Meld {
  tiles: number[];
  type: "吃" | "碰" | "明槓" | "暗槓";
}

export interface Player {
  hand: number[];
  melds: Meld[];
  river: number[];
}

export interface ClaimOffer {
  player: number;
  type: "吃" | "碰" | "明槓" | "胡";
  take: number[];
  rank: number;
  distance: number;
}

export interface LastDiscard {
  player: number;
  tile: number;
}

export interface GameState {
  wall: number[];
  players: Player[];
  turn: number;
  phase: Phase;
  selected: number;
  last: LastDiscard | null;
  drawn: number | null;
  logs: string[];
  offers: ClaimOffer[];
  offerIndex: number;
  result: string;
  winner: number | null;
}
