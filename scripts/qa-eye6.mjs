import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:120000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(28000);
await p.screenshot({path:'/workspace/eye-qa4/compare-eye.png'});
await p.evaluate(()=>document.querySelector('[data-collapse-target="data-panel"]')?.click());
for(const id of ['flights','satellites','ais-live-vessels']){await p.evaluate(id=>{const e=document.querySelector(`[data-layer-id="${id}"]`);(e.querySelector('input,button')||e).click()},id);await W(9000);}
await W(6000);await p.screenshot({path:'/workspace/eye-qa4/glyphs-far.png'});
const hits=await p.evaluate(()=>{const v=window.__anorixViewer;const R=v.scene.canvas.getBoundingClientRect();const out={};let picks=0;
 const cols=[];const walk=(c)=>{if(!c)return;if(c.constructor?.name?.match(/BillboardCollection|PointPrimitiveCollection/))cols.push(c);if(c.length!==undefined&&c.get&&!c.constructor.name.match(/Billboard|Point/))for(let i=0;i<c.length;i++)walk(c.get(i));};walk(v.scene.primitives);
 for(const col of cols){let tries=0;for(let i=0;i<col.length&&tries<6;i+=Math.max(1,Math.floor(col.length/40))){const it=col.get(i);if(!it.show)continue;const c=v.scene.cartesianToCanvasCoordinates(it.position);if(!c||c.x<60||c.x>R.width-420||c.y<60||c.y>R.height-120)continue;tries++;if(picks++>60)break;const pk=v.scene.pick(c);if(!pk)continue;
  const raw=typeof pk.id==='string'?pk.id:(pk.primitive?.id??pk.id);const key=col.constructor.name+':'+String(raw?.id??raw).slice(0,3);if(!out[key]){out[key]={x:c.x+R.left,y:c.y+R.top,raw:String(raw?.name??raw?.id??raw).slice(0,40)};break;}}}
 return out});
console.log(JSON.stringify(hits));
let i=0;for(const [k,h] of Object.entries(hits).sort((a,b)=>a[0].startsWith('Bill')?-1:1).slice(0,4)){await p.mouse.click(h.x,h.y);await W(2500);
 const c=await p.evaluate(()=>{const c=document.getElementById('anorix-card');return c.hidden?'hidden':c.textContent.replace(/\s+/g,' ').slice(0,150)});
 console.log(k,'=>',c);await p.screenshot({path:`/workspace/eye-qa4/card-${i++}.png`});await p.keyboard.press('Escape');await W(1500);}
await p.evaluate(()=>document.getElementById('anorix-theme').click());await W(2500);await p.screenshot({path:'/workspace/eye-qa4/compare-eye-light.png'});
console.log([...new Set(errs)].slice(0,12).join('\n'));await b.close();
