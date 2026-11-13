"""Build a compact county map from the checked-in 2023 Census cartographic files."""
import struct, json, math
from pathlib import Path
root = Path(__file__).resolve().parent.parent
raw = (root / 'cb_2023_us_county_500k.dbf').read_bytes()
n, header, length = struct.unpack_from('<IHH', raw, 4)
fields = []
for off in range(32, header - 1, 32):
    field = raw[off:off+32]
    fields.append((field[:11].split(b'\0')[0].decode(), field[16]))
rows = []
for i in range(n):
    record = raw[header+i*length:header+(i+1)*length]
    row, off = {}, 1
    for name, size in fields:
        row[name] = record[off:off+size].decode('utf8').strip(); off += size
    rows.append(row)
# Albers equal-area projection for the contiguous states; separate AK/HI insets.
p1, p2, p0 = map(math.radians, [29.5, 45.5, 37.5])
nn = (math.sin(p1)+math.sin(p2))/2
cc = math.cos(p1)**2+2*nn*math.sin(p1)
r0 = math.sqrt(cc-2*nn*math.sin(p0))/nn
def project(x, y, state):
    if state == '02': return (x if x < 0 else x-360, -y)
    if state == '15': return (x, -y)
    rho = math.sqrt(cc-2*nn*math.sin(math.radians(y)))/nn
    theta = nn*math.radians(x+96)
    return (rho*math.sin(theta), -(r0-rho*math.cos(theta)))
shp = (root/'cb_2023_us_county_500k.shp').read_bytes(); off = 100; shapes=[]
for row in rows:
    size = struct.unpack_from('>I',shp,off+4)[0]*2; rec = shp[off+8:off+8+size]; off += 8+size
    state = row['STATEFP']
    if int(state)>56: continue
    parts, count = struct.unpack_from('<ii',rec,36)
    starts = list(struct.unpack_from('<'+'i'*parts,rec,44))+[count]
    pts = [project(*struct.unpack_from('<dd',rec,44+4*parts+16*i),state) for i in range(count)]
    rings=[]
    for a,b in zip(starts,starts[1:]):
        ring=pts[a:b]
        # Retain major geometry, omit tiny offshore islands.
        if len(ring)<4: continue
        sampled=[ring[0]]
        tolerance = .045 if state=='02' else .008 if state=='15' else .00065
        for p in ring[1:]:
            if math.dist(p,sampled[-1])>tolerance: sampled.append(p)
        rings.append(sampled if len(sampled)>2 else ring)
    shapes.append((row,rings))
bounds={}
for row,rings in shapes:
    group=row['STATEFP'] if row['STATEFP'] in ('02','15') else 'main'
    points=[p for ring in rings for p in ring]
    if not points: continue
    box=bounds.setdefault(group,[float('inf'),float('inf'),-float('inf'),-float('inf')])
    box[:]=[min(box[0],min(p[0] for p in points)),min(box[1],min(p[1] for p in points)),max(box[2],max(p[0] for p in points)),max(box[3],max(p[1] for p in points))]
result=[]
for row,rings in shapes:
    group=row['STATEFP'] if row['STATEFP'] in ('02','15') else 'main'
    x,y,w,h={'main':(35,25,930,545),'02':(50,580,220,145),'15':(305,610,140,95)}[group]
    bx,by,ex,ey=bounds[group]; scale=min(w/(ex-bx),h/(ey-by))
    path=''.join('M'+'L'.join(f'{x+(px-bx)*scale:.1f},{y+(py-by)*scale:.1f}' for px,py in ring)+'Z' for ring in rings)
    result.append({'id':row['GEOID'],'name':row['NAMELSAD'],'state':row.get('STUSPS',row['STATEFP']),'path':path})
(root/'src/client/data/counties.json').write_text(json.dumps(result,separators=(',',':')))
print(f'Built {len(result)} counties and county equivalents')
