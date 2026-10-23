const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const results=[];
 try {
  const page=await browser.newPage();
  await page.route('**/api/v1/public/catalog',r=>r.fulfill({json:{data:require('./public-catalog-fixture.cjs')}}));
  await page.route('**/accounts.google.com/gsi/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  for(const [width,height] of [[1440,900],[390,844]]) {
   await page.setViewportSize({width,height});
   await page.goto(process.env.PUBLIC_UI_URL||'http://127.0.0.1:5173');
   await page.locator('.fit-sport-stack-track.is-enhanced').waitFor();
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.fit-sport-stack img')].map(img=>{img.loading='eager';return img.decode();}));});
   const layout=await page.locator('.fit-sport-stack-track').evaluate(el=>({
    start:el.getBoundingClientRect().top+scrollY-108,
    step:Number(el.style.getPropertyValue('--stack-step'))
   }));
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),layout.start);
   await page.waitForTimeout(800);
   const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   const sample=await page.evaluate(async({start,step})=>{
    const intervals=[];
    let mutations=0,longTasks=0;
    const observer=new MutationObserver(records=>mutations+=records.length);
    observer.observe(document.querySelector('.fit-sport-stack'),{attributes:true,subtree:true});
    const tasks=new PerformanceObserver(list=>longTasks+=list.getEntries().length);
    tasks.observe({type:'longtask'});
    await new Promise(resolve=>{
     let began,last;
     const tick=now=>{
      if(began===undefined) began=now;
      if(last!==undefined) intervals.push(now-last);
      last=now;
      const elapsed=now-began;
      const phase=Math.min(1,elapsed/5000);
      const progress=phase<.5?phase*2:(1-phase)*2;
      scrollTo({top:start+progress*step*3,behavior:'instant'});
      if(phase<1) requestAnimationFrame(tick); else resolve();
     };
     requestAnimationFrame(tick);
    });
    observer.disconnect();tasks.disconnect();
    const sorted=[...intervals].sort((a,b)=>a-b);
    return {frames:intervals.length,fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),p95FrameMs:sorted[Math.floor(sorted.length*.95)],framesOver25ms:intervals.filter(t=>t>25).length,mutations,longTasks};
   },layout);
   const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   const work={};
   for(const metric of ['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration']) work[metric]=Number((after[metric]-before[metric]).toFixed(4));
   results.push({width,height,...sample,...work});
   console.log(JSON.stringify(results.at(-1)));
   if(process.env.STACK_PERF_CHECK==='1') {
    assert.ok(sample.fps>=60,'headless rAF throughput must meet the 60 FPS target');
    assert.ok(sample.p95FrameMs<=1000/60,'p95 interval must stay within the 16.7ms frame budget');
   }
  }
  if(process.env.STACK_PERF_OUTPUT) fs.writeFileSync(process.env.STACK_PERF_OUTPUT,JSON.stringify({browser:browser.version(),durationSeconds:5,results},null,2)+'\n');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
