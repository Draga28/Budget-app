/* ============================================================
   Davids Budget App – al data gemmes lokalt i localStorage
   ============================================================ */

const LS_KEY = "davids-budget-app";

let state = JSON.parse(localStorage.getItem(LS_KEY) || "null") || {
  startsaldo: 0,
  posteringer: [],   // {id, type, tekst, beloeb, dato, kategori, fast}
  maal: [],          // {id, navn, beloeb, dato, prio}
};

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
  renderKategorier();
  renderSeneste();
  renderMaalListe(document.getElementById("ov-maal-liste"), false);
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
  const viste = [...state.posteringer]
    .filter(p => valgtMaaned === "alle" || p.dato.startsWith(valgtMaaned))
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

/* ---------- CSV-import fra bank ---------- */
document.getElementById("csv-fil").addEventListener("change", e => {
  const fil = e.target.files[0];
  if (!fil) return;
  const laeser = new FileReader();
  laeser.onload = () => {
    const linjer = laeser.result.split(/\r?\n/).filter(l => l.trim());
    let importeret = 0, sprunget = 0;
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
      const type = beloeb >= 0 ? "indtaegt" : "udgift";
      // Spring dubletter over, så samme fil kan importeres flere gange
      const findes = state.posteringer.some(x =>
        x.dato === dato && x.tekst === tekst && x.beloeb === Math.abs(beloeb) && x.type === type);
      if (findes) { sprunget++; return; }
      state.posteringer.push({
        id: uid(), type,
        tekst, beloeb: Math.abs(beloeb), dato,
        kategori: gaetKategori(tekst), fast: false,
      });
      importeret++;
    });
    gem(); renderAlt();
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
document.getElementById("koeb-form").addEventListener("submit", e => {
  e.preventDefault();
  const pris = Number(document.getElementById("k-pris").value);
  const tekst = document.getElementById("k-tekst").value || "købet";
  const saldo = opsparing();
  const overskud = maanedligtOverskud();
  const boks = document.getElementById("koeb-resultat");
  boks.classList.remove("hidden", "ok", "advarsel", "nej");

  // Hvor mange penge skal der stå klar til målene på deres deadlines?
  // Simulér måned for måned: saldo efter køb + overskud, tjek hvert mål på dets deadline.
  const maalSorteret = [...state.maal].sort((a, b) => a.dato.localeCompare(b.dato));
  let problemer = [];
  let reserveretTilMaal = 0;
  maalSorteret.forEach(m => {
    reserveretTilMaal += m.beloeb;
    const mdr = maanederTil(m.dato);
    const tilRaadighedVedDeadline = saldo - pris + overskud * mdr;
    if (tilRaadighedVedDeadline < reserveretTilMaal) {
      problemer.push({ maal: m, mangler: reserveretTilMaal - tilRaadighedVedDeadline });
    }
  });

  if (pris > saldo) {
    boks.classList.add("nej");
    const mdrTilRaad = overskud > 0 ? Math.ceil((pris - saldo) / overskud) : null;
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
    const vent = overskud > 0
      ? Math.ceil(Math.max(...problemer.map(p => p.mangler)) / overskud)
      : null;
    boks.innerHTML = `<h3>🟡 Teknisk set råd – men det går ud over dine mål</h3>
      <p>Hvis du køber ${tekst} til ${kr(pris)} nu, kommer du bagud med:</p>
      <ul>${problemer.map(p =>
        `<li><strong>${p.maal.navn}</strong> (senest ${new Date(p.maal.dato).toLocaleDateString("da-DK")}) – mangler ca. ${kr(p.mangler)} til deadline</li>`).join("")}
      </ul>
      ${vent ? `<p>💡 Venter du ca. <strong>${vent} måned(er)</strong>, kan du købe det uden at gå på kompromis med målene.</p>` : ""}`;
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

/* ---------- Init ---------- */
function renderAlt() {
  renderOverblik();
  renderPosteringer();
  renderMaalListe(document.getElementById("maal-liste"), true);
}
renderGlemteListe();
renderFasteUdgifter();
renderAlt();
