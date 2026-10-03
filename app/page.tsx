import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import Desk from "./desk";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  if (!user)
    return (
      <main className="login">
        <div className="mark">S</div>
        <h1>Your shop, one conversation at a time.</h1>
        <p>
          Private enquiries, draft work orders and the Stories you choose to
          share.
        </p>
        <a
          className="button primary"
          href={chatGPTSignInPath("/")}
          target="_top"
        >
          Sign in to your desk
        </a>
        <p className="muted">WhatsApp & Instagram · India & US</p>
      </main>
    );
  return <Desk />;
}
