"""Self-contained animated SVG profile; --time N emits deterministic preview frames.
Only standard-library Python is needed. Motion is CSS, with no script in SVGs.
"""
from pathlib import Path
from html import escape
import math, argparse
ROOT=Path(__file__).resolve().parents[1]
BG='#070b18'; PANEL='#10172b'; LINE='#273650'; WHITE='#eef5ff'; MUTED='#aabbd5'
ELECTRIC='#438cff'; PINK='#ff69c8'; ICE='#91b5ff'; YELLOW='#ffe46b'
T=None

def txt(x,y,v,s=18,c=WHITE,w=400,extra=''):
 return f'<text x="{x}" y="{y}" fill="{c}" font-size="{s}" font-weight="{w}" {extra}>{escape(v)}</text>'
def rect(x,y,w,h,c=PANEL,r=10,stroke='none',extra=''):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}" stroke="{stroke}" {extra}/>'
def line(x,y,xx,yy,c=LINE,sw=1,extra=''):
 return f'<path d="M{x} {y} L{xx} {yy}" fill="none" stroke="{c}" stroke-width="{sw}" {extra}/>'
def circ(x,y,r,c,stroke='none',extra=''):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{stroke}" {extra}/>'
def path(d,c,sw=1,extra=''):
 return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{sw}" {extra}/>'
def group(body,x=0,y=0,scale=1):
 return f'<g transform="translate({x} {y}) scale({scale})">{body}</g>'
def rot(body,dur=24,direction=1,phase=0):
 if T is not None: return f'<g transform="rotate({direction*360*(T+phase)/dur})">{body}</g>'
 name='spin' if direction==1 else 'reverse'
 return f'<g class="motion" style="animation:{name} {dur}s linear infinite;animation-delay:-{phase}s">{body}</g>'
def pulse(body,dur=4,phase=0):
 if T is not None:
  opacity=.35+.65*(1-math.cos(2*math.pi*(T+phase)/dur))/2
  return f'<g opacity="{opacity:.3f}">{body}</g>'
 return f'<g class="motion" style="animation:pulse {dur}s ease-in-out infinite;animation-delay:-{phase}s">{body}</g>'
def travel(body,dx,dy,dur=4,phase=0):
 if T is not None:
  t=((T+phase)%dur)/dur
  return f'<g transform="translate({dx*t} {dy*t})" opacity="{min(1,t*8,(1-t)*8):.3f}">{body}</g>'
 return f'<g class="motion" style="--tx:{dx}px;--ty:{dy}px;animation:travel {dur}s linear infinite;animation-delay:-{phase}s">{body}</g>'
def draw(d,c,length=300,dur=6,phase=0,sw=2):
 if T is not None:
  p=((T+phase)%dur)/dur
  offset=length*(1-min(1,p/.65))
  return path(d,c,sw, f'stroke-dasharray="{length}" stroke-dashoffset="{offset}"')
 return path(d,c,sw,f'class="motion draw" stroke-dasharray="{length}" style="--length:{length};animation:draw {dur}s ease-in-out infinite;animation-delay:-{phase}s"')
def shell(w,h,title,body):
 css='''text{font-family:Arial,Helvetica,sans-serif}.mono{font-family:monospace;letter-spacing:1.7px}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes reverse{to{transform:rotate(-360deg)}}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes travel{0%{transform:translate(0,0);opacity:0}12%,88%{opacity:1}100%{transform:translate(var(--tx),var(--ty));opacity:0}}
@keyframes draw{0%{stroke-dashoffset:var(--length)}65%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:var(--length)}}
@media(prefers-reduced-motion:reduce){.motion{animation:none!important;opacity:1!important;stroke-dashoffset:0!important}}'''
 return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title"><title id="title">{escape(title)}</title><defs>
