/* ============================================================
   Davids Budget App – al data gemmes lokalt i localStorage
   ============================================================ */

const LS_KEY = "davids-budget-app";

let state = JSON.parse(localStorage.getItem(LS_KEY) || "null") || {
  startsaldo: 0,
  posteringer: [],   // {id, type, tekst, beloeb, dato, kategori, fast}
  maal: [],          // {id, navn, beloeb, dato, prio}
};
if (!state.startsaldo) state.startsaldo = 0;
if (!Array.isArray(state.posteringer)) state.posteringer = [];
if (!Array.isArray(state.maal)) state.maal = [];
if (!state.bank) state.bank = { server: "", token: "", sidst: "", konti: [] };
if (!state.bank.konti) state.bank.konti = [];

function gem() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function kr(n) { return Math.round(n).toLocaleString("da-DK") + " kr."; }
function uid() { return Math.random().toString(36).slice(2, 10); }

const KAT_EMOJI = {
  "Løn": "💰", "Bolig": "🏠", "Mad": "🍎", "Transport": "🚗",
  "Fritid": "🎉", "Tøj": "👕", "Abonnementer": "📺", "Rejse": "✈️", "Andet": "📦",
};

/* Automatisk kategorisering ud fra posteringsteksten (bruges ved CSV-import
   og som forslag ved manuel indtastning) */
const KATEGORI_REGLER = [
  { kat: "Mad", ord: ["netto", "rema", "føtex", "fotex", "lidl", "aldi", "bilka", "coop", "brugsen", "kvickly", "meny", "spar ", "købmand", "7-eleven", "bager"] },
  { kat: "Transport", ord: ["dsb", "rejsekort", "circle k", "q8", "ok benzin", "uno-x", "ingo", "shell", "parkering", "easypark", "apcoa", "fdm", "movia", "gomore", "letbane", "metro"] },
  { kat: "Bolig", ord: ["husleje", "bolig", "ejendom", "ørsted", "andel energi", "norlys", "ewii", "vandværk", "varme", "forsikring", "fibernet", "yousee", "stofa", "hiper"] },
  { kat: "Abonnementer", ord: ["netflix", "spotify", "hbo", "disney", "viaplay", "tv2 play", "youtube", "apple.com", "icloud", "google one", "telenor", "telia", "tdc", "cbb", "oister", "lebara", "abonnement"] },
  { kat: "Fritid", ord: ["restaurant", "cafe", "café", "mcdonald", "burger", "pizza", "sushi", "grill", "biograf", "cinema", "kino", "fitness", "sats", "puregym", "loop", "bar ", "bodega"] },
  { kat: "Tøj", ord: ["h&m", "zalando", "asos", "bestseller", "jack & jones", "only", "name it", "zara", "nike", "adidas", "intersport"] },
  { kat: "Rejse", ord: ["ryanair", "norwegian", "sas ", "airbnb", "booking.com", "hotel", "camping", "færge", "molslinjen"] },
  { kat: "Løn", ord: ["løn", "salary", "dagpenge", "su ", "feriepenge"] },
];

function gaetKategori(tekst) {
  const t = (tekst || "").toLowerCase();
  for (const regel of KATEGORI_REGLER) {
    if (regel.ord.some(o => t.includes(o))) return regel.kat;
  }
  return "Andet";
}

/* ---------- Faner ---------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

/* ---------- Beregninger ---------- */
function opsparing() {
  const sum = state.posteringer.reduce((a, p) =>
    a + (p.type === "indtaegt" ? p.beloeb : -p.beloeb), 0);
  return state.startsaldo + sum;
}

// Gennemsnitligt månedligt overskud over de seneste 3 måneder.
// Falder tilbage til faste posteringer hvis der ingen historik er.
function maanedligtOverskud() {
  const nu = new Date();
  const start = new Date(nu.getFullYear(), nu.getMonth() - 3, 1);
  const slut = new Date(nu.getFullYear(), nu.getMonth(), 1);
  const relevante = state.posteringer.filter(p => {
    const d = new Date(p.dato);
    return d >= start && d < slut;
  });
  if (relevante.length > 0) {
    const netto = relevante.reduce((a, p) =>
      a + (p.type === "indtaegt" ? p.beloeb : -p.beloeb), 0);
    return netto / 3;
  }
  return state.posteringer
    .filter(p => p.fast)
    .reduce((a, p) => a + (p.type === "indtaegt" ? p.beloeb : -p.beloeb), 0);
}

function denneMaaned() {
  const nu = new Date();
  let ind = 0, ud = 0;
  state.posteringer.forEach(p => {
    const d = new Date(p.dato);
    if (d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth()) {
      if (p.type === "indtaegt") ind += p.beloeb; else ud += p.beloeb;
    }
  });
  return { ind, ud };
}

function maanederTil(datoStr) {
  const nu = new Date();
  const d = new Date(datoStr);
  return Math.max(0, (d - nu) / (1000 * 60 * 60 * 24 * 30.44));
}

/* ---------- Overblik ---------- */
function renderOverblik() {
  document.getElementById("ov-opsparing").textContent = kr(opsparing());
  document.getElementById("ov-overskud").textContent = kr(maanedligtOverskud());
  const { ind, ud } = denneMaaned();
  document.getElementById("ov-ind").textContent = kr(ind);
  document.getElementById("ov-ud").textContent = kr(ud);
  document.getElementById("startsaldo").value = state.startsaldo;
  renderSoejler();
  renderCirkel();
  renderKategorier();
  renderSeneste();
  renderMaalListe(document.getElementById("ov-maal-liste"), false);
}

/* ---------- Grafer (ren SVG, farver fra valideret palette) ---------- */
const GRAF_FARVER = { ind: "#2a78d6", ud: "#eb6834" };
/* Fast farve pr. kategori – farven følger kategorien, ikke størrelsen */
const KAT_FARVE = {
  "Bolig": "#2a78d6", "Mad": "#eb6834", "Transport": "#1baf7a", "Fritid": "#eda100",
  "Tøj": "#e87ba4", "Abonnementer": "#4a3aa7", "Rejse": "#008300", "Løn": "#2a78d6", "Andet": "#8a8987",
};
const MDR_NAVNE = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function kompaktKr(n) {
  return n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
}

