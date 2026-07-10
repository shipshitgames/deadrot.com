import catalogJson from "../assets-catalog.json" with { type: "json" };
import pyreDuelistUrl from "../entities/pyre-duelist/pactfall.webp";
import scourgeEliteUrl from "../entities/scourge-elite/pactfall.webp";
import trucebreakerUrl from "../entities/trucebreaker/pactfall.webp";
import wardenBastionUrl from "../entities/warden-bastion/pactfall.webp";

const BRAWL_ALIAS_URLS: Record<string, string> = {
  "entities/pyre-duelist/pactfall.webp": pyreDuelistUrl,
  "entities/scourge-elite/pactfall.webp": scourgeEliteUrl,
  "entities/trucebreaker/pactfall.webp": trucebreakerUrl,
  "entities/warden-bastion/pactfall.webp": wardenBastionUrl,
};

/** Brawl's roster names mapped to their canon catalog entity ids. */
export const BRAWL_FIGHTER_ENTITY_IDS = {
  "pyre-duelist": "pyre-duelist",
  "warden-bastion": "warden-bastion",
  "scourge-render": "scourge-elite",
  trucebreaker: "trucebreaker",
} as const;

export type BrawlFighterAssetId = keyof typeof BRAWL_FIGHTER_ENTITY_IDS;

function isAliasVariant(variant: unknown): variant is { type: "alias"; sourceGame: string } {
  return (
    typeof variant === "object" &&
    variant !== null &&
    "type" in variant &&
    variant.type === "alias" &&
    "sourceGame" in variant &&
    typeof variant.sourceGame === "string"
  );
}

/**
 * Resolves a Brawl fighter image through its explicit catalog alias. Brawl has
 * no fighter-specific renders yet, so each roster entry must point at a declared
 * alias instead of importing a Pactfall file from game code.
 */
export function brawlFighterAssetUrl(id: BrawlFighterAssetId): string {
  const entityId = BRAWL_FIGHTER_ENTITY_IDS[id];
  const entity = catalogJson.entities.find((candidate) => candidate.id === entityId);
  if (!entity) throw new Error(`Unknown Brawl fighter catalog entity: ${entityId}`);

  const variant = entity.variants.brawl;
  if (!isAliasVariant(variant)) {
    throw new Error(`Brawl fighter ${entityId} must declare a catalog alias until its own render exists.`);
  }

  const path = Object.entries(entity.variants).find(([game]) => game === variant.sourceGame)?.[1];
  if (typeof path !== "string") {
    throw new Error(`Brawl fighter ${entityId} alias resolves without an asset path.`);
  }

  const url = BRAWL_ALIAS_URLS[path];
  if (!url) throw new Error(`Brawl fighter ${entityId} alias is not included in the Brawl asset bundle: ${path}`);
  return url;
}