<radialGradient id="glow"><stop stop-color="#183c87" stop-opacity=".8"/><stop offset="1" stop-color="{BG}" stop-opacity="0"/></radialGradient>
<linearGradient id="spectrum"><stop stop-color="{ELECTRIC}"/><stop offset=".5" stop-color="{PINK}"/><stop offset="1" stop-color="{ICE}"/></linearGradient>
<linearGradient id="fade"><stop stop-color="{ELECTRIC}" stop-opacity="0"/><stop offset="1" stop-color="{ELECTRIC}" stop-opacity=".8"/></linearGradient>
<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#25354b" stroke-width=".5"/></pattern>
</defs><style>{css}</style>{rect(1,1,w-2,h-2,BG,24,LINE)}{body}</svg>'''

def orb():
 b=circ(0,0,200,'url(#glow)')
 b+=circ(0,0,142,'none',LINE)+circ(0,0,118,'none','#31528b')
 # Wire sphere; the independent tilted meridians imply depth.
 mesh=''
 for width in [22,55,87,113]:
  mesh+=f'<ellipse cx="0" cy="0" rx="{width}" ry="118" fill="none" stroke="{ELECTRIC}" opacity=".18"/>'
 for yy in [-78,-40,0,40,78]:
  rx=math.sqrt(118**2-yy**2)
  mesh+=f'<ellipse cx="0" cy="{yy}" rx="{rx:.2f}" ry="{rx*.23:.2f}" fill="none" stroke="{PINK}" opacity=".27"/>'
 b+=rot(mesh,48)
 for angle,c,dur,direction in [(22,ELECTRIC,12,1),(-40,PINK,18,-1),(80,YELLOW,24,1)]:
  ring=f'<ellipse cx="0" cy="0" rx="158" ry="57" fill="none" stroke="{c}" opacity=".45"/>'
  # Transform a circular orbit into an elliptical one; particle follows the same orbit.
  electron=rot(circ(158,0,5,c)+circ(158,0,12,'none',c,extra='opacity=".3"'),dur,direction)
  ring+=f'<g transform="scale(1 .36)">{electron}</g>'
  b+=f'<g transform="rotate({angle})">{ring}</g>'
 for a in range(0,360,10):
  q=math.radians(a);r1=171;r2=177 if a%30==0 else 174
  b+=line(round(r1*math.cos(q),2),round(r1*math.sin(q),2),round(r2*math.cos(q),2),round(r2*math.sin(q),2),MUTED,.7,extra='opacity=".45"')
 b+=pulse(circ(0,0,28,'none',ELECTRIC,extra='stroke-width=".8"'),6)
 b+=circ(0,0,20,BG)+txt(-10,5,'AB',12,WHITE,700,'class="mono"')
 return b

def hero(mobile=False):
 w,h=(440,700) if mobile else (1000,510)
 x=28 if mobile else 42
 b=rect(16,16,w-32,h-32,'url(#grid)',16,extra='opacity=".3"')
 b+=rect(x,29,36,27,ELECTRIC,7)+txt(x+7,48,'AB',13,BG,700)
 b+=txt(x+51,48,'APPLIED AI / ENGINEERING',11,MUTED,500,'class="mono"')
 if mobile:
  b+=txt(x,112,'ANAS',53,WHITE,700)+txt(x,173,'BAKKOURY',53,WHITE,700)
  b+=txt(x,216,'Build with curiosity.',22,ELECTRIC,500)+txt(x,246,'Measure with rigor.',22,ELECTRIC,500)
  b+=group(orb(),220,435,.87)
  b+=txt(x,627,'M.Sc. AI & Machine Learning',17,WHITE,700)+txt(x,655,'TU Darmstadt · Germany',16,MUTED)
  b+=line(x,589,w-x,589)
 else:
  b+=txt(799,48,'DARMSTADT, DE',11,MUTED,500,'class="mono"')
  b+=txt(x,143,'ANAS',70,WHITE,700)+txt(x,220,'BAKKOURY',70,WHITE,700)
  b+=txt(x,268,'Build with curiosity.',29,ELECTRIC,500)+txt(x,306,'Measure with rigor.',29,ELECTRIC,500)
  b+=txt(x,349,'AI applications · LLM evaluation · Time series',17,MUTED)
  b+=group(orb(),777,239,1)
  b+=txt(666,436,'DATA → MODELS → EVIDENCE',11,MUTED,500,'class="mono"')
  b+=line(x,390,554,390)
  b+=txt(x,426,'M.Sc. AI & Machine Learning',19,WHITE,700)+txt(x,457,'TU Darmstadt · Germany',17,MUTED)
 b+=rect(x,h-15,w-x*2,2,'url(#spectrum)',1)
 return shell(w,h,'Anas Bakkoury — Build with curiosity. Measure with rigor.',b)

PROJECTS=[
 ('factoryguard','01 / INDUSTRIAL ML','FactoryGuard',['Bearing signals.','Clearer investigations.'],'Python / Time series / Model evaluation',ELECTRIC,'EXPLORE PROJECT'),
 ('defendly','02 / AI APPLICATIONS','Defendly',['From a CV to focused,','adaptive interview practice.'],'FastAPI / React / TypeScript',PINK,'EXPLORE PROJECT'),
 ('graph-recovery','03 / BACHELOR THESIS','LLM Graph Recovery',['Prompt strategies.','Measurable graph recovery.'],'Python / Ollama / Graph evaluation',ICE,'READ RESEARCH'),
 ('privacy','04 / LLM EVALUATION','Adversarial Privacy',['Probe the model.','Measure the leakage.'],'Python / Ollama / Reproducibility',YELLOW,'EXPLORE FRAMEWORK')]

def bearing(c):
 b=txt(0,10,'SIGNAL INVESTIGATION',10,MUTED,500,'class="mono"')
 for r in [63,44,21]: b+=circ(80,102,r,'none',c,extra='stroke-width="1.5"')
 rollers=''
 for a in range(0,360,45):
  q=math.radians(a); rollers+=circ(53*math.cos(q),53*math.sin(q),7,BG,c)
 b+=group(rot(rollers,12),80,102)
 b+=rect(163,40,155,123,'#0c1426',9,LINE)
 for yy in [70,100,130]: b+=line(176,yy,305,yy,LINE,.7)
 d='M176 105 L185 101 L195 110 L204 76 L213 137 L223 64 L234 118 L243 88 L254 109 L264 93 L274 104 L285 97 L303 103'
 b+=path(d,c,1,extra='opacity=".22"')+draw(d,c,320,6,0,2)
 b+=travel(line(178,52,178,150,c,1.2)+rect(166,52,12,98,'url(#fade)',0),126,0,6)
 b+=txt(175,187,'ILLUSTRATIVE TRACE',8,MUTED,400,'class="mono"')
 return b

def interview(c):
 b=txt(0,10,'EXTRACT → PRACTICE → REVIEW',10,MUTED,500,'class="mono"')
 b+=rect(0,38,98,136,'#0c1426',12,LINE)
 b+=txt(14,64,'CV',16,c,700)
 for i,ww in enumerate([66,54,62,40]): b+=rect(14,81+i*18,ww,3,LINE,1)
 for i in range(3): b+=travel(circ(108,105+i*6,2,c),53,0,3,i)
 b+=rect(173,38,145,58,'#231329',12,c)
 for i,ww in enumerate([112,81]):
  b+=draw(f'M187 {58+i*16}h{ww}',c,112,6,i*.6,3)
 b+=rect(155,112,163,62,'#0c1426',12,LINE)
 for i,ww in enumerate([124,93]): b+=draw(f'M171 {133+i*16}h{ww}',MUTED,124,6,3+i*.6,3)
 b+=txt(0,204,'ADAPTIVE PRACTICE / SCHEMATIC',8,MUTED,400,'class="mono"')
 return b

def graph(c):
 b=txt(0,10,'PROPOSE → COMPARE → EVALUATE',10,MUTED,500,'class="mono"')
 pts=[(22,99),(82,47),(83,157),(150,87),(182,160)]
 for k,(i,j) in enumerate([(0,1),(0,2),(1,3),(2,3),(3,4)]):
  a,z=pts[i],pts[j];d=f'M{a[0]} {a[1]}L{z[0]} {z[1]}'
  b+=path(d,LINE,1.5)+draw(d,c,150,6,k*.6,1.8)
 for x,y in pts: b+=circ(x,y,10,BG,c)+pulse(circ(x,y,3,c),4,x/60)
 b+=line(211,44,211,176,LINE)
 for i in range(4):
  for j in range(4):
   block=rect(235+j*21,57+i*25,13,13,c if (i,j) in [(0,1),(1,3),(2,0),(3,2)] else LINE,3)
   b+=pulse(block,6,(i+j)*.6) if (i+j)%2 else block
 b+=txt(230,178,'MATRIX',9,MUTED,400,'class="mono"')
 b+=txt(0,204,'CONCEPT DIAGRAM / NOT A RESULT',8,MUTED,400,'class="mono"')
 return b

def privacy(c):
 b=txt(0,10,'ATTACK → OUTPUT → INSPECT',10,MUTED,500,'class="mono"')
 for i in range(3):
  yy=62+i*37
  b+=line(0,yy,98,yy,LINE)
  b+=travel(rect(0,yy-3,14,6,c,2),93,0,4,i*1.2)
 b+=path('M117 42L158 25L199 42V91Q198 131 158 153Q118 131 117 91Z',c,1.8)
 b+=rect(142,75,32,30,'#19233b',5,c)+path('M148 75V63a10 10 0 0 1 20 0V75',c,2)
 b+=pulse(circ(158,89,3,c),4)
 b+=line(205,96,233,96,LINE)
 for i in range(4):
  b+=rect(242,44+i*28,74,12,LINE,3)
  b+=pulse(rect(242,44+i*28,45 if i%2 else 62,12,c,3),6,i)
 b+=txt(0,204,'LEAKAGE EVALUATION / SCHEMATIC',8,MUTED,400,'class="mono"')
 return b
ART={'factoryguard':bearing,'defendly':interview,'graph-recovery':graph,'privacy':privacy}
def card(p,mobile=False):
 key,label,title,copy,stack,c,cta=p
 w,h=(440,490) if mobile else (1000,300)
 x=28 if mobile else 36
 b=txt(x,38,label,11,c,600,'class="mono"')
 b+=txt(x,86,title,31 if mobile else 39,WHITE,700)
 if mobile:
  b+=txt(x,121,copy[0],19,MUTED)+txt(x,149,copy[1],19,MUTED)
  b+=group(ART[key](c),59,181,1)
  b+=line(x,417,w-x,417)
  b+=txt(x,440,stack,12,MUTED)+txt(x,470,cta+' ↗',11,c,600,'class="mono"')
 else:
  b+=txt(x,130,copy[0],23,MUTED)+txt(x,162,copy[1],23,MUTED)
  b+=txt(x,218,stack,14,MUTED)
  b+=txt(x,266,cta+' ↗',11,c,600,'class="mono"')
  b+=line(607,34,607,266,LINE)
  b+=group(ART[key](c),650,48)
 b+=rect(x,13,50,2,c,1)
 return shell(w,h,title+' — '+ ' '.join(copy),b)

def build(out,time=None):
 global T
 T=time;out.mkdir(exist_ok=True,parents=True)
 for mobile in [False,True]:
  suf='-mobile' if mobile else ''
  (out/f'hero{suf}.svg').write_text(hero(mobile))
  for p in PROJECTS:(out/f'{p[0]}{suf}.svg').write_text(card(p,mobile))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--time',type=float);p.add_argument('--out',type=Path,default=ROOT/'assets');a=p.parse_args()
 build(a.out,a.time)
 print('Generated 10 self-contained SVGs.'+(' Motion enabled.' if a.time is None else f' Frame t={a.time}.'))
