# Plan: Automatisk kobling til Danske Bank

Målet er at appen selv henter transaktioner fra Danske Bank, så CSV-import bliver overflødig.

## Sådan virker det (PSD2 / open banking)

Danske Bank er ved lov forpligtet til at dele kontodata med tjenester, som kontoejeren selv godkender. Man kan ikke lave et plugin *inde i* bankens app, men man kan hente data *fra* banken via en godkendt formidler:

- ~~GoCardless Bank Account Data (tidl. Nordigen)~~ — **lukket for nye tilmeldinger** (juli 2025) og under afvikling. Duer ikke længere.
- **Enable Banking** (enablebanking.com) — det aktuelle gratis alternativ: "Restricted Production" giver **gratis adgang til rigtige bankdata, begrænset til konti man selv forbinder** — præcis vores behov. Dækker Danske Bank og alle andre store danske banker; login sker med MitID.
- Adgangen er **kun læseadgang** — ingen kan flytte penge.
- Godkendes med MitID og fornyes periodisk med ét tryk (PSD2-samtykke).

## Arkitektur

```
[Budget-app (browser/PWA)] ⇄ [lille server] ⇄ [Enable Banking API] ⇄ [Danske Bank]
```

Serveren er nødvendig, fordi API-nøgler og bank-tokens aldrig må ligge i en browser-app. Den skal kunne:

1. `POST /forbind` – starte en autorisation hos Enable Banking og sende brugeren til Danske Banks MitID-godkendelse
2. `GET /callback` – modtage brugeren retur efter godkendelse og gemme sessions-id
3. `GET /transaktioner` – hente nye transaktioner og levere dem til appen i samme format som CSV-importen (dato, tekst, beløb)

Gratis hosting-muligheder: Cloudflare Workers (anbefalet), Deno Deploy eller Render.

## Status

- [x] Konto oprettet på [enablebanking.com](https://enablebanking.com)
- [x] RSA-nøglepar genereret
- [x] Server bygget (`server/main.ts` – klar til Deno Deploy)
- [x] "Forbind til Danske Bank"-knap i appen (under Ind & ud)
- [ ] Server sat op på Deno Deploy
- [ ] Applikation registreret i Enable Banking Control Panel
- [ ] Første MitID-godkendelse og test

## Opsætningsguide

### 1. Server på Deno Deploy (gratis)
1. Gå til [dash.deno.com](https://dash.deno.com) og log ind med GitHub
2. "New project" → vælg repoet `Draga28/Budget-app` → entrypoint: `server/main.ts` → Deploy
3. Notér projektets adresse, fx `https://budget-app.deno.dev`
4. Under Settings → Environment variables tilføjes:
   - `EB_APP_ID` – applikations-id fra Enable Banking (trin 2)
   - `EB_PRIVATE_KEY` – hele indholdet af den private nøglefil
   - `APP_TOKEN` – et selvvalgt kodeord (skrives også i appen)

### 2. Applikation i Enable Banking Control Panel
1. Applications → registrér ny applikation, navn fx "Davids Budget App"
2. Miljø: **Production** (aktiveres i restricted mode ved at forbinde egne konti)
3. Redirect URL: `https://<dit-projekt>.deno.dev/callback`
4. Offentlig nøgle: indholdet af `eb-offentlig-noegle.pem`
5. Kopiér applikations-id'et til `EB_APP_ID` på Deno Deploy

### 3. I appen
1. Ind & ud → "🏦 Automatisk fra Danske Bank" → fold "Opsætning" ud
2. Indtast server-adresse og APP_TOKEN → Gem
3. Tryk "Forbind til Danske Bank" → godkend med MitID
4. Tryk "Hent nye posteringer" – færdig! Gentag når du vil have friske tal.

## Indtil da

CSV-import fra Danske Banks netbank virker allerede og tager ca. 2 minutter:
Netbank → konto → "Søg på posteringer" → vælg periode → eksportér CSV → vælg filen i appen. Posteringerne kategoriseres automatisk, og dubletter springes over.