/* Søjlediagram: indtægter og udgifter pr. måned, sidste 6 måneder */
function renderSoejler() {
  const nu = new Date();
  const mdr = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    mdr.push({ aar: d.getFullYear(), md: d.getMonth(), ind: 0, ud: 0 });
  }
  state.posteringer.forEach(p => {
    const d = new Date(p.dato);
    const m = mdr.find(x => x.aar === d.getFullYear() && x.md === d.getMonth());
    if (m) { if (p.type === "indtaegt") m.ind += p.beloeb; else m.ud += p.beloeb; }
  });
  const div = document.getElementById("graf-soejler");
  const maks = Math.max(...mdr.map(m => Math.max(m.ind, m.ud)), 1);
  const W = 360, H = 210, top = 12, bund = 26, venstre = 34;
  const plotH = H - top - bund, plotW = W - venstre - 6;
  const gruppeB = plotW / 6;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Indtægter og udgifter pr. måned">`;
  // Gitterlinjer + akse-tal (diskrete)
  for (let i = 0; i <= 3; i++) {
    const vaerdi = maks * i / 3;
    const y = top + plotH - (plotH * i / 3);
    s += `<line x1="${venstre}" y1="${y}" x2="${W - 6}" y2="${y}" stroke="#e5eaf0" stroke-width="1"/>`;
    s += `<text x="${venstre - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="#8a8987">${kompaktKr(vaerdi)}</text>`;
  }
  // Søjler: afrundet top (4px), flad bund mod grundlinjen, 2px luft mellem naboer
  const soejleB = Math.min(20, gruppeB / 2 - 6);
  const soejle = (x, hoejde, farve, titel) => {
    if (hoejde < 1) hoejde = 1;
    const y = top + plotH - hoejde;
    const r = Math.min(4, soejleB / 2, hoejde);
    return `<path d="M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + soejleB - r} Q${x + soejleB},${y} ${x + soejleB},${y + r} V${top + plotH} Z" fill="${farve}"><title>${titel}</title></path>`;
  };
  mdr.forEach((m, i) => {
    const midt = venstre + gruppeB * i + gruppeB / 2;
    const navn = MDR_NAVNE[m.md];
    s += soejle(midt - soejleB - 1, plotH * m.ind / maks, GRAF_FARVER.ind, `${navn}: ${kr(m.ind)} ind`);
    s += soejle(midt + 1, plotH * m.ud / maks, GRAF_FARVER.ud, `${navn}: ${kr(m.ud)} ud`);
    s += `<text x="${midt}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#52514e">${navn}</text>`;
  });
  s += `<line x1="${venstre}" y1="${top + plotH}" x2="${W - 6}" y2="${top + plotH}" stroke="#cbd5e1" stroke-width="1"/>`;
  s += `</svg>
    <div class="graf-signatur">
      <span><i style="background:${GRAF_FARVER.ind}"></i>Indtægter</span>
      <span><i style="background:${GRAF_FARVER.ud}"></i>Udgifter</span>
    </div>`;
  div.innerHTML = s;
}

/* Cirkeldiagram (doughnut): udgifter pr. kategori, sidste 3 måneder */
function renderCirkel() {
  const nu = new Date();
  const graense = new Date(nu.getFullYear(), nu.getMonth() - 2, 1);
  const sum = {};
  let total = 0;
  state.posteringer.forEach(p => {
    const d = new Date(p.dato);
    if (p.type === "udgift" && d >= graense) {
      sum[p.kategori] = (sum[p.kategori] || 0) + p.beloeb;
      total += p.beloeb;
    }
  });
  const div = document.getElementById("graf-cirkel");
  if (total === 0) {
    div.innerHTML = "<p class='hint'>Ingen udgifter registreret endnu – importér fra banken eller tast ind, så tegnes grafen her.</p>";
    return;
  }
  // Top 5 kategorier + resten samlet som "Andet"
  let par = Object.entries(sum).sort((a, b) => b[1] - a[1]);
  if (par.length > 6) {
    const rest = par.slice(5).reduce((a, [, v]) => a + v, 0);
    par = par.slice(0, 5);
    const eksisterende = par.find(([k]) => k === "Andet");
    if (eksisterende) eksisterende[1] += rest;
    else par.push(["Andet", rest]);
  }
  const R = 70, r = 44, C = 105;
  let vinkel = -Math.PI / 2;
  let s = `<svg viewBox="0 0 210 210" role="img" aria-label="Udgifter pr. kategori">`;
  par.forEach(([kat, beloeb]) => {
    const andel = beloeb / total;
    const slut = vinkel + andel * Math.PI * 2;
    const stor = andel > 0.5 ? 1 : 0;
    const x1 = C + R * Math.cos(vinkel), y1 = C + R * Math.sin(vinkel);
    const x2 = C + R * Math.cos(slut), y2 = C + R * Math.sin(slut);
    const x3 = C + r * Math.cos(slut), y3 = C + r * Math.sin(slut);
    const x4 = C + r * Math.cos(vinkel), y4 = C + r * Math.sin(vinkel);
    s += `<path d="M${x1},${y1} A${R},${R} 0 ${stor} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${stor} 0 ${x4},${y4} Z"
      fill="${KAT_FARVE[kat] || "#8a8987"}" stroke="#fff" stroke-width="2"><title>${kat}: ${kr(beloeb)} (${Math.round(andel * 100)} %)</title></path>`;
    vinkel = slut;
  });
  s += `<text x="${C}" y="${C - 4}" text-anchor="middle" font-size="12" fill="#52514e">I alt</text>`;
  s += `<text x="${C}" y="${C + 14}" text-anchor="middle" font-size="14" font-weight="700" fill="#0b0b0b">${kr(total)}</text>`;
  s += `</svg><div class="graf-signatur lodret">`;
  par.forEach(([kat, beloeb]) => {
    s += `<span><i style="background:${KAT_FARVE[kat] || "#8a8987"}"></i>${KAT_EMOJI[kat] || "📦"} ${kat} · <strong>${kr(beloeb)}</strong> (${Math.round(beloeb / total * 100)} %)</span>`;
  });
  s += `</div>`;
  div.innerHTML = s;
}

