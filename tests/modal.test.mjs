import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/modal.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const { manageModal } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

function fixture() {
  const doc = { activeElement: undefined };
  const element = (name) => ({
    name,
    isConnected: true,
    focus() {
      doc.activeElement = this;
    },
  });
  const trigger = element("restart"),
    first = element("close"),
    safe = element("continue"),
    last = element("confirm");
  trigger.focus();
  const handlers = new Map();
  const node = {
    ...element("dialog"),
    ownerDocument: doc,
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    querySelector: () => safe,
    querySelectorAll: () => [first, safe, last],
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: (name) => handlers.delete(name),
  };
  const tab = (shiftKey = false) => {
    const event = {
      key: "Tab",
      shiftKey,
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    handlers.get("keydown")(event);
    return event;
  };
  return { doc, trigger, first, safe, last, node, handlers, tab };
}

test("modal initially focuses safe cancel, cycles Tab and restores trigger after closing", async () => {
  const f = fixture();
  const action = manageModal(f.node);
  assert.equal(f.node.open, true);
  assert.equal(f.doc.activeElement, f.safe);
  f.last.focus();
  assert.equal(f.tab().prevented, true);
  assert.equal(f.doc.activeElement, f.first);
  f.first.focus();
  assert.equal(f.tab(true).prevented, true);
  assert.equal(f.doc.activeElement, f.last);
  f.safe.focus();
  assert.equal(f.tab().prevented, false);
  action.destroy();
  await Promise.resolve();
  assert.equal(f.node.open, false);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.doc.activeElement, f.trigger);
});

test("empty modal traps focus on itself; disconnected return target is not focused", async () => {
  const f = fixture();
  f.node.querySelector = () => null;
  f.node.querySelectorAll = () => [];
  const action = manageModal(f.node);
  assert.equal(f.doc.activeElement, f.node);
  assert.equal(f.tab().prevented, true);
  f.trigger.isConnected = false;
  action.destroy();
  await Promise.resolve();
  assert.equal(f.doc.activeElement, f.node);
});
