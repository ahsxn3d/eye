import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'||/Anorix/.test(m.text()))errs.push(m.text().slice(0,160))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(30000);
await p.evaluate(()=>document.querySelector('[data-collapse-target="data-panel"]')?.click());await W(1500);
for(const id of ['earthquakes','flights','satellites']){await p.evaluate(id=>{const e=document.querySelector(`[data-layer-id="${id}"]`);(e.querySelector('input,button')||e).click()},id);await W(12000);}
await W(8000);await p.screenshot({path:'/workspace/eye-qa3/far-centered.png'});
console.log('far',await p.evaluate(()=>document.body.classList.contains('anorix-far')));
// click an earthquake entity
const r=await p.evaluate(()=>{const v=window.__anorixViewer;const t=v.clock.currentTime;const all=[...v.entities.values];for(let i=0;i<v.dataSources.length;i++)all.push(...v.dataSources.get(i).entities.values);
 for(const e of all){const pos=e.position?.getValue?.(t);if(!pos||!e.show)continue;const c=v.scene.cartesianToCanvasCoordinates(pos);if(!c||c.x<450||c.x>1500||c.y<100||c.y>800)continue;const pk=v.scene.pick(c);if(pk&&(pk.id===e))return{x:c.x,y:c.y,name:e.name};}return {n:all.length}});
console.log(JSON.stringify(r));
if(r.x){await p.mouse.click(r.x,r.y);await W(2500);}
console.log('card',await p.evaluate(()=>{const c=document.getElementById('anorix-card');return c.hidden?'hidden':c.textContent.replace(/\s+/g,' ').slice(0,200)}));
await p.screenshot({path:'/workspace/eye-qa3/details-card.png'});
console.log(errs.slice(0,15).join('\n'));await b.close();