/* Søjler pr. kategori for denne måneds udgifter */
function renderKategorier() {
  const nu = new Date();
  const sum = {};
  state.posteringer.forEach(p => {
    const d = new Date(p.dato);
    if (p.type === "udgift" && d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth()) {
      sum[p.kategori] = (sum[p.kategori] || 0) + p.beloeb;
    }
  });
  const div = document.getElementById("ov-kategorier");
  const par = Object.entries(sum).sort((a, b) => b[1] - a[1]);
  if (par.length === 0) {
    div.innerHTML = "<p class='hint'>Ingen udgifter denne måned endnu.</p>";
    return;
  }
  const maks = par[0][1];
  div.innerHTML = par.map(([kat, beloeb]) => `
    <div class="kat-raekke">
      <span class="kat-navn">${KAT_EMOJI[kat] || "📦"} ${kat}</span>
      <div class="kat-bar"><div style="width:${Math.round((beloeb / maks) * 100)}%"></div></div>
      <span class="kat-beloeb">${kr(beloeb)}</span>
    </div>`).join("");
}

/* De 5 seneste posteringer, kompakt */
function renderSeneste() {
  const div = document.getElementById("ov-seneste");
  const seneste = [...state.posteringer].sort((a, b) => b.dato.localeCompare(a.dato)).slice(0, 5);
  if (seneste.length === 0) {
    div.innerHTML = "<p class='hint'>Ingen posteringer endnu – tilføj under “Ind & ud”.</p>";
    return;
  }
  div.innerHTML = seneste.map(p => `
    <div class="seneste-raekke">
      <span>${KAT_EMOJI[p.kategori] || "📦"} ${p.tekst}</span>
      <span class="${p.type === "indtaegt" ? "positiv" : "negativ"}">${p.type === "indtaegt" ? "+" : "−"}${kr(p.beloeb)}</span>
    </div>`).join("");
}

document.getElementById("startsaldo").addEventListener("change", e => {
  state.startsaldo = Number(e.target.value) || 0;
  gem(); renderOverblik();
});

/* ---------- Posteringer ---------- */
document.getElementById("p-dato").valueAsDate = new Date();

// Foreslå kategori automatisk når man skriver teksten
document.getElementById("p-tekst").addEventListener("blur", e => {
  const gaet = gaetKategori(e.target.value);
  if (gaet !== "Andet") document.getElementById("p-kategori").value = gaet;
});

let valgtMaaned = "alle";

document.getElementById("p-maaned").addEventListener("change", e => {
  valgtMaaned = e.target.value;
  renderPosteringer();
});

document.getElementById("p-soeg").addEventListener("input", () => renderPosteringer());

function renderMaanedVaelger() {
  const select = document.getElementById("p-maaned");
  const maaneder = [...new Set(state.posteringer.map(p => p.dato.slice(0, 7)))].sort().reverse();
  const navne = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
  select.innerHTML = `<option value="alle">Alle måneder</option>` +
    maaneder.map(m => {
      const [aar, md] = m.split("-");
      return `<option value="${m}">${navne[Number(md) - 1]} ${aar}</option>`;
    }).join("");
  if (valgtMaaned !== "alle" && !maaneder.includes(valgtMaaned)) valgtMaaned = "alle";
  select.value = valgtMaaned;
}

document.getElementById("post-form").addEventListener("submit", e => {
  e.preventDefault();
  state.posteringer.push({
    id: uid(),
    type: document.getElementById("p-type").value,
    tekst: document.getElementById("p-tekst").value,
    beloeb: Number(document.getElementById("p-beloeb").value),
    dato: document.getElementById("p-dato").value,
    kategori: document.getElementById("p-kategori").value,
    fast: document.getElementById("p-fast").checked,
  });
  gem(); e.target.reset();
  document.getElementById("p-dato").valueAsDate = new Date();
  renderAlt();
});

function renderPosteringer() {
  renderMaanedVaelger();
  const tbody = document.querySelector("#post-tabel tbody");
  tbody.innerHTML = "";
  const soeg = (document.getElementById("p-soeg").value || "").toLowerCase().trim();
  const viste = [...state.posteringer]
    .filter(p => valgtMaaned === "alle" || p.dato.startsWith(valgtMaaned))
    .filter(p => !soeg || p.tekst.toLowerCase().includes(soeg) || p.kategori.toLowerCase().includes(soeg))
    .sort((a, b) => b.dato.localeCompare(a.dato));
  let ind = 0, ud = 0;
  viste.forEach(p => {
      if (p.type === "indtaegt") ind += p.beloeb; else ud += p.beloeb;
      const tr = document.createElement("tr");
      const fortegn = p.type === "indtaegt" ? "+" : "−";
      tr.innerHTML = `<td>${p.dato.slice(8, 10)}/${p.dato.slice(5, 7)}</td>
        <td>${KAT_EMOJI[p.kategori] || "📦"} ${p.tekst}${p.fast ? " 🔁" : ""}</td>
        <td class="${p.type === "indtaegt" ? "positiv" : "negativ"}">${fortegn}${kr(p.beloeb)}</td>
        <td><button title="Slet" data-id="${p.id}">✕</button></td>`;
      tr.querySelector("button").addEventListener("click", () => {
        state.posteringer = state.posteringer.filter(x => x.id !== p.id);
        gem(); renderAlt();
      });
      tbody.appendChild(tr);
    });
  document.getElementById("p-maaned-sum").textContent =
    viste.length ? `Ind: ${kr(ind)} · Ud: ${kr(ud)} · Netto: ${kr(ind - ud)}` : "";
}

