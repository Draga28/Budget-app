# 💰 Davids Budget App

En personlig budget-app skræddersyet til Davids økonomi og mål. Appen kører direkte i browseren – ingen installation, ingen server, og alle data gemmes kun lokalt i din egen browser (localStorage).

## Sådan bruger du den

Åbn `index.html` i din browser – det er det hele.

## På telefonen 📱

Appen er en PWA (Progressive Web App): når den ligger på en webadresse, kan den installeres på telefonens hjemmeskærm og virker derefter som en almindelig app – også offline.

1. Slå GitHub Pages til (kræver et **offentligt** repo på gratis GitHub-konto): Settings → Pages → under "Build and deployment" vælg "Deploy from a branch" → `main` og `/ (root)` → Save. Efter et par minutter ligger appen på **https://draga28.github.io/budget-app/**.
2. Åbn adressen på telefonen.
3. **iPhone (Safari):** tryk på del-ikonet → "Føj til hjemmeskærm". **Android (Chrome):** menu → "Installér app" / "Føj til startskærm".

Herefter ligger den som app-ikon med eget navn og ikon, åbner uden browserbjælke og virker uden internet. Data gemmes stadig kun lokalt på telefonen.

## Funktioner

### 📊 Overblik
- Nuværende opsparing, månedligt overskud (gennemsnit af de sidste 3 måneder) og denne måneds indtægter/udgifter.
- Status på alle mål: er du på rette kurs eller bagud?

### 💳 Indtægter & udgifter
- Skriv indtægter og udgifter ind manuelt med kategori og dato.
- Markér posteringer som "fast månedlig" (fx løn og husleje), så de indgår i fremtidsberegninger.
- **CSV-import fra banken**: eksportér kontoudtog som CSV fra netbanken (Danske Bank, Nordea, Lunar m.fl.) og træk filen ind – så slipper du for at taste alt manuelt.

### 🎯 Mål
- Opret mål med beløb, deadline og prioritet – fx "Ferie i Spanien, 20.000 kr., klar til juni".
- Appen viser hvor meget der skal lægges til side pr. måned, og om dit nuværende overskud rækker.

### 🛒 "Kan jeg købe?" (køb-tjek)
- Skriv fx "Computer, 10.000 kr." – appen tjekker om købet stadig lader dig nå alle dine mål til tiden.
- Svarer 🟢 ja / 🟡 ja, men det går ud over målene (og hvor længe du bør vente) / 🔴 nej, du har ikke pengene.

### ✈️ Rejseestimat
- Sæt et maks-budget, antal dage og personer.
- Indtast faste udgifter (fly, autocamper, overnatning) og vælg dagligt niveau: mad (supermarked / mix / restaurant), aktiviteter, kørsel (km × pris), shopping.
- Indbygget tjekliste med **poster man tit glemmer**: brændstof, vejafgifter/péage, færger, parkering, campingstrøm & gas, rejseforsikring, roaming, vaskeri, småkøb og en buffer til uforudset.
- Resultat: 🟢 realistisk / 🟡 stramt / 🔴 urealistisk – med fuld udregning og forslag til hvordan du kommer i mål.

## Automatisk bankdata – kan det lade sig gøre?

Ja, men ikke gratis/nemt som privatperson. Danske banker åbner deres data via PSD2 "open banking", og man kan bruge en mellemmand som:

- **GoCardless Bank Account Data** (tidl. Nordigen) – har en gratis udviklerkonto og understøtter de fleste danske banker.
- **Aiia (Mastercard)** og **Tink** – kommercielle alternativer.

Det kræver dog en lille server (bank-tokens må ikke ligge i en browser-app), så det er planlagt som fase 2. Indtil da er CSV-import den hurtige løsning – 2 minutters arbejde en gang om ugen.

## Roadmap

- [x] Fase 1: Manuel indtastning, CSV-import, mål, køb-tjek, rejseestimat
- [ ] Fase 2: Lille backend + GoCardless-integration så transaktioner hentes automatisk
- [ ] Fase 3: Automatisk kategorisering af transaktioner (fx "Netto" → Mad)
- [ ] Fase 4: Rejsedagbog: log forbrug undervejs på rejsen og se om du holder dagsbudgettet
