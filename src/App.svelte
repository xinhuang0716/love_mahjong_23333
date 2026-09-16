<script lang="ts">
  import { onDestroy } from 'svelte';
  import GameDialog from './components/GameDialog.svelte';
  import PlayerArea from './components/PlayerArea.svelte';
  import Tile from './components/Tile.svelte';
  import { advanceOffer, botDiscardIndex, claimOffer, concealedKong, counts, createGame, currentOffer, discardTile, drawTile, finishGame, isWinningHand, passOffer, readyTiles } from './lib/game';
  import { playerNames, tileLabel } from './lib/tiles';
  import type { ClaimOffer, Stats } from './lib/types';

  let game = createGame();
  let helpOpen = false;
  let restartOpen = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let epoch = 0;
  let recorded = false;
  let stats = loadStats();

  $: isPlayerTurn = game.phase === 'discard' && game.turn === 0;
  $: offer = currentOffer(game);
  $: playerOffers = game.phase === 'claim' && offer?.player === 0 ? game.offers.filter((item, index) => index >= game.offerIndex && item.player === 0 && item.rank === offer?.rank) : [];
  $: selectedWaits = getWaits(game, isPlayerTurn);
  $: status = getStatus(game, offer, isPlayerTurn);
  $: substatus = getSubstatus(game, selectedWaits, isPlayerTurn);

  function loadStats(): Stats {
    try {
      const value = JSON.parse(localStorage.getItem('mahjong-practice-stats') ?? 'null');
      if (Number.isFinite(value?.games) && Number.isFinite(value?.wins)) return value;
    } catch {}
    return { games: 0, wins: 0 };
  }
  function persistStats() { try { localStorage.setItem('mahjong-practice-stats', JSON.stringify(stats)); } catch {} }
  function update() {
    game = game;
    if (game.phase === 'end' && !recorded) {
      recorded = true;
      stats = { games: stats.games + 1, wins: stats.wins + (game.winner === 0 ? 1 : 0) };
      persistStats();
    }
  }
  function later(action: () => void, delay = 620) {
    clearTimeout(timer);
    const currentEpoch = epoch;
    timer = setTimeout(() => { if (currentEpoch === epoch) action(); }, delay);
  }
  function newGame() { clearTimeout(timer); epoch++; recorded = false; game = createGame(); restartOpen = false; }
  function selectTile(index: number) {
    if (!isPlayerTurn) return;
    if (game.selected === index) return playDiscard(index);
    game.selected = index; update();
  }
  function playDiscard(index = game.selected) {
    if (!isPlayerTurn || index < 0) return;
    discardTile(game, 0, index); update(); processOffers();
  }
  function botTurn() {
    const player = game.players[game.turn];
    if (isWinningHand(player.hand, player.melds.length)) { finishGame(game, game.turn, '自摸'); return update(); }
    const kong = counts(player.hand).findIndex((amount) => amount === 4);
    if (kong >= 0 && game.wall.length) { concealedKong(game, game.turn, kong); update(); return later(botTurn); }
    discardTile(game, game.turn, botDiscardIndex(player.hand)); update(); processOffers();
  }
  function processOffers() {
    const next = advanceOffer(game); update();
    if (next === 'player') return;
    if (next === 'bot') return later(() => acceptClaim(currentOffer(game)!));
    const nextPlayer = ((game.last?.player ?? game.turn) + 1) % 4;
    later(() => { drawTile(game, nextPlayer); update(); if (nextPlayer !== 0) later(botTurn); });
  }
  function acceptClaim(claim: ClaimOffer) {
    claimOffer(game, claim); update();
    if (game.phase === 'end') return;
    if (claim.type === '明槓') drawTile(game, claim.player);
    update(); if (claim.player !== 0) later(botTurn);
  }
  function declineClaim() { passOffer(game); processOffers(); }
  function declareSelfDraw() { finishGame(game, 0, '自摸'); update(); }
  function makeKong(tile: number) { concealedKong(game, 0, tile); update(); }
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
    if (waits.length) return `聽牌：${waits.map(tileLabel).join('、')}`;
    if (playerTurn) return state.selected < 0 ? '先選一張牌，再按出牌；點兩次牌也可以快速打出。' : `已選擇 ${tileLabel(state.players[0].hand[state.selected])}`;
    return state.last ? `${playerNames[state.last.player].split('・')[0]}打出 ${tileLabel(state.last.tile)}` : '牌局進行中';
  }
  onDestroy(() => clearTimeout(timer));
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
      <div class="round-stat" aria-label={`已進行 ${stats.games} 局，勝利 ${stats.wins} 局`}><span><b>{stats.games}</b> 局</span><i></i><span><b>{stats.wins}</b> 勝</span></div>
      <button class="icon-button" on:click={() => helpOpen = true} aria-label="查看玩法說明" title="玩法說明"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2.9-1.2 2M12 17h.01"/></svg></button>
      <button class="button ghost compact" on:click={() => game.phase === 'end' ? newGame() : restartOpen = true}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M19 12a7 7 0 1 0-2.1 5"/></svg><span>重新開局</span></button>
    </div>
  </header>

  <main class="game-stage" id="game-table">
    <section class="table-frame" aria-label="四人麻將牌桌">
      <div class="table-felt">
        <PlayerArea player={game.players[2]} index={2} position="north" active={game.turn === 2 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <PlayerArea player={game.players[3]} index={3} position="west" active={game.turn === 3 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <PlayerArea player={game.players[1]} index={1} position="east" active={game.turn === 1 && game.phase !== 'end'} ended={game.phase === 'end'} />
        <section class="table-center" aria-live="polite">
          <div class="score-board" class:your-turn={isPlayerTurn}>
            <span class="score-seat score-north">西</span>
            <span class="score-seat score-west">北</span>
            <div class="score-screen">
              <small>單局練習</small>
              <strong>{game.wall.length}</strong>
              <span>牌山</span>
            </div>
            <span class="score-seat score-east">南</span>
            <span class="score-seat score-south">東</span>
          </div>
          <h1>{status}</h1>
          <div class="last-tile">{#if game.last}<Tile tile={game.last.tile} />{:else}<span>尚未出牌</span>{/if}</div>
        </section>
        <PlayerArea player={game.players[0]} index={0} position="south" active={game.turn === 0 && game.phase !== 'end'} ended={game.phase === 'end'} selected={game.selected} drawn={game.drawn} canDiscard={isPlayerTurn} onTileSelect={selectTile} />
      </div>
    </section>

    <section class="command-bar" aria-label="目前操作">
      <div class="command-copy"><span class="eyebrow"><i></i> CURRENT ACTION</span><strong>{status}</strong><small>{substatus}</small></div>
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
        {:else}
          <span class="thinking"><span class="thinking-dots"><i></i><i></i><i></i></span> 對手思考中</span>
        {/if}
      </div>
    </section>

    <details class="game-log"><summary><span>牌局紀錄</span><span class="log-count">{game.logs.length}</span></summary><ol>{#each game.logs as log}<li>{log}</li>{/each}</ol></details>
  </main>
</div>

<GameDialog open={helpOpen} title="玩法說明" onclose={() => helpOpen = false}>
  <p>這是一張 16 張制的台灣麻將練習桌。輪到你時，先點選手牌，再按「確認出牌」；也可以連點同一張牌快速打出。</p>
  <p>系統會自動提示可用的吃、碰、槓與胡牌操作。選牌時若已聽牌，桌面也會顯示可能的進張。</p>
</GameDialog>
<GameDialog open={restartOpen} title="重新開局？" secondaryText="繼續這局" confirmText="重新開局" onclose={() => restartOpen = false} onconfirm={newGame}>
  <p>目前的牌局進度將會清除，但已完成的對局統計仍會保留。</p>
</GameDialog>
