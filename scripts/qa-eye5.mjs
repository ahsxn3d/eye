import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'||/Anorix/.test(m.text()))errs.push(m.text().slice(0,160))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(28000);
await p.screenshot({path:'/workspace/eye-qa3/start.png'});
await p.evaluate(()=>document.querySelector('[data-collapse-target="data-panel"]')?.click());
await p.evaluate(()=>{const e=document.querySelector('[data-layer-id="earthquakes"]');(e.querySelector('input,button')||e).click()});await W(12000);
const r=await p.evaluate(()=>{const v=window.__anorixViewer;const t=v.clock.currentTime;const all=[...v.entities.values];for(let i=0;i<v.dataSources.length;i++)all.push(...v.dataSources.get(i).entities.values);
 for(const e of all){const pos=e.position?.getValue?.(t);if(!pos)continue;const c=v.scene.cartesianToCanvasCoordinates(pos);if(!c||c.x<300||c.x>1300||c.y<100||c.y>800)continue;const pk=v.scene.pick(c);if(pk&&pk.id===e){const R=v.scene.canvas.getBoundingClientRect();return{x:c.x+R.left,y:c.y+R.top,name:e.name}}}return {n:all.length}});
console.log(JSON.stringify(r));
if(r.x){await p.mouse.move(r.x,r.y);await W(800);await p.mouse.click(r.x,r.y);await W(2000);}
console.log('card',await p.evaluate(()=>{const c=document.getElementById('anorix-card');return c.hidden?'hidden':c.textContent.replace(/\s+/g,' ').slice(0,200)}));
await p.screenshot({path:'/workspace/eye-qa3/details-card.png'});
console.log(errs.slice(0,12).join('\n'));await b.close();
