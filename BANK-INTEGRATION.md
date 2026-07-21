# Plan: Automatisk kobling til Danske Bank

Målet er at appen selv henter transaktioner fra Danske Bank, så CSV-import bliver overflødig.

## Sådan virker det (PSD2 / open banking)

Danske Bank er ved lov forpligtet til at dele kontodata med tjenester, som kontoejeren selv godkender. Man kan ikke lave et plugin *inde i* bankens app, men man kan hente data *fra* banken via en godkendt formidler:

- **GoCardless Bank Account Data** (tidl. Nordigen) — gratis for privat brug, understøtter Danske Bank (`DANSKEBANK_DABADKKK`).
- Adgangen er **kun læseadgang** — ingen kan flytte penge.
- Godkendes med MitID og gælder 90 dage ad gangen, hvorefter den fornyes med ét tryk.

## Arkitektur

```
[Budget-app (browser/PWA)] ⇄ [lille server] ⇄ [GoCardless API] ⇄ [Danske Bank]
```

Serveren er nødvendig, fordi API-nøgler og bank-tokens aldrig må ligge i en browser-app. Den skal kunne:

1. `POST /forbind` – starte en "requisition" hos GoCardless og sende brugeren til Danske Banks MitID-godkendelse
2. `GET /callback` – modtage brugeren retur efter godkendelse og gemme konto-id
3. `GET /transaktioner` – hente nye transaktioner og levere dem til appen i samme format som CSV-importen (dato, tekst, beløb)

Gratis hosting-muligheder: Cloudflare Workers (anbefalet), Deno Deploy eller Render.

## Trin for at komme i gang

- [ ] David opretter gratis konto på [bankaccountdata.gocardless.com](https://bankaccountdata.gocardless.com)
- [ ] David opretter `secret_id` + `secret_key` under "Developers → User secrets"
- [ ] Vælg hosting og læg nøglerne ind som hemmeligheder dér (aldrig i git!)
- [ ] Byg serveren (koden kommer i `server/`-mappen i dette repo)
- [ ] Tilføj "Forbind til Danske Bank"-knap i appen
- [ ] Første MitID-godkendelse og test

## Indtil da

CSV-import fra Danske Banks netbank virker allerede og tager ca. 2 minutter:
Netbank → konto → "Søg på posteringer" → vælg periode → eksportér CSV → vælg filen i appen. Posteringerne kategoriseres automatisk, og dubletter springes over.
