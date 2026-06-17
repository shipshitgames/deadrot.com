/**
 * Genre-neutral networking transport. Wraps a WebSocket-like socket in a small
 * JSON message bus keyed by a `t` discriminator, so a game speaks in typed
 * `emit(type, payload)` / `on(type, handler)` calls instead of touching the
 * socket directly. The concrete socket (PartySocket in production, a fake in
 * tests) is injected via {@link NetTransportOptions.socketFactory}, keeping this
 * module free of any transport-library or DOM coupling.
 */

/** Minimal surface this transport needs from a socket (a WebSocket/PartySocket subset). */
export interface TransportSocket {
  /** WebSocket-style ready state; `1` (OPEN) gates sends. */
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "close", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: string }) => void): void;
}

/** Opens a socket for `room`. Called once per {@link NetTransport.connect}. */
export type SocketFactory = (room: string) => TransportSocket;

/** A decoded inbound message. `t` is the discriminator; the rest is payload. */
export type NetMessage = { t?: string; [key: string]: unknown };

export type MessageHandler = (message: NetMessage) => void;
export type StatusHandler = (connected: boolean) => void;

export interface NetTransportOptions {
  /** Builds the underlying socket. Inject a fake to test or to swap libraries. */
  socketFactory: SocketFactory;
  /** Monotonic clock for {@link NetTransport.emitThrottled}; injectable for tests. */
  now?: () => number;
}

export interface NetTransport {
  /** True between a socket `open` and its `close`/`disconnect`. */
  readonly connected: boolean;
  /** Open the socket for `room` and start dispatching. No-op if already connected. */
  connect(room: string): void;
  /** Register a handler for inbound messages of `type`. Returns an unsubscribe fn. */
  on(type: string, handler: MessageHandler): () => void;
  /** Register a connection-status handler. Returns an unsubscribe fn. */
  onStatus(handler: StatusHandler): () => void;
  /** Send `{ t: type, ...payload }` when the socket is open; dropped otherwise. */
  emit(type: string, payload?: Record<string, unknown>): void;
  /**
   * Like {@link emit} but rate-limited per `type` to at most one send every
   * `minIntervalMs`. Returns true when the message was sent. Safe to call every
   * frame for high-rate streams like player transforms.
   */
  emitThrottled(type: string, payload: Record<string, unknown>, minIntervalMs: number): boolean;
  /** Close the socket and clear connection state. Registered handlers are kept. */
  disconnect(): void;
}

function defaultNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Create a {@link NetTransport} over the supplied socket factory. */
export function createTransport(options: NetTransportOptions): NetTransport {
  const { socketFactory } = options;
  const now = options.now ?? defaultNow;
  const handlers = new Map<string, Set<MessageHandler>>();
  const statusHandlers = new Set<StatusHandler>();
  const lastSent = new Map<string, number>();
  let socket: TransportSocket | null = null;
  let connected = false;

  function setStatus(next: boolean): void {
    if (connected === next) return;
    connected = next;
    for (const handler of [...statusHandlers]) handler(next);
  }

  function dispatch(data: string): void {
    let message: NetMessage;
    try {
      message = JSON.parse(data) as NetMessage;
    } catch {
      return; // ignore malformed frames rather than tearing down the room
    }
    const type = typeof message.t === "string" ? message.t : undefined;
    if (!type) return;
    const set = handlers.get(type);
    if (!set) return;
    for (const handler of [...set]) handler(message);
  }

  function rawSend(type: string, payload?: Record<string, unknown>): boolean {
    if (socket?.readyState !== 1) return false;
    socket.send(JSON.stringify({ t: type, ...payload }));
    return true;
  }

  return {
    get connected() {
      return connected;
    },
    connect(room) {
      if (socket) return;
      socket = socketFactory(room);
      socket.addEventListener("open", () => setStatus(true));
      socket.addEventListener("close", () => setStatus(false));
      socket.addEventListener("message", (event) => dispatch(event.data));
    },
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
      return () => {
        handlers.get(type)?.delete(handler);
      };
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => {
        statusHandlers.delete(handler);
      };
    },
    emit(type, payload) {
      rawSend(type, payload);
    },
    emitThrottled(type, payload, minIntervalMs) {
      const stamp = now();
      const last = lastSent.get(type) ?? Number.NEGATIVE_INFINITY;
      if (stamp - last < minIntervalMs) return false;
      lastSent.set(type, stamp);
      return rawSend(type, payload);
    },
    disconnect() {
      if (socket) {
        socket.close();
        socket = null;
      }
      lastSent.clear();
      setStatus(false);
    },
  };
}
