"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Layers,
  Package,
  Plug,
  ShieldCheck,
  Plus,
  Search,
  Send,
  Check,
  Download,
  Trash2,
  Bell,
  Leaf,
  Droplet,
  Shirt,
  ShoppingBag,
  FileText,
  UserRound,
  Lock,
  ChevronRight,
  Activity,
  X,
} from "lucide-react";
import evaluation from "../docs/evaluation-results.json";
import {
  products,
  fieldsFor,
  missingFields,
  validationIssues,
  leadStatus,
  workOrder,
  type Lead,
  type Product,
  type CatalogItem,
} from "../lib/domain";
type Data = {
  leads: Lead[];
  stories: any[];
  events: any[];
  outbox: any[];
  settings: { catalog: CatalogItem[]; providerConsent: boolean };
  connections: {
    whatsapp: boolean;
    instagram: boolean;
    ai: boolean;
    liveEnabled: boolean;
  };
};
const tabs = [
  { name: "Enquiry desk", icon: MessageSquare },
  { name: "Stories digest", icon: Layers },
  { name: "Catalog", icon: Package },
  { name: "Connections", icon: Plug },
  { name: "Trust & activity", icon: ShieldCheck },
];
const icons = { tea: Leaf, oil: Droplet, jersey: Shirt, bag: ShoppingBag };
const samples = [
  {
    title: "Weekend tea pop-up",
    source: "Fictional WhatsApp status",
    text: "Nilgiris tea tasting this Saturday, 10 am to 1 pm. Bring your own cup. Message the organizer to check the location.",
  },
  {
    title: "Running club kit",
    source: "Fictional Instagram Story",
    text: "The running club is planning new jerseys for next month. Members should send their sizes by Friday. Final price will be confirmed later.",
  },
  {
    title: "Custom tote enquiry",
    source: "Fictional Instagram Story",
    text: "Looking for reusable event bags. We need 50 canvas totes with a logo. Delivery date and printing quote still need checking.",
  },
];
export default function Desk() {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("Enquiry desk"),
    [selected, setSelected] = useState("demo-jersey"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [message, setMessage] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [newProduct, setNewProduct] = useState<Product>("jersey"),
    [newChannel, setNewChannel] = useState("instagram"),
    [newName, setNewName] = useState("Demo customer"),
    [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [storyTitle, setStoryTitle] = useState(""),
    [storyText, setStoryText] = useState(""),
    [storySource, setStorySource] = useState(""),
    [storyFile, setStoryFile] = useState<File | null>(null),
    [useAI, setUseAI] = useState(false),
    [digestQuestion, setDigestQuestion] = useState(""),
    [notifications, setNotifications] = useState(false);
  const dataRef = useRef<Data | null>(null);
  dataRef.current = data;
  const refresh = useCallback(async () => {
    const r = await fetch("/api/state");
    const d: any = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
    return d as Data;
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "seed" }),
        });
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
        setCatalog(d.settings.catalog);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    })();
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      void refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function act(body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      if (body.action === "new") {
        setSelected(d.leads[0]?.id);
        setNewOpen(false);
      }
      if (body.action === "catalog")
        setNotice("Catalog saved. Approved facts will be used in replies.");
      if (body.action === "review") setNotice("Enquiry marked reviewed.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const lead = data?.leads.find((l) => l.id === selected) || data?.leads[0];
  const ready =
    data?.leads.filter(
      (l) => leadStatus(l) === "Ready for discussion" && l.review === "new",
    ).length || 0;
  const human =
    data?.leads.filter((l) => l.human && !l.optedOut && l.review === "new")
      .length || 0;
  const queue = ready + human;
  useEffect(() => {
    if (notifications && queue > 0 && Notification.permission === "granted")
      new Notification("Shop Concierge", {
        body: `${queue} enquiries need your review.`,
      });
  }, [queue, notifications]);
  const filtered = (data?.leads || []).filter(
    (l) =>
      (filter === "All" ||
        (filter === "Ready"
          ? leadStatus(l) === "Ready for discussion"
          : l.channel === filter)) &&
      `${l.name} ${products[l.product].name} ${leadStatus(l)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const field = lead ? missingFields(lead)[0] : undefined;
  const issues = lead ? validationIssues(lead) : [];
  const status = lead ? leadStatus(lead) : "Browsing";
  async function addStory(sample?: (typeof samples)[number]) {
    setBusy(true);
    setError("");
    try {
      let body: BodyInit;
      let headers: Record<string, string> = {};
      if (storyFile && !sample) {
        const f = new FormData();
        f.set("title", storyTitle || "Shared Story");
        f.set("source", storySource || "Shared intentionally");
        f.set("text", storyText);
        f.set("file", storyFile);
        f.set("useAI", String(useAI));
        body = f;
      } else {
        body = JSON.stringify({
          ...sample,
          title: sample?.title || storyTitle || "Shared Story",
          source: sample?.source || storySource || "Shared intentionally",
          text: sample?.text || storyText,
          useAI: sample ? false : useAI,
        });
        headers["Content-Type"] = "application/json";
      }
      const r = await fetch("/api/stories", { method: "POST", headers, body });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh();
      if (!sample) {
        setStoryTitle("");
        setStorySource("");
        setStoryText("");
        setStoryFile(null);
      }
      setNotice("Story saved to your private digest.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Story.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteStory(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!r.ok) throw new Error(((await r.json()) as any).error);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function exportOrder() {
    if (!lead) return;
    const w = workOrder(lead);
    const text = `${w.id}\n${w.kind}\n\nCustomer: ${w.customer}\nChannel: ${w.channel}\nContact: ${w.contact}\nProduct: ${w.product}\nStatus: ${w.status}\n\n${w.details.map((x) => `${x.label}: ${x.value}`).join("\n")}\n\nBuyer confirmed: ${w.confirmedByBuyer}\nPermission to follow up: ${w.permissionToFollowUp}\nPrice: ${w.price}\nPayment: ${w.payment}\nOwner: Siva\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_enquiry_queue",
            description:
              "Read the visible private enquiry queue and its readiness reasons. Does not send customer messages.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              return {
                enquiries: (dataRef.current?.leads || []).map((l) => ({
                  id: l.id,
                  name: l.name,
                  product: products[l.product].name,
                  status: leadStatus(l),
                  missing: missingFields(l).map((f) => f.label),
                  issues: validationIssues(l),
                })),
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  const digestResults = (data?.stories || []).filter(
    (s) =>
      !digestQuestion ||
      digestQuestion
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3)
        .some((w) =>
          `${s.title} ${s.text} ${s.summary}`.toLowerCase().includes(w),
        ),
  );
  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">
          <div className="mark">S</div>
          <div>
            Shop Concierge<span>Siva’s private desk</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              className={tab === t.name ? "nav active" : "nav"}
              key={t.name}
              onClick={() => {
                setTab(t.name);
                if (t.name === "Catalog" && data)
                  setCatalog(data.settings.catalog);
              }}
            >
              <t.icon size={20} />
              {t.name}
              {t.name === "Enquiry desk" && queue > 0 && (
                <b className="nav-count">{queue}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="market-pills">
            <span>India · INR</span>
            <span>US · USD</span>
          </div>
          <div className="owner">
            <div className="avatar owner-avatar">SB</div>
            <div>
              Siva Babu<small>Owner · Human decisions</small>
            </div>
            <Lock size={15} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">YOUR SHOP WORKSPACE</span>
            <h1>{tab}</h1>
          </div>
          <div className="top-actions">
            <span className="mode">
              <span className="mode-dot" />
              Sample workspace
            </span>
            <button
              className="icon-button"
              aria-label="Enable browser review alerts"
              onClick={async () => {
                if (!("Notification" in window)) {
                  setNotice(
                    "This browser does not support notifications. The review queue remains available.",
                  );
                  return;
                }
                const p = await Notification.requestPermission();
                setNotifications(p === "granted");
                setNotice(
                  p === "granted"
                    ? "Review alerts enabled while the desk is open."
                    : "Use the review queue for alerts.",
                );
              }}
            >
              <Bell size={20} />
              {queue > 0 && <i>{queue}</i>}
            </button>
          </div>
        </header>
        <div className="demo-banner">
          <ShieldCheck size={17} />
          <span>
            {data?.leads.some((l) => !l.demo)
              ? "Business enquiries and clearly marked samples share this desk. Review connection status before enabling replies."
              : "Fictional enquiries for testing. WhatsApp and Instagram are not connected. No messages or payments are sent from this demo."}
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {!data ? (
          <div className="empty">
            <Activity size={30} />
            <h2>Opening your desk…</h2>
            {error && (
              <button
                className="button"
                onClick={() => void refresh().catch((e) => setError(String(e)))}
              >
                Retry
              </button>
            )}
          </div>
        ) : tab === "Enquiry desk" ? (
          <>
            <div className="desk-summary">
              <div>
                <strong>{queue}</strong>
                <span>Need your attention</span>
              </div>
              <div>
                <strong>{ready}</strong>
                <span>Ready to discuss</span>
              </div>
              <div>
                <strong>
                  {
                    data.leads.filter((l) => leadStatus(l) === "Needs details")
                      .length
                  }
                </strong>
                <span>Collecting details</span>
              </div>
              <button
                className="button primary"
                onClick={() => setNewOpen(true)}
              >
                <Plus size={17} />
                Test a new enquiry
              </button>
            </div>
            <div className="desk-grid">
              <section className="conversation-list">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search enquiries"
                    placeholder="Search enquiries"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="filters">
                  {["All", "Ready", "whatsapp", "instagram"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "selected" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f === "whatsapp" ? "WA" : f === "instagram" ? "IG" : f}
                    </button>
                  ))}
                </div>
                <div className="list-scroll">
                  {filtered.map((l) => {
                    const Icon = icons[l.product];
                    const s = leadStatus(l);
                    return (
                      <button
                        key={l.id}
                        className={`conversation ${lead?.id === l.id ? "chosen" : ""}`}
                        onClick={() => {
                          setSelected(l.id);
                          setAnswer("");
                          setMessage("");
                        }}
                      >
                        <div className={`product-icon ${l.product}`}>
                          <Icon size={22} />
                        </div>
                        <div className="conversation-info">
                          <strong>{l.name}</strong>
                          <span>{products[l.product].name}</span>
                          <small>
                            <span className={`channel ${l.channel}`}>
                              {l.channel === "whatsapp"
                                ? "WhatsApp"
                                : "Instagram"}
                            </span>{" "}
                            · {s}
                          </small>
                        </div>
                        {s === "Ready for discussion" && l.review === "new" && (
                          <span className="attention-dot" />
                        )}
                      </button>
                    );
                  })}
                  {!filtered.length && (
                    <p className="muted list-empty">No matching enquiries.</p>
                  )}
                </div>
              </section>
              {lead ? (
                <>
                  <section className="chat-panel">
                    <div className="chat-head">
                      <div className="avatar">
                        {lead.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2>{lead.name}</h2>
                        <span>
                          {products[lead.product].name} ·{" "}
                          {lead.demo
                            ? "Customer simulator"
                            : "Customer conversation"}
                        </span>
                      </div>
                      <span
                        className={`status ${status === "Ready for discussion" ? "ready" : ""}`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="chat-scroll">
                      {lead.messages.map((m) => (
                        <div key={m.id} className={`message-row ${m.role}`}>
                          <div className="bubble">
                            <span className="message-role">
                              {m.role === "customer"
                                ? "Customer"
                                : m.role === "owner"
                                  ? "Siva"
                                  : "Shop assistant"}
                            </span>
                            <p>{m.text}</p>
                            <time>
                              {new Date(m.at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                        </div>
                      ))}
                    </div>
                    {lead.demo && (
                      <div className="customer-controls">
                        <div className="control-heading">
                          <UserRound size={17} />
                          <strong>Try the customer’s side</strong>
                          <span>Sample conversation</span>
                        </div>
                        {issues.length > 0 && (
                          <div className="validation">{issues.join(" ")}</div>
                        )}
                        {field && !lead.optedOut && !lead.human && (
                          <form
                            className="answer-form"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (
                                await act({
                                  action: "answer",
                                  id: lead.id,
                                  field: field.key,
                                  text: answer,
                                })
                              )
                                setAnswer("");
                            }}
                          >
                            <label htmlFor="field-answer">
                              {field.question}
                            </label>
                            <div className="input-row">
                              {field.key === "market" ? (
                                <select
                                  id="field-answer"
                                  value={answer}
                                  onChange={(e) => setAnswer(e.target.value)}
                                  required
                                >
                                  <option value="">Choose market</option>
                                  <option value="IN">India</option>
                                  <option value="US">US</option>
                                </select>
                              ) : (
                                <input
                                  id="field-answer"
                                  value={answer}
                                  onChange={(e) => setAnswer(e.target.value)}
                                  placeholder={field.examples.join(" / ")}
                                  maxLength={250}
                                  required
                                />
                              )}
                              <button
                                className="button primary"
                                disabled={busy || !answer}
                              >
                                Answer
                              </button>
                            </div>
                            <div className="suggestions">
                              {(field.key === "payment" &&
                              lead.answers.market === "US"
                                ? ["Card", "Bank transfer", "Discuss with Siva"]
                                : field.examples
                              ).map((x) => (
                                <button
                                  type="button"
                                  key={x}
                                  onClick={() => setAnswer(x)}
                                >
                                  {x}
                                </button>
                              ))}
                            </div>
                          </form>
                        )}
                        {!field &&
                          !issues.length &&
                          !lead.confirmed &&
                          !lead.optedOut &&
                          !lead.human && (
                            <div className="confirmation">
                              <strong>Review the draft on the right.</strong>
                              <p>
                                Confirm the details and allow Siva to follow up
                                in this conversation.
                              </p>
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() =>
                                  void act({
                                    action: "message",
                                    id: lead.id,
                                    text: "CONFIRM",
                                  })
                                }
                              >
                                <Check size={17} />
                                Confirm enquiry & follow-up
                              </button>
                            </div>
                          )}
                        <form
                          className="compose"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (
                              await act({
                                action: "message",
                                id: lead.id,
                                text: message,
                              })
                            )
                              setMessage("");
                          }}
                        >
                          <input
                            aria-label="Customer message"
                            placeholder="Type as the customer…"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={4000}
                          />
                          <button
                            className="icon-button send"
                            aria-label="Send sample customer message"
                            disabled={busy || !message.trim()}
                          >
                            <Send size={18} />
                          </button>
                        </form>
                        <div className="quick-actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: "message",
                                id: lead.id,
                                text: "What is the price?",
                              })
                            }
                          >
                            Ask price
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: "message",
                                id: lead.id,
                                text: "Speak with Siva",
                              })
                            }
                          >
                            Ask for a person
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void act({
                                action: "message",
                                id: lead.id,
                                text: lead.optedOut ? "START" : "STOP",
                              })
                            }
                          >
                            {lead.optedOut ? "Resume" : "Opt out"}
                          </button>
                        </div>
                      </div>
                    )}
                    {!lead.demo && (
                      <form
                        className="compose live-compose"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await act({
                              action: "send",
                              id: lead.id,
                              text: message,
                            })
                          )
                            setMessage("");
                        }}
                      >
                        <input
                          aria-label="Siva’s reply"
                          placeholder="Reply personally as Siva…"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                        <button
                          className="button primary"
                          disabled={
                            busy || !message || !data.connections.liveEnabled
                          }
                        >
                          Send reply
                        </button>
                      </form>
                    )}
                  </section>
                  <aside className="order-panel">
                    <div className="order-heading">
                      <FileText size={20} />
                      <h2>Draft work order</h2>
                    </div>
                    <p className="muted">
                      For a conversation with Siva. Prices, availability and
                      delivery remain to be agreed.
                    </p>
                    <div className="progress">
                      <span
                        style={{
                          width: `${Math.round(((fieldsFor(lead.product).length - missingFields(lead).length) / fieldsFor(lead.product).length) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="completion">
                      {fieldsFor(lead.product).length -
                        missingFields(lead).length}{" "}
                      of {fieldsFor(lead.product).length} details collected
                    </p>
                    <dl className="order-details">
                      {fieldsFor(lead.product).map((f) => (
                        <div key={f.key}>
                          <dt>{f.label}</dt>
                          <dd className={lead.answers[f.key] ? "" : "missing"}>
                            {lead.answers[f.key] || "Needs details"}
                          </dd>
                          {lead.evidence[f.key] && (
                            <details>
                              <summary>Source</summary>
                              <p>{lead.evidence[f.key].quote}</p>
                            </details>
                          )}
                        </div>
                      ))}
                    </dl>
                    <div className="consent-check">
                      <span>
                        {lead.confirmed ? (
                          <Check size={16} />
                        ) : (
                          <span className="empty-check" />
                        )}
                        Buyer confirmed
                      </span>
                      <span>
                        {lead.consent ? (
                          <Check size={16} />
                        ) : (
                          <span className="empty-check" />
                        )}
                        Permission to follow up
                      </span>
                    </div>
                    <div className="owner-actions">
                      <button
                        className="button primary"
                        disabled={busy || lead.review === "reviewed"}
                        onClick={() =>
                          void act({ action: "review", id: lead.id })
                        }
                      >
                        <Check size={16} />
                        {lead.review === "reviewed"
                          ? "Reviewed by Siva"
                          : "Mark reviewed"}
                      </button>
                      <button className="button" onClick={exportOrder}>
                        <Download size={16} />
                        Download draft
                      </button>
                      <button
                        className="text-danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this conversation and its draft?",
                            )
                          )
                            void act({
                              action: "delete",
                              id: lead.id,
                              value: "DELETE",
                            });
                        }}
                      >
                        <Trash2 size={14} />
                        Delete conversation
                      </button>
                    </div>
                  </aside>
                </>
              ) : (
                <div className="empty">
                  <h2>Start your first enquiry</h2>
                  <button
                    className="button primary"
                    onClick={() => setNewOpen(true)}
                  >
                    Test a new enquiry
                  </button>
                </div>
              )}
            </div>
          </>
        ) : tab === "Stories digest" ? (
          <div className="stories-layout">
            <section>
              <div className="section-head">
                <h2>The Stories you choose to share</h2>
                <span className="pill">
                  <Lock size={13} />
                  Private
                </span>
              </div>
              <p className="muted">
                Save text or a screenshot from a Story or status. Your personal
                feed is not monitored automatically.
              </p>
              <div className="search digest-search">
                <Search size={19} />
                <input
                  aria-label="Ask your Stories digest"
                  value={digestQuestion}
                  onChange={(e) => setDigestQuestion(e.target.value)}
                  placeholder="What did I save about jerseys or tea?"
                />
              </div>
              <p className="muted">
                {digestQuestion
                  ? "Matching saved sources, with their original claims."
                  : "Your saved digest, newest first."}
              </p>
              <div className="story-grid">
                {digestResults.map((s) => (
                  <article className="story-card" key={s.id}>
                    {s.key && (
                      <img
                        className="story-image"
                        src={`/api/media/${s.id}`}
                        alt={`Shared screenshot: ${s.title}`}
                      />
                    )}
                    <div className="story-card-body">
                      <span className="eyebrow">{s.source}</span>
                      <h3>{s.title}</h3>
                      <p className="story-summary">{s.summary}</p>
                      <details>
                        <summary>View original text</summary>
                        <p>{s.text || "Screenshot only."}</p>
                      </details>
                      <footer>
                        <small>{s.mode}</small>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${s.title}`}
                          onClick={() => void deleteStory(s.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
              {!digestResults.length && (
                <div className="empty story-empty">
                  <Layers size={32} />
                  <h3>
                    {digestQuestion
                      ? "No saved sources match yet."
                      : "Your digest starts with what you share."}
                  </h3>
                  <p>Try one of the fictional Stories below or add your own.</p>
                </div>
              )}
              <div className="sample-stories">
                <h3>Try a sample Story</h3>
                {samples.map((s) => (
                  <button
                    className="sample-story"
                    key={s.title}
                    disabled={busy}
                    onClick={() => void addStory(s)}
                  >
                    <Layers size={19} />
                    <span>
                      {s.title}
                      <small>Fictional sample · Local summary</small>
                    </span>
                    <Plus size={17} />
                  </button>
                ))}
              </div>
            </section>
            <aside className="share-card">
              <h2>Add a Story</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addStory();
                }}
              >
                <label>
                  Title
                  <input
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    placeholder="A useful Story"
                    maxLength={100}
                  />
                </label>
                <label>
                  Source
                  <input
                    value={storySource}
                    onChange={(e) => setStorySource(e.target.value)}
                    placeholder="WhatsApp status or Instagram Story"
                    maxLength={200}
                  />
                </label>
                <label>
                  Text from the Story
                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    rows={6}
                    maxLength={8000}
                    placeholder="Paste the text you want to summarize…"
                  />
                </label>
                <label>
                  Screenshot
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setStoryFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="muted">
                  PNG, JPEG or WebP, up to 5 MB. For video Stories, share
                  selected screenshots or a transcript.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={useAI}
                    disabled={
                      !data.connections.ai || !data.settings.providerConsent
                    }
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  <span>
                    Send this shared content to OpenAI for a summary and image
                    reading.
                  </span>
                </label>
                {!data.connections.ai && (
                  <p className="muted">
                    AI is not connected. Text summaries run locally.
                  </p>
                )}
                <button
                  className="button primary full"
                  disabled={busy || (!storyText.trim() && !storyFile)}
                >
                  <Plus size={17} />
                  Save to digest
                </button>
              </form>
            </aside>
          </div>
        ) : tab === "Catalog" ? (
          <div className="content-page">
            <div className="section-head">
              <div>
                <h2>Your approved product facts</h2>
                <p className="muted">
                  Leave prices empty until you are ready to quote. Each product
                  needs your approval before the assistant uses its claims.
                </p>
              </div>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void act({ action: "catalog", value: catalog })}
              >
                Save catalog
              </button>
            </div>
            <div className="catalog-grid">
              {catalog.map((c, i) => {
                const Icon = icons[c.product];
                const change = (key: string, value: unknown) =>
                  setCatalog((a) =>
                    a.map((x, j) => (j === i ? { ...x, [key]: value } : x)),
                  );
                return (
                  <article className="catalog-card" key={c.product}>
                    <div className="catalog-title">
                      <div className={`product-icon ${c.product}`}>
                        <Icon size={25} />
                      </div>
                      <div>
                        <h3>{products[c.product].name}</h3>
                        <span className="muted">
                          DM keyword · {products[c.product].keyword}
                        </span>
                      </div>
                    </div>
                    <label>
                      Description & approved claims
                      <textarea
                        value={c.description}
                        rows={3}
                        onChange={(e) => change("description", e.target.value)}
                      />
                    </label>
                    <div className="two-columns">
                      <label>
                        India price · INR
                        <input
                          type="number"
                          min="0"
                          placeholder="Quote required"
                          value={c.priceIN ?? ""}
                          onChange={(e) =>
                            change(
                              "priceIN",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        US price · USD
                        <input
                          type="number"
                          min="0"
                          placeholder="Quote required"
                          value={c.priceUS ?? ""}
                          onChange={(e) =>
                            change(
                              "priceUS",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Stock information
                      <input
                        value={c.stock}
                        onChange={(e) => change("stock", e.target.value)}
                      />
                    </label>
                    <label>
                      Shipping information
                      <input
                        value={c.shipping}
                        onChange={(e) => change("shipping", e.target.value)}
                      />
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={c.approved}
                        onChange={(e) => change("approved", e.target.checked)}
                      />
                      <span>
                        I approve these product facts for customer replies.
                      </span>
                    </label>
                  </article>
                );
              })}
            </div>
            <p className="muted">
              Payment options are collected as preferences: India — UPI, card or
              bank transfer; US — card or bank transfer. Siva confirms which
              methods the business can actually accept.
            </p>
          </div>
        ) : tab === "Connections" ? (
          <div className="content-page">
            <h2>Connect when your shop is ready</h2>
            <p className="muted">
              Your working sample desk stays available while you set up the
              business accounts.
            </p>
            <div className="connection-grid">
              <article className="connection-card">
                <div className="connection-logo whatsapp">
                  <MessageSquare />
                </div>
                <h3>WhatsApp Business</h3>
                <span className="status">
                  {data.connections.whatsapp
                    ? "Credentials configured"
                    : "Not connected"}
                </span>
                <ol>
                  <li>
                    Create a business account and register a business phone
                    number.
                  </li>
                  <li>
                    Set up a Meta developer app with WhatsApp Cloud API access.
                  </li>
                  <li>
                    Connect the signed webhook gateway and approved credentials.
                  </li>
                  <li>
                    Test customer-initiated messages before enabling live
                    replies.
                  </li>
                </ol>
                <a
                  href="https://www.postman.com/meta/whatsapp-business-platform/overview"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official setup reference
                </a>
              </article>
              <article className="connection-card">
                <div className="connection-logo instagram">
                  <Layers />
                </div>
                <h3>Instagram</h3>
                <span className="status">
                  {data.connections.instagram
                    ? "Credentials configured"
                    : "Not connected"}
                </span>
                <ol>
                  <li>Create or convert to a professional account.</li>
                  <li>Use Instagram Login and messaging permissions.</li>
                  <li>
                    Have customers DM TEA, OIL, JERSEY or BAG from your Stories.
                  </li>
                  <li>
                    Connect verified webhooks and test the handoff to Siva.
                  </li>
                </ol>
                <a
                  href="https://www.postman.com/meta/instagram/folder/uxudqu0/send-api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official messaging reference
                </a>
              </article>
              <article className="connection-card">
                <div className="connection-logo ai">
                  <Activity />
                </div>
                <h3>Optional OpenAI</h3>
                <span className="status">
                  {data.connections.ai
                    ? "Provider configured"
                    : "Local mode active"}
                </span>
                <p>
                  Structured fact extraction for free-text enquiries. Optional
                  summaries and image reading for deliberately shared Stories.
                </p>
                <p>
                  Configure a server-side API key and model. The public
                  repository contains no credentials.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={data.settings.providerConsent}
                    onChange={(e) =>
                      void act({ action: "consent", value: e.target.checked })
                    }
                  />
                  <span>
                    Allow enquiry text to be sent to OpenAI. Story analysis
                    still requires a separate choice for each item.
                  </span>
                </label>
                <p className="muted">
                  API usage is billed separately by the provider.
                </p>
              </article>
            </div>
            <div className="setup-note">
              <Lock size={24} />
              <div>
                <h3>Your personal inbox stays separate</h3>
                <p>
                  The business APIs support shop conversations. They do not
                  provide your entire personal Stories feed. This app uses only
                  business messages received by the connected account and
                  Stories you intentionally share.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="content-page">
            <div className="section-head">
              <div>
                <h2>Decisions you can trace</h2>
                <p className="muted">
                  Readiness comes from the questionnaire, consistency checks and
                  buyer confirmation.
                </p>
              </div>
              <span className="pill">
                <ShieldCheck size={16} />
                Human review
              </span>
            </div>
            <div className="trust-grid">
              <article>
                <ShieldCheck size={27} />
                <h3>No sincerity score</h3>
                <p>
                  Browsing enquiries remain visible. Missing details lead to a
                  question, not rejection. “Ready” means complete and confirmed.
                </p>
              </article>
              <article>
                <Lock size={27} />
                <h3>Private by default</h3>
                <p>
                  Sign-in and owner-scoped storage protect the desk. Sensitive
                  payment numbers are removed. Screenshots can be deleted.
                </p>
              </article>
              <article>
                <UserRound size={27} />
                <h3>Easy human handoff</h3>
                <p>
                  Ask for Siva at any point. Opt-out stops automated follow-up.
                  AI never marks a payment as received.
                </p>
              </article>
            </div>
            <div className="evaluation-card">
              <div>
                <span className="eyebrow">CHECKED SCENARIOS</span>
                <h3>
                  {evaluation.passed} / {evaluation.tests} passed
                </h3>
                <p>{evaluation.scope}</p>
              </div>
              <ul>
                {evaluation.categories.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="activity-panel">
              <h3>Recent activity</h3>
              <p className="muted">
                Event labels only. Customer text and payment credentials are
                excluded from activity logs.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e, i) => (
                    <tr key={i}>
                      <td>
                        {new Date(e.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <code>{e.kind}</code>
                      </td>
                      <td>{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="setup-note">
              <Activity size={23} />
              <div>
                <h3>Connection status</h3>
                <p>
                  {data.connections.liveEnabled
                    ? "Live sending is enabled for configured accounts."
                    : "Live sending is disabled."}{" "}
                  {data.connections.ai
                    ? "AI is configured; consent controls whether it receives content."
                    : "Local questionnaire and text digest are active."}
                </p>
                <p>
                  {data.outbox.length} business reply drafts in the outbox.
                  Sample conversations never send externally.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {newOpen && (
        <div className="modal-backdrop" onClick={() => setNewOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <h2 id="new-title">Test a new enquiry</h2>
              <button
                className="icon-button"
                aria-label="Close new enquiry"
                onClick={() => setNewOpen(false)}
              >
                <X />
              </button>
            </div>
            <p className="muted">
              Play the customer’s side. Everything stays inside this sample
              workspace.
            </p>
            <label>
              Customer name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Product
              <select
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value as Product)}
              >
                {Object.entries(products).map(([p, x]) => (
                  <option key={p} value={p}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Channel
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
              >
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() =>
                void act({
                  action: "new",
                  product: newProduct,
                  channel: newChannel,
                  name: newName,
                })
              }
            >
              Open sample conversation
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
