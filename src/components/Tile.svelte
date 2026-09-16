<script lang="ts">
  import { tileFace, tileLabel } from '../lib/tiles';

  export let tile: number;
  export let size: 'hand' | 'mini' = 'hand';
  export let selected = false;
  export let drawn = false;
  export let hidden = false;
  export let disabled = false;
  export let interactive = false;
  export let onselect: (() => void) | undefined = undefined;

  $: face = tileFace(tile);
</script>

{#if hidden}
  <span class="tile tile-back {size}" aria-hidden="true"><span class="back-mark"></span></span>
{:else if interactive}
  <button
    class="tile {face.kind} {size}"
    class:selected
    class:drawn
    {disabled}
    aria-label={tileLabel(tile)}
    aria-pressed={selected}
    on:click={onselect}
  >
    <strong>{face.value}</strong>
    {#if face.suit}<small>{face.suit}</small>{/if}
  </button>
{:else}
  <span class="tile {face.kind} {size}" class:drawn aria-label={tileLabel(tile)}>
    <strong>{face.value}</strong>
    {#if face.suit}<small>{face.suit}</small>{/if}
  </span>
{/if}
