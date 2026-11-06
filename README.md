# Grünhof Golf Estate — grunhofestate.lv

Zaļās muižas ieceres vietnes jaunākā versija: vēsturiskie attēli, brūnās tušas skices, golfa trases skice un interaktīvā zemes vienību karte.

Avots: apstiprinātā Grünhof vietne, avota versija `3da5808f4288c7b437e92f5346786d3bea95692f` (2026-11-06).

## GitHub un Cloudflare Pages

Ieteiktais repozitorijs: `avotnieks-design/grunhofestate-website`. Šis ir sagatavots projekts; repozitorijs un Cloudflare izvietojums vēl jāizveido autorizētajos kontos.

Repozitorijā augšupielādē šī projekta saturu, saglabājot mapju struktūru. GitHub repozitorijs var būt privāts; Cloudflare publicē vietni no mapes `dist`.

Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**. Izvēlies šim projektam izveidoto repozitoriju.

| Iestatījums | Vērtība |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `python3 tools/build_site.py` |
| Build output directory | `dist` |
| Root directory | repozitorija sakne (atstāt tukšu) |

Nav jāinstalē atkarības. Būvēšana izmanto tikai Python standarta bibliotēku. Ja tiek izmantoti jau sagatavotie `dist` faili bez pārbūvēšanas, build command var būt `exit 0`.

Pēc pirmās izvietošanas pārbaudi piešķirto `pages.dev` adresi un karti.

## Domēna piesaiste

1. Pievieno **grunhofestate.lv** tajā pašā Cloudflare kontā kā domēna zonu. Izvēlies Free plānu.
2. Pārbaudi importētos DNS ierakstus. Ja domēnam ir e-pasts, saglabā tā MX un TXT ierakstus.
3. Domēna reģistratora panelī uzstādi tieši šai zonai Cloudflare piešķirtos nameserverus. Vērtības nav universālas; tās jāņem no Cloudflare paneļa.
4. Kad zona ir aktīva: Pages projekta **Custom domains → Set up a domain**, pievieno `grunhofestate.lv` un `www.grunhofestate.lv`.
5. Ja vajadzīga vienota adrese, Cloudflare domēna līmenī konfigurē pāradresāciju no `www` uz `https://grunhofestate.lv`, saglabājot ceļu un parametrus.
6. Pārbaudi HTTPS, galveno lapu, fotogrāfiju palielināšanu un karti.

## Satura rediģēšana

- `base-index.html` — galvenās lapas saturs un dizains.
- `tools/build_site.py` — galvenās lapas izveide ar skicēm un kartes atsauci.
- `dist/assets` — attēli, karte, stili un dati.
- `dist/karte.html` — interaktīvās kartes lapa.
- `dist/robots.txt`, `dist/sitemap.xml` — meklētāju norādes jaunajam domēnam.

Pārbūvēšana: `python3 tools/build_site.py`.

Zemes vienību ģeometrijas avots un CC BY 4.0 attiecinājums saglabāts failā `cadastre-provenance.json` un kartes datos. Lietotāja kartes izvēles un personīgās piezīmes glabājas tikai viņa pārlūkā.

## Oficiālā dokumentācija

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/how-to/www-redirect/
