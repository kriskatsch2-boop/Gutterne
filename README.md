# Gutterdag – mordleg, hemmelige missioner og mystery-øl

En lille mobilside til gutterdagen. Den er sat op ligesom serveren.katsch.dk: Node.js/Express, Socket.IO og PostgreSQL på Railway, almindelig JavaScript i frontenden og alt på dansk.

## Filer

```
gutterdag/
├── server.js          # Express-server, API, Socket.IO og lagring
├── data.js            # Ting, steder og missioner (ret frit her)
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js         # Hele frontenden
```

## Deploy på Railway

1. Lav et **nyt projekt** på Railway og deploy mappen, enten fra GitHub eller med `railway up` inde i mappen.
2. Tilføj **PostgreSQL** til projektet: *New → Database → PostgreSQL*.
3. Gå til servicens **Variables** og tilføj:
   - `DATABASE_URL` → reference til Postgres-databasens `DATABASE_URL`
   - `ADMIN_PIN` → din admin-kode, fx `4821` (standard er `1234`, så skift den)
   - Kun hvis du bruger den *offentlige* database-URL: `PGSSL=true`
4. Railway sætter selv `PORT`. Start-kommandoen er `npm start`.
5. Tabellen `gutterdag_tilstand` oprettes automatisk ved første start.

## Subdomæne (gutterdag.katsch.dk)

1. I Railway: *Settings → Networking → Custom Domain* → skriv `gutterdag.katsch.dk`.
2. Railway giver dig et CNAME-mål. Hos Simply.com tilføjer du en **CNAME**-record: `gutterdag` → det mål, Railway gav dig.
3. Vent på, at DNS og certifikat er klar, typisk et par minutter.

## Lokalt

```
npm install
ADMIN_PIN=1234 npm start
```
Uden `DATABASE_URL` gemmes alt i `gemt-tilstand.json` i mappen.

## Sådan bruger du den på dagen

**Før gæsterne kommer**
1. Åbn siden → **Admin** (nederst) → log ind med `ADMIN_PIN`.
2. Skriv de 7 navne → **Gem navne**.

**Når folk kommer**
3. Øllene ryger i den fælles pose. Del linket. Alle trykker på deres navn og vælger selv en kode på 4 cifre.
4. Admin → **Træk sedler og missioner**. Alt trækkes tilfældigt på serveren, så du kan heller ikke se de andres.

**I løbet af dagen**
- Primær mission: For hvert point i dagens lege giver man en tår til en valgfri person (vises øverst under Missioner og Status).
- Mordlegen: Man dræber ved at få offeret til at tage imod tingen fra hånd til hånd på stedet. Man undgår at dø ved at sige nej tak. Har man en mistanke, kan man bruge sit ene forsøg på **"Afslør min jæger"**. Gætter man rigtigt, er jægeren ude, og man får drabet. Gætter man forkert, skal man drikke.
- Offeret trykker selv på **"Jeg er blevet dræbt"**, og så går sedlen automatisk videre. Trykker nogen ved en fejl, kan du bruge **Fortryd sidste drab** under Admin.
- Missioner: Man markerer selv **Klaret** eller **Afsløret** (og vælger, hvem der afslørede den).

**Mystery-øl (når I har lyst)**
- Admin → slå **Åbn øl-smagning** til. Alle skriver deres egen øls nummer og giver point (1–10) og gætter ejer på resten.
- Når alle står som færdige: slå **Afslør øl-resultat** til.

**Til sidst**
- Slå **Afslør missioner** og **Afslør mordlegen** til. Så kan alle se point, missioner og hvem der dræbte hvem under *Status*.

**Hvis noget går galt**
- Har nogen glemt sin kode? Brug Admin → **Nulstil kode**.
- **Nulstil alt** sletter koder, sedler, drab, missioner og øl-ark. Navnene beholdes.
