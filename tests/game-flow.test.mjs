import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
const load = (source) =>
  import(
    `data:text/javascript;base64,${Buffer.from(compile(source)).toString("base64")}`
  );
const engine = await load(
  readFileSync(new URL("../src/lib/game.ts", import.meta.url), "utf8").replace(
    /import .* from ["']\.\/tiles["'];/,
    'const playerNames = ["You", "Player 2", "Player 3", "Player 1"]; const tileLabel = String;',
  ),
);
const { createScheduler } = await load(
  readFileSync(new URL("../src/lib/scheduler.ts", import.meta.url), "utf8"),
);

function fakeClock() {
  let time = 0,
    id = 0;
  const tasks = new Map();
  const callbacks = [];
  return {
    callbacks,
    now: () => time,
    setTimeout(action, delay) {
      callbacks.push(action);
      tasks.set(++id, { action, at: time + delay });
      return id;
    },
    clearTimeout(timer) {
      tasks.delete(timer);
    },
    advance(amount) {
      const end = time + amount;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].action();
      }
      time = end;
    },
    get pending() {
      return tasks.size;
    },
  };
}

// Exercise the actual App handlers, without a DOM or SVG bundler dependency.
const appScript =
  readFileSync(new URL("../src/App.svelte", import.meta.url), "utf8")
    .split('<script lang="ts">')[1]
    .split("</script>")[0]
    .replace(/^\s*import .*;$/gm, "")
    .replace(/^\s*\$:.*;$/gm, "")
    .replace(/onDestroy\(.*\);/, "") +
  "\nreturn { processOffers, acceptClaim, botTurn, requestRestart, continueGame, newGame, later, getWaits, getSubstatus, get game() { return game; }, set game(value) { game = value; }, get restartOpen() { return restartOpen; } };";
function app(clock) {
  const dependencies = {
    ...engine,
    tileLabel: String,
    createScheduler: (canRun) => createScheduler(canRun, clock),
  };
  return new Function(...Object.keys(dependencies), compile(appScript))(
    ...Object.values(dependencies),
  );
}
function state(phase = "waiting") {
  return {
    wall: [],
    players: Array.from({ length: 4 }, () => ({
      hand: [0, 3, 6],
      melds: [],
      river: [],
    })),
    turn: 0,
    phase,
    selected: -1,
    last: { player: 0, tile: 8 },
    drawn: null,
    logs: [],
    offers: [],
    offerIndex: 0,
    result: "",
    winner: null,
  };
}

test("pause preserves remaining time; repeated pause/resume does not duplicate actions", () => {
  const clock = fakeClock();
  const scheduler = createScheduler(() => true, clock);
  let calls = 0;
  scheduler.schedule(() => calls++, 620);
  clock.advance(200);
  scheduler.pause();
  scheduler.pause();
  clock.advance(2000);
  assert.equal(calls, 0);
  scheduler.resume();
  scheduler.resume();
  clock.advance(419);
  assert.equal(calls, 0);
  clock.advance(1);
  assert.equal(calls, 1);
  assert.equal(clock.pending, 0);
});

test("cancel rejects even an already queued old callback; terminal state blocks work", () => {
  const clock = fakeClock();
  let active = true,
    calls = 0;
  const scheduler = createScheduler(() => active, clock);
  scheduler.schedule(() => calls++);
  const stale = clock.callbacks[0];
  scheduler.pause();
  scheduler.cancel();
  scheduler.resume();
  stale();
  clock.advance(2000);
  assert.equal(calls, 0);
  scheduler.schedule(() => calls++);
  active = false;
  clock.advance(620);
  scheduler.schedule(() => calls++);
  assert.equal(calls, 0);
  assert.equal(clock.pending, 0);
});

test("empty wall ends the game without scheduling a bot discard", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state();
  flow.processOffers();
  clock.advance(620);
  assert.equal(flow.game.phase, "end");
  assert.equal(clock.pending, 0);
  const ended = JSON.stringify(flow.game);
  flow.botTurn();
  flow.processOffers();
  clock.advance(2000);
  assert.equal(JSON.stringify(flow.game), ended);
});

