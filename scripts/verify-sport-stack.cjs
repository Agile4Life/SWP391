const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/v1/public/catalog',r=>r.fulfill({json:{data:require('./public-catalog-fixture.cjs')}}));
  await page.route('**/accounts.google.com/gsi/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await page.goto(process.env.PUBLIC_UI_URL||'http://127.0.0.1:5173');
  const scroll=async y=>{
   await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
   await page.waitForTimeout(100);
  };
  for(const theme of ['light','dark']) for(const [width,height] of [[390,844],[768,650],[1440,650],[1920,900],[2560,1000]]) {
   await page.evaluate(t=>localStorage.setItem('scms_theme',t),theme);
   await page.setViewportSize({width,height});
   await page.reload();
   await page.locator('.fit-sport-stack-track.is-enhanced').waitFor();
   await page.evaluate(()=>document.fonts.ready);
   await scroll(0);
   await page.waitForTimeout(400);
   const cards=page.locator('.fit-sport-stack-card');
   assert.equal(await cards.count(),4);
   assert.equal(await page.locator('.fit-sport-stack button').count(),0);
   const layout=await page.locator('.fit-sport-stack-track').evaluate(el=>({
    y:el.getBoundingClientRect().top+scrollY,
    step:Number(el.style.getPropertyValue('--stack-step')),
    top:parseFloat(el.querySelector('.fit-sport-stack-deck').style.getPropertyValue('--stack-top'))
   }));
   const origin=layout.y-layout.top;
   const active=page.locator('.fit-sport-stack-card[data-depth="0"]');
   for(let i=0;i<3;i++) {
    await scroll(origin+layout.step*i+2);
    const resting=await cards.nth(i).evaluate(el=>el.style.transform);
    const deckBox=await page.locator('.fit-sport-stack-deck').boundingBox();
    await page.mouse.move(deckBox.x+20,deckBox.y+20);
    await page.mouse.wheel(0,20);
    await page.waitForTimeout(100);
    assert.notEqual(await cards.nth(i).evaluate(el=>el.style.transform),resting,'one small wheel movement immediately moves the card');
    const forward=await cards.nth(i).evaluate(el=>el.style.transform);
    await page.mouse.wheel(0,-10);
    await page.waitForTimeout(100);
    assert.notEqual(await cards.nth(i).evaluate(el=>el.style.transform),forward,'small reverse wheel movement immediately reverses motion');
    await scroll(origin+layout.step*(i+.35));
    const before=await cards.nth(i).evaluate(el=>getComputedStyle(el).transform);
    await scroll(origin+layout.step*(i+.64));
    const leaving=cards.nth(i);
    const stage=await page.locator('.fit-sport-stack-deck').boundingBox();
    assert.ok(Math.abs(stage.y-layout.top)<2,'deck remains visible and sticky throughout cycling');
    assert.equal(await leaving.evaluate(el=>el.classList.contains('is-leaving')),true);
    const moving=await leaving.evaluate(el=>({transform:getComputedStyle(el).transform}));
    assert.notEqual(moving.transform,before,'card lifts and tilts while scrolling');
    assert.equal(await leaving.evaluate(el=>getComputedStyle(el).animationName),'none','motion uses compositor transforms instead of CSS animation seeking');
    await scroll(origin+layout.step*(i+1)+2);
    assert.equal(await active.getAttribute('data-sport'),['tennis','badminton','basketball'][i]);
    assert.equal(await cards.nth(i).getAttribute('data-depth'),'3','previous card goes behind');
    await scroll(origin+layout.step*(i+.64));
    assert.equal(await cards.nth(i).evaluate(el=>el.classList.contains('is-leaving')),true,'reverse scroll restores same motion');
   }
   await scroll(origin+layout.step*3+2);
   assert.equal(await page.locator('.fit-sport-stack [inert]').count(),3);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
   const bounds=await active.boundingBox();
   assert.ok(bounds.y>=107 && bounds.y+bounds.height<=height-23,'entire card stays below header and inside viewport');
   await active.locator('.fit-sport-stack-content').evaluate(el=>el.scrollTop=el.scrollHeight);
   const footer=await active.locator('.fit-sport-stack-footer').boundingBox();
   assert.ok(footer.y>=108 && footer.y+footer.height<=height-23,'long card footer is accessible');
   await scroll(origin+layout.step*3+2);
   const held=await page.locator('.fit-sport-stack-deck').boundingBox();
   assert.ok(Math.abs(held.y-layout.top)<2,'final card is visible when its transition completes');
   await page.mouse.move(bounds.x+20,bounds.y+20);
   await page.mouse.wheel(0,100);
   await page.waitForTimeout(150);
   const wheelHeld=await page.locator('.fit-sport-stack-deck').boundingBox();
   assert.ok(wheelHeld.y<held.y-20,'one wheel gesture releases the final card toward the next section');
   await scroll(origin+layout.step*3+120);
   const released=await page.locator('.fit-sport-stack-deck').boundingBox();
   assert.ok(released.y<layout.top-20,'deck releases after final reading interval');
   console.log(`PASS send-back motion, reverse, footer, overflow: ${theme} ${width}x${height}px`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelectorAll('.fit-sport-stack [inert]').length===0);
  assert.equal(await page.locator('.fit-sport-stack [inert]').count(),0);
  assert.equal(await page.locator('.fit-sport-stack-card.is-leaving').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')),true);
  assert.equal(await page.locator('.fit-sport-stack-deck').evaluate(el=>getComputedStyle(el).position),'static');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('.fit-sport-stack-deck').evaluate(el=>getComputedStyle(el).position),'sticky');
  assert.deepEqual(errors,[]);
  console.log('PASS live reduced motion and no browser errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
