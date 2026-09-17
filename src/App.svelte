<script lang="ts">
  import { onDestroy } from 'svelte';
  import GameDialog from './components/GameDialog.svelte';
  import PlayerArea from './components/PlayerArea.svelte';
  import Tile from './components/Tile.svelte';
  import { advanceOffer, availablePlayerOffers, botDiscardIndex, claimOffer, concealedKong, counts, createGame, currentOffer, discardTile, drawTile, finishGame, isWinningHand, passOffer, readyTiles, remainingTileCounts } from './lib/game';
  import { playerNames, tileLabel } from './lib/tiles';
  import type { ClaimOffer } from './lib/types';
  import { createScheduler } from './lib/scheduler';

  let game = createGame();
  let restartOpen = false;
  const scheduler = createScheduler(() => game.phase !== 'end');

  $: isPlayerTurn = game.phase === 'discard' && game.turn === 0;
  $: offer = currentOffer(game);
  $: playerOffers = availablePlayerOffers(game);
  $: selectedWaits = getWaits(game, isPlayerTurn);
  $: status = getStatus(game, offer, isPlayerTurn);
  $: substatus = getSubstatus(game, selectedWaits, isPlayerTurn);

  function update() { if (game.phase === 'end') scheduler.cancel(); game = game; }
  function later(action: () => void, delay = 620) {
    scheduler.schedule(action, delay);
  }
  function newGame() { scheduler.cancel(); game = createGame(); restartOpen = false; }
  function requestRestart() {
    if (game.phase === 'end') return newGame();
    scheduler.pause(); restartOpen = true;
  }
  function continueGame() {
    if (!restartOpen) return;
    restartOpen = false; scheduler.resume();
  }
  function selectTile(index: number) {
    if (restartOpen || !isPlayerTurn) return;
    if (game.selected === index) return playDiscard(index);
    game.selected = index; update();
  }
  function playDiscard(index = game.selected) {
    if (restartOpen || !isPlayerTurn || index < 0) return;
    discardTile(game, 0, index); update(); processOffers();
  }
  function botTurn() {
    if (restartOpen || game.phase !== 'discard' || game.turn === 0) return;
    const player = game.players[game.turn];
    if (isWinningHand(player.hand, player.melds.length)) { finishGame(game, game.turn, '自摸'); return update(); }
    const kong = counts(player.hand).findIndex((amount) => amount === 4);
    if (kong >= 0 && game.wall.length) { concealedKong(game, game.turn, kong); update(); return later(botTurn); }
    discardTile(game, game.turn, botDiscardIndex(player.hand)); update(); processOffers();
  }
  function processOffers() {
    if (restartOpen || game.phase === 'end') return;
    const next = advanceOffer(game); update();
    if (next === 'player') return;
    if (next === 'bot') return later(() => { const claim = currentOffer(game); if (claim) acceptClaim(claim); });
    const nextPlayer = ((game.last?.player ?? game.turn) + 1) % 4;
    later(() => { drawTile(game, nextPlayer); update(); if (game.phase === 'discard' && nextPlayer !== 0) later(botTurn); });
  }
  function acceptClaim(claim: ClaimOffer) {
    if (restartOpen || !canClaim()) return;
    const outcome = claimOffer(game, claim); update();
    if (outcome === 'pending') return processOffers();
    if (outcome !== 'applied') return;
    if (game.phase === 'end') return;
    if (claim.type === '明槓') drawTile(game, claim.player);
    update(); if (game.phase === 'discard' && claim.player !== 0) later(botTurn);
  }
  function canClaim() { return game.phase === 'claim' || game.phase === 'thinking'; }
  function declineClaim() { if (restartOpen) return; passOffer(game); processOffers(); }
  function declareSelfDraw() { if (restartOpen || !isPlayerTurn) return; finishGame(game, 0, '自摸'); update(); }
  function makeKong(tile: number) { if (restartOpen) return; concealedKong(game, 0, tile); update(); }
  function getWaits(state = game, playerTurn = isPlayerTurn) {
    const player = state.players[0];
    if (playerTurn && state.selected >= 0) return readyTiles(state, player.hand.filter((_, index) => index !== state.selected), player.melds.length);
    if (!playerTurn && state.phase !== 'end') return readyTiles(state, player.hand, player.melds.length);
    return [];
  }
  function getStatus(state = game, currentOfferValue = offer, playerTurn = isPlayerTurn) {
    if (state.phase === 'end') return state.result;
    if (playerTurn) return '輪到你出牌';
    if (state.phase === 'claim' && currentOfferValue?.player === 0) return '要收下這張牌嗎？';
    if (state.phase === 'discard') return `${playerNames[state.turn].split('・')[0]}正在思考`;
    return '等待其他玩家回應';
  }
  function getSubstatus(state = game, waits = selectedWaits, playerTurn = isPlayerTurn) {
    if (state.phase === 'end') return '這一局已結束，隨時可以再開一局。';
    if (waits.length) {
      const remaining = remainingTileCounts(state);
      return `聽牌：${waits.map((tile) => `${tileLabel(tile)}${remaining[tile] === 0 ? '（已無剩餘）' : ''}`).join('、')}`;
    }
    if (playerTurn) return state.selected < 0 ? '' : `已選擇 ${tileLabel(state.players[0].hand[state.selected])}`;
    return state.last ? `${playerNames[state.last.player].split('・')[0]}打出 ${tileLabel(state.last.tile)}` : '牌局進行中';
  }
  onDestroy(() => scheduler.cancel());
