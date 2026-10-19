import puppeteer from 'puppeteer';
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,200)));
await p.goto('http://127.0.0.1:3017/',{waitUntil:'domcontentloaded',timeout:60000});
await new Promise(r=>setTimeout(r,+process.argv[3]||35000));
await p.screenshot({path:'/workspace/eye-qa2/'+process.argv[2]+'.png'});
const sc=await p.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,ov:getComputedStyle(document.body).overflow}));
console.log(JSON.stringify(sc));console.log(errs.slice(0,25).join('\n'));await b.close();
