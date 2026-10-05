"""Original inscription outlines. Python 3; pip install -r requirements.txt.

This is a display face, not a body-text font. Lowercase uses small capitals.
No third-party font outlines or generated raster glyphs are embedded.
"""
from pathlib import Path
from math import hypot, cos, sin, pi
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0
from fontTools.ttLib import newTable

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/fonts/imperivm'
OUT.mkdir(parents=True, exist_ok=True)
glyphs, metrics, cmap = {}, {}, {}

class Letter:
    def __init__(self, advance=790):
        self.pen = TTGlyphPen(None)
        self.advance = advance
    def poly(self, points):
        self.pen.moveTo(tuple(round(v) for v in points[0]))
        for p in points[1:]: self.pen.lineTo(tuple(round(v) for v in p))
        self.pen.closePath()
    def line(self, a, b, width=None, serif=False):
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = hypot(dx, dy)
        if not length: return
        # Chiselled contrast: broad stems and fine crossbars.
        w = width or (30 + 39*abs(dy)/length)
        nx, ny = -dy/length*w/2, dx/length*w/2
        self.poly([(a[0]+nx,a[1]+ny),(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny)])
        if serif:
            for x,y in (a,b):
                sign = 1 if y > 350 else -1
                self.poly([(x-71,y),(x+71,y),(x+36,y-sign*20),(x-36,y-sign*20)])
    def path(self, pts, width=None):
        for a,b in zip(pts,pts[1:]): self.line(a,b,width)
    def oval(self, cx=395, cy=360, rx=250, ry=353, start=0, end=2*pi):
        self.path([(cx+rx*cos(start+(end-start)*i/40),cy+ry*sin(start+(end-start)*i/40)) for i in range(41)])
    def stem(self, x, low=0, high=720): self.line((x,low),(x,high),serif=True)

def add(char, letter):
    name = 'uni%04X' % ord(char)
    glyphs[name] = letter.pen.glyph()
    metrics[name] = (letter.advance, 30)
    cmap[ord(char)] = name

def latin(char):
    l = Letter()
    L,R,B,T,M = 145,645,0,720,365
    if char == 'A':
        l.line((L,B),(395,T),serif=True); l.line((395,T),(R,B),serif=True); l.line((230,255),(554,255))
    elif char in 'BEFPR':
        l.stem(L)
        if char in 'EF':
            l.line((L,T),(R,T)); l.line((L,M),(540,M))
            if char == 'E': l.line((L,B),(R,B))
            l.line((R,T),(R,T-75),25)
            if char=='E': l.line((R,0),(R,75),25)
        else:
            l.path([(L,T),(455,T),(584,658),(625,570),(590,451),(470,M),(L,M)])
            if char=='B': l.path([(L,M),(480,M),(621,300),(652,171),(600,64),(460,0),(L,B)])
            if char=='R': l.line((410,M),(667,B),serif=True)
    elif char in 'CGOQ':
        if char in 'OQ': l.oval()
        else:
            l.oval(start=.65,end=2*pi-.65)
            if char=='G': l.path([(620,360),(620,210),(528,100)]); l.line((443,360),(663,360))
        if char=='Q': l.line((435,115),(701,-95),44)
    elif char == 'D':
        l.stem(L); l.path([(L,720),(408,720),(554,640),(638,490),(653,360),(633,215),(560,80),(411,0),(L,0)])
    elif char == 'H': l.stem(L); l.stem(R); l.line((L,M),(R,M))
    elif char=='I': l.advance=400; l.stem(200)
    elif char=='J':
        l.stem(620,155,720); l.path([(620,155),(574,48),(468,-7),(307,12),(190,100)])
    elif char=='K':
        l.stem(L); l.line((L,345),(R,720),serif=True); l.line((310,475),(R,0),serif=True)
    elif char=='L': l.stem(L); l.line((L,0),(R,0)); l.line((R,0),(R,90),25)
    elif char=='M':
        l.stem(L); l.stem(R); l.line((L,T),(395,220)); l.line((395,220),(R,T))
    elif char=='N': l.stem(L); l.stem(R); l.line((L,T),(R,B))
    elif char=='S': l.path([(625,625),(510,715),(319,712),(179,618),(163,502),(260,409),(510,315),(625,214),(615,111),(500,13),(282,5),(165,95)])
    elif char=='T':
        l.stem(395); l.line((90,T),(700,T)); l.line((90,T),(90,630),25); l.line((700,T),(700,630),25)
    elif char=='U': l.path([(L,T),(L,190),(185,67),(290,5),(495,5),(605,70),(R,190),(R,T)]); l.line((L,T),(L,650),serif=True); l.line((R,T),(R,650),serif=True)
    elif char=='V': l.line((L,T),(395,B),serif=True); l.line((395,B),(R,T),serif=True)
    elif char=='W':
        l.advance=1020; l.path([(120,T),(320,0),(510,520),(700,0),(900,T)])
        for x in [120,900]: l.line((x,T),(x,T-1),serif=True)
    elif char=='X': l.line((L,0),(R,T),serif=True); l.line((L,T),(R,0),serif=True)
    elif char=='Y': l.line((L,T),(395,M),serif=True); l.line((R,T),(395,M),serif=True); l.stem(395,0,M)
    elif char=='Z': l.line((L,T),(R,T)); l.line((R,T),(L,0)); l.line((L,0),(R,0))
    return l

