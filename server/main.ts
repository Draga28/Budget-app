/* ============================================================
   Davids Budget App – bank-server
   Henter transaktioner fra Danske Bank via Enable Banking (PSD2).
   Designet til gratis hosting på Deno Deploy (dash.deno.com).

   Miljøvariabler (sættes i Deno Deploy under Settings → Environment):
     EB_APP_ID      – applikations-id fra Enable Banking Control Panel
     EB_PRIVATE_KEY – den private RSA-nøgle (hele PEM-indholdet)
     APP_TOKEN      – selvvalgt kodeord som appen skal sende med
   ============================================================ */

const APP_ID = Deno.env.get("EB_APP_ID") ?? "";
const PRIVATE_KEY_PEM = Deno.env.get("EB_PRIVATE_KEY") ?? "";
const APP_TOKEN = Deno.env.get("APP_TOKEN") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://draga28.github.io/Budget-app/";
const API = "https://api.enablebanking.com";

const kv = await Deno.openKv();

/* ---------- JWT-signering (RS256) til Enable Banking ---------- */
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: CryptoKey | null = null;
async function privatNoegle(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = PRIVATE_KEY_PEM.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey(
    "pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
  return cachedKey;
}

async function ebJwt(): Promise<string> {
  const nu = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: APP_ID }));
  const payload = b64url(JSON.stringify({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: nu,
    exp: nu + 3600,
  }));
  const sig = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await privatNoegle(),
    new TextEncoder().encode(`${header}.${payload}`),
  ));
  return `${header}.${payload}.${b64url(sig)}`;
}

async function eb(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${await ebJwt()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Enable Banking ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------- Hjælpere ---------- */
function svar(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
    },
  });
}

function tjekToken(req: Request): boolean {
  return APP_TOKEN.length > 0 && req.headers.get("X-App-Token") === APP_TOKEN;
}

/* Omsæt Enable Banking-transaktioner til appens format */
function tilPostering(t: any) {
  const kredit = t.credit_debit_indicator === "CRDT";
  const tekst = (t.remittance_information?.join(" ") ||
    t.creditor?.name || t.debtor?.name || "Bankpostering").trim();
  return {
    dato: t.booking_date || t.value_date,
    tekst,
    beloeb: Number(t.transaction_amount?.amount ?? 0) * (kredit ? 1 : -1),
  };
}

/* ---------- HTTP-håndtering ---------- */
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return svar({});

  try {
    /* Status – bruges af appen til at vise om der er forbindelse */
    if (url.pathname === "/status" && req.method === "GET") {
      if (!tjekToken(req)) return svar({ fejl: "forkert token" }, 401);
      const konti = (await kv.get<string[]>(["konti"])).value ?? [];
      return svar({ ok: true, forbundet: konti.length > 0, antalKonti: konti.length });
    }

    /* Start MitID-godkendelse hos Danske Bank */
    if (url.pathname === "/forbind" && req.method === "POST") {
      if (!tjekToken(req)) return svar({ fejl: "forkert token" }, 401);
      const gyldigTil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const state = crypto.randomUUID();
      await kv.set(["state", state], true, { expireIn: 30 * 60 * 1000 });
      const auth = await eb("/auth", {
        method: "POST",
        body: JSON.stringify({
          access: { valid_until: gyldigTil },
          aspsp: { name: "Danske Bank", country: "DK" },
          state,
          redirect_url: `${url.origin}/callback`,
          psu_type: "personal",
        }),
      });
      return svar({ url: auth.url });
    }

    /* Banken sender brugeren retur hertil efter MitID-godkendelse */
    if (url.pathname === "/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const kendtState = (await kv.get(["state", state])).value;
      if (!code || !kendtState) {
        return Response.redirect(`${APP_URL}?bank=fejl`, 302);
      }
      await kv.delete(["state", state]);
      const session = await eb("/sessions", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await kv.set(["konti"], session.accounts ?? []);
      return Response.redirect(`${APP_URL}?bank=forbundet`, 302);
    }

    /* Hent transaktioner fra alle forbundne konti */
    if (url.pathname === "/transaktioner" && req.method === "GET") {
      if (!tjekToken(req)) return svar({ fejl: "forkert token" }, 401);
      const konti = (await kv.get<string[]>(["konti"])).value ?? [];
      if (konti.length === 0) return svar({ fejl: "ingen konti forbundet endnu" }, 409);
      const fra = url.searchParams.get("fra") ??
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const alle: unknown[] = [];
      for (const kontoUid of konti) {
        let continuationKey: string | undefined;
        do {
          const q = new URLSearchParams({ date_from: fra });
          if (continuationKey) q.set("continuation_key", continuationKey);
          const side = await eb(`/accounts/${kontoUid}/transactions?${q}`);
          for (const t of side.transactions ?? []) alle.push(tilPostering(t));
          continuationKey = side.continuation_key;
        } while (continuationKey);
      }
      return svar({ posteringer: alle });
    }

    return svar({ fejl: "ukendt sti" }, 404);
  } catch (e) {
    console.error(e);
    return svar({ fejl: String(e) }, 500);
  }
});
