<script lang="ts">
  import type { Player } from '../lib/types';
  import { playerNames } from '../lib/tiles';
  import Tile from './Tile.svelte';
  export let player: Player;
  export let index: number;
  export let position: 'north' | 'west' | 'east' | 'south';
  export let active = false;
  export let ended = false;
  export let selected = -1;
  export let drawn: number | null = null;
  export let canDiscard = false;
  export let onTileSelect: ((index: number) => void) | undefined = undefined;
</script>

<section class="player-area {position}" class:active aria-label={playerNames[index]}>
  <header>
    <span class="seat">{['東', '南', '西', '北'][index]}</span>
    <div class="player-copy"><strong>{playerNames[index].split('・')[0]}</strong><small>{index === 0 ? 'PLAYER' : 'CPU'} · {player.hand.length} 張</small></div>
    {#if active}<span class="turn-dot"><i></i> 輪到此家</span>{/if}
  </header>
  {#if index === 0}
    <div class="hand" aria-label="你的手牌">
      {#each player.hand as tile, handIndex}
        <Tile {tile} interactive disabled={!canDiscard} selected={selected === handIndex} drawn={canDiscard && tile === drawn && handIndex === player.hand.lastIndexOf(tile)} onselect={() => onTileSelect?.(handIndex)} />
      {/each}
    </div>
  {:else}
    <div class="concealed" aria-label={ended ? '對手手牌' : `對手有 ${player.hand.length} 張牌`}>
      {#each player.hand as tile}<Tile {tile} size="mini" hidden={!ended} />{/each}
    </div>
  {/if}
  {#if player.melds.length}
    <div class="melds" aria-label="牌組">
      {#each player.melds as meld}
        <div class="meld" title={meld.type}>{#each meld.tiles as tile}<Tile {tile} size="mini" hidden={meld.type === '暗槓' && index !== 0 && !ended} />{/each}</div>
      {/each}
    </div>
  {/if}
  <div class="river" aria-label="牌河">{#each player.river as tile}<Tile {tile} size="mini" />{/each}</div>
</section>
