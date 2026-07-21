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
  renderMaalListe(document.getElementById("ov-maal-liste"), false);
}

document.getElementById("startsaldo").addEventListener("change", e => {
  state.startsaldo = Number(e.target.value) || 0;
  gem(); renderOverblik();
});

/* ---------- Posteringer ---------- */
document.getElementById("p-dato").valueAsDate = new Date();

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
  const tbody = document.querySelector("#post-tabel tbody");
  tbody.innerHTML = "";
  [...state.posteringer]
    .sort((a, b) => b.dato.localeCompare(a.dato))
    .forEach(p => {
      const tr = document.createElement("tr");
      const fortegn = p.type === "indtaegt" ? "+" : "−";
      tr.innerHTML = `<td>${p.dato}</td><td>${p.tekst}${p.fast ? " 🔁" : ""}</td>
        <td>${p.kategori}</td>
        <td class="${p.type === "indtaegt" ? "positiv" : "negativ"}">${fortegn}${kr(p.beloeb)}</td>
        <td><button title="Slet" data-id="${p.id}">✕</button></td>`;
      tr.querySelector("button").addEventListener("click", () => {
        state.posteringer = state.posteringer.filter(x => x.id !== p.id);
        gem(); renderAlt();
      });
      tbody.appendChild(tr);
    });
}

/* ---------- CSV-import fra bank ---------- */
document.getElementById("csv-fil").addEventListener("change", e => {
  const fil = e.target.files[0];
  if (!fil) return;
  const laeser = new FileReader();
  laeser.onload = () => {
    const linjer = laeser.result.split(/\r?\n/).filter(l => l.trim());
    let importeret = 0;
    linjer.forEach(linje => {
      const dele = linje.split(/[;,]/).map(s => s.trim().replace(/^"|"$/g, ""));
      if (dele.length < 3) return;
      const [datoRaa, tekst, beloebRaa] = dele;
      const beloeb = parseFloat(beloebRaa.replace(/\./g, "").replace(",", "."));
      if (isNaN(beloeb) || !/\d{2,4}/.test(datoRaa)) return; // spring header over
      // Understøt både 21-07-2026 og 2026-07-21
      let dato = datoRaa;
      const m = datoRaa.match(/^(\d{2})[-\/.](\d{2})[-\/.](\d{4})$/);
      if (m) dato = `${m[3]}-${m[2]}-${m[1]}`;
      state.posteringer.push({
        id: uid(),
        type: beloeb >= 0 ? "indtaegt" : "udgift",
        tekst, beloeb: Math.abs(beloeb), dato,
        kategori: "Andet", fast: false,
      });
      importeret++;
    });
    gem(); renderAlt();
    document.getElementById("csv-status").textContent =
      importeret > 0 ? `✅ Importerede ${importeret} posteringer.`
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
