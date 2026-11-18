# Deployment and data compatibility

## Fresh installation

1. Provision a MongoDB replica set or Atlas database.
2. Supply the variables in .env.example using server-side secret storage.
3. Install with npm ci, build with npm run build, and run npm run start:prod.
4. Place the API behind HTTPS and configure only your actual browser origins.
5. Configure a persistent Stripe webhook URL and its endpoint-specific signing secret.
6. Verify email delivery, Google audience, S3 access and Stripe test checkout/refunds with your own accounts.
7. Provision an admin through a controlled database operation after confirming the account. Public signup cannot assign roles.
8. Run the regression suite against an isolated test database before release.

## Existing database checklist

Take a backup and review existing records before deployment:

- Password-reset bugs in earlier versions may have stored unhashed passwords. Invalidate affected credentials and use the reset flow; do not assume old password data is sound.
- Old JWTs without a token version are rejected. Users must sign in again.
- Carts now have a unique createdBy index. Reconcile duplicate carts per customer before creating that index.
- OTPs now have a unique (createdBy, type) index. Remove expired/redundant OTP records before creating it.
- Old orders do not have immutable items or a recorded Stripe session. Reconcile existing pending/paid orders manually. Do not synthesize a historical order snapshot from a cart that may have changed.
- Existing products may contain only the already discounted price. Supply their original price when changing discount; new products store basePrice.
- Earlier versions declared a unique variants.sku index. Review existing indexes and remove that legacy index if it conflicts with the documented per-product variant behavior.
- Product update moved to PATCH /Products/update/:id to prevent a route collision with variant updates.
- An earlier anonymous /upload/\*path S3 proxy was removed. Implement controlled signed-URL or CDN delivery for catalog images.

## Operational limits

### Dependency maintenance

CI checks production dependencies with `npm audit --omit=dev --audit-level=high`. Also run the full `npm audit` when maintaining the build and test tools. The current development dependency tree reports advisories through `picomatch`, `glob` and `minimatch` in Jest, the Nest CLI and linting tools. These development-only findings are not covered by the production audit gate; a green CI run does not mean the full dependency tree is advisory-free.

Keep build/test tooling out of the deployed runtime: build with `npm ci`, then use `npm prune --omit=dev` before running `node dist/main`. Build only trusted source and do not pass untrusted glob patterns to development tools. Review upstream fixes and compatibility before major tooling upgrades; do not apply `npm audit fix --force` blindly.

Transactions protect stock/coupon/cart updates, not remote Stripe or S3 calls. Stripe calls use order-scoped idempotency keys; payment and stock transitions use conditional updates. Reconcile provider state after prolonged outages.

A pending refund does not release stock. Failed/cancelled asynchronous refunds need administrator reconciliation; notifications and a reconciliation dashboard are outside this repository's scope.

Orders created without opening Checkout remain pending until an administrator cancels them. There is no automatic abandoned-order scheduler. Monitor pending orders and webhook delivery failures.

Keep a single app instance for the built-in per-process account limiter, or enforce a shared rate limit at a gateway. Reverse-proxy trust and IP extraction must match your deployment.

This project has no storefront, shipping carrier, tax engine or variant-specific purchasing. Live external integrations require separate acceptance testing.
