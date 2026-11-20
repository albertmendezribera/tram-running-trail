# The ICGC ortho photo (CC BY 4.0) over each window of data/*.json, at 0.25 m to the pixel, asked in quarters and joined.
import json, glob, subprocess, io, sys, time
from PIL import Image
URL = 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wms/service'
CELL = 0.25
for path in sorted(glob.glob('data/*.json')):
    meta = json.load(open(path)); side = meta['side']; minX, maxY = meta['utm']
    px = int(side / CELL); half = px // 2
    out = Image.new('RGB', (px, px))
    for r in range(2):
        for c in range(2):
            west = minX + c * side / 2; north = maxY - r * side / 2
            q = f'{URL}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=orto&SRS=EPSG:25831&BBOX={west},{north - side / 2},{west + side / 2},{north}&WIDTH={half}&HEIGHT={half}&FORMAT=image/jpeg&STYLES='
            raw = subprocess.run(['curl', '-s', '-m', '90', q], capture_output=True).stdout
            try: out.paste(Image.open(io.BytesIO(raw)).convert('RGB'), (c * half, r * half))
            except Exception as e: print('failed', meta['name'], r, c, raw[:200]); sys.exit(1)
            time.sleep(1)
    out.save(f"data/{meta['name']}-ortho.jpg", quality=88); print(meta['name'], out.size)
    out.resize((700, 700)).save(f"data/{meta['name']}-ortho-small.jpg", quality=80)
