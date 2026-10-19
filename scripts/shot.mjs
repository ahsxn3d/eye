import puppeteer from 'puppeteer';
const [url,out,wait]=process.argv.slice(2);
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1600,height:900});
await p.goto(url,{waitUntil:'domcontentloaded'});await new Promise(r=>setTimeout(r,+wait));
await p.screenshot({path:out});
if(process.argv[5]==='light'){await p.evaluate(()=>{const t=[...document.querySelectorAll('button')].find(b=>/theme|light|dark/i.test(b.getAttribute('aria-label')||b.title||''));t?.click()});await new Promise(r=>setTimeout(r,4000));await p.screenshot({path:out.replace('.png','-light.png')});}
await b.close();