test("last available tile can be discarded, then exhaustion ends before the next bot turn", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state();
  flow.game.wall = [31];
  flow.processOffers();
  clock.advance(620);
  assert.equal(flow.game.phase, "discard");
  clock.advance(620);
  assert.equal(flow.game.phase, "waiting");
  clock.advance(620);
  assert.equal(flow.game.phase, "end");
  assert.equal(clock.pending, 0);
});

test("exposed kong replacement exhaustion does not schedule a bot", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state("thinking");
  flow.game.players[1].hand = [8, 8, 8, 0];
  flow.game.players[0].river = [8];
  const offer = {
    player: 1,
    type: "明槓",
    take: [8, 8, 8],
    rank: 1,
    distance: 1,
  };
  flow.game.offers = [offer];
  flow.acceptClaim(offer);
  assert.equal(flow.game.phase, "end");
  assert.equal(clock.pending, 0);
});

for (const phase of ["waiting", "discard", "thinking"]) {
  test(`restart dialog freezes ${phase} and cancellation resumes exactly once`, () => {
    const clock = fakeClock(),
      flow = app(clock);
    flow.game = state(phase);
    let calls = 0;
    flow.later(() => calls++);
    clock.advance(200);
    flow.requestRestart();
    const frozen = JSON.stringify(flow.game);
    clock.advance(2000);
    assert.equal(JSON.stringify(flow.game), frozen);
    assert.equal(calls, 0);
    flow.continueGame();
    flow.continueGame();
    clock.advance(419);
    assert.equal(calls, 0);
    flow.requestRestart();
    clock.advance(1000);
    flow.continueGame();
    clock.advance(1);
    assert.equal(calls, 1);
    assert.equal(flow.restartOpen, false);
  });
}

test("confirmed restart drops old actions and resumes no old callback", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state();
  let calls = 0;
  flow.later(() => calls++);
  const stale = clock.callbacks[0];
  flow.requestRestart();
  flow.newGame();
  const fresh = JSON.stringify(flow.game);
  stale();
  flow.continueGame();
  clock.advance(3000);
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(flow.game), fresh);
  assert.equal(clock.pending, 0);
});

for (const action of ["draw", "discard", "claim"]) {
  test(`actual ${action} handler pauses and resumes its original game state`, () => {
    const clock = fakeClock(),
      flow = app(clock);
    flow.game = state();
    flow.game.wall = [31];
    if (action === "discard") {
      flow.game.phase = "discard";
      flow.game.turn = 1;
      flow.later(flow.botTurn);
    } else if (action === "claim") {
      flow.game.phase = "claim";
      flow.game.players[0].river = [8];
      flow.game.players[1].hand = [8, 8, 0];
      flow.game.offers = [
        { player: 1, type: "碰", take: [8, 8], rank: 1, distance: 1 },
      ];
      flow.processOffers();
    } else flow.processOffers();
    clock.advance(200);
    flow.requestRestart();
    const frozen = JSON.stringify(flow.game);
    clock.advance(2000);
    assert.equal(JSON.stringify(flow.game), frozen);
    flow.continueGame();
    clock.advance(419);
    assert.equal(JSON.stringify(flow.game), frozen);
    clock.advance(1);
    if (action === "draw") {
      assert.equal(flow.game.drawn, 31);
      assert.equal(flow.game.wall.length, 0);
    }
    if (action === "discard")
      assert.equal(flow.game.players[1].river.length, 1);
    if (action === "claim") {
      assert.equal(flow.game.players[1].melds.length, 1);
      assert.equal(flow.game.players[0].river.length, 0);
    }
    flow.newGame();
  });
}

test("human turn with no pending action preserves selection and offers across the dialog", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state("discard");
  flow.game.selected = 2;
  const before = JSON.stringify(flow.game);
  flow.requestRestart();
  clock.advance(2000);
  flow.continueGame();
  assert.equal(JSON.stringify(flow.game), before);
  assert.equal(clock.pending, 0);
});

test("concealed kong consumes the final replacement tile, then the subsequent draw ends safely", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = state("discard");
  flow.game.turn = 1;
  flow.game.players[1].hand = [8, 8, 8, 8, 0];
  flow.game.wall = [31];
  flow.botTurn();
  assert.equal(flow.game.players[1].melds[0].type, "暗槓");
  assert.equal(flow.game.wall.length, 0);
  clock.advance(1240);
  assert.equal(flow.game.phase, "end");
  assert.equal(clock.pending, 0);
});

