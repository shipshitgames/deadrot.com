import PartySocket from "partysocket";
import type { SocketFactory, TransportSocket } from "./transport";

export interface PartySocketFactoryOptions {
  /** PartyKit host, e.g. `"localhost:1999"` in dev or `"deadrot.partykit.dev"`. */
  host: string;
  /** PartyKit "party" (server class) name. Defaults to `"main"`. */
  party?: string;
}

/**
 * Builds a {@link SocketFactory} backed by PartySocket. This is the only spot in
 * the net layer that depends on the concrete transport library, so the rest of
 * {@link createTransport} stays library-agnostic and trivially unit-testable.
 */
export function createPartySocketFactory(options: PartySocketFactoryOptions): SocketFactory {
  const party = options.party ?? "main";
  return (room: string): TransportSocket =>
    new PartySocket({ host: options.host, room, party }) as unknown as TransportSocket;
}
