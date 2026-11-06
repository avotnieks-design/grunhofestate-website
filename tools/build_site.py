"""Apply the requested illustrations and map entry to the retained HTML page."""
from pathlib import Path
import json,re,shutil,html,sys

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
SOURCE=Path(sys.argv[1]) if len(sys.argv)>1 else None

def sprite(index,label,extra=''):
    return '<span class="object-study '+extra+'" role="img" aria-label="'+html.escape(label,quote=True)+'" style="--sprite-x:'+('100%' if index%2 else '0%')+';--sprite-y:'+str((index//2)*25)+'%"></span>'

def preview(dataset):
    ps=[p for p in dataset['parcels'] if p['rings'] and 'expanded' in p['groups']]
    x0=min(p['bbox'][0] for p in ps)-90;y0=min(p['bbox'][1] for p in ps)-90;x1=max(p['bbox'][2] for p in ps)+90;y1=max(p['bbox'][3] for p in ps)+90
    shapes=[]
    for p in ps:
        d=''.join('M'+'L'.join(f'{x-x0:.2f},{y1-y:.2f}' for x,y in ring)+'Z' for ring in p['rings'])
        fill={'municipal':'#9a926e','private':'#b38c68','state':'#8d9990','unknown':'#bbaa8f'}[p['category']]
        shapes.append(f'<path d="{d}" fill="{fill}" fill-opacity=".25" stroke="#806344" stroke-width="1.1" vector-effect="non-scaling-stroke" fill-rule="evenodd"/>')
    return '<svg viewBox="0 0 '+str(x1-x0)+' '+str(y1-y0)+'" aria-hidden="true" focusable="false">'+''.join(shapes)+'</svg>'

def main():
    s=(ROOT/'base-index.html').read_text()
    data=json.loads((DIST/'assets'/'parcel-data.js').read_text()[len('window.GOLF_DATA='):-2])
    css='''
/* Object studies, drawn from the ten original illustrations. */
.object-study{display:block;width:142px;aspect-ratio:5 / 3;background-image:url('assets/object-studies.png');background-size:200% 500%;background-position:var(--sprite-x) var(--sprite-y);background-repeat:no-repeat;mix-blend-mode:multiply;filter:sepia(1) saturate(.72) contrast(.96);flex:none}
.vision-item{padding-right:128px;min-height:155px}.vision-item>.object-study{position:absolute;right:0;top:26px;width:118px}
.golf-feature>.object-study{width:155px;margin:-5px 0 14px}.territory-foot article{position:relative}.territory-foot article>.object-study{width:123px;margin:0 0 10px}
.phase>.object-study{width:142px;margin:-6px 0 16px}.phase-num{margin-bottom:12px}.phase h3{min-height:64px}
.map-launch{margin:48px 0 0;border:1px solid #a88b61;position:relative;display:grid;grid-template-columns:.8fr 1.2fr;gap:40px;padding:30px 38px;background:#dec89e18;align-items:center}
.map-launch:after{content:'';position:absolute;inset:3px -4px -4px 3px;border:1px solid #ad90683d;transform:rotate(-.18deg);pointer-events:none}.map-launch .eyebrow{font-size:9px;margin-bottom:14px}.map-launch h3{font-size:37px;line-height:1.15}.map-launch p{font-size:14px;margin:17px 0 12px;max-width:460px;line-height:1.85}.map-launch .text-link{margin-top:0}.map-thumbnail{position:relative;min-height:220px;padding:8px;border-right:1px solid #b49a703d}.map-thumbnail svg{width:100%;height:220px;display:block}.map-thumbnail:after{content:'N ↑';position:absolute;right:16px;top:0;color:#a78a60;font:11px Georgia,serif}.map-thumbnail span{display:block;font:italic 10px/1.7 Georgia,serif;color:#98784f;text-align:center;margin-top:7px}.nav{gap:22px}.map-launch a:focus-visible{outline-offset:7px}
@media(max-width:1100px){.vision-item{padding-right:100px}.vision-item>.object-study{width:92px}.map-launch{gap:25px;padding:28px}.map-launch h3{font-size:33px}.nav{gap:17px}}
@media(max-width:850px){.vision-item{padding-right:96px}.vision-item>.object-study{width:88px}.phase>.object-study{width:130px}.map-launch{grid-template-columns:.8fr 1.2fr;gap:24px;padding:24px}.map-thumbnail{min-height:190px}.map-thumbnail svg{height:190px}.map-launch h3{font-size:30px}}
@media(max-width:620px){.vision-item{padding-right:96px;min-height:140px}.vision-item>.object-study{width:94px;top:30px}.vision-item h3{font-size:23px}.vision-item p{font-size:13px}.golf-feature>.object-study{width:145px;margin-bottom:9px}.territory-foot article>.object-study{width:118px}.phase>.object-study{width:125px;margin-bottom:13px}.phase h3{min-height:0}.map-launch{grid-template-columns:1fr;gap:15px;padding:24px 23px;margin-top:35px}.map-thumbnail{min-height:175px;border:0;border-bottom:1px solid #b49a7040;padding-bottom:16px}.map-thumbnail svg{height:175px}.map-launch h3{font-size:32px}.map-launch p{font-size:14px}.map-launch .eyebrow{font-size:8px}.nav{gap:0}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important}}
'''
    s=s.replace('</style>',css+'\n</style>',1)
    # Three concept illustrations.
    for heading,index,label in [
        ('Kungu ēka kā kluba nams',4,'Tušas skice: kauss un šķīvis — muižas viesmīlība'),
        ('Golfs vēsturiskā ainavā',8,'Tušas skice: krustotas golfa nūjas un bumbiņa'),
        ('Viesmīlība muižas ēkās',0,'Tušas skice: linu dvieļi un ūdens pudele — viesu uzņemšana')]:
        pattern=r'(<article class="vision-item">[\s\S]*?<h3>'+re.escape(heading)+r'</h3>[\s\S]*?</div>)(</article>)'
        s,n=re.subn(pattern,lambda m:m.group(1)+sprite(index,label)+m.group(2),s,count=1)
        if n!=1:raise ValueError('Concept heading missing: '+heading)
    # Golf landscape and cultural club life.
    for title,index,label in [('Ainava kā pieredze',6,'Tušas skice: vecs parka koks'),('Vieta, kur atgriezties',9,'Tušas skice: vijole un lociņš — kultūra un kluba dzīve')]:
        pattern=r'(<article class="golf-feature">)(?=<span class="mini-label">[^<]+</span><h3>'+re.escape(title)+')'
        s,n=re.subn(pattern,lambda m:m.group(1)+sprite(index,label),s,count=1)
        if n!=1:raise ValueError('Golf heading missing: '+title)
    # Education and each of the four development stages.
    s=s.replace('<article><h4>Izglītības turpinājums</h4>','<article>'+sprite(7,'Tušas skice: atvērta grāmata un spalva — izglītība')+'<h4>Izglītības turpinājums</h4>',1)
    phases=[(1,5,'Tušas skice: sena atslēga — vienošanās un lietošanas modelis'),(2,1,'Tušas skice: monētas un naudas maiss — finansējums'),(3,3,'Tušas skice: plāns, cirkulis un lineāls — projektēšana'),(4,2,'Tušas skice: āmurs, kalts un ota — restaurācija')]
    for phase,index,label in phases:
        target='<span class="phase-num">'+str(phase)+'</span>'
        if target not in s:raise ValueError('Phase missing '+str(phase))
        s=s.replace(target,target+sprite(index,label),1)
    if s.count('class="object-study ')!=10:raise ValueError('Expected ten object studies')
    academy='<article class="golf-feature"><span class="mini-label">Akadēmija</span>'
    if s.count(academy)!=1:raise ValueError('Academy illustration insertion point missing')
    s=s.replace(academy,'<article class="golf-feature">'+sprite(7,'Tušas skice: atvērta grāmata un spalva — golfa akadēmija un mācīšanās')+'<span class="mini-label">Akadēmija</span>',1)
    for heading,index,label in [('Kultūras mantojums',2,'Tušas skice: āmurs, kalts un ota — kultūras mantojuma saglabāšana'),('Dzīva publiskā vide',6,'Tušas skice: vecs parka koks — pastaigas un publiskais parks')]:
        target='<article><h4>'+heading+'</h4>'
        if s.count(target)!=1:raise ValueError('Territory illustration insertion point missing: '+heading)
        s=s.replace(target,'<article>'+sprite(index,label)+'<h4>'+heading+'</h4>',1)
    # Keep a full-size working map one click from the main territory section.
    launch='<div class="map-launch" id="ipasumu-karte"><div class="map-thumbnail">'+preview(data)+'<span>Fig. III — Zemes vienību robežu pārskats</span></div><div><span class="eyebrow">Interaktīvā teritorijas izpēte</span><h3>Īpašumi vienā kartē.</h3><p>Skolas lauksaimniecības zemes, kalpu ciemats un abas Veckastaņu vienības kopā ar muižu un golfa ieceres teritoriju. Katru daļu var iekļaut izvēlē un apskatīt atsevišķi.</p><a class="text-link" href="karte.html"><span>Atvērt interaktīvo karti</span><span aria-hidden="true">↗</span></a></div></div>'
    target='<div class="territory-foot">'
    if s.count(target)!=1:raise ValueError('Territory insertion point missing')
    s=s.replace(target,launch+target,1)
    s=s.replace('<a href="#attistiba">Attīstība</a>','<a href="karte.html">Karte</a><a href="#attistiba">Attīstība</a>',1)
    # Expand the existing land dialog without changing unrelated concept text.
    rows=''.join('<tr><td class="nowrap">'+codeLabel(p['code'])+'</td><td>'+html.escape(p['name'])+'</td><td>'+((f"{p['geometryHa']:.2f}".replace('.',',')+' ha') if p['geometryHa'] is not None else 'Jāprecizē')+'</td></tr>' for p in data['parcels'])
    land='<span class="eyebrow">Teritorijas izpēte</span><h2 id="dialog-title">Zemes un to konteksts.</h2><p class="dialog-lead">Īpašumu izvēle un attīstības varianti vienā darba kartē.</p><p><a class="btn" href="karte.html">Atvērt interaktīvo karti ↗</a></p><div class="table-wrap"><table><thead><tr><th>Kadastra apzīmējums</th><th>Projekta konteksts</th><th>Laukums kartē</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="note">Laukumi aprēķināti pēc VZD 31.10.2026. robežu datnes, nevis pārņemti no kadastra teksta datiem. Piederības piezīmes apskatāmas interaktīvajā kartē; aktuālās īpašuma tiesības nav pārbaudītas.</p><p>Darba materiālos minētais vēsturiskais pašvaldības 113,43 ha īpašums, kultūras pieminekļa robežas, agrākajās kartēs iezīmētie laukumi un aptuveni 100 ha kompleksa ieceres mērogs raksturo atšķirīgas teritorijas.</p><p class="dialog-footer">Interaktīvajā kartē izmantota VZD publiskotā robežu ģeometrija. Tā neatspoguļo apstiprinātu golfa trases izvietojumu.</p>'
    s,n=re.subn(r'(<template id="content-land">)[\s\S]*?(</template>)',lambda m:m.group(1)+land+m.group(2),s,count=1)
    if n!=1:raise ValueError('Land template missing')
    s=s.replace('</head>','<link rel="canonical" href="https://grunhofestate.lv/">\n</head>',1)
    (DIST/'index.html').write_text(s)
    for name,source in [('reference-v1.jpg','F145DB8F-DEAF-485A-9A35-FB074B1F31D0.jpeg'),('reference-municipal.jpg','78434FC1-3E22-4E1F-8C4C-FC963424A3FD.jpeg'),('reference-forest.jpg','F951B72A-B188-4A69-9F86-D7C7E00C6F50.jpeg')]:
        if SOURCE:shutil.copyfile(SOURCE/'Kartes'/source,DIST/'assets'/name)
        elif not (DIST/'assets'/name).exists():raise FileNotFoundError(name)
    (DIST/'.nojekyll').touch()
    print(json.dumps({'indexBytes':len(s.encode()),'illustrationPlacements':13,'uniqueStudies':10,'mapParcels':len(data['parcels'])}))

def codeLabel(code):return code[:4]+' '+code[4:7]+' '+code[7:]

if __name__=='__main__':main()