for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ': add(c,latin(c))
aliases = dict(zip('АВЕЗКМНОРСТХ', 'ABESKMHOPCTX'))
for c in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ':
    if c in aliases and c!='З': l = latin(aliases[c])
    elif c=='Ё':
        l=latin('E'); l.poly([(225,790),(290,790),(290,855),(225,855)]); l.poly([(495,790),(560,790),(560,855),(495,855)])
    else:
        l=Letter(); L,R=145,645
        if c=='Б':
            l.stem(L); l.line((L,720),(R,720)); l.path([(L,350),(470,350),(607,280),(637,171),(580,58),(460,0),(L,0)])
        elif c=='Г': l.stem(L); l.line((L,720),(R,720)); l.line((R,720),(R,635),25)
        elif c=='Д':
            l.path([(155,0),(255,255),(280,720),(560,720),(560,0)]); l.line((90,0),(660,0)); l.stem(90,-110,0); l.stem(660,-110,0)
        elif c=='Ж':
            l.advance=980; l.stem(490); l.path([(120,720),(400,355),(120,0)]); l.path([(850,720),(580,355),(850,0)]); l.line((400,355),(580,355))
        elif c=='З': l.path([(170,641),(320,716),(494,707),(612,615),(607,501),(491,383),(361,365),(508,345),(628,225),(595,93),(471,7),(283,7),(165,85)])
        elif c in 'ИЙ':
            l.stem(L); l.stem(R); l.line((L,0),(R,720))
            if c=='Й': l.path([(280,855),(325,792),(465,792),(510,855)],30)
        elif c=='Л': l.line((L,0),(395,720),serif=True); l.line((395,720),(R,0),serif=True)
        elif c=='П': l.stem(L); l.stem(R); l.line((L,720),(R,720))
        elif c=='У': l.path([(130,720),(382,305),(635,720)]); l.path([(382,305),(300,55),(188,0),(96,25)])
        elif c=='Ф': l.stem(395,-30,750); l.oval(395,360,270,260)
        elif c=='Ц': l.stem(L); l.stem(R); l.line((L,0),(R,0)); l.stem(695,-110,0)
        elif c=='Ч': l.stem(R); l.path([(L,720),(L,448),(252,350),(410,350),(R,440)])
        elif c in 'ШЩ':
            l.advance=1030
            for x in [145,515,885]: l.stem(x)
            l.line((145,0),(885,0))
            if c=='Щ': l.stem(945,-110,0)
        elif c in 'ЬЫЪ':
            if c=='Ы': l.advance=1090; l.stem(945)
            x=255 if c=='Ъ' else L
            l.stem(x); l.path([(x,345),(470,345),(610,275),(643,171),(580,53),(460,0),(x,0)])
            if c=='Ъ': l.line((90,720),(255,720)); l.line((90,720),(90,625),25)
        elif c=='Э': l.oval(start=pi+.65,end=3*pi-.65); l.line((390,365),(640,365))
        elif c=='Ю': l.advance=1090; l.stem(L); l.line((L,365),(470,365)); l.oval(720,360,220,353)
        elif c=='Я': l.stem(R); l.path([(R,720),(380,720),(228,657),(172,553),(213,450),(371,365),(R,365)]); l.line((388,365),(L,0),serif=True)
    add(c,l)

