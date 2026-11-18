# E-Commerce API

A modular commerce backend built with **NestJS, TypeScript and MongoDB**, covering customer accounts, a product catalog, shopping carts, coupons and orders with Stripe Checkout.

[![CI](https://github.com/Mahetab21/E-Commerce-App/actions/workflows/ci.yml/badge.svg)](https://github.com/Mahetab21/E-Commerce-App/actions/workflows/ci.yml)

**Author:** [Mahitab Ayman](https://github.com/Mahetab21) · Backend Developer

This repository contains the API. It does not include a storefront or a hosted demo.

## What the API does

- Email registration and confirmation, password recovery, Google ID-token sign-in, access/refresh JWTs and role guards.
- Admin management of brands, categories, subcategories, products and product variants.
- Customer wish lists and owner-scoped shopping carts with quantity validation.
- Date-limited percentage coupons, with one redemption per customer.
- Cash orders and Stripe Checkout payments.
- MongoDB transactions for stock reservation, coupon redemption and cart clearing.
- Order item and price snapshots independent of subsequent cart/catalog changes.
- Signed Stripe webhooks with amount, currency and session checks; repeat deliveries do not double-apply order state changes.
- Cancellation/refund handling with stock restoration and an explicit pending-refund state.
- S3 image uploads, bounded multipart requests, pagination and keyword search.

## Stack and organization

| Layer           | Tools                                                                 |
| --------------- | --------------------------------------------------------------------- |
| HTTP API        | NestJS 11, Express, TypeScript                                        |
| Data            | MongoDB, Mongoose, repository classes                                 |
| Authentication  | JWT, bcrypt, Google Auth Library, expiring hashed OTPs                |
| Payments        | Stripe Checkout and signed webhooks                                   |
| Files and email | AWS S3, Multer, Nodemailer                                            |
| Verification    | Jest, Supertest, MongoDB replica-set regression tests, GitHub Actions |

```text
src/
  config/          Environment validation and HTTP configuration
  DB/
    models/        Mongoose schemas
    repositories/  Database access
  common/          Guards, decorators, validation and integrations
  module/
    user/          Accounts and authentication
    brand/         Brand management
    category/      Category management
    subCategory/   Subcategory management
    Product/       Catalog, variants and wish lists
    Cart/          Customer carts
    Coupon/        Discount codes
    order/         Orders, checkout, payments and refunds
    gateway/       Authenticated Socket.IO connections
```

Controllers validate requests and enforce roles; services implement business rules; repositories perform database operations. Socket connections use the HTTP server port; cart contents are not broadcast to other customers.

## Run locally

**Requirements:** Node.js 22+, npm and a MongoDB replica set. Atlas works; a standalone MongoDB server cannot execute order transactions.

```bash
git clone https://github.com/Mahetab21/E-Commerce-App.git
cd E-Commerce-App
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell). Set `MONGO_URI`, the four token secrets and the authorization prefixes. Generate each token secret independently:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

For a local database with Docker:

```bash
docker compose up -d
docker compose exec mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

The one-time initiation command is only needed for a new database volume. The default example URI connects through localhost. Then:

```bash
npm run start:dev
# GET http://localhost:3000/ returns the service status.
```

For a compiled start:

```bash
npm run build
npm run start:prod
```

### Integration configuration

| Feature        | Variables                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | `MONGO_URI` (replica set required for orders)                                                                                                |
| Tokens         | `ACCESS_TOKEN_USER`, `ACCESS_TOKEN_ADMIN`, `REFRESH_TOKEN_USER`, `REFRESH_TOKEN_ADMIN` — four different secrets, at least 32 characters each |
| Authorization  | `BEARER_USER=Bearer`, `BEARER_ADMIN=Admin`                                                                                                   |
| Browser client | `CORS_ORIGINS` — comma-separated allowed origins                                                                                             |
| Email          | `EMAIL_USER`, `EMAIL_PASSWORD` — Gmail address and application password                                                                      |
| Google sign-in | `WEB_CLIENT_ID`                                                                                                                              |
| Images         | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `APPLICATION_NAME`                                            |
| Payments       | `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`                                                     |

External integrations require your own credentials. No keys or ready-made accounts are supplied. Image upload methods return S3 object keys; client image delivery needs a controlled signed-URL/CDN integration. There is no anonymous proxy to private S3 objects.

## Try the API

Use the requests in [the API guide](docs/API.md). The core sequence is:

1. Register a customer at `POST /user/signup`.
2. Confirm the emailed code at `PATCH /user/confirmEmail`.
3. Sign in at `POST /user/signin`.
4. Send `Authorization: Bearer <access_token>` on customer requests.
5. Browse `GET /Products`, add items to `POST /Carts`, then create an order at `POST /Order`.
6. For a card order, call `POST /Order/stripe/:id` and open the returned Checkout URL.

Admin tokens use `Authorization: Admin <access_token>`. Public registration always creates a customer. Provision administrators through a controlled database operation; there is no public role-upgrade endpoint.

### Stripe test mode

```bash
stripe listen --forward-to localhost:3000/Order/webhook
```

Set the printed signing secret as `STRIPE_WEBHOOK_SECRET`. Use a Stripe **test-mode** API key. Subscribe the deployed endpoint to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`
- `refund.created` and `refund.updated`

Payment is recorded by a verified webhook, never by the success-page redirect. Checkout uses the final stored order total in EGP minor units, including the applied coupon. Sessions use Stripe's default expiry; expiration webhooks release reservations. Orders that never start Checkout remain pending and can be cancelled by an administrator.

## Tests

```bash
npm test -- --runInBand
```

Database regression tests additionally require `TEST_MONGO_URI` pointing to a **dedicated disposable replica-set database**. They clear collections in that database. Do not use a database containing application data.

PowerShell example:

```powershell
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017/ecommerce_test?replicaSet=rs0"
$env:MONGO_URI = $env:TEST_MONGO_URI
npm run test:ci
```

Set the same token environment variables as the app before running integration tests. Without `TEST_MONGO_URI`, database-dependent tests are explicitly skipped. CI starts a separate MongoDB replica set and executes the build, regression suite and production dependency audit.

Coverage includes role escalation, password hashing and token invalidation, expired/overused OTPs, cart ownership, stock checks, immutable order prices, transaction rollback, concurrent orders, signed payment events, refund failure and startup routes. Stripe network calls, Gmail, Google and S3 are not exercised against live accounts by the automated suite.

## Deployment and existing data

See [deployment and migration notes](docs/DEPLOYMENT.md) before connecting an existing database. Use HTTPS, a replica-set database, a persistent webhook endpoint and server-side secret storage. This is a portfolio backend with tested workflows, not a claim of completed production operations.

Current scope:

- Product variants are catalog metadata; cart and order purchases currently target the parent product.
- Delivery tracking, tax/shipping calculations, a storefront and scheduled abandoned-order cleanup are not implemented.
- The account limiter is per process; multiple instances require a shared limiter or gateway policy.
- Pending/failed external refunds require reconciliation with Stripe. Do not treat a pending refund as completed.
- S3/Gmail/Google/Stripe end-to-end operation must be verified with deployment credentials.

## References

- [NestJS raw body](https://docs.nestjs.com/faq/raw-body)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
