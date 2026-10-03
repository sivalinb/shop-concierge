import type { Channel, Lead } from "./domain";
export type MetaConfig = {
  META_GRAPH_VERSION?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  LIVE_SEND_ENABLED?: string;
};
export type Inbound = {
  id: string;
  sender: string;
  channel: Channel;
  text: string;
  at: number;
};
export function parseWebhook(body: any, config: MetaConfig): Inbound[] {
  const result: Inbound[] = [];
  for (const entry of body.entry || []) {
    if (body.object === "whatsapp_business_account") {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (
          value?.metadata?.phone_number_id !== config.WHATSAPP_PHONE_NUMBER_ID
        )
          continue;
        for (const m of value.messages || []) {
          if (m.type === "text" && m.text?.body && m.id && m.from)
            result.push({
              id: m.id,
              sender: m.from,
              channel: "whatsapp",
              text: m.text.body,
              at: Number(m.timestamp) * 1000,
            });
        }
      }
    } else if (
      body.object === "instagram" &&
      entry.id === config.INSTAGRAM_ACCOUNT_ID
    ) {
      for (const m of entry.messaging || []) {
        if (
          m.message?.is_echo ||
          m.recipient?.id !== config.INSTAGRAM_ACCOUNT_ID
        )
          continue;
        if (m.message?.mid && m.message?.text && m.sender?.id)
          result.push({
            id: m.message.mid,
            sender: m.sender.id,
            channel: "instagram",
            text: m.message.text,
            at: Number(m.timestamp),
          });
      }
    }
  }
  return result.filter(
    (m) =>
      Number.isFinite(m.at) &&
      m.at > 0 &&
      m.text.length <= 4000 &&
      m.sender.length < 100,
  );
}
export function canSend(
  lead: Lead,
  config: MetaConfig,
  now = Date.now(),
): string | null {
  if (lead.demo) return "Demo conversations never send externally.";
  if (config.LIVE_SEND_ENABLED !== "true") return "Live sending is disabled.";
  if (lead.optedOut) return "The customer has opted out.";
  if (
    !lead.recipient ||
    !lead.lastInboundAt ||
    now - lead.lastInboundAt > 24 * 60 * 60 * 1000 ||
    lead.lastInboundAt > now + 5 * 60 * 1000
  )
    return "No active customer-initiated 24-hour reply window. Use an approved template workflow for later contact.";
  if (!/^v\d+\.\d+$/.test(config.META_GRAPH_VERSION || ""))
    return "Set the API version supported by your Meta app.";
  if (
    lead.channel === "whatsapp" &&
    (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID)
  )
    return "WhatsApp is not connected.";
  if (
    lead.channel === "instagram" &&
    (!config.INSTAGRAM_ACCESS_TOKEN || !config.INSTAGRAM_ACCOUNT_ID)
  )
    return "Instagram is not connected.";
  return null;
}
export async function sendText(
  lead: Lead,
  text: string,
  config: MetaConfig,
  fetcher = fetch,
) {
  const blocked = canSend(lead, config);
  if (blocked) throw new Error(blocked);
  const wa = lead.channel === "whatsapp";
  const token = wa
    ? config.WHATSAPP_ACCESS_TOKEN
    : config.INSTAGRAM_ACCESS_TOKEN;
  const id = wa ? config.WHATSAPP_PHONE_NUMBER_ID : config.INSTAGRAM_ACCOUNT_ID;
  const url = `https://${wa ? "graph.facebook.com" : "graph.instagram.com"}/${config.META_GRAPH_VERSION}/${encodeURIComponent(id!)}/messages`;
  const body = wa
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: lead.recipient,
        type: "text",
        text: { body: text.slice(0, 3500) },
      }
    : {
        recipient: { id: lead.recipient },
        message: { text: text.slice(0, 1000) },
      };
  const r = await fetcher(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Meta rejected delivery (${r.status}).`);
  return r.json();
}