/* Fælles import med dublet-kontrol og auto-kategorisering.
   raekker: [{dato: "yyyy-mm-dd", tekst, beloeb (fortegn: minus = udgift)}] */
function tilfoejPosteringer(raekker) {
  let importeret = 0, sprunget = 0;
  raekker.forEach(r => {
    if (!r.dato || isNaN(r.beloeb)) return;
    const type = r.beloeb >= 0 ? "indtaegt" : "udgift";
    const beloeb = Math.abs(r.beloeb);
    const findes = state.posteringer.some(x =>
      x.dato === r.dato && x.tekst === r.tekst && x.beloeb === beloeb && x.type === type);
    if (findes) { sprunget++; return; }
    state.posteringer.push({
      id: uid(), type, tekst: r.tekst, beloeb, dato: r.dato,
      kategori: gaetKategori(r.tekst), fast: false,
    });
    importeret++;
  });
  gem(); renderAlt();
  return { importeret, sprunget };
}

/* ---------- Automatisk hentning fra Danske Bank (via egen server) ---------- */
function bankOpsat() { return state.bank.server && state.bank.token; }

function bankStatus(tekst) {
  document.getElementById("bank-status").textContent = tekst;
}

async function bankKald(sti, metode = "GET") {
  const res = await fetch(state.bank.server.replace(/\/$/, "") + sti, {
    method: metode,
    headers: { "X-App-Token": state.bank.token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.fejl || `Serverfejl (${res.status})`);
  return data;
}

document.getElementById("bank-gem").addEventListener("click", () => {
  state.bank.server = document.getElementById("bank-server").value.trim();
  state.bank.token = document.getElementById("bank-token").value.trim();
  gem();
  bankStatus(bankOpsat() ? "Opsætning gemt ✓ – tryk “Forbind til Danske Bank”." : "Udfyld både server-adresse og kodeord.");
});

document.getElementById("bank-forbind").addEventListener("click", async () => {
  if (!bankOpsat()) { bankStatus("Udfyld opsætningen først (fold “Opsætning” ud)."); return; }
  try {
    bankStatus("Starter MitID-godkendelse …");
    const { url } = await bankKald("/forbind", "POST");
    location.href = url; // videre til Danske Banks MitID-login
  } catch (e) { bankStatus("⚠️ " + e.message); }
});

document.getElementById("bank-hent").addEventListener("click", async () => {
  if (!bankOpsat()) { bankStatus("Udfyld opsætningen først (fold “Opsætning” ud)."); return; }
  if (state.bank.konti.length === 0) { bankStatus("Forbind til Danske Bank først (MitID)."); return; }
  try {
    bankStatus("Henter posteringer fra Danske Bank …");
    // Hent med lidt overlap, dubletter sorteres alligevel fra
    const fra = state.bank.sidst || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const { posteringer } = await bankKald(`/transaktioner?fra=${fra}&konti=${encodeURIComponent(state.bank.konti.join(","))}`);
    const { importeret, sprunget } = tilfoejPosteringer(posteringer);
    state.bank.sidst = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    gem();
    bankStatus(`✅ Hentede ${importeret} nye posteringer${sprunget ? ` (${sprunget} dubletter sprunget over)` : ""}.`);
  } catch (e) { bankStatus("⚠️ " + e.message); }
});

function initBank() {
  document.getElementById("bank-server").value = state.bank.server;
  document.getElementById("bank-token").value = state.bank.token;
  // Serveren sender os retur med konto-id'erne i URL-fragmentet
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (hash.get("bank") === "forbundet") {
    try {
      state.bank.konti = JSON.parse(atob(decodeURIComponent(hash.get("konti") || ""))) || [];
    } catch { state.bank.konti = []; }
    gem();
    bankStatus(state.bank.konti.length
      ? `✅ Forbundet til Danske Bank (${state.bank.konti.length} konto/konti)! Tryk “Hent nye posteringer”.`
      : "⚠️ Forbundet, men ingen konti fundet – prøv igen.");
    history.replaceState(null, "", location.pathname);
  } else if (hash.get("bank") === "fejl") {
    bankStatus("⚠️ Godkendelsen blev afbrudt – prøv igen.");
    history.replaceState(null, "", location.pathname);
  } else if (bankOpsat()) {
    bankStatus(state.bank.konti.length
      ? "Klar – tryk “Hent nye posteringer”, eller “Forbind” hvis adgangen er udløbet."
      : "Opsætning gemt – tryk “Forbind til Danske Bank” for at godkende med MitID.");
  }
}

/* ---------- CSV-import fra bank ---------- */
document.getElementById("csv-fil").addEventListener("change", e => {
  const fil = e.target.files[0];
  if (!fil) return;
  const laeser = new FileReader();
  laeser.onload = () => {
    const linjer = laeser.result.split(/\r?\n/).filter(l => l.trim());
    const raekker = [];
    linjer.forEach(linje => {
      // Danske Bank bruger semikolon og beløb med komma (fx "1.234,56")
      const sep = linje.includes(";") ? ";" : ",";
      const dele = linje.split(sep).map(s => s.trim().replace(/^"|"$/g, ""));
      if (dele.length < 3) return;
      const [datoRaa, tekst, beloebRaa] = dele;
      const beloeb = parseFloat(beloebRaa.replace(/\./g, "").replace(",", "."));
      if (isNaN(beloeb) || !/\d{2,4}/.test(datoRaa)) return; // spring header over
      // Understøt både 21.07.2026, 21-07-2026 og 2026-07-21
      let dato = datoRaa;
      const m = datoRaa.match(/^(\d{2})[-\/.](\d{2})[-\/.](\d{4})$/);
      if (m) dato = `${m[3]}-${m[2]}-${m[1]}`;
      raekker.push({ dato, tekst, beloeb });
    });
    const { importeret, sprunget } = tilfoejPosteringer(raekker);
    document.getElementById("csv-status").textContent =
      importeret > 0 ? `✅ Importerede ${importeret} posteringer.${sprunget ? ` (${sprunget} dubletter sprunget over)` : ""}`
      : sprunget > 0 ? `✅ Alt var allerede importeret (${sprunget} dubletter sprunget over).`
      : "⚠️ Kunne ikke læse filen – tjek at formatet er: dato; tekst; beløb";
  };
  laeser.readAsText(fil, "utf-8");
  e.target.value = "";
});

/* ---------- Mål ---------- */
document.getElementById("maal-form").addEventListener("submit", e => {
  e.preventDefault();
  state.maal.push({
    id: uid(),
    navn: document.getElementById("m-navn").value,
    beloeb: Number(document.getElementById("m-beloeb").value),
    dato: document.getElementById("m-dato").value,
    prio: Number(document.getElementById("m-prio").value),
  });
  gem(); e.target.reset(); renderAlt();
});

function renderMaalListe(container, medSlet) {
  container.innerHTML = "";
  if (state.maal.length === 0) {
    container.innerHTML = "<p class='hint'>Ingen mål endnu – opret et under fanen “Mål”, fx din ferie i Spanien.</p>";
    return;
  }
  const saldo = opsparing();
  const overskud = maanedligtOverskud();
  // Fordel opsparingen på målene efter prioritet og dato
  let rest = saldo;
  [...state.maal]
    .sort((a, b) => a.prio - b.prio || a.dato.localeCompare(b.dato))
    .forEach(m => {
      const dækket = Math.max(0, Math.min(m.beloeb, rest));
      rest -= dækket;
      const pct = Math.round((dækket / m.beloeb) * 100);
      const mdr = maanederTil(m.dato);
      const mangler = m.beloeb - dækket;
      const kraevetPrMd = mdr > 0 ? mangler / mdr : mangler;
      const status = mangler <= 0
        ? "✅ Fuldt dækket af din opsparing"
        : mdr <= 0
          ? `⚠️ Deadline er nået – mangler ${kr(mangler)}`
          : kraevetPrMd <= overskud
            ? `🟢 På rette kurs – kræver ${kr(kraevetPrMd)}/md. (du har ${kr(overskud)}/md.)`
            : `🔴 Bagud – kræver ${kr(kraevetPrMd)}/md., men dit overskud er ${kr(overskud)}/md.`;
      const div = document.createElement("div");
      div.className = "goal";
      div.innerHTML = `
        ${medSlet ? `<button data-id="${m.id}" title="Slet mål">✕</button>` : ""}
        <strong>${m.navn}</strong> – ${kr(m.beloeb)} senest ${new Date(m.dato).toLocaleDateString("da-DK")}
        <div class="bar"><div style="width:${pct}%"></div></div>
        <small>${pct}% dækket · ${status}</small>`;
      if (medSlet) {
        div.querySelector("button").addEventListener("click", () => {
          state.maal = state.maal.filter(x => x.id !== m.id);
          gem(); renderAlt();
        });
      }
      container.appendChild(div);
    });
}

/* ---------- Køb-tjek ---------- */
/* Vurderer et køb op mod opsparing, overskud og alle mål.
   Bruges af både Køb-fanen og Spar-botten. */
function vurderKoeb(pris) {
  const saldo = opsparing();
  const overskud = maanedligtOverskud();
  // Hvor mange penge skal der stå klar til målene på deres deadlines?
  const maalSorteret = [...state.maal].sort((a, b) => a.dato.localeCompare(b.dato));
  const problemer = [];
  let reserveretTilMaal = 0;
  maalSorteret.forEach(m => {
    reserveretTilMaal += m.beloeb;
    const mdr = maanederTil(m.dato);
    const tilRaadighedVedDeadline = saldo - pris + overskud * mdr;
    if (tilRaadighedVedDeadline < reserveretTilMaal) {
      problemer.push({ maal: m, mangler: reserveretTilMaal - tilRaadighedVedDeadline });
    }
  });
  const ventMdr = overskud > 0 && problemer.length
    ? Math.ceil(Math.max(...problemer.map(p => p.mangler)) / overskud) : null;
  const mdrTilRaad = pris > saldo && overskud > 0 ? Math.ceil((pris - saldo) / overskud) : null;
  return { saldo, overskud, problemer, ventMdr, mdrTilRaad, harPenge: pris <= saldo };
}

document.getElementById("koeb-form").addEventListener("submit", e => {
  e.preventDefault();
  const pris = Number(document.getElementById("k-pris").value);
  const tekst = document.getElementById("k-tekst").value || "købet";
  const boks = document.getElementById("koeb-resultat");
  boks.classList.remove("hidden", "ok", "advarsel", "nej");
  const { saldo, overskud, problemer, ventMdr, mdrTilRaad } = vurderKoeb(pris);

  if (pris > saldo) {
    boks.classList.add("nej");
    boks.innerHTML = `<h3>🔴 Nej – du har ikke pengene endnu</h3>
      <p>${tekst} koster ${kr(pris)}, men din opsparing er ${kr(saldo)}.</p>
      ${mdrTilRaad ? `<p>Med dit nuværende overskud på ${kr(overskud)}/md. har du råd om ca. <strong>${mdrTilRaad} måned(er)</strong> – og det er uden at tage hensyn til dine mål.</p>`
                   : `<p>Dit månedlige overskud er 0 eller negativt, så opsparingen vokser ikke af sig selv – kig på udgifterne først.</p>`}`;
  } else if (problemer.length === 0) {
    boks.classList.add("ok");
    boks.innerHTML = `<h3>🟢 Ja – det ser fint ud</h3>
      <p>Du kan købe ${tekst} til ${kr(pris)} og stadig nå alle dine mål til tiden.</p>
      <p>Opsparing efter køb: <strong>${kr(saldo - pris)}</strong> · Månedligt overskud: ${kr(overskud)}</p>`;
  } else {
    boks.classList.add("advarsel");
    boks.innerHTML = `<h3>🟡 Teknisk set råd – men det går ud over dine mål</h3>
      <p>Hvis du køber ${tekst} til ${kr(pris)} nu, kommer du bagud med:</p>
      <ul>${problemer.map(p =>
        `<li><strong>${p.maal.navn}</strong> (senest ${new Date(p.maal.dato).toLocaleDateString("da-DK")}) – mangler ca. ${kr(p.mangler)} til deadline</li>`).join("")}
      </ul>
      ${ventMdr ? `<p>💡 Venter du ca. <strong>${ventMdr} måned(er)</strong>, kan du købe det uden at gå på kompromis med målene.</p>` : ""}`;
  }
});

/* ---------- Rejseestimat ---------- */
const GLEMTE_POSTER = [
  { navn: "Brændstof-ekstra / dyrere diesel undervejs", std: 500, valgt: true },
  { navn: "Vejafgifter, motorvej &amp; broer (péage, vignette)", std: 700, valgt: true },
  { navn: "Færgeoverfarter", std: 400, valgt: false },
  { navn: "Parkering i byer", std: 300, valgt: true },
  { navn: "Campingstrøm, gas &amp; tømning", std: 350, valgt: true },
  { navn: "Rejseforsikring / vejhjælp i udlandet", std: 600, valgt: true },
  { navn: "Roaming / data-SIM", std: 150, valgt: false },
  { navn: "Vaskeri undervejs", std: 200, valgt: true },
  { navn: "Is, kaffe &amp; småkøb (37 dage bliver det til noget!)", std: 550, valgt: true },
  { navn: "Uforudset (bilreparation, medicin, glemte ting)", std: 1000, valgt: true },
];

function renderGlemteListe() {
  const div = document.getElementById("r-glemte");
  div.innerHTML = "";
  GLEMTE_POSTER.forEach((g, i) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" data-i="${i}" ${g.valgt ? "checked" : ""}>
      <span>${g.navn}</span>
      <input type="number" data-i="${i}" value="${g.std}" title="kr.">`;
    div.appendChild(label);
  });
}

let fasteUdgifter = [
  { navn: "Autocamper (leje)", beloeb: 7500 },
  { navn: "Flybilletter", beloeb: 2000 },
  { navn: "Airbnb & campingpladser", beloeb: 5000 },
];

function renderFasteUdgifter() {
  const div = document.getElementById("r-faste");
  div.innerHTML = "";
  fasteUdgifter.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "fast-udgift";
    row.innerHTML = `<input type="text" value="${f.navn}" data-i="${i}" data-felt="navn">
      <input type="number" value="${f.beloeb}" data-i="${i}" data-felt="beloeb">
      <button type="button" title="Fjern" data-i="${i}">✕</button>`;
    row.querySelectorAll("input").forEach(inp => inp.addEventListener("change", e => {
      const felt = e.target.dataset.felt;
      fasteUdgifter[i][felt] = felt === "beloeb" ? Number(e.target.value) : e.target.value;
    }));
    row.querySelector("button").addEventListener("click", () => {
      fasteUdgifter.splice(i, 1); renderFasteUdgifter();
    });
    div.appendChild(row);
  });
}

document.getElementById("r-tilfoej-fast").addEventListener("click", () => {
  fasteUdgifter.push({ navn: "", beloeb: 0 });
  renderFasteUdgifter();
});

document.getElementById("rejse-form").addEventListener("submit", e => {
  e.preventDefault();
  const budget = Number(document.getElementById("r-budget").value);
  const dage = Number(document.getElementById("r-dage").value);
  const personer = Number(document.getElementById("r-personer").value);
  const madPrDag = Number(document.getElementById("r-mad").value) * personer;
  const aktPrDag = Number(document.getElementById("r-akt").value) * personer;
  const km = Number(document.getElementById("r-km").value);
  const kmPris = Number(document.getElementById("r-kmpris").value);
  const shopping = Number(document.getElementById("r-shopping").value);

  const fast = fasteUdgifter.reduce((a, f) => a + f.beloeb, 0);
  const mad = madPrDag * dage;
  const akt = aktPrDag * dage;
  const braendstof = km * kmPris;

  let glemte = 0;
  const glemteValgte = [];
  document.querySelectorAll("#r-glemte label").forEach(label => {
    const check = label.querySelector("input[type=checkbox]");
    const beloeb = Number(label.querySelector("input[type=number]").value);
    if (check.checked && beloeb > 0) {
      glemte += beloeb;
      glemteValgte.push(`${label.querySelector("span").textContent}: ${kr(beloeb)}`);
    }
  });

  const total = fast + mad + akt + braendstof + shopping + glemte;
  const diff = budget - total;
  const restEfterFast = budget - fast;
  const prDagTilRaadighed = restEfterFast / dage;
  const variabelPrDag = (mad + akt + braendstof + shopping + glemte) / dage;

  const boks = document.getElementById("rejse-resultat");
  boks.classList.remove("hidden", "ok", "advarsel", "nej");
  boks.classList.add(diff >= 0 ? "ok" : (diff > -budget * 0.15 ? "advarsel" : "nej"));

  boks.innerHTML = `
    <h3>${diff >= 0 ? "🟢 Realistisk" : (diff > -budget * 0.15 ? "🟡 Stramt – men muligt med disciplin" : "🔴 Ikke realistisk med de valg")}</h3>
    <table>
      <tr><td>Faste udgifter (transport, bolig m.m.)</td><td>${kr(fast)}</td></tr>
      <tr><td>Mad (${dage} dage × ${kr(madPrDag)}/dag)</td><td>${kr(mad)}</td></tr>
      <tr><td>Aktiviteter (${dage} dage × ${kr(aktPrDag)}/dag)</td><td>${kr(akt)}</td></tr>
      <tr><td>Brændstof (${km} km × ${kmPris} kr./km)</td><td>${kr(braendstof)}</td></tr>
      <tr><td>Shopping/tøj/souvenirs</td><td>${kr(shopping)}</td></tr>
      <tr><td>Glemte poster (${glemteValgte.length} valgt)</td><td>${kr(glemte)}</td></tr>
      <tr><th>Estimat i alt</th><th>${kr(total)}</th></tr>
      <tr><th>Dit budget</th><th>${kr(budget)}</th></tr>
      <tr><th>${diff >= 0 ? "Luft i budgettet" : "Overskridelse"}</th><th>${kr(Math.abs(diff))}</th></tr>
    </table>
    <p style="margin-top:.8rem">Efter faste udgifter har du <strong>${kr(restEfterFast)}</strong> til ${dage} dage
      = <strong>${kr(prDagTilRaadighed)}/dag</strong>. Dine valg koster ca. <strong>${kr(variabelPrDag)}/dag</strong>.</p>
    ${diff < 0 ? `<p>💡 <strong>Sådan kan du komme i mål:</strong> vælg supermarked frem for restaurant, sænk antal km, eller hæv budgettet til ${kr(total)}.</p>` : ""}
    ${glemteValgte.length ? `<details><summary>Glemte poster medregnet</summary><ul>${glemteValgte.map(g => `<li>${g}</li>`).join("")}</ul></details>` : ""}`;
});

/* ---------- Spar-bot ---------- */
const CHAT_CHIPS = [
  "Hvordan ser min økonomi ud?",
  "Kan jeg købe en computer til 10.000 kr.?",
  "Læg en opsparingsplan for mine mål",
  "Hvad må ferien koste pr. dag?",
];

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chatBesked(html, fraBot) {
  const div = document.createElement("div");
  div.className = "chat-besked " + (fraBot ? "bot" : "mig");
  div.innerHTML = html;
  const vindue = document.getElementById("chat-vindue");
  vindue.appendChild(div);
  vindue.scrollTop = vindue.scrollHeight;
}

/* Træk et beløb ud af teksten, fx "10.000 kr", "10000", "10.000,50" */
function findBeloeb(t) {
  const m = t.replace(/\s/g, " ").match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:kr|kroner|,-)?/i);
  return m ? parseFloat(m[1].replace(/\./g, "")) : null;
}

function botSvar(spgRaa) {
  const spg = spgRaa.toLowerCase();
  const saldo = opsparing();
  const overskud = maanedligtOverskud();
  const beloeb = findBeloeb(spg);

  /* Status / overblik */
  if (/hvordan|status|økonomi|overblik|står det/.test(spg)) {
    const { ind, ud } = denneMaaned();
    const antalMaal = state.maal.length;
    return `Sådan ser det ud lige nu:<br>
      💰 Opsparing: <strong>${kr(saldo)}</strong><br>
      📈 Månedligt overskud: <strong>${kr(overskud)}</strong><br>
      📅 Denne måned: ${kr(ind)} ind / ${kr(ud)} ud<br>
      🎯 ${antalMaal ? `${antalMaal} mål – se status på Overblik-fanen` : "Ingen mål endnu – opret et under 🎯 Mål, så kan jeg lægge planer for dig"}`;
  }

  /* Køb-vurdering */
  if (beloeb && /køb|råd|anskaf|investere|purchase|koste/.test(spg) || (beloeb && spg.trim().split(" ").length <= 4)) {
    const v = vurderKoeb(beloeb);
    if (!v.harPenge) {
      return `🔴 Et køb til <strong>${kr(beloeb)}</strong> kan ikke lade sig gøre endnu – din opsparing er ${kr(v.saldo)}.` +
        (v.mdrTilRaad ? `<br>💡 <strong>Planen:</strong> Med ${kr(v.overskud)} i overskud pr. måned har du beløbet om ca. <strong>${v.mdrTilRaad} måned(er)</strong>.` :
          `<br>Dit månedlige overskud er 0 eller negativt – kig først på, hvor der kan spares (se kategorierne på Overblik-fanen).`);
    }
    if (v.problemer.length === 0) {
      return `🟢 Ja! Et køb til <strong>${kr(beloeb)}</strong> er realistisk. Du har ${kr(v.saldo)} og når stadig alle dine mål. Efter købet: ${kr(v.saldo - beloeb)} tilbage.`;
    }
    return `🟡 Du <em>har</em> pengene, men det går ud over: ${v.problemer.map(p => `<strong>${escHtml(p.maal.navn)}</strong> (mangler så ${kr(p.mangler)})`).join(", ")}.` +
      (v.ventMdr ? `<br>💡 <strong>Planen:</strong> Vent ca. <strong>${v.ventMdr} måned(er)</strong> – så kan du købe det uden at røre målene.` : "");
  }

  /* Opsparingsplan for målene */
  if (/plan|spare op|opspar|nå mine mål|hvordan når/.test(spg)) {
    if (state.maal.length === 0) {
      return `Du har ingen mål endnu. Opret fx “Ferie i Spanien – 20.000 kr.” under 🎯 Mål, så regner jeg planen ud.`;
    }
    let rest = saldo, kraevetIalt = 0;
    const linjer = [...state.maal]
      .sort((a, b) => a.prio - b.prio || a.dato.localeCompare(b.dato))
      .map(m => {
        const daekket = Math.max(0, Math.min(m.beloeb, rest));
        rest -= daekket;
        const mangler = m.beloeb - daekket;
        const mdr = Math.max(1, maanederTil(m.dato));
        const prMd = mangler / mdr;
        kraevetIalt += prMd;
        return `🎯 <strong>${escHtml(m.navn)}</strong>: ${mangler <= 0 ? "allerede dækket ✅" : `læg <strong>${kr(prMd)}</strong> til side pr. måned frem til ${new Date(m.dato).toLocaleDateString("da-DK")}`}`;
      });
    const dom = kraevetIalt <= overskud
      ? `✅ Det kræver <strong>${kr(kraevetIalt)}/md.</strong> i alt – og dit overskud er ${kr(overskud)}, så planen holder. Resten (${kr(overskud - kraevetIalt)}/md.) er til dig!`
      : `⚠️ Det kræver <strong>${kr(kraevetIalt)}/md.</strong>, men dit overskud er kun ${kr(overskud)}. Muligheder: ryk en deadline, sænk et målbeløb – eller find besparelser i din største kategori (se Overblik).`;
    return `Her er planen:<br>${linjer.join("<br>")}<br><br>${dom}`;
  }

  /* Ferie / dagsbudget */
  if (/ferie|rejse|spanien|pr\. dag|per dag|dagsbudget/.test(spg)) {
    const budget = beloeb || Number(document.getElementById("r-budget").value) || 20000;
    const dage = Number(document.getElementById("r-dage").value) || 37;
    const fast = fasteUdgifter.reduce((a, f) => a + f.beloeb, 0);
    const prDag = (budget - fast) / dage;
    return `Med et loft på <strong>${kr(budget)}</strong> og ${kr(fast)} i faste rejseudgifter har du <strong>${kr(budget - fast)}</strong> til ${dage} dage = <strong>${kr(prDag)}/dag</strong>.<br>
      Til sammenligning: supermarkedsmad koster ~130 kr./dag, og brændstof/småting løber let op i 100+ kr./dag.<br>
      💡 Brug ✈️ Rejse-fanen til at skrue på valgene og se, om det hænger sammen – husk de “glemte poster”!`;
  }

  /* Beløb uden tydelig sammenhæng → behandl som køb */
  if (beloeb) {
    const v = vurderKoeb(beloeb);
    return v.harPenge && v.problemer.length === 0
      ? `Hvis du mener et køb til ${kr(beloeb)}: 🟢 ja, det er der plads til.`
      : `Hvis du mener et køb til ${kr(beloeb)}: ${v.harPenge ? "🟡 muligt, men det presser dine mål" : "🔴 ikke endnu"}${v.ventMdr || v.mdrTilRaad ? ` – vent ca. ${v.ventMdr || v.mdrTilRaad} måned(er)` : ""}. Spørg fx “Kan jeg købe X til ${kr(beloeb)}?” for detaljer.`;
  }

  return `Det kan jeg ikke helt regne på endnu 🤔 Prøv fx:<br>
    • “Hvordan ser min økonomi ud?”<br>
    • “Kan jeg købe en computer til 10.000 kr.?”<br>
    • “Læg en opsparingsplan for mine mål”<br>
    • “Hvad må ferien koste pr. dag?”`;
}

/* Samtalehistorik til AI'en (kun i hukommelsen) */
const chatHistorik = [];

/* Nøgletal som AI'en får med, så den kan regne på Davids egne tal */
function bygKontekst() {
  const { ind, ud } = denneMaaned();
  const kategorier = {};
  const nu = new Date();
  state.posteringer.forEach(p => {
    const d = new Date(p.dato);
    if (p.type === "udgift" && d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth()) {
      kategorier[p.kategori] = (kategorier[p.kategori] || 0) + p.beloeb;
    }
  });
  return {
    dato_i_dag: new Date().toISOString().slice(0, 10),
    opsparing_kr: Math.round(opsparing()),
    maanedligt_overskud_kr: Math.round(maanedligtOverskud()),
    denne_maaned: { indtaegter_kr: Math.round(ind), udgifter_kr: Math.round(ud), udgifter_pr_kategori: kategorier },
    maal: state.maal.map(m => ({ navn: m.navn, beloeb_kr: m.beloeb, senest: m.dato, prioritet: m.prio })),
    rejseplan: {
      budget_kr: Number(document.getElementById("r-budget").value) || null,
      dage: Number(document.getElementById("r-dage").value) || null,
      faste_udgifter_kr: fasteUdgifter.reduce((a, f) => a + f.beloeb, 0),
    },
  };
}

/* AI-svar formateres let: fed skrift og linjeskift */
function formatAiSvar(t) {
  return escHtml(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

async function stilSpoergsmaal(tekst) {
  chatBesked(escHtml(tekst), false);

  // Prøv ægte AI via serveren, hvis den er sat op
  if (bankOpsat()) {
    const vindue = document.getElementById("chat-vindue");
    const taenker = document.createElement("div");
    taenker.className = "chat-besked bot";
    taenker.textContent = "Tænker …";
    vindue.appendChild(taenker);
    vindue.scrollTop = vindue.scrollHeight;
    try {
      const res = await fetch(state.bank.server.replace(/\/$/, "") + "/spar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-App-Token": state.bank.token },
        body: JSON.stringify({ besked: tekst, historik: chatHistorik, kontekst: bygKontekst() }),
      });
      const data = await res.json();
      if (res.ok && data.svar) {
        taenker.innerHTML = formatAiSvar(data.svar);
        chatHistorik.push({ role: "user", content: tekst }, { role: "assistant", content: data.svar });
        if (chatHistorik.length > 20) chatHistorik.splice(0, chatHistorik.length - 20);
        return;
      }
      taenker.remove(); // AI ikke sat op eller fejlede – fald tilbage til regne-botten
    } catch {
      taenker.remove();
    }
  }

  setTimeout(() => chatBesked(botSvar(tekst), true), 150);
}

document.getElementById("chat-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const tekst = input.value.trim();
  if (!tekst) return;
  input.value = "";
  stilSpoergsmaal(tekst);
});

function initChat() {
  const chips = document.getElementById("chat-chips");
  CHAT_CHIPS.forEach(c => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = c;
    b.addEventListener("click", () => stilSpoergsmaal(c));
    chips.appendChild(b);
  });
  chatBesked(`Hej David! 👋 Jeg er din budget-bot. Spørg mig om køb, planer og ferier – jeg svarer ud fra dine egne tal. Prøv en af knapperne herunder.`, true);
}

/* ---------- Init ---------- */
function renderAlt() {
  renderOverblik();
  renderPosteringer();
  renderMaalListe(document.getElementById("maal-liste"), true);
}
renderGlemteListe();
renderFasteUdgifter();
initBank();
initChat();
renderAlt();
