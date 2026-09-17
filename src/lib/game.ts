import type { ClaimOffer, GameState, Player } from "./types";
import { playerNames, tileLabel } from "./tiles";

const makePlayer = (): Player => ({ hand: [], melds: [], river: [] });
const sortHand = (player: Player) => player.hand.sort((a, b) => a - b);

export function counts(hand: number[]): number[] {
  const result = Array<number>(34).fill(0);
  for (let index = 0; index < hand.length; index++) {
    result[hand[index]]++;
  }
  return result;
}

export function isWinningHand(hand: number[], meldCount = 0): boolean {
  if (hand.length !== 17 - 3 * meldCount) return false;
  const tileCounts = counts(hand);

  function hasSets(): boolean {
    const tile = tileCounts.findIndex((amount) => amount > 0);
    if (tile < 0) return true;
    if (tileCounts[tile] >= 3) {
      tileCounts[tile] -= 3;
      const complete = hasSets();
      tileCounts[tile] += 3;
      if (complete) return true;
    }
    if (
      tile < 27 &&
      tile % 9 < 7 &&
      tileCounts[tile + 1] &&
      tileCounts[tile + 2]
    ) {
      tileCounts[tile]--;
      tileCounts[tile + 1]--;
      tileCounts[tile + 2]--;
      const complete = hasSets();
      tileCounts[tile]++;
      tileCounts[tile + 1]++;
      tileCounts[tile + 2]++;
      if (complete) return true;
    }
    return false;
  }

  for (let tile = 0; tile < 34; tile++) {
    if (tileCounts[tile] < 2) continue;
    tileCounts[tile] -= 2;
    const complete = hasSets();
    tileCounts[tile] += 2;
    if (complete) return true;
  }
  return false;
}

function chiOptions(hand: number[], discarded: number): number[][] {
  if (discarded >= 27) return [];
  const tileCounts = counts(hand);
  const result: number[][] = [];
  for (let start = discarded - 2; start <= discarded; start++) {
    if (
      start < 0 ||
      start >= 27 ||
      Math.floor(start / 9) !== Math.floor(discarded / 9) ||
      start % 9 > 6
    )
      continue;
    const needed = [start, start + 1, start + 2];
    needed.splice(needed.indexOf(discarded), 1);
    if (needed.every((tile) => tileCounts[tile] > 0)) result.push(needed);
  }
  return result;
}

export function createGame(): GameState {
  const state: GameState = {
    wall: [],
    players: Array.from({ length: 4 }, makePlayer),
    turn: 0,
    phase: "draw",
    selected: -1,
    last: null,
    drawn: null,
    logs: [],
    offers: [],
    offerIndex: 0,
    result: "",
    winner: null,
  };
  for (let tile = 0; tile < 34; tile++)
    for (let copy = 0; copy < 4; copy++) state.wall.push(tile);
  for (let i = state.wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.wall[i], state.wall[j]] = [state.wall[j], state.wall[i]];
  }
  for (let round = 0; round < 16; round++)
    state.players.forEach((player) => player.hand.push(state.wall.pop()!));
  state.players.forEach(sortHand);
  addLog(state, "牌局開始，你是東家。");
  drawTile(state, 0);
  return state;
}

export function addLog(state: GameState, message: string) {
  state.logs.unshift(message);
  if (state.logs.length > 20) state.logs.length = 20;
}

export function finishGame(state: GameState, player: number, kind = "") {
  if (state.phase === "end") return;
  state.phase = "end";
  state.winner = player;
  state.result =
    player < 0 ? "流局・牌牆已空" : `${playerNames[player]} ${kind}`;
  if (player >= 0 && kind === "胡牌" && state.last) {
    state.players[player].hand.push(state.last.tile);
    state.players[state.last.player].river.pop();
    sortHand(state.players[player]);
  }
  addLog(state, state.result);
}

export function drawTile(state: GameState, playerIndex: number) {
  if (state.phase === "end") return;
  if (!state.wall.length) return finishGame(state, -1);
  state.turn = playerIndex;
  state.phase = "discard";
  state.selected = -1;
  state.drawn = state.wall.pop()!;
  // Keep the newly drawn tile separate at the right end until a discard.
  sortHand(state.players[playerIndex]);
  state.players[playerIndex].hand.push(state.drawn);
  addLog(state, `${playerNames[playerIndex]} 摸牌`);
}