</script>

<svelte:head>
  <title>一雀入魂｜台灣麻將練習</title>
  <meta name="description" content="簡潔、專注的單機台灣麻將練習桌。" />
</svelte:head>

<a class="skip-link" href="#game-table">跳到牌桌</a>
<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="#game-table" aria-label="一雀入魂牌桌">
      <span class="brand-mark" aria-hidden="true"><span>雀</span></span>
      <span class="brand-copy"><strong>一雀入魂</strong><small>TAIWAN MAHJONG TABLE</small></span>
    </a>
    <div class="top-actions">
      <button class="button ghost compact" on:click={requestRestart}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M19 12a7 7 0 1 0-2.1 5"/></svg><span>重新開局</span></button>
    </div>
  </header>

  <main class="game-stage" id="game-table">
    <section class="table-frame" aria-label="四人麻將牌桌">
      <div class="table-felt">
        <PlayerArea player={game.players[2]} index={2} position="north" active={game.turn === 2 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <PlayerArea player={game.players[3]} index={3} position="west" active={game.turn === 3 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <PlayerArea player={game.players[1]} index={1} position="east" active={game.turn === 1 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <section class="table-center" aria-live="polite">
          <span class="wall-count">牌山剩餘 <strong>{game.wall.length}</strong> 張</span>
          <h1>{status}</h1>
          {#if substatus}<p class="table-hint">{substatus}</p>{/if}
          <div class="last-tile">{#if game.last}<Tile tile={game.last.tile} />{:else}<span>尚未出牌</span>{/if}</div>
        </section>
        <section class="table-actions" aria-label="目前操作">
          <div class="commands">
            {#if game.phase === 'end'}
              <button class="button primary" on:click={newGame}>再開一局</button>
            {:else if isPlayerTurn}
              {#if isWinningHand(game.players[0].hand, game.players[0].melds.length)}<button class="button primary" on:click={declareSelfDraw}>自摸</button>{/if}
              {#each counts(game.players[0].hand) as amount, tile}{#if amount === 4 && game.wall.length}<button class="button secondary" on:click={() => makeKong(tile)}>暗槓 {tileLabel(tile)}</button>{/if}{/each}
              <button class="button primary" disabled={game.selected < 0} on:click={() => playDiscard()}>確認出牌</button>
            {:else if playerOffers.length}
              {#each playerOffers as item}<button class="button primary" on:click={() => acceptClaim(item)}>{item.type}{item.type === '吃' ? ` ${[...item.take, game.last?.tile ?? 0].sort((a, b) => a - b).map(tileLabel).join(' ')}` : ''}</button>{/each}
              <button class="button secondary" on:click={declineClaim}>略過</button>
            {/if}
          </div>
        </section>
        <PlayerArea player={game.players[0]} index={0} position="south" active={game.turn === 0 && game.phase !== 'end'} ended={game.phase === 'end'} selected={game.selected} drawn={game.drawn} canDiscard={isPlayerTurn} onTileSelect={selectTile} />
      </div>
    </section>


  </main>
</div>

<GameDialog open={restartOpen} title="重新開局？" secondaryText="繼續這局" confirmText="重新開局" onclose={continueGame} onconfirm={newGame}>
  <p>目前的牌局進度將會清除，並重新發牌。</p>
</GameDialog>