for c in '0123456789':
    l=Letter(720)
    if c=='0': l.oval(360,360,220,353)
    elif c=='1': l.path([(177,582),(366,720),(366,0)]); l.line((235,0),(507,0))
    elif c=='2': l.path([(130,620),(240,716),(438,716),(580,616),(565,458),(130,0),(590,0)]); l.line((590,0),(590,88),25)
    elif c=='3': l.path([(145,645),(272,715),(450,706),(571,612),(554,485),(415,369),(300,357),(480,340),(585,228),(556,102),(451,6),(260,7),(137,91)])
    elif c=='4': l.path([(492,0),(492,720),(110,227),(606,227)]); l.line((380,0),(600,0))
    elif c=='5': l.path([(567,720),(164,720),(164,384),(369,389),(545,306),(588,181),(535,59),(402,5),(240,9),(130,84)])
    elif c in '69':
        l.oval(360,235 if c=='6' else 485,225,230)
        l.path([(145,235),(137,420),(192,590),(333,716),(494,698),(585,635)] if c=='6' else [(585,485),(580,302),(520,123),(389,2),(215,20),(127,84)])
    elif c=='7': l.path([(135,630),(135,720),(593,720),(252,0)])
    elif c=='8': l.oval(360,535,211,178); l.oval(360,188,234,185)
    add(c,l)

for c in '.,:;!?-–—+×/\\()[]«»\'"…%&@#=₿$€₽':
    l=Letter(430)
    if c in '.,:;…':
        for x,y in ([(145,42),(275,42),(405,42)] if c=='…' else [(190,42),(190,395)] if c in ':;' else [(190,42)]): l.poly([(x-28,y-28),(x+28,y-28),(x+28,y+28),(x-28,y+28)])
        if c in ',;': l.line((211,30),(160,-80),25)
        if c=='…': l.advance=570
    elif c in '-–—+=':
        l.advance=790 if c=='—' else 600
        l.line((95,345),(l.advance-95,345),30)
        if c=='+': l.line((l.advance/2,150),(l.advance/2,550),30)
        if c=='=': l.line((95,475),(l.advance-95,475),30)
    elif c=='!': l.line((215,210),(215,720),55); l.poly([(188,15),(242,15),(242,70),(188,70)])
    elif c=='?':
        l.advance=660; l.path([(100,620),(228,720),(419,702),(539,600),(525,479),(330,331),(330,210)]); l.poly([(301,15),(359,15),(359,70),(301,70)])
    elif c in '/\\': l.line((100,0 if c=='/' else 720),(330,720 if c=='/' else 0),30)
    elif c in '()[]':
        l.path([(325,770),(173,565),(132,360),(173,155),(325,-50)] if c=='(' else [(105,770),(257,565),(298,360),(257,155),(105,-50)] if c==')' else [(325,770),(150,770),(150,-50),(325,-50)] if c=='[' else [(105,770),(280,770),(280,-50),(105,-50)],30)
    elif c in '«»':
        l.advance=620
        for x in [150,370]: l.path([(x+80,535),(x-40,350),(x+80,165)] if c=='«' else [(x-40,535),(x+80,350),(x-40,165)],30)
    elif c in '\'"':
        for x in ([125,280] if c=='"' else [215]): l.line((x,720),(x-35,565),40)
    elif c=='×': l.advance=650; l.line((120,100),(530,600),30); l.line((120,600),(530,100),30)
    elif c=='%': l.advance=790; l.line((125,0),(665,720),30); l.oval(214,590,90,110); l.oval(570,125,90,110)
    elif c=='&': l.advance=790; l.path([(663,0),(266,505),(222,619),(300,712),(426,716),(516,625),(451,502),(166,238),(140,118),(264,9),(420,9),(634,213),(670,357)]); l.line((540,360),(740,360))
    elif c=='@': l.advance=1000; l.oval(480,360,340,350,start=.7,end=2*pi+.2); l.oval(450,350,155,195); l.path([(600,540),(600,145),(719,145),(819,259)])
    elif c=='#': l.advance=790; l.line((235,0),(330,720),35); l.line((460,0),(555,720),35); l.line((120,250),(680,250),30); l.line((140,475),(700,475),30)
    else:
        # Currency signs use matching Latin bowls/stems with distinct bars.
        l=latin('B' if c=='₿' else 'P' if c=='₽' else 'C' if c=='€' else 'S')
        if c in '₿$': l.line((360,-85),(360,805),28)
        if c=='₿': l.line((445,-85),(445,805),28)
        if c in '€₽': l.line((100,265),(490,265),28)
        if c=='€': l.line((100,410),(490,410),28)
    add(c,l)

