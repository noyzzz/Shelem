"""Original geometric Persian garden rug artwork; no external image assets."""
from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw
import random

ROOT = Path(__file__).resolve().parent
S = 2
W, H = 1024, 768
im = Image.new('RGB', (W*S, H*S), '#342c28')
d = ImageDraw.Draw(im)

def box(bounds, fill, outline=None, width=1):
    d.rectangle(tuple(round(v*S) for v in bounds), fill, outline, width*S)

def line(points, fill, width=1):
    d.line([(round(x*S),round(y*S)) for x,y in points], fill, width*S, joint='curve')

def poly(points, fill, outline=None):
    d.polygon([(round(x*S),round(y*S)) for x,y in points], fill, outline)

def diamond(x,y,rx,ry,fill):
    poly([(x,y-ry),(x+rx,y),(x,y+ry),(x-rx,y)],fill)

def flower(x,y,r,cream='#c8ad7e',base='#425a51'):
    # Eight angular petals, inspired by woven palmettes.
    for a in range(8):
        t = a*pi/4
        ux,uy=cos(t),sin(t)
        vx,vy=-uy,ux
        poly([(x+ux*r*.22,y+uy*r*.22),
              (x+ux*r*.67+vx*r*.27,y+uy*r*.67+vy*r*.27),
              (x+ux*r,y+uy*r),
              (x+ux*r*.67-vx*r*.27,y+uy*r*.67-vy*r*.27)],cream)
    diamond(x,y,r*.4,r*.4,base)
    diamond(x,y,r*.17,r*.17,'#d8c397')

# Multiple narrow guard stripes and one generous palmette border.
for inset,color in [(5,'#b69a70'),(9,'#574737'),(13,'#a96e51'),(20,'#c6aa78'),
                    (24,'#303f3b'),(33,'#b79864'),(37,'#703a31'),
                    (84,'#b79b6e'),(89,'#2f4541'),(99,'#b09062'),
                    (103,'#854b3d')]:
    box((inset,inset,W-inset-1,H-inset-1),color)

for x in range(48,W-40,47):
    for y in (60,H-61):
        flower(x,y,18)
        line([(x+18,y),(x+24,y-9),(x+30,y)],'#bda475',1)
for y in range(107,H-94,47):
    for x in (60,W-61):
        flower(x,y,18)
        line([(x,y+18),(x-9,y+24),(x,y+30)],'#bda475',1)
for x in range(29,W-27,12):
    for y in (28,94,H-29,H-95): diamond(x,y,3,3,'#c2a777')
for y in range(29,H-27,12):
    for x in (28,94,W-29,W-95): diamond(x,y,3,3,'#c2a777')

# Repeating tendrils remain visible beyond the table silhouette.
for row,y in enumerate(range(127,H-111,50)):
    for x in range(122+(row%2)*25,W-111,50):
        flower(x,y,10,cream='#bc9270',base='#586359')
        line([(x,y+12),(x+12,y+23),(x+25,y+25)],'#b18b68',1)
        poly([(x+14,y+22),(x+14,y+13),(x+22,y+20)],'#4b6155')
        poly([(x-13,y-22),(x-13,y-13),(x-22,y-20)],'#4b6155')

# Stepped corner spandrels and the central garden medallion.
for cx,cy,sx,sy in [(105,105,1,1),(W-106,105,-1,1),
                   (105,H-106,1,-1),(W-106,H-106,-1,-1)]:
    shape=[(0,0),(141,0),(123,20),(103,20),(103,39),(80,39),
           (80,60),(60,60),(60,80),(39,80),(39,103),(20,103),(20,123),(0,141)]
    poly([(cx+x*sx,cy+y*sy) for x,y in shape],'#3c514a')
    flower(cx+40*sx,cy+40*sy,25)
for rx,ry,col in [(217,262,'#b69a70'),(206,249,'#344d47'),
                  (173,217,'#c0a375'),(160,203,'#793f35'),(131,173,'#334b45')]:
    diamond(W/2,H/2,rx,ry,col)
for a in range(16):
    t=a*pi/8
    flower(W/2+103*cos(t),H/2+140*sin(t),13)
flower(W/2,H/2,69,cream='#bea475',base='#814c3c')
diamond(W/2,H/2,19,27,'#42594c')
flower(W/2,H/2,13)

# Subtle deterministic warp/weft, not large grain or extra texture maps.
im=im.resize((W,H),Image.Resampling.LANCZOS)
pixels=im.load()
rng=random.Random(714)
for y in range(H):
    weave=(1 if y%3==0 else -1)*1.4
    for x in range(W):
        n=rng.choice((-2,-1,0,0,0,1,2))+weave
        pixels[x,y]=tuple(max(0,min(255,round(v+n))) for v in pixels[x,y])
im.quantize(colors=64, method=Image.Quantize.MEDIANCUT).save(ROOT/'persian-rug.png',optimize=True)
print(f'Rug texture: {W} x {H}, {(ROOT / "persian-rug.png").stat().st_size:,} bytes')
