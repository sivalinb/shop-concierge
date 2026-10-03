# Threat model and operational boundaries

| Risk                                            | Implemented boundary                                                                          | Remaining limitation                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Customer asks model to leak another chat        | Owner-scoped queries; extractor has no database/tool access; validated field allowlist        | No claim of universal prompt-injection prevention                                                              |
| Model invents urgency, price or medical promise | Replies assembled from questionnaire and approved catalog; medical-claim boundary for tea/oil | Merchant must ensure catalog claims are legitimate; regex classifiers are limited                              |
| Buyer gets silently rejected                    | Missing-info states, visible review queue and human bypass                                    | No sincerity/identity verification; screening is completeness only                                             |
| Webhook forgery                                 | Raw-body HMAC at gateway and private app; explicit configured account filtering               | Meta secret rotation and gateway configuration are operator tasks                                              |
| Duplicate or concurrent message                 | External message IDs, optimistic revision checks, atomic outbox claim                         | Uncertain external send needs human review; no exactly-once promise                                            |
| Old/stale reply                                 | Latest reply comparison, opt-out check, active window check                                   | A message can arrive during a send; external network timing cannot be made transactional                       |
| Upload spoofing / excessive memory              | Bounded stream read, 5 MB file cap, image signature/type checks, private R2                   | Screenshots are not antivirus-scanned; no SVG/HTML uploads accepted                                            |
| SSRF through Stories or media URLs              | No arbitrary remote URL fetch                                                                 | User-shared URLs are treated as text; no automatic linked-site research                                        |
| Customer-data exposure in public Git            | Fictional fixtures; runtime state, keys, uploads and DB files ignored                         | Operators must check future commits too                                                                        |
| Cross-owner access                              | Hosted private access boundary and owner key in every customer-record query                   | Self-hosted deployments must preserve trusted identity injection; never trust caller-supplied identity headers |
| Excessive provider cost                         | Explicit consent, bounded inputs/timeouts, per-minute quota                                   | Not a monetary budget cap; configure provider spending limits                                                  |

Browser access uses Sites sign-in. Public gateway access does not grant owner UI privileges. `MERCHANT_OWNER_ID` is configured server-side. The gateway forwards only signed callbacks and a signed delivery job to a fixed HTTPS origin; it never forwards user-controlled destinations.

Payment credentials are not requested. Obvious long number strings and labeled OTP/CVV/PIN/password values are removed. This limited redaction does not detect all personal information. Enquiry delivery city/postcode is intentionally retained for a shipping conversation; don’t supply full addresses before they are needed.

Conversation/digest deletion removes its app records and associated media/drafts; this is not a claim that provider logs, backups, previous Git history or Meta messages are deleted. There is no cross-provider deletion service. Event logs are operational labels with no message text, and deletion events do not keep the deleted content.

The evaluation report uses synthetic cases and mocked provider responses. It demonstrates software boundaries in those cases, not measured live lead precision, customer sincerity or human health outcomes.