# Useful game/UI signs share the inscription's stroke weight.
for c in '−←→':
    l=Letter(790); l.line((110,350),(680,350),30)
    if c=='←': l.path([(310,550),(110,350),(310,150)],30)
    if c=='→': l.path([(480,550),(680,350),(480,150)],30)
    add(c,l)

# Independent small-cap outlines; ordinary Unicode typing works in both languages.
for upper in list(cmap):
    c=chr(upper); lower=c.lower()
    if len(lower)==1 and lower!=c:
        source=glyphs[cmap[upper]]; p=TTGlyphPen(None)
        source.draw(TransformPen(p,(.82,0,0,.8,0,0)),glyphs)
        name='uni%04X' % ord(lower); glyphs[name]=p.glyph(); metrics[name]=(round(metrics[cmap[upper]][0]*.82),25); cmap[ord(lower)]=name
blank=TTGlyphPen(None).glyph()
glyphs['space']=blank; metrics['space']=(330,0); cmap[32]='space'; cmap[160]='space'
missing=Letter(700); missing.poly([(100,0),(100,720),(600,720),(600,0)]); missing.poly([(150,50),(550,50),(550,670),(150,670)])
glyphs['.notdef']=missing.pen.glyph(); metrics['.notdef']=(700,50)
order=['.notdef','space']+[n for n in glyphs if n not in ['.notdef','space']]
fb=FontBuilder(1000,isTTF=True); fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=920,descent=-180)
fb.setupNameTable({'familyName':'IMPERIVM Inscription','styleName':'Regular','uniqueFontIdentifier':'IMPERIVMInscription-1.000','fullName':'IMPERIVM Inscription Regular','psName':'IMPERIVMInscription-Regular','version':'Version 1.000','copyright':'Original outlines for the IMPERIVM project, 2026. See LICENSE.txt.'})
fb.setupOS2(sTypoAscender=920,sTypoDescender=-180,usWinAscent=940,usWinDescent=190,sCapHeight=720,sxHeight=576,fsType=0)
fb.setupPost(); fb.setupMaxp()
kern=newTable('kern'); kern.version=0; table=KernTable_format_0(); table.version=0; table.coverage=1; table.kernTable={}
for pair in ['AV','VA','WA','TA','AT','YA','FA','PA','ЛА','ТА','ГА','ДЛ']:
    a,b=pair
    if ord(a) in cmap and ord(b) in cmap: table.kernTable[(cmap[ord(a)],cmap[ord(b)])]=-55
kern.kernTables=[table]; fb.font['kern']=kern
# Fixed timestamps make regeneration deterministic.
fb.font['head'].created=fb.font['head'].modified=3874089600
fb.font.recalcTimestamp=False
fb.font.save(OUT/'imperivm-inscription.ttf')
font=TTFont(OUT/'imperivm-inscription.ttf',recalcTimestamp=False); font.flavor='woff2'; font.save(OUT/'imperivm-inscription.woff2')
# SVG proof uses the very same outlines as the font, not a disconnected picture.
rows=['ABCDEFGHIJKLMNOPQRSTUVWXYZ','АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ','0123456789 + − × / ! ? ₿ $ € ₽']
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="510" viewBox="0 0 1800 510"><rect width="1800" height="510" fill="#17211e"/>']
svg.append('<text x="50" y="55" fill="#ae9f81" font-family="sans-serif" font-size="20">IMPERIVM INSCRIPTION · LATIN / CYRILLIC · DISPLAY SMALL CAPS</text>')
for row,index in zip(rows,range(3)):
    x=50; scale=min(.075,1680/sum(metrics[cmap[ord(c)]][0] if ord(c) in cmap else 330 for c in row))
    for c in row:
        if ord(c) not in cmap: x+=330*scale; continue
        name=cmap[ord(c)]; pen=SVGPathPen(glyphs); glyphs[name].draw(pen,glyphs)
        svg.append(f'<path d="{pen.getCommands()}" fill="#edcf8e" transform="translate({x:.2f},{160+index*145}) scale({scale:.5f},-{scale:.5f})"/>')
        x+=metrics[name][0]*scale
svg.append('</svg>'); (OUT/'alphabet.svg').write_text(''.join(svg))
print(f'{len(cmap)} characters / {len(order)} glyphs → {OUT}')