export function botDiscardIndex(hand: number[]): number {
  const tileCounts = counts(hand);
  let bestScore = -Infinity;
  let result = 0;
  hand.forEach((tile, index) => {
    let strength = tileCounts[tile] >= 3 ? 8 : tileCounts[tile] === 2 ? 5 : 0;
    if (tile < 27) {
      for (const distance of [-2, -1, 1, 2]) {
        const nearby = tile + distance;
        if (
          nearby >= 0 &&
          nearby < 27 &&
          Math.floor(nearby / 9) === Math.floor(tile / 9) &&
          tileCounts[nearby]
        ) {
          strength += Math.abs(distance) === 1 ? 2 : 1;
        }
      }
    }
    const score = -strength + (tile >= 27 ? 0.3 : 0) + Math.random() * 0.2;
    if (score > bestScore) {
      bestScore = score;
      result = index;
    }
  });
  return result;
}

export function discardTile(
  state: GameState,
  playerIndex: number,
  handIndex: number,
) {
  if (
    state.phase !== "discard" ||
    state.turn !== playerIndex ||
    handIndex < 0 ||
    handIndex >= state.players[playerIndex].hand.length
  )
    return;
  const tile = state.players[playerIndex].hand.splice(handIndex, 1)[0];
  sortHand(state.players[playerIndex]);
  state.players[playerIndex].river.push(tile);
  state.last = { player: playerIndex, tile };
  state.drawn = null;
  state.selected = -1;
  state.phase = "claim";
  addLog(state, `${playerNames[playerIndex]} 打出 ${tileLabel(tile)}`);
  buildOffers(state);
}

function buildOffers(state: GameState) {
  if (!state.last) return;
  const { player: from, tile } = state.last;
  const offers: ClaimOffer[] = [];
  for (let distance = 1; distance <= 3; distance++) {
    const playerIndex = (from + distance) % 4;
    const player = state.players[playerIndex];
    const amount = counts(player.hand)[tile];
    if (isWinningHand([...player.hand, tile], player.melds.length))
      offers.push({
        player: playerIndex,
        type: "胡",
        take: [],
        rank: 0,
        distance,
      });
    if (amount >= 3 && state.wall.length)
      offers.push({
        player: playerIndex,
        type: "明槓",
        take: [tile, tile, tile],
        rank: 1,
        distance,
      });
    if (amount >= 2)
      offers.push({
        player: playerIndex,
        type: "碰",
        take: [tile, tile],
        rank: 1,
        distance,
      });
    if (distance === 1)
      chiOptions(player.hand, tile).forEach((take) =>
        offers.push({
          player: playerIndex,
          type: "吃",
          take,
          rank: 2,
          distance,
        }),
      );
  }
  state.offers = offers.sort(
    (a, b) => a.rank - b.rank || a.distance - b.distance,
  );
  state.offerIndex = 0;
}

export function currentOffer(state: GameState): ClaimOffer | null {
  return state.offers[state.offerIndex] ?? null;
}

export function availablePlayerOffers(state: GameState): ClaimOffer[] {
  if (state.phase !== "claim" || currentOffer(state)?.player !== 0) return [];
  return state.offers
    .slice(state.offerIndex)
    .filter((offer) => offer.player === 0);
}

export function advanceOffer(state: GameState): "player" | "bot" | "draw" {
  if (state.phase !== "claim" && state.phase !== "thinking") return "draw";
  if (state.offerIndex >= state.offers.length) {
    state.phase = "waiting";
    return "draw";
  }
  const offer = currentOffer(state)!;
  if (offer.player === 0) {
    state.phase = "claim";
    return "player";
  }
  state.phase = "thinking";
  return "bot";
}

export function passOffer(state: GameState) {
  if (state.phase !== "claim" && state.phase !== "thinking") return;
  const offer = currentOffer(state);
  if (!offer) return;
  if (offer.player !== 0) return;
  state.offers = state.offers.filter(
    (candidate, index) => index < state.offerIndex || candidate.player !== 0,
  );
}

