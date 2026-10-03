declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    META_APP_SECRET?: string;
    META_VERIFY_TOKEN?: string;
    META_GRAPH_VERSION?: string;
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    INSTAGRAM_ACCESS_TOKEN?: string;
    INSTAGRAM_ACCOUNT_ID?: string;
    MERCHANT_OWNER_ID?: string;
    LIVE_SEND_ENABLED?: string;
  }
}
