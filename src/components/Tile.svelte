<script lang="ts">
  import { tileFace, tileImages, tileLabel } from '../lib/tiles';

  export let tile: number;
  export let size: 'hand' | 'mini' = 'hand';
  export let selected = false;
  export let drawn = false;
  export let hidden = false;
  export let disabled = false;
  export let interactive = false;
  export let onselect: (() => void) | undefined = undefined;

  $: faceClass = tileFace(tile);
</script>

{#if hidden}
  <span class="tile tile-back {size}" aria-hidden="true"><span class="back-mark"></span></span>
{:else if interactive}
  <button
    class="tile {faceClass} {size}"
    class:selected
    class:drawn
    {disabled}
    aria-label={tileLabel(tile)}
    aria-pressed={selected}
    on:click={onselect}
  >
    <img class="tile-face" src={tileImages[tile]} alt="" width="300" height="420" draggable="false" />
  </button>
{:else}
  <span class="tile {faceClass} {size}" class:drawn aria-label={tileLabel(tile)}>
    <img class="tile-face" src={tileImages[tile]} alt="" width="300" height="420" draggable="false" />
  </span>
{/if}