export function claimOffer(
  state: GameState,
  offer: ClaimOffer,
): "applied" | "pending" | "invalid" {
  if (
    (state.phase !== "claim" && state.phase !== "thinking") ||
    !state.last ||
    state.offers.indexOf(offer) < state.offerIndex
  )
    return "invalid";
  const player = state.players[offer.player];
  const from = state.players[state.last.player];
  if (
    !player ||
    !from ||
    player === from ||
    from.river.at(-1) !== state.last.tile
  )
    return "invalid";
  // Validate a complete copy before touching offers, hands, rivers or logs.
  const remainingHand = [...player.hand];
  const expectedLength =
    offer.type === "胡" ? 0 : offer.type === "明槓" ? 3 : 2;
  if (offer.take.length !== expectedLength) return "invalid";
  for (const tile of offer.take) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= 34) return "invalid";
    const index = remainingHand.indexOf(tile);
    if (index < 0) return "invalid";
    remainingHand.splice(index, 1);
  }
  if (
    (offer.type === "碰" || offer.type === "明槓") &&
    offer.take.some((tile) => tile !== state.last!.tile)
  )
    return "invalid";
  if (offer.type === "吃") {
    const tiles = [...offer.take, state.last.tile].sort((a, b) => a - b);
    if (
      offer.player !== (state.last.player + 1) % 4 ||
      tiles[0] >= 27 ||
      tiles[0] % 9 > 6 ||
      tiles[1] !== tiles[0] + 1 ||
      tiles[2] !== tiles[0] + 2
    )
      return "invalid";
  }
  if (offer.player === 0) {
    if (!availablePlayerOffers(state).includes(offer)) return "invalid";
    // Commit this choice, but let any intervening higher-priority opponents respond first.
    state.offers = state.offers.filter(
      (candidate, index) =>
        index < state.offerIndex ||
        candidate.player !== 0 ||
        candidate === offer,
    );
    if (currentOffer(state) !== offer) return "pending";
  } else if (currentOffer(state) !== offer) return "invalid";
  if (offer.type === "胡") {
    finishGame(state, offer.player, "胡牌");
    return "applied";
  }
  player.hand = remainingHand;
  state.players[state.last.player].river.pop();
  player.melds.push({
    tiles: [...offer.take, state.last.tile].sort((a, b) => a - b),
    type: offer.type,
  });
  addLog(
    state,
    `${playerNames[offer.player]} ${offer.type} ${tileLabel(state.last.tile)}`,
  );
  state.turn = offer.player;
  state.last = null;
  state.phase = "discard";
  state.selected = -1;
  state.drawn = null;
  sortHand(player);
  return "applied";
}

export function concealedKong(
  state: GameState,
  playerIndex: number,
  tile: number,
) {
  const player = state.players[playerIndex];
  if (
    state.phase !== "discard" ||
    state.turn !== playerIndex ||
    counts(player.hand)[tile] !== 4 ||
    !state.wall.length
  )
    return;
  player.hand = player.hand.filter((value) => value !== tile);
  player.melds.push({ tiles: [tile, tile, tile, tile], type: "暗槓" });
  addLog(state, `${playerNames[playerIndex]} 暗槓 ${tileLabel(tile)}`);
  drawTile(state, playerIndex);
}

export function readyTiles(
  state: GameState,
  hand: number[],
  meldCount: number,
): number[] {
  if (hand.length !== 16 - 3 * meldCount) return [];
  const visibleCounts = counts([
    ...hand,
    ...state.players[0].melds.flatMap((meld) => meld.tiles),
  ]);
  return Array.from({ length: 34 }, (_, tile) => tile).filter(
    (tile) =>
      visibleCounts[tile] < 4 && isWinningHand([...hand, tile], meldCount),
  );
}

/** Unseen copies, not wall contents: never inspect opponents' concealed information. */
export function remainingTileCounts(state: GameState): number[] {
  const known = counts([
    ...state.players[0].hand,
    ...state.players.flatMap((player, index) => [
      ...player.river,
      ...player.melds
        .filter((meld) => index === 0 || meld.type !== "暗槓")
        .flatMap((meld) => meld.tiles),
    ]),
  ]);
  return known.map((amount) => Math.max(0, 4 - amount));
}