test("finished engine state is immutable under game actions", () => {
  const game = state("claim");
  const offer = { player: 1, type: "碰", take: [0, 0], rank: 1, distance: 1 };
  game.offers = [offer];
  engine.finishGame(game, -1);
  const ended = JSON.stringify(game);
  engine.drawTile(game, 1);
  engine.discardTile(game, 0, 0);
  engine.claimOffer(game, offer);
  engine.passOffer(game);
  engine.concealedKong(game, 0, 0);
  engine.advanceOffer(game);
  engine.finishGame(game, 1, "自摸");
  assert.equal(JSON.stringify(game), ended);
});

function simultaneousClaims() {
  const game = state("discard");
  game.turn = 3;
  game.wall = [31];
  game.players[3].hand = [4];
  game.players[0].hand = [2, 3, 4, 4, 5, 6];
  game.players[1].hand = [27];
  game.players[2].hand = [28];
  engine.discardTile(game, 3, 0);
  engine.advanceOffer(game);
  return game;
}

test("pon and every chi combination are offered together for the same discard", () => {
  const game = simultaneousClaims();
  const choices = engine.availablePlayerOffers(game);
  assert.deepEqual(
    choices.map((offer) => offer.type),
    ["碰", "吃", "吃", "吃"],
  );
  assert.deepEqual(
    choices.filter((offer) => offer.type === "吃").map((offer) => offer.take),
    [
      [2, 3],
      [3, 5],
      [5, 6],
    ],
  );
});

for (const type of ["吃", "碰"]) {
  test(`choosing ${type} immediately applies that choice without an extra prompt`, () => {
    const clock = fakeClock(),
      flow = app(clock);
    flow.game = simultaneousClaims();
    const choice = engine
      .availablePlayerOffers(flow.game)
      .find((offer) => offer.type === type);
    flow.acceptClaim(choice);
    assert.equal(flow.game.phase, "discard");
    assert.equal(flow.game.turn, 0);
    assert.equal(flow.game.players[0].melds[0].type, type);
    assert.equal(flow.game.players[3].river.length, 0);
    assert.deepEqual(engine.availablePlayerOffers(flow.game), []);
    assert.equal(clock.pending, 0);
  });
}

test("one pass dismisses all human claims, not only pon", () => {
  const game = simultaneousClaims();
  engine.passOffer(game);
  assert.equal(
    game.offers.some((offer) => offer.player === 0),
    false,
  );
  assert.equal(engine.advanceOffer(game), "draw");
});

test("win, kong, pon and chi can share one choice list", () => {
  const game = simultaneousClaims();
  game.offers.unshift({
    player: 0,
    type: "胡",
    take: [],
    rank: 0,
    distance: 1,
  });
  game.offers.splice(1, 0, {
    player: 0,
    type: "明槓",
    take: [4, 4, 4],
    rank: 1,
    distance: 1,
  });
  assert.deepEqual(
    engine.availablePlayerOffers(game).map((offer) => offer.type),
    ["胡", "明槓", "碰", "吃", "吃", "吃"],
  );
});

test("choosing chi does not bypass an intervening opponent pon", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = simultaneousClaims();
  flow.game.players[1].hand = [4, 4];
  const bot = { player: 1, type: "碰", take: [4, 4], rank: 1, distance: 2 };
  flow.game.offers.splice(1, 0, bot);
  const chi = engine
    .availablePlayerOffers(flow.game)
    .find((offer) => offer.type === "吃");
  flow.acceptClaim(chi);
  assert.equal(flow.game.phase, "thinking");
  assert.equal(flow.game.players[0].melds.length, 0);
  assert.deepEqual(
    flow.game.offers.filter((offer) => offer.player === 0),
    [chi],
  );
  clock.advance(620);
  assert.equal(flow.game.players[1].melds[0].type, "碰");
  assert.equal(flow.game.players[0].melds.length, 0);
  flow.newGame();
});

