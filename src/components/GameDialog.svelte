<script lang="ts">
  import { manageModal } from '../lib/modal';
  export let open = false;
  export let title = '';
  export let confirmText = '知道了';
  export let secondaryText = '';
  export let onclose: () => void;
  export let onconfirm: (() => void) | undefined = undefined;
</script>

{#if open}
  <dialog class="dialog-backdrop" use:manageModal aria-labelledby="dialog-title" tabindex="-1" on:cancel|preventDefault={onclose} on:click={(event) => { if (event.target === event.currentTarget) onclose(); }}>
    <div class="dialog-card">
      <div class="dialog-heading">
        <button class="dialog-close" aria-label="關閉對話框" on:click={onclose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button>
      </div>
      <h2 id="dialog-title">{title}</h2>
      <div class="dialog-copy"><slot /></div>
      <footer>
        {#if secondaryText}<button class="button secondary" data-initial-focus on:click={onclose}>{secondaryText}</button>{/if}
        <button class="button primary" on:click={() => onconfirm ? onconfirm() : onclose()}>{confirmText}</button>
      </footer>
    </div>
  </dialog>
{/if}
