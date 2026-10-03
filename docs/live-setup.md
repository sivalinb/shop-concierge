# From sample workspace to live shop

## 1. Approve the merchant facts

Enter descriptions, supported variants, genuine product origin/claims, INR/USD prices when available, stock wording and shipping policy in Catalog. Approve each product only after checking it. For tea/oil, use the actual packaging and supplier facts. Do not market generated medical benefits. Keep unknowns quote-required. The listed payment methods are customer preferences, not a claim that accounts exist or payment is accepted.

## 2. Set up the business accounts

- WhatsApp: business account, registered phone number and Cloud API messaging access. Subscribe to the account’s message webhooks.
- Instagram: professional account, Instagram Login, current `instagram_business_manage_messages` permission and the relevant account webhook subscription.
- Use the scopes, app review and API version currently supported by Meta for your specific app and audience. Set `META_GRAPH_VERSION` explicitly; do not copy a guessed version from a tutorial.
- Invite customers to start a DM through your own Stories: **TEA**, **OIL**, **JERSEY**, **BAG**.

## 3. Keep the desk private, expose only the signed gateway

The hosted private Site is not directly reachable by Meta’s unauthenticated webhook caller. `gateway/worker.ts` is a separate small public HTTPS ingress with no inbox or customer-data UI.

Configure its server secrets using your Cloudflare Worker account:

- `SHOP_SITE_ORIGIN`: the exact private Site origin.
- `SHOP_SERVICE_TOKEN`: the Site’s supported platform service credential. It is sent only to that Site in `OAI-Sites-Authorization`.
- `META_APP_SECRET`: the same app secret configured in the private Site.
- `META_VERIFY_TOKEN`: a secret value used for Meta’s GET challenge verification.

Deploy the gateway from its directory with Wrangler after configuring your own account. No gateway is deployed by this repository’s sample app. Do not make the entire merchant app public to solve webhook access.

Set Meta callback URLs to `https://YOUR_GATEWAY/webhooks/whatsapp` and `/webhooks/instagram`. The gateway verifies raw-body HMAC, forwards to the private Site, then signs a delivery job. Neither endpoint accepts unsigned data.

## 4. Configure private Site secrets

Use the host’s secret store, never browser settings or public source:

```text
META_APP_SECRET
META_VERIFY_TOKEN
META_GRAPH_VERSION
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_ACCOUNT_ID
MERCHANT_OWNER_ID
LIVE_SEND_ENABLED=false
```

`MERCHANT_OWNER_ID` is the stable authenticated Site user ID for the merchant, not an email and not a Meta account ID. Read it from authenticated server-side identity in your own deployment. Bind the gateway and business accounts to that owner. The app is a single-merchant installation, not a multi-tenant commercial onboarding product.

Test signed inbound messages, replay delivery, STOP/START, human handoff and expired windows. Verify every callback targets your own configured account. When ready, set `LIVE_SEND_ENABLED=true` to let the delivery processor send business replies. Demo leads remain blocked.

The outbox stores draft, sending, sent, blocked or needs_review state. A send timeout may have delivered the message despite an absent response. The app marks it needs_review rather than retrying blindly. Inspect Meta’s delivery evidence before resending manually. A Worker crash during send can leave `sending`; handle it the same way. This design reduces duplicates but does not claim exactly-once delivery across a third-party network.

The gateway attempts a drain after each successfully processed webhook. Failed delivery jobs can leave drafts pending until a later webhook or an authorized operator runs the signed job. A production shop should add monitored queue/scheduled draining and delivery-status reconciliation before relying on unattended service.

## 5. Optional AI

Use a separately billed provider project with a scoped server-side key and a model supporting Responses structured output and image inputs. Set `OPENAI_API_KEY` and `OPENAI_MODEL`. Enable the visible enquiry-text permission in Connections. Each Story upload separately chooses whether to send that content for AI processing.

For a Site managed through Codex, the OpenAI Developers plugin can provision a key with approval. No existing home-directory token is assumed to authorize sending personal content.

The model extracts facts; the rules decide readiness. Refusals, malformed outputs and timeouts fall back to the explicit questionnaire. Image summaries should be treated as source claims and reviewed when exact text matters. The app sends `store:false`, which disables response-object storage but does not by itself eliminate all provider-side processing/log retention; apply the provider’s actual data settings.

## 6. Go-live checklist

Verify account permissions, merchant product claims, customer notices, opt-in policy, owner access, gateway signature tests, deletion, approved payment links and shipping policy. Run `npm test`, `npm run typecheck`, `npm run build`, then test with your own business account. Live Meta/OpenAI behavior has not been validated in this sample release.
