export type Product = "tea" | "oil" | "jersey" | "bag";
export type Channel = "whatsapp" | "instagram";
export type Market = "IN" | "US";
export type LeadStatus =
  | "Browsing"
  | "Needs details"
  | "Ready for discussion"
  | "Human requested"
  | "Opted out";
export type Field = {
  key: string;
  label: string;
  question: string;
  examples: string[];
};
export const products: Record<
  Product,
  { name: string; keyword: string; icon: string; fields: Field[] }
> = {
  tea: {
    name: "Nilgiris tea",
    keyword: "TEA",
    icon: "leaf",
    fields: [
      {
        key: "variety",
        label: "Variety",
        question: "Which tea variety are you looking for?",
        examples: ["Black tea", "Green tea", "Please advise"],
      },
      {
        key: "pack",
        label: "Pack size",
        question: "What pack size would you prefer?",
        examples: ["100 g", "250 g", "500 g"],
      },
      {
        key: "quantity",
        label: "Quantity",
        question: "How many packs do you need?",
        examples: ["2", "10", "50"],
      },
      {
        key: "use",
        label: "Retail or bulk",
        question: "Is this a retail purchase or a bulk enquiry?",
        examples: ["Retail", "Bulk"],
      },
    ],
  },
  oil: {
    name: "Eucalyptus oil",
    keyword: "OIL",
    icon: "droplet",
    fields: [
      {
        key: "bottle",
        label: "Bottle size",
        question: "What bottle size would you prefer?",
        examples: ["30 ml", "100 ml", "Please advise"],
      },
      {
        key: "quantity",
        label: "Quantity",
        question: "How many bottles do you need?",
        examples: ["2", "10", "50"],
      },
      {
        key: "use",
        label: "Retail or bulk",
        question: "Is this a retail purchase or a bulk enquiry?",
        examples: ["Retail", "Bulk"],
      },
    ],
  },
  jersey: {
    name: "Running jerseys",
    keyword: "JERSEY",
    icon: "shirt",
    fields: [
      {
        key: "quantity",
        label: "Quantity",
        question: "How many running jerseys do you need?",
        examples: ["10", "20", "50"],
      },
      {
        key: "sizes",
        label: "Size breakdown",
        question:
          "What sizes and quantities do you need? The total should match your order.",
        examples: ["S: 5, M: 10, L: 5", "M: 10", "L: 20"],
      },
      {
        key: "fabric",
        label: "Fabric preference",
        question:
          "Any fabric preference? Availability will be confirmed by Siva.",
        examples: ["Breathable polyester", "Please advise"],
      },
      {
        key: "customization",
        label: "Logo & customization",
        question: "Do you need a team name, logo or other customization?",
        examples: ["Team logo", "Names and numbers", "None"],
      },
    ],
  },
  bag: {
    name: "Custom bags",
    keyword: "BAG",
    icon: "bag",
    fields: [
      {
        key: "type",
        label: "Bag type",
        question: "What kind of bag do you need?",
        examples: ["Tote", "Drawstring", "Duffel"],
      },
      {
        key: "dimensions",
        label: "Dimensions",
        question: "What dimensions would you prefer?",
        examples: ["35 × 40 cm", "Please advise"],
      },
      {
        key: "material",
        label: "Material",
        question: "What material would you prefer?",
        examples: ["Cotton", "Canvas", "Please advise"],
      },
      {
        key: "quantity",
        label: "Quantity",
        question: "How many bags do you need?",
        examples: ["10", "50", "100"],
      },
      {
        key: "customization",
        label: "Logo & customization",
        question: "Do you need a logo or other customization?",
        examples: ["Printed logo", "Embroidery", "None"],
      },
    ],
  },
};
const common: Field[] = [
  {
    key: "market",
    label: "Market",
    question: "Will delivery be in India or the US?",
    examples: ["India", "US"],
  },
  {
    key: "location",
    label: "Delivery region",
    question:
      "Which city and postal code should Siva use for the shipping quote?",
    examples: ["Coimbatore 641001", "Denver 80202"],
  },
  {
    key: "deadline",
    label: "Needed by",
    question: "When do you need it? A date or “flexible” is fine.",
    examples: ["In 3 weeks", "Flexible"],
  },
  {
    key: "payment",
    label: "Payment preference",
    question:
      "How would you prefer to pay? This is a preference, not a payment request.",
    examples: ["UPI", "Card", "Bank transfer", "Discuss with Siva"],
  },
];
export function fieldsFor(product: Product): Field[] {
  return [...products[product].fields, ...common];
}
export type Message = {
  id: string;
  role: "customer" | "assistant" | "owner";
  text: string;
  at: number;
};
export type Evidence = { messageId: string; quote: string };
export type Lead = {
  id: string;
  name: string;
  channel: Channel;
  product: Product;
  demo: boolean;
  productSelected?: boolean;
  recipient?: string;
  answers: Record<string, string>;
  evidence: Record<string, Evidence>;
  messages: Message[];
  confirmed: boolean;
  consent: boolean;
  human: boolean;
  optedOut: boolean;
  review: "new" | "reviewed";
  revision: number;
  updatedAt: number;
  lastInboundAt: number;
};
export type CatalogItem = {
  product: Product;
  description: string;
  priceIN: number | null;
  priceUS: number | null;
  stock: string;
  shipping: string;
  approved: boolean;
};
export const initialCatalog: CatalogItem[] = Object.keys(products).map((p) => ({
  product: p as Product,
  description:
    "Product details, origin and specifications need merchant approval.",
  priceIN: null,
  priceUS: null,
  stock: "Check with Siva",
  shipping: "Quote required; delivery dates are not confirmed",
  approved: false,
}));
export function missingFields(lead: Lead): Field[] {
  return fieldsFor(lead.product).filter((f) => !lead.answers[f.key]);
}
export function validationIssues(lead: Lead): string[] {
  const issues: string[] = [];
  const qty = Number(lead.answers.quantity);
  if (
    lead.answers.quantity &&
    (!Number.isInteger(qty) || qty < 1 || qty > 10000)
  )
    issues.push("Quantity must be a whole number from 1 to 10,000.");
  if (lead.answers.market && !["IN", "US"].includes(lead.answers.market))
    issues.push("Choose India or US.");
  if (lead.product === "jersey" && lead.answers.sizes) {
    const parts = [
      ...lead.answers.sizes.matchAll(
        /(?:\b(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL))\s*[:x=\-]\s*(\d+)\b/gi,
      ),
    ];
    const total = parts.reduce((s, m) => s + Number(m[1]), 0);
    if (
      parts.length === 0 ||
      total !== qty ||
      new Set(
        parts.map((m) =>
          m[0]
            .split(/[:x=\-]/)[0]
            .trim()
            .toUpperCase(),
        ),
      ).size !== parts.length ||
      parts.some((m) => Number(m[1]) < 1)
    )
      issues.push(
        "Jersey size quantities must add up to the requested quantity.",
      );
  }
  if (lead.answers.payment) {
    const allowed =
      lead.answers.market === "IN"
        ? ["UPI", "Card", "Bank transfer", "Discuss with Siva"]
        : ["Card", "Bank transfer", "Discuss with Siva"];
    if (!allowed.includes(lead.answers.payment))
      issues.push(
        "That payment preference needs discussion with Siva for this market.",
      );
  }
  return issues;
}
export function leadStatus(lead: Lead): LeadStatus {
  if (lead.optedOut) return "Opted out";
  if (lead.human) return "Human requested";
  if (!Object.keys(lead.answers).length) return "Browsing";
  if (
    !missingFields(lead).length &&
    !validationIssues(lead).length &&
    lead.confirmed &&
    lead.consent
  )
    return "Ready for discussion";
  return "Needs details";
}
export function normalizeField(key: string, value: string): string {
  let v = value.trim().slice(0, 250);
  if (key === "market")
    return /^(india|in|ind)$/i.test(v)
      ? "IN"
      : /^(us|usa|united states|u\.s\.)$/i.test(v)
        ? "US"
        : v;
  if (key === "quantity") {
    const m = v.match(
      /^\s*(\d+)\s*(?:packs?|bottles?|jerseys?|bags?|pieces?|pcs)?\s*$/i,
    );
    return m ? String(Number(m[1])) : v;
  }
  if (key === "payment") {
    if (/^upi$/i.test(v)) return "UPI";
    if (/^(card|credit card|debit card)$/i.test(v)) return "Card";
    if (/^(bank|bank transfer)$/i.test(v)) return "Bank transfer";
    if (/^(discuss|discuss with siva|please advise|flexible)$/i.test(v))
      return "Discuss with Siva";
  }
  return v;
}
export function redact(text: string): string {
  return text
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[sensitive number removed]")
    .replace(
      /\b(?:otp|cvv|pin|password)\s*[:=]?\s*\S+/gi,
      "[sensitive credential removed]",
    );
}
export function hasSensitive(text: string): boolean {
  return /\b(?:\d[ -]?){13,19}\b|\b(?:otp|cvv|pin|password)\s*[:=]?\s*\S+/i.test(
    text,
  );
}
export function updateAnswers(
  lead: Lead,
  values: Record<string, string>,
  message: Message,
): Lead {
  const next = structuredClone(lead);
  const allowed = new Set(fieldsFor(lead.product).map((f) => f.key));
  let changed = false;
  for (const [key, raw] of Object.entries(values)) {
    if (
      !allowed.has(key) ||
      typeof raw !== "string" ||
      !raw.trim() ||
      hasSensitive(raw)
    )
      continue;
    const v = normalizeField(key, raw);
    if (v !== next.answers[key]) changed = true;
    next.answers[key] = v;
    next.evidence[key] = {
      messageId: message.id,
      quote: redact(message.text).slice(0, 500),
    };
  }
  if (changed) {
    next.confirmed = false;
    next.consent = false;
    next.review = "new";
  }
  return next;
}
export function extractLocal(text: string, lead: Lead): Record<string, string> {
  const values: Record<string, string> = {};
  const allowed = fieldsFor(lead.product);
  const pairs = text.split(/[;\n]/);
  for (const pair of pairs) {
    const m = pair.match(/^\s*([\w &]+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().trim();
    const field = allowed.find(
      (f) => f.key === key || f.label.toLowerCase() === key,
    );
    if (field) values[field.key] = m[2];
  }
  const q = text.match(
    /\b(\d+)\s+(?:running\s+)?(?:jerseys?|bags?|packs?|bottles?)\b/i,
  );
  if (q) values.quantity = q[1];
  const sizes = [
    ...text.matchAll(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)\s*[:x=]\s*(\d+)\b/gi),
  ];
  if (sizes.length && lead.product === "jersey")
    values.sizes = sizes
      .map((m) => `${m[1].toUpperCase()}: ${m[2]}`)
      .join(", ");
  if (/\b(india|coimbatore|chennai|bangalore|bengaluru|mumbai)\b/i.test(text))
    values.market = "IN";
  else if (/\b(USA|United States|Denver|Colorado|Seattle)\b/i.test(text))
    values.market = "US";
  const location = text.match(/\b([A-Za-z][A-Za-z ]{1,40})\s+(\d{5,6})(?:\b)/);
  if (location) values.location = location[0].trim();
  const deadline = text.match(
    /\b(?:in\s+)?\d+\s+(?:weeks?|days?|months?)\b|\bflexible\b/i,
  );
  if (deadline) values.deadline = deadline[0];
  if (/\bUPI\b/i.test(text)) values.payment = "UPI";
  else if (/\bcard\b/i.test(text)) values.payment = "Card";
  else if (/\bbank transfer\b/i.test(text)) values.payment = "Bank transfer";
  if (/\b(?:team )?logo\b/i.test(text)) values.customization = "Team logo";
  // A plain answer is interpreted only as the field explicitly last asked.
  const previous = lead.messages
    .filter((m) => m.role === "assistant")
    .at(-1)?.text;
  const asked = allowed.find((f) => previous?.endsWith(f.question));
  if (
    asked &&
    !Object.keys(values).length &&
    text.length <= 250 &&
    !/[?]/.test(text)
  )
    values[asked.key] = text;
  return values;
}
export function nextReply(lead: Lead, catalog: CatalogItem[]): string {
  if (lead.optedOut)
    return "Understood. Automated replies and follow-up are stopped. You can message START to resume.";
  if (lead.human)
    return "Your request to speak with Siva is in the review queue. Siva will reply personally when available.";
  if (lead.productSelected === false)
    return "I’m Siva’s automated shop assistant. Which product can I help with: TEA, OIL, JERSEY or BAG? You can ask for a person or reply STOP at any time.";
  const issues = validationIssues(lead);
  if (issues.length) return issues[0];
  const f = missingFields(lead)[0];
  if (f) return f.question;
  if (!lead.confirmed || !lead.consent)
    return `Here is your enquiry: ${fieldsFor(lead.product)
      .map((f) => `${f.label}: ${lead.answers[f.key]}`)
      .join(
        "; ",
      )}. Reply CONFIRM to confirm these details and allow Siva to follow up here. This is a draft enquiry; price, availability and payment method still need Siva’s approval.`;
  return "Thanks. Your confirmed enquiry is ready for Siva to discuss with you. No order or payment has been confirmed.";
}
export function newLead(
  product: Product,
  channel: Channel,
  name = "Demo customer",
): Lead {
  return {
    id: crypto.randomUUID(),
    name,
    channel,
    product,
    demo: true,
    answers: {},
    evidence: {},
    messages: [],
    confirmed: false,
    consent: false,
    human: false,
    optedOut: false,
    review: "new",
    revision: 0,
    updatedAt: Date.now(),
    lastInboundAt: 0,
  };
}
export function receive(
  lead: Lead,
  text: string,
  catalog: CatalogItem[],
  extra: Record<string, string> = {},
  messageId = crypto.randomUUID(),
  now = Date.now(),
): { lead: Lead; reply: string; guardrail: string | null } {
  if (lead.messages.some((m) => m.id === messageId))
    return { lead, reply: "", guardrail: "duplicate" };
  let n = structuredClone(lead);
  const wasOut = n.optedOut;
  const safe = redact(text).slice(0, 4000);
  const msg: Message = { id: messageId, role: "customer", text: safe, at: now };
  n.messages.push(msg);
  n.lastInboundAt = Math.max(n.lastInboundAt, now);
  n.updatedAt = Date.now();
  n.revision++;
  let guardrail: string | null = null;
  let reply = "";
  if (/^(stop|unsubscribe|opt out)\b/i.test(text.trim())) {
    n.optedOut = true;
    n.consent = false;
    n.confirmed = false;
    guardrail = "opt_out";
  } else if (/^start$/i.test(text.trim())) {
    n.optedOut = false;
    n.human = false;
    guardrail = "resume";
  } else if (wasOut) return { lead: n, reply: "", guardrail: "opt_out" };
  else if (
    /\b(human|speak to siva|speak with siva|talk to siva|person|agent)\b/i.test(
      text,
    )
  ) {
    n.human = true;
    guardrail = "human_handoff";
  } else if (hasSensitive(text)) {
    reply =
      "Please do not share card numbers, OTPs, passwords or payment credentials here. Siva can discuss payment through an approved method.";
    guardrail = "sensitive_data";
  } else if (
    /ignore (?:all |previous |the )?instructions|system prompt|reveal.*(?:secret|token)|mark.*paid|bypass.*(?:consent|confirm)/i.test(
      text,
    )
  ) {
    reply = "I can help with the product enquiry or connect you with Siva.";
    guardrail = "untrusted_instruction";
  } else if (
    /\b(cure|treat|heal|asthma|diabetes|ingest|swallow|drink.*oil)\b/i.test(
      text,
    ) &&
    ["tea", "oil"].includes(n.product)
  ) {
    reply =
      "I can share merchant-approved product information. I cannot recommend treatment or ingestion of eucalyptus oil. For medical questions, please ask a qualified clinician.";
    guardrail = "health_claim";
  } else if (n.productSelected === false) {
    const p = (Object.keys(products) as Product[]).find((p) =>
      new RegExp(`\\b${products[p].keyword}S?\\b`, "i").test(text),
    );
    if (p) {
      n.product = p;
      n.productSelected = true;
    } else reply = nextReply(n, catalog);
  } else if (/^confirm$/i.test(text.trim())) {
    if (!missingFields(n).length && !validationIssues(n).length) {
      n.confirmed = true;
      n.consent = true;
    } else reply = "A few details still need checking before you can confirm.";
  } else if (
    /\b(price|cost|available|stock|shipping)\b/i.test(text) &&
    !text.includes(":")
  ) {
    const item = catalog.find((i) => i.product === n.product);
    const price = n.answers.market === "US" ? item?.priceUS : item?.priceIN;
    reply = item?.approved
      ? `${item.description} ${price != null ? `Catalog price: ${n.answers.market === "US" ? "USD" : "INR"} ${price}.` : "Siva will provide the price."} Stock: ${item.stock}. Shipping: ${item.shipping}.`
      : "Siva has not approved prices, stock or shipping yet. I can collect the details for a quote.";
    guardrail = "catalog_grounding";
  } else {
    n = updateAnswers(n, { ...extractLocal(text, n), ...extra }, msg);
  }
  reply = reply || nextReply(n, catalog);
  if (reply)
    n.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      text: reply,
      at: Date.now(),
    });
  return { lead: n, reply, guardrail };
}
export function workOrder(lead: Lead) {
  return {
    id: `WO-${lead.id.slice(0, 8).toUpperCase()}`,
    kind: "Draft enquiry — not a confirmed order",
    customer: lead.name,
    contact: lead.recipient || "Sample — no real customer contact",
    channel: lead.channel,
    product: products[lead.product].name,
    status: leadStatus(lead),
    details: fieldsFor(lead.product).map((f) => ({
      label: f.label,
      value: lead.answers[f.key] || "Needs details",
      evidence: lead.evidence[f.key] || null,
    })),
    permissionToFollowUp: lead.consent,
    confirmedByBuyer: lead.confirmed,
    price: "Quote required",
    payment: "Not requested or verified",
    owner: "Siva",
  };
}
export function demoLeads(): Lead[] {
  const specs: [Product, Channel, string, string][] = [
    [
      "jersey",
      "instagram",
      "Demo running club",
      "quantity: 20; sizes: S: 5, M: 10, L: 5; fabric: Breathable polyester; customization: Team logo; market: US; location: Denver 80202; deadline: In 3 weeks; payment: Card",
    ],
    [
      "tea",
      "whatsapp",
      "Demo tea buyer",
      "variety: Black tea; pack: 250 g; quantity: 4; use: Retail; market: IN; location: Coimbatore 641001; deadline: Flexible; payment: UPI",
    ],
    [
      "bag",
      "instagram",
      "Demo event organizer",
      "type: Tote; quantity: 50; market: US",
    ],
    ["oil", "whatsapp", "Demo oil buyer", ""],
  ];
  return specs.map(([p, ch, name, txt], i) => {
    let n = newLead(p, ch, name);
    n.id = `demo-${p}`;
    if (txt) n = receive(n, txt, initialCatalog).lead;
    else n = receive(n, "OIL", initialCatalog).lead;
    if (i === 1) n = receive(n, "CONFIRM", initialCatalog).lead;
    return n;
  });
}
