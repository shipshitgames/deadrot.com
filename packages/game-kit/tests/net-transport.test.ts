import assert from "node:assert/strict";
import { test } from "node:test";

import { createTransport, type SocketFactory, type TransportSocket } from "../src/net/transport";

/**
 * A WebSocket-shaped fake. Records every frame sent, exposes its listeners so a
 * test can drive open/close/message, and lets a test toggle `readyState` to
 * model a socket that isn't OPEN yet.
 */
class FakeSocket implements TransportSocket {
  readyState = 1; // OPEN
  sent: string[] = [];
  closed = false;
  room: string;
  private openListeners: Array<() => void> = [];
  private closeListeners: Array<() => void> = [];
  private messageListeners: Array<(event: { data: string }) => void> = [];

  constructor(room: string) {
    this.room = room;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.fireClose();
  }

  addEventListener(type: "open" | "close", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: string }) => void): void;
  addEventListener(type: "open" | "close" | "message", listener: (event: { data: string }) => void): void {
    if (type === "open") this.openListeners.push(listener as () => void);
    else if (type === "close") this.closeListeners.push(listener as () => void);
    else this.messageListeners.push(listener);
  }

  fireOpen() {
    for (const l of this.openListeners) l();
  }
  fireClose() {
    for (const l of this.closeListeners) l();
  }
  fireMessage(data: string) {
    for (const l of this.messageListeners) l({ data });
  }
}

/** A factory that hands the test the socket it created. */
function fakeFactory(): { factory: SocketFactory; last: () => FakeSocket } {
  let socket: FakeSocket | null = null;
  return {
    factory: (room) => {
      socket = new FakeSocket(room);
      return socket;
    },
    last: () => {
      if (!socket) throw new Error("socket not created yet");
      return socket;
    },
  };
}

test("connect opens the socket for the room and flips connected on open", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  const statuses: boolean[] = [];
  t.onStatus((c) => statuses.push(c));

  assert.equal(t.connected, false);
  t.connect("BREACH-1");
  assert.equal(last().room, "BREACH-1");
  assert.equal(t.connected, false, "still closed until the socket opens");

  last().fireOpen();
  assert.equal(t.connected, true);
  assert.deepEqual(statuses, [true]);
});

test("connect is idempotent — a second call does not open a new socket", () => {
  let created = 0;
  const t = createTransport({
    socketFactory: (room) => {
      created++;
      return new FakeSocket(room);
    },
  });
  t.connect("R");
  t.connect("R");
  assert.equal(created, 1);
});

test("emit sends a typed frame only while the socket is OPEN", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  t.connect("R");
  last().fireOpen();

  t.emit("hit", { target: "p2", dmg: 25 });
  assert.deepEqual(JSON.parse(last().sent[0] as string), { t: "hit", target: "p2", dmg: 25 });

  t.emit("ping");
  assert.deepEqual(JSON.parse(last().sent[1] as string), { t: "ping" });

  last().readyState = 0; // CONNECTING — sends must drop
  t.emit("hit", { target: "p3", dmg: 9 });
  assert.equal(last().sent.length, 2, "frame dropped while not OPEN");
});

test("on dispatches decoded inbound messages by type, and unsubscribes cleanly", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  t.connect("R");

  const welcomes: unknown[] = [];
  const states: unknown[] = [];
  const off = t.on("welcome", (m) => welcomes.push(m));
  t.on("state", (m) => states.push(m));

  last().fireMessage(JSON.stringify({ t: "welcome", id: "self" }));
  last().fireMessage(JSON.stringify({ t: "state", id: "p2", x: 1 }));
  assert.deepEqual(welcomes, [{ t: "welcome", id: "self" }]);
  assert.deepEqual(states, [{ t: "state", id: "p2", x: 1 }]);

  off();
  last().fireMessage(JSON.stringify({ t: "welcome", id: "again" }));
  assert.equal(welcomes.length, 1, "handler removed");
});

test("multiple handlers for one type all fire", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  t.connect("R");
  let a = 0;
  let b = 0;
  t.on("join", () => a++);
  t.on("join", () => b++);
  last().fireMessage(JSON.stringify({ t: "join", player: {} }));
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("malformed frames and frames without a type are ignored", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  t.connect("R");
  let fired = 0;
  t.on("state", () => fired++);

  last().fireMessage("not json{");
  last().fireMessage(JSON.stringify({ x: 1 })); // no `t`
  last().fireMessage(JSON.stringify({ t: 123 })); // non-string `t`
  assert.equal(fired, 0);
});

test("onStatus reports open then close exactly once each", () => {
  const { factory, last } = fakeFactory();
  const t = createTransport({ socketFactory: factory });
  const statuses: boolean[] = [];
  t.onStatus((c) => statuses.push(c));
  t.connect("R");
  last().fireOpen();
  last().fireOpen(); // duplicate open — must not re-report
  last().fireClose();
  assert.deepEqual(statuses, [true, false]);
  assert.equal(t.connected, false);
});

test("emitThrottled rate-limits per type using the injected clock", () => {
  const { factory, last } = fakeFactory();
  let now = 1000;
  const t = createTransport({ socketFactory: factory, now: () => now });
  t.connect("R");
  last().fireOpen();

  assert.equal(t.emitThrottled("state", { x: 0 }, 45), true, "first send passes");
  now += 20;
  assert.equal(t.emitThrottled("state", { x: 1 }, 45), false, "within interval — dropped");
  now += 30; // 50ms since the first send
  assert.equal(t.emitThrottled("state", { x: 2 }, 45), true, "interval elapsed — passes");

  // A different type has its own independent budget.
  assert.equal(t.emitThrottled("name", { n: "x" }, 45), true);

  const sent = last().sent.map((s) => JSON.parse(s));
  assert.deepEqual(sent, [
    { t: "state", x: 0 },
    { t: "state", x: 2 },
    { t: "name", n: "x" },
  ]);
});

test("disconnect closes the socket, reports disconnected, and resets throttle", () => {
  const { factory, last } = fakeFactory();
  const now = 0;
  const t = createTransport({ socketFactory: factory, now: () => now });
  const statuses: boolean[] = [];
  t.onStatus((c) => statuses.push(c));
  t.connect("R");
  last().fireOpen();
  t.emitThrottled("state", { x: 0 }, 45);

  t.disconnect();
  assert.equal(last().closed, true);
  assert.equal(t.connected, false);
  assert.deepEqual(statuses, [true, false]);

  // A fresh socket after reconnect: throttle history is gone, first send passes.
  t.connect("R2");
  last().fireOpen();
  assert.equal(t.emitThrottled("state", { x: 9 }, 45), true);
});
