# API guide

Base URL: `http://localhost:3000`. Request bodies are JSON unless an upload is specified. Unknown body properties are rejected. IDs must be MongoDB ObjectIds.

## Accounts

| Method | Route                | Access         | Purpose                           |
| ------ | -------------------- | -------------- | --------------------------------- |
| POST   | /user/signup         | Public         | Register customer                 |
| PATCH  | /user/confirmEmail   | Public         | Confirm email using code          |
| POST   | /user/resendOtp      | Public         | Request another confirmation code |
| POST   | /user/signin         | Public         | Receive access and refresh tokens |
| POST   | /user/refreshToken   | Public         | Exchange refresh token            |
| PATCH  | /user/forgotPassword | Public         | Request reset code                |
| PATCH  | /user/resetPassword  | Public         | Reset password with code          |
| POST   | /user/google-oauth   | Public         | Verify Google ID token            |
| GET    | /user/getProfile     | Customer/admin | Read own profile                  |
| POST   | /user/upload         | Customer       | Upload image attachment           |

Registration:

```json
{
  "firstName": "Demo",
  "lastName": "Customer",
  "email": "customer@example.com",
  "age": 24,
  "password": "YourOwnStrongPassword!123",
  "confirmPassword": "YourOwnStrongPassword!123"
}
```

Confirmation uses `{ "email": "customer@example.com", "code": "123456" }`; use the actual emailed code. Reset uses `email`, `otp`, `password`, `cPassword`. Each code expires after 10 minutes, is single-use and permits at most five verification attempts. Requests for replacement codes have a one-minute cooldown.

Sign-in uses `email` and `password`. Refresh uses `{ "refresh_token": "..." }`. Access tokens last 15 minutes and refresh tokens seven days. Password reset invalidates existing tokens. Google sign-in uses `idToken`; a new account also requires `firstName`, `lastName`, `age`.

## Catalog

Public listing routes: `GET /brands`, `GET /Categories`, `GET /subCategories`, `GET /Products`. Query parameters: `page` (1+), `limit` (1–100), `search`.

Admin creation routes use the same paths with POST. Brand/category/subcategory image field: `attachment`. Product fields: `mainImage` (one image) and optional `subImages` (up to five). Each file is limited to 5 MB.

Product creation fields: `name`, `description`, `price` (undiscounted), `discount` (0–99), `quantity`, `stock`, `brand`, `category`, `subCategory`. Monetary values allow two decimal places. Stored `basePrice` retains the original price; `price` is the price after product discount. Send numeric multipart fields as text; the DTO converts them.

Admin product update: `PATCH /Products/update/:id`. This explicit path avoids conflict with `PATCH /Products/variants/update`. Image update: `PATCH /Products/updateImage/:id`.

Variants: `POST /Products/variants/add`, `PATCH /Products/variants/update`, `DELETE /Products/variants/delete`, `GET /Products/variants/:id`. Variant stock is not used by the parent-product checkout flow.

Wish-list toggle: `POST /Products/wish-list/:id`, customer/admin.

## Carts, coupons and orders

Send the signed-in customer's access token. Cart and checkout lookups are always scoped to that customer.

```json
{ "productId": "REPLACE_WITH_PRODUCT_ID", "quantity": 2 }
```

Cart routes: POST /Carts to add a product; PATCH /Carts/:id with { quantity } to update; DELETE /Carts/:id to remove a product; DELETE /Carts to clear. The :id is a product ID. Quantities must be positive integers. Cart values are estimates; creating an order re-reads catalog prices and stock inside a transaction.

Admin coupons: `POST /Coupons`, `PATCH /Coupons/:id`.

```json
{
  "code": "welcome10",
  "amount": 10,
  "fromDate": "2030-01-01T00:00:00.000Z",
  "toDate": "2030-02-01T00:00:00.000Z"
}
```

Choose dates appropriate to the intended promotion. `amount` is a percentage, 1–99.

Create order: `POST /Order`.

```json
{
  "address": "Customer delivery address",
  "phone": "Customer phone",
  "paymentMethod": "CARD",
  "couponCode": "welcome10"
}
```

`couponCode` is optional; `paymentMethod` is `CARD` or `CASH`. Creating the order reserves stock and clears the cart atomically. The returned order contains its item snapshot.

Card checkout: `POST /Order/stripe/:id`. The response contains a Stripe Checkout session. Repeated calls return the existing session.

Webhook: `POST /Order/webhook`. Stripe sends the `stripe-signature` header; manually posting an unsigned JSON body is rejected.

Admin cancellation/refund: `PATCH /Order/:id`. A pending order is cancelled; a paid card order is refunded through Stripe. Refunds reported as pending stay `REFUND_PENDING` until successful confirmation.

## Responses

The existing controllers retain their response envelopes (`message`, `product`, `order`, etc.). Validation failures return 400; missing or invalid authentication returns 401; insufficient permissions returns 403. The health response is `{ "name": "E-Commerce API", "status": "ok" }`.