test("opponent win is resolved before human choices become available", () => {
  const game = simultaneousClaims();
  const win = { player: 1, type: "胡", take: [], rank: 0, distance: 2 };
  game.offers.unshift(win);
  engine.advanceOffer(game);
  assert.deepEqual(engine.availablePlayerOffers(game), []);
  assert.equal(
    engine.claimOffer(
      game,
      game.offers.find((offer) => offer.type === "吃"),
    ),
    "invalid",
  );
  assert.equal(engine.claimOffer(game, win), "applied");
  assert.equal(game.winner, 1);
});

function waitingHand() {
  const game = state();
  game.players.forEach((player) => {
    player.hand = [];
  });
  game.players[0].hand = [
    0, 0, 0, 1, 1, 1, 9, 9, 9, 18, 18, 18, 27, 27, 27, 28,
  ];
  return game;
}

test("dead waits remain structurally valid but are marked exhausted using all public rivers", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = waitingHand();
  flow.game.players[1].river = [28];
  flow.game.players[2].river = [28];
  flow.game.players[3].river = [28];
  const waits = flow.getWaits(flow.game, false);
  assert.deepEqual(waits, [28]);
  assert.equal(
    flow.getSubstatus(flow.game, waits, false),
    "聽牌：28（已無剩餘）",
  );
});

test("public melds and own concealed kong count, but opponents hidden hands, kongs and wall do not", () => {
  const game = waitingHand();
  game.players[1].hand = [28, 28, 28];
  game.players[2].melds = [{ type: "暗槓", tiles: [28, 28, 28, 28] }];
  game.wall = [28, 28];
  assert.equal(engine.remainingTileCounts(game)[28], 3);
  game.players[2].melds = [{ type: "碰", tiles: [28, 28, 28] }];
  assert.equal(engine.remainingTileCounts(game)[28], 0);
  game.players[2].melds = [];
  game.players[0].melds = [{ type: "暗槓", tiles: [29, 29, 29, 29] }];
  assert.equal(engine.remainingTileCounts(game)[29], 0);
});

test("selected discard stays counted exactly once in the hypothetical waiting hand", () => {
  const clock = fakeClock(),
    flow = app(clock);
  flow.game = waitingHand();
  flow.game.phase = "discard";
  flow.game.players[0].hand.push(28);
  flow.game.selected = 16;
  flow.game.players[1].river = [28, 28];
  const waits = flow.getWaits(flow.game, true);
  assert.deepEqual(waits, [28]);
  assert.equal(
    flow.getSubstatus(flow.game, waits, true),
    "聽牌：28（已無剩餘）",
  );
  engine.discardTile(flow.game, 0, 16);
  assert.equal(engine.remainingTileCounts(flow.game)[28], 0);
  // last.tile is already in the river and must not be counted twice.
  flow.game.players[1].river = [];
  assert.equal(engine.remainingTileCounts(flow.game)[28], 2);
});

for (const take of [
  [4, 99],
  [4, 4, 4],
  [4, 5],
]) {
  test(`invalid claim ${take} leaves every state field unchanged`, () => {
    const game = simultaneousClaims();
    const offer = engine.availablePlayerOffers(game)[0];
    offer.take = take;
    const before = JSON.stringify(game);
    assert.equal(engine.claimOffer(game, offer), "invalid");
    assert.equal(JSON.stringify(game), before);
  });
}

test("missing duplicate fails before any valid copy is removed or other choices are dismissed", () => {
  const game = simultaneousClaims();
  const pon = engine.availablePlayerOffers(game)[0];
  game.players[0].hand.splice(game.players[0].hand.indexOf(4), 1);
  const before = JSON.stringify(game);
  assert.equal(engine.claimOffer(game, pon), "invalid");
  assert.equal(JSON.stringify(game), before);
});

test("stale discard and invalid player cannot corrupt rivers or hands", () => {
  const game = simultaneousClaims();
  const pon = engine.availablePlayerOffers(game)[0];
  game.players[3].river = [9];
  const before = JSON.stringify(game);
  assert.equal(engine.claimOffer(game, pon), "invalid");
  assert.equal(JSON.stringify(game), before);
  pon.player = 99;
  const invalid = JSON.stringify(game);
  assert.equal(engine.claimOffer(game, pon), "invalid");
  assert.equal(JSON.stringify(game), invalid);
});
