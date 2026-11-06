"""Extract the project's parcels from the VZD municipal SHP publication.

Run with a downloaded 0030000_kk_shp.zip; no third-party modules are required.
Coordinates remain in their published EPSG:10306 (LKS-2020 TM) reference system.
"""
import sys, json, struct, zipfile, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = 'https://data.gov.lv/dati/dataset/b28f0eed-73b0-4e44-94e7-b04b11bf0b69/resource/fbec7921-0899-40ff-b4bd-e9c9c358d3dd/download/0030000_kk_shp.zip'
SOURCE_PAGE = 'https://data.gov.lv/dati/lv/dataset/kadastra-informacijas-sistemas-atverti-telpiskie-dati/resource/fbec7921-0899-40ff-b4bd-e9c9c358d3dd'

def read_layer(archive, stem):
    dbf = archive.read(stem+'.dbf')
    count = struct.unpack_from('<I', dbf, 4)[0]
    hlen, rlen = struct.unpack_from('<HH', dbf, 8)
    fields = []
    for p in range(32, hlen-1, 32):
        if dbf[p] == 13: break
        fields.append((dbf[p:p+11].split(b'\0')[0].decode(), dbf[p+16]))
    rows = []
    for i in range(count):
        row = dbf[hlen+i*rlen:hlen+(i+1)*rlen]
        off, record = 1, {}
        for name, size in fields:
            record[name] = row[off:off+size].decode('utf-8', 'replace').strip()
            off += size
        rows.append(record)
    shp, p, i, features = archive.read(stem+'.shp'), 100, 0, []
    while p < len(shp):
        _, words = struct.unpack_from('>II', shp, p)
        b = shp[p+8:p+8+words*2]
        typ = struct.unpack_from('<I', b)[0]
        if typ in (5, 15, 25):
            box = list(struct.unpack_from('<4d', b, 4))
            parts, points = struct.unpack_from('<II', b, 36)
            offsets = list(struct.unpack_from('<'+'I'*parts, b, 44))+[points]
            xy = [list(struct.unpack_from('<2d', b, 44+4*parts+16*j)) for j in range(points)]
            rings = [xy[offsets[j]:offsets[j+1]] for j in range(parts)]
            features.append({'code':rows[i]['CODE'], 'date':rows[i].get('GEOM_ACT_D'), 'bbox':box, 'rings':rings, 'sourceArea':float(rows[i].get('AREA_SCALE') or 0)})
        elif typ != 0:
            raise ValueError('Unsupported shape type '+str(typ))
        p += 8+words*2
        i += 1
    if i != count: raise ValueError('SHP and DBF row count mismatch')
    return features

def signed_area(ring):
    # Translate before computing to avoid cancellation at national coordinates.
    x0, y0 = ring[0]
    r = [(x-x0, y-y0) for x,y in ring]
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]+r[:1]))/2

def contains(rings,x,y):
    inside=False
    for ring in rings:
        for a,b in zip(ring,ring[1:]+ring[:1]):
            if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: inside=not inside
    return inside

def label_point(feature):
    rings = feature['rings']; x0,y0,x1,y1=feature['bbox']
    # A small interior grid avoids placing labels in courtyards and parcel holes.
    best=None
    for i in range(1,20):
        for j in range(1,20):
            x=x0+(x1-x0)*i/20; y=y0+(y1-y0)*j/20
            if contains(rings,x,y):
                distance=float('inf')
                for ring in rings:
                    for a,b in zip(ring,ring[1:]+ring[:1]):
                        dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
                        distance=min(distance,(x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2)
                if best is None or distance>best[0]:best=(distance,x,y)
    return list(best[1:]) if best else rings[0][0]

def intersects(a,b): return not (a[2]<b[0] or a[0]>b[2] or a[3]<b[1] or a[1]>b[3])

def main():
    raw=Path(sys.argv[1]).read_bytes(); z=zipfile.ZipFile(Path(sys.argv[1]))
    layer='ExportCadGroup_5496004/'
    parcels=read_layer(z,layer+'KKParcel'); buildings=read_layer(z,layer+'KKBuilding')
    metadata=json.loads((ROOT/'parcel-notes.json').read_text())
    index={p['code']:p for p in parcels};selected=[]
    for item in metadata:
        f=index.get(item['code'])
        if f:
            # AREA_SCALE is VZD's polygon area with projection scale correction,
            # never the registered textual parcel area. The direct planar area
            # is slightly smaller because of the TM scale factor.
            a=abs(sum(signed_area(r) for r in f['rings']))
            if abs(a-f['sourceArea'])>max(2,a*0.01):
                raise ValueError('Geometry area discrepancy for '+item['code'])
            item.update({'geometryHa':round(f['sourceArea']/10000,4),'planarHa':round(a/10000,4),'geometryDate':f['date'],'rings':f['rings'],'labelPoint':label_point(f),'bbox':f['bbox']})
        else:item.update({'geometryHa':None,'rings':None,'labelPoint':None,'bbox':None})
        selected.append(item)
    boxes=[p['bbox'] for p in selected if p['bbox']]
    bounds=[min(b[0] for b in boxes)-200,min(b[1] for b in boxes)-200,max(b[2] for b in boxes)+200,max(b[3] for b in boxes)+200]
    def compact(f):return {'code':f['code'],'rings':f['rings']}
    dataset={'source':{'publisher':'Valsts zemes dienests','url':SOURCE_PAGE,'downloadUrl':SOURCE_URL,'license':'CC BY 4.0','crs':'EPSG:10306 · LKS-2020 TM','retrieved':'2026-11-05','snapshot':'2026-10-31','sha256':hashlib.sha256(raw).hexdigest()},'bounds':bounds,'parcels':selected,'context':[compact(p) for p in parcels if intersects(p['bbox'],bounds)],'buildings':[compact(p) for p in buildings if intersects(p['bbox'],bounds)]}
    # Four decimals of a metre exceeds the source display precision.
    def rounded(v):
        if isinstance(v,float):return round(v,4)
        if isinstance(v,list):return [rounded(x) for x in v]
        if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
        return v
    dataset=rounded(dataset)
    out=ROOT/'dist'/'assets'/'parcel-data.js'
    out.write_text('window.GOLF_DATA='+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n')
    (ROOT/'cadastre-provenance.json').write_text(json.dumps(dataset['source'],ensure_ascii=False,indent=2))
    print(json.dumps({'mapped':sum(bool(p['rings']) for p in selected),'unmapped':[p['code'] for p in selected if not p['rings']],'context':len(dataset['context']),'buildings':len(dataset['buildings']),'bytes':out.stat().st_size}))

if __name__=='__main__':main()
