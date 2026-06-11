export {};

// Shape of the customized Clerk session token. Requires the dashboard
// session-token customization: { "metadata": "{{user.public_metadata}}" }
// so proxy.ts can read the entitlement without a Backend API call per request.
declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      deadrotCollection?: boolean;
    };
  }
}
