import type { ClaimOffer, GameState, Player } from './types';
import { playerNames, tileLabel } from './tiles';

const makePlayer = (): Player => ({ hand: [], melds: [], river: [] });
const sortHand = (player: Player) => player.hand.sort((a, b) => a - b);

export function counts(hand: number[]): number[] {
  const result = Array(34).fill(0);
  hand.forEach((tile) => result[tile]++);
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
    if (tile < 27 && tile % 9 < 7 && tileCounts[tile + 1] && tileCounts[tile + 2]) {
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
    if (start < 0 || start >= 27 || Math.floor(start / 9) !== Math.floor(discarded / 9) || start % 9 > 6) continue;
    const needed = [start, start + 1, start + 2];
    needed.splice(needed.indexOf(discarded), 1);
    if (needed.every((tile) => tileCounts[tile] > 0)) result.push(needed);
  }
  return result;
}

export function createGame(): GameState {
  const state: GameState = {
    wall: [], players: Array.from({ length: 4 }, makePlayer), turn: 0, phase: 'draw', selected: -1,
    last: null, drawn: null, logs: [], offers: [], offerIndex: 0, result: '', winner: null
  };
  for (let tile = 0; tile < 34; tile++) for (let copy = 0; copy < 4; copy++) state.wall.push(tile);
  for (let i = state.wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.wall[i], state.wall[j]] = [state.wall[j], state.wall[i]];
  }
  for (let round = 0; round < 16; round++) state.players.forEach((player) => player.hand.push(state.wall.pop()!));
  state.players.forEach(sortHand);
  addLog(state, '牌局開始，你是東家。');
  drawTile(state, 0);
  return state;
}

export function addLog(state: GameState, message: string) {
  state.logs = [message, ...state.logs].slice(0, 20);
}

export function finishGame(state: GameState, player: number, kind = '') {
  state.phase = 'end';
  state.winner = player;
  state.result = player < 0 ? '流局・牌牆已空' : `${playerNames[player]} ${kind}`;
  if (player >= 0 && kind === '胡牌' && state.last) {
    state.players[player].hand.push(state.last.tile);
    state.players[state.last.player].river.pop();
    sortHand(state.players[player]);
  }
  addLog(state, state.result);
}

export function drawTile(state: GameState, playerIndex: number) {
  if (!state.wall.length) return finishGame(state, -1);
  state.turn = playerIndex;
  state.phase = 'discard';
  state.selected = -1;
  state.drawn = state.wall.pop()!;
  state.players[playerIndex].hand.push(state.drawn);
  sortHand(state.players[playerIndex]);
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
        if (nearby >= 0 && nearby < 27 && Math.floor(nearby / 9) === Math.floor(tile / 9) && tileCounts[nearby]) {
          strength += Math.abs(distance) === 1 ? 2 : 1;
        }
      }
    }
    const score = -strength + (tile >= 27 ? 0.3 : 0) + Math.random() * 0.2;
    if (score > bestScore) { bestScore = score; result = index; }
  });
  return result;
}

export function discardTile(state: GameState, playerIndex: number, handIndex: number) {
  if (state.phase !== 'discard' || state.turn !== playerIndex || handIndex < 0 || handIndex >= state.players[playerIndex].hand.length) return;
  const tile = state.players[playerIndex].hand.splice(handIndex, 1)[0];
  state.players[playerIndex].river.push(tile);
  state.last = { player: playerIndex, tile };
  state.drawn = null;
  state.selected = -1;
  state.phase = 'claim';
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
    if (isWinningHand([...player.hand, tile], player.melds.length)) offers.push({ player: playerIndex, type: '胡', take: [], rank: 0, distance });
    if (amount >= 3 && state.wall.length) offers.push({ player: playerIndex, type: '明槓', take: [tile, tile, tile], rank: 1, distance });
    if (amount >= 2) offers.push({ player: playerIndex, type: '碰', take: [tile, tile], rank: 1, distance });
    if (distance === 1) chiOptions(player.hand, tile).forEach((take) => offers.push({ player: playerIndex, type: '吃', take, rank: 2, distance }));
  }
  state.offers = offers.sort((a, b) => a.rank - b.rank || a.distance - b.distance);
  state.offerIndex = 0;
}

export function currentOffer(state: GameState): ClaimOffer | null { return state.offers[state.offerIndex] ?? null; }

export function advanceOffer(state: GameState): 'player' | 'bot' | 'draw' {
  if (state.phase !== 'claim' && state.phase !== 'thinking') return 'draw';
  if (state.offerIndex >= state.offers.length) { state.phase = 'waiting'; return 'draw'; }
  const offer = currentOffer(state)!;
  if (offer.player === 0) { state.phase = 'claim'; return 'player'; }
  state.phase = 'thinking';
  return 'bot';
}

export function passOffer(state: GameState) {
  const offer = currentOffer(state);
  if (!offer) return;
  const rank = offer.rank;
  state.offers = state.offers.filter((candidate, index) => index < state.offerIndex || candidate.player !== 0 || candidate.rank !== rank);
}

export function claimOffer(state: GameState, offer: ClaimOffer) {
  if (!state.last) return;
  if (offer.type === '胡') return finishGame(state, offer.player, '胡牌');
  const player = state.players[offer.player];
  offer.take.forEach((tile) => player.hand.splice(player.hand.indexOf(tile), 1));
  state.players[state.last.player].river.pop();
  player.melds.push({ tiles: [...offer.take, state.last.tile].sort((a, b) => a - b), type: offer.type });
  addLog(state, `${playerNames[offer.player]} ${offer.type} ${tileLabel(state.last.tile)}`);
  state.turn = offer.player;
  state.last = null;
  state.phase = 'discard';
  state.selected = -1;
  state.drawn = null;
  sortHand(player);
}

export function concealedKong(state: GameState, playerIndex: number, tile: number) {
  const player = state.players[playerIndex];
  if (state.phase !== 'discard' || state.turn !== playerIndex || counts(player.hand)[tile] !== 4 || !state.wall.length) return;
  player.hand = player.hand.filter((value) => value !== tile);
  player.melds.push({ tiles: [tile, tile, tile, tile], type: '暗槓' });
  addLog(state, `${playerNames[playerIndex]} 暗槓 ${tileLabel(tile)}`);
  drawTile(state, playerIndex);
}

export function readyTiles(state: GameState, hand: number[], meldCount: number): number[] {
  if (hand.length !== 16 - 3 * meldCount) return [];
  const visibleCounts = counts([...hand, ...state.players[0].melds.flatMap((meld) => meld.tiles)]);
  return Array.from({ length: 34 }, (_, tile) => tile).filter((tile) => visibleCounts[tile] < 4 && isWinningHand([...hand, tile], meldCount));
}
