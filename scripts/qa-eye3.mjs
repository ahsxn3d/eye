import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url().slice(0,110))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(30000);
await p.evaluate(()=>[...document.querySelectorAll('button')].find(x=>/explore manually/i.test(x.textContent))?.click());await W(3000);
await p.evaluate(()=>document.querySelector('[data-collapse-target="data-panel"]')?.click());await W(2500);
const ids=await p.evaluate(()=>[...document.querySelectorAll('[data-layer-id]')].map(e=>e.dataset.layerId));
console.log('panelOpen',await p.evaluate(()=>!document.getElementById('data-panel').classList.contains('collapsed')),'ids',ids.join(','));
await p.screenshot({path:'/workspace/eye-qa2/layers-panel.png'});
for(const id of ['satellites','earthquakes','local-firms','flights','weather-radar']){
 errs.push('--- '+id);
 const ok=await p.evaluate(id=>{const e=document.querySelector(`[data-layer-id="${id}"]`);if(!e)return 'missing';(e.querySelector('input,button')||e).click();return 'clicked'},id);
 errs.push(ok);await W(20000);await p.screenshot({path:`/workspace/eye-qa2/layer-${id}.png`});
 errs.push(await p.evaluate(id=>document.querySelector(`[data-layer-id="${id}"]`)?.textContent.replace(/\s+/g,' ').slice(0,90),id));
}
console.log(errs.join('\n'));await b.close();
