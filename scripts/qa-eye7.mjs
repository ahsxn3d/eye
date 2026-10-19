import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',protocolTimeout:120000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded'});await W(26000);
await p.screenshot({path:'/workspace/eye-qa4/compare-eye.png'});
await p.click('[data-toggle="flights"]');await W(10000);
await p.click('[data-tab="space"]');await W(500);await p.click('[data-toggle="satellites"]');await W(10000);
await p.screenshot({path:'/workspace/eye-qa4/eye-layers-on.png'});
const hits=await p.evaluate(()=>{const v=window.__anorixViewer;const R=v.scene.canvas.getBoundingClientRect();const out={};let picks=0;const cols=[];const walk=(c)=>{if(!c)return;if(/BillboardCollection|PointPrimitiveCollection/.test(c.constructor?.name))cols.push(c);else if(c.length!==undefined&&c.get)for(let i=0;i<c.length;i++)walk(c.get(i));};walk(v.scene.primitives);
 for(const col of cols){let tries=0;for(let i=0;i<col.length&&tries<6;i+=Math.max(1,Math.floor(col.length/40))){const it=col.get(i);if(!it.show)continue;const c=v.scene.cartesianToCanvasCoordinates(it.position);if(!c)continue;const x=c.x+R.left,y=c.y+R.top;if(x<80||x>1180||y<90||y>700)continue;tries++;if(picks++>60)break;if(!v.scene.pick(c))continue;const k=col.constructor.name;if(!out[k]){out[k]={x,y};break;}}}return out});
console.log(JSON.stringify(hits));
let i=0;for(const [k,h] of Object.entries(hits).sort((a)=>a[0].startsWith('Bill')?-1:1)){await p.mouse.click(h.x,h.y);await W(2500);
 console.log(k,'=>',await p.evaluate(()=>document.querySelector('.ax-panel').dataset.view+' | '+document.querySelector('.ax-panel').textContent.replace(/\s+/g,' ').slice(0,140)));
 await p.screenshot({path:`/workspace/eye-qa4/card-${k}.png`});await p.click('[data-back]').catch(()=>{});await W(800);}
await p.click('.ax-theme');await W(2000);await p.screenshot({path:'/workspace/eye-qa4/compare-eye-light.png'});
await p.setViewport({width:390,height:844});await W(3000);await p.screenshot({path:'/workspace/eye-qa4/eye-mobile.png'});
console.log([...new Set(errs)].slice(0,12).join('\n'));await b.close();
