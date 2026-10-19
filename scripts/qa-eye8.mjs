import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:120000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(25000);
// search autocomplete
await p.click('.ax-search input');await p.keyboard.type('Shahodi Garhi',{delay:40});await W(4000);
console.log('suggest:',await p.evaluate(()=>[...document.querySelectorAll('.ax-suggest li')].map(l=>l.textContent).slice(0,3).join(' | ')));
await p.screenshot({path:'/workspace/eye-qa5/search-autocomplete.png'});
await p.keyboard.press('Enter');await W(6000);await p.screenshot({path:'/workspace/eye-qa5/search-flew.png'});
await p.evaluate(()=>window.__anorixViewer.camera.setView({destination:window.Cesium?undefined:undefined}));
await p.click('[data-go="earth"]');await W(4000);
// light mode
await p.click('.ax-theme');await W(1500);
console.log('theme:',await p.evaluate(()=>document.documentElement.dataset.theme+' panelBg='+getComputedStyle(document.querySelector('.ax-panel')).backgroundColor));
await p.screenshot({path:'/workspace/eye-qa5/light-mode.png'});await p.click('.ax-theme');await W(800);
// sources credit
await p.click('[data-view="sources"]');await W(800);await p.screenshot({path:'/workspace/eye-qa5/sources-credit.png'});await p.click('[data-view="layers"]');
// satellite card
await p.click('[data-tab="space"]');await p.click('[data-toggle="satellites"]');await W(12000);
const pt=await p.evaluate(()=>{const v=window.__anorixViewer;const R=v.scene.canvas.getBoundingClientRect();const cols=[];const walk=c=>{if(!c)return;if(/PointPrimitiveCollection/.test(c.constructor?.name))cols.push(c);else if(c.length!==undefined&&c.get)for(let i=0;i<c.length;i++)walk(c.get(i));};walk(v.scene.primitives);
 for(const col of cols)for(let i=0;i<col.length;i+=7){const it=col.get(i);if(!it.show)continue;const c=v.scene.cartesianToCanvasCoordinates(it.position);if(!c)continue;const x=c.x+R.left,y=c.y+R.top;if(x<100||x>1150||y<100||y>700)continue;if(v.scene.pick(c))return{x,y};}return null});
if(pt){await p.mouse.click(pt.x,pt.y);await W(3000);}
console.log('sat:',await p.evaluate(()=>document.querySelector('.ax-panel').dataset.view+' | '+document.querySelector('.ax-title').textContent+' | '+document.querySelector('.ax-eyebrow').textContent));
await p.screenshot({path:'/workspace/eye-qa5/satellite-card.png'});
await p.keyboard.press('Escape');await p.click('[data-toggle="satellites"]').catch(()=>{});
// flight close tracking
await p.click('[data-tab="air"]');await p.click('[data-toggle="flights"]');await W(12000);
const fp=await p.evaluate(()=>{const v=window.__anorixViewer;const R=v.scene.canvas.getBoundingClientRect();const cols=[];const walk=c=>{if(!c)return;if(/BillboardCollection/.test(c.constructor?.name))cols.push(c);else if(c.length!==undefined&&c.get)for(let i=0;i<c.length;i++)walk(c.get(i));};walk(v.scene.primitives);
 for(const col of cols)for(let i=0;i<col.length;i+=5){const it=col.get(i);if(!it.show)continue;const c=v.scene.cartesianToCanvasCoordinates(it.position);if(!c)continue;const x=c.x+R.left,y=c.y+R.top;if(x<100||x>1150||y<100||y>700)continue;if(v.scene.pick(c))return{x,y};}return null});
if(fp){await p.mouse.click(fp.x,fp.y);await W(20000);}
console.log('flight:',await p.evaluate(()=>{const v=window.__anorixViewer;return document.querySelector('.ax-title').textContent+' h='+Math.round(v.camera.positionCartographic.height)+' globe='+v.scene.globe.show+' tiles='+v.scene.globe.tilesLoaded+' fog='+v.scene.fog.enabled+' style='+document.body.className.slice(0,120)}));
await p.screenshot({path:'/workspace/eye-qa5/flight-tracking.png'});
console.log([...new Set(errs)].slice(0,10).join('\n'));await b.close();
