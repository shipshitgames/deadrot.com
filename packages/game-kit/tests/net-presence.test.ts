import assert from "node:assert/strict";
import { test } from "node:test";

import { createPresenceRegistry, type PeerInfo, type RemotePeer } from "../src/net/presence";

interface Info extends PeerInfo {
  id: string;
  name: string;
}

/** A minimal {@link RemotePeer} that records its own disposal. */
class StubPeer implements RemotePeer {
  readonly id: string;
  name: string;
  disposed = 0;
  constructor(info: Info) {
    this.id = info.id;
    this.name = info.name;
  }
  dispose() {
    this.disposed++;
  }
}

function setup() {
  let built = 0;
  const added: StubPeer[] = [];
  const removed: StubPeer[] = [];
  const registry = createPresenceRegistry<Info, StubPeer>(
    (info) => {
      built++;
      return new StubPeer(info);
    },
    {
      onAdd: (p) => added.push(p),
      onRemove: (p) => removed.push(p),
    },
  );
  return { registry, added, removed, builtCount: () => built };
}

test("add builds a peer, fires onAdd, and tracks it", () => {
  const { registry, added, builtCount } = setup();
  const peer = registry.add({ id: "p1", name: "Ana" });
  assert.ok(peer);
  assert.equal(peer?.name, "Ana");
  assert.equal(registry.size, 1);
  assert.equal(registry.has("p1"), true);
  assert.equal(registry.get("p1"), peer);
  assert.deepEqual(added, [peer]);
  assert.equal(builtCount(), 1);
});

test("add skips self and never builds a peer for it", () => {
  const { registry, added, builtCount } = setup();
  registry.selfId = "me";
  const peer = registry.add({ id: "me", name: "Me" });
  assert.equal(peer, null);
  assert.equal(registry.size, 0);
  assert.equal(builtCount(), 0);
  assert.deepEqual(added, []);
});

test("add is idempotent for a known id — no duplicate build", () => {
  const { registry, builtCount } = setup();
  const first = registry.add({ id: "p1", name: "Ana" });
  const second = registry.add({ id: "p1", name: "Ana v2" });
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(registry.size, 1);
  assert.equal(builtCount(), 1);
  assert.equal(registry.get("p1")?.name, "Ana", "kept the original peer");
});

test("values iterates tracked peers in insertion order", () => {
  const { registry } = setup();
  registry.add({ id: "a", name: "A" });
  registry.add({ id: "b", name: "B" });
  registry.add({ id: "c", name: "C" });
  assert.deepEqual(
    [...registry.values()].map((p) => p.id),
    ["a", "b", "c"],
  );
});

test("remove disposes the peer, fires onRemove, and forgets it", () => {
  const { registry, removed } = setup();
  const peer = registry.add({ id: "p1", name: "Ana" });
  const out = registry.remove("p1");
  assert.equal(out, peer);
  assert.equal(peer?.disposed, 1);
  assert.deepEqual(removed, [peer]);
  assert.equal(registry.size, 0);
  assert.equal(registry.has("p1"), false);
});

test("remove of an unknown id is a no-op", () => {
  const { registry, removed } = setup();
  assert.equal(registry.remove("ghost"), undefined);
  assert.deepEqual(removed, []);
});

test("clear disposes every peer and empties the registry", () => {
  const { registry, removed } = setup();
  const a = registry.add({ id: "a", name: "A" });
  const b = registry.add({ id: "b", name: "B" });
  registry.clear();
  assert.equal(registry.size, 0);
  assert.equal(a?.disposed, 1);
  assert.equal(b?.disposed, 1);
  assert.deepEqual(removed, [a, b]);
});

test("a peer added before selfId is set still survives a later self match check", () => {
  const { registry } = setup();
  const peer = registry.add({ id: "p1", name: "Ana" });
  registry.selfId = "p1"; // self id is learned later (welcome arrives after a join)
  assert.equal(registry.get("p1"), peer, "already-tracked peers are not retroactively evicted");
  // ...but a fresh add of self is now rejected.
  assert.equal(registry.add({ id: "p1", name: "dup" }), null);
});
