export {};

// Shape of the customized Clerk session token. Requires the dashboard
// session-token customization (Sessions → Customize session token):
//   { "deadrotCollection": "{{user.public_metadata.deadrotCollection}}" }
// One flat claim with just the field we need — not the whole metadata bag —
// so proxy.ts can read the entitlement without a Backend API call per request.
// (Without the customization the claim is absent and proxy.ts falls back to
// an authoritative user lookup; slower, still correct.)
declare global {
  interface CustomJwtSessionClaims {
    /** Shortcode resolves to null for users who never purchased. */
    deadrotCollection?: boolean | null;
  }
}
