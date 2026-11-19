
 // Laser Escape (Q12). Independent overlay: does not modify Lustre's DOM,
 // the Gleam evaluator, or the original drawing renderer.
let laserPaths = window.laserEscapePaths || [];

window.addEventListener("laser-paths-updated", (event) => {
  laserPaths = event.detail;
});

function getLaserPaths() {
  return laserPaths;
}
 const colors = { Red: '#ff496d', Pink: '#ff66d8', Blue: '#48a9ff', Green: '#5bffab', Purple: '#b47bff', Rainbow: 'rainbow' };
 const skins = {
   'Classic Noob': { head:'#ffdc35', body:'#2783ef', legs:'#56b34a', arms:'#ffdc35', hair:false },
   'Bacon Hair': { head:'#efb981', body:'#303b55', legs:'#202636', arms:'#efb981', hair:true },
   'Pink Avatar': { head:'#f6c6a6', body:'#ff79bd', legs:'#ad78e8', arms:'#f6c6a6', hair:false },
 };
 const $ = (id) => document.getElementById(id);
 const ui = document.createElement('section');
 ui.id = 'laser-escape-ui';
 ui.innerHTML = `<div class="laser-title">⚡ LASER ESCAPE <span id="laser-status">DRAWING MODE</span></div>
 <div class="laser-row"><label>Mode <select id="laser-mode"><option value="drawing">Drawing</option><option value="game">Laser Escape</option></select></label>
 <label>Avatar <select id="laser-avatar">${Object.keys(skins).map(x=>`<option>${x}</option>`).join('')}</select></label>
 <label>Lasers <select id="laser-color">${Object.keys(colors).map(x=>`<option>${x}</option>`).join('')}</select></label>
 <button id="laser-start" type="button">▶ Start Game</button><button id="laser-restart" type="button">↻ Restart</button></div>
 <div id="laser-stats">♥ ♥ ♥ · Time 0s · Score 0</div>
 <div class="laser-help">WASD / arrow keys to move · Collect 🛡 shield and ⚡ speed coil · Avoid the lines</div>`;
 document.body.appendChild(ui);
 const overlay = document.createElement('canvas');
 overlay.id = 'laser-game-overlay';
 overlay.setAttribute('aria-label','Laser Escape game canvas');
 document.body.appendChild(overlay);
 const g = overlay.getContext('2d');
 let active = false, player = { x:0, y:110 }, lives = 3, elapsed = 0, score = 0;
 let invulnerable = 1.5, shield = 0, boost = 0, finished = false, won = false;
 let collected = 0, prevTime = 0, lastScoreSecond = 0, powerups = [], laserSignature = '';
 const keys = new Set();
 let gameStarted = false;
 let countdown = 0;
 let countdownStart = 0;
 function ready() {
   reset();
   gameStarted = false;
   countdown = 0;
   keys.clear();
   $('laser-start').disabled = false;
   $('laser-start').textContent = '▶ Start Game';
 }
 function startGame() {
   reset();
   gameStarted = true;
   countdown = 3;
   countdownStart = performance.now();
   keys.clear();
   $('laser-start').disabled = true;
   $('laser-start').textContent = 'Playing...';
 }
 const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
 function reset() {
   player = { x:0, y:110 }; lives=3; elapsed=0; score=0;
   invulnerable=2; shield=0; boost=0; finished=false; won=false;
   collected=0; lastScoreSecond=0;
   powerups=[{x:-260,y:140,type:'shield',taken:false},{x:240,y:-120,type:'speed',taken:false}];
   laserSignature = '';
   prevTime=performance.now();
 }
 function toggle() {
   active=$('laser-mode').value==='game';
   overlay.style.display=active?'block':'none';
   $('laser-stats').style.display=active?'block':'none';
   $('laser-status').textContent=active?'GAME MODE':'DRAWING MODE';
   const original=$('animation-canvas');
   if(original) original.style.visibility=active?'hidden':'';
   if(active) ready();
   else keys.clear();
 }
 $('laser-mode').addEventListener('change',toggle);
 $('laser-restart').addEventListener('click',ready);
 $('laser-start').addEventListener('click',startGame);
 $('laser-stats').style.display='none';
 window.addEventListener('keydown',e=>{
   if(!active || e.target.closest('input, textarea, select, [contenteditable="true"], .cm-editor')) return;
   const key=e.key.toLowerCase();
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { keys.add(key); e.preventDefault(); }
 });
 window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
 window.addEventListener('blur',()=>keys.clear());
 function lineSegments(p, time) {
   if(time < p.start/10) return [];
   const pts=p.pts, count=pts.length/2;
   if(count<2) return [];
   const u=p.end<=p.start?1:clamp((time*10-p.start)/(p.end-p.start),0,1);
   const f=u*(count-1), k=Math.floor(f), segments=[];
   for(let i=0;i<k;i++) segments.push([pts[2*i],pts[2*i+1],pts[2*i+2],pts[2*i+3]]);
   if(k<count-1 && f-k>0) {
     const t=f-k, j=2*k;
     segments.push([pts[j],pts[j+1],pts[j]+(pts[j+2]-pts[j])*t,pts[j+1]+(pts[j+3]-pts[j+1])*t]);
   }
   return segments;
 }
 function distanceToSegment(px,py,x1,y1,x2,y2) {
   const dx=x2-x1,dy=y2-y1, len=dx*dx+dy*dy;
   const t=len?clamp(((px-x1)*dx+(py-y1)*dy)/len,0,1):0;
   return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
 }
 function drawAvatar() {
   const skin=skins[$('laser-avatar').value], x=player.x, y=player.y;
   g.save(); g.translate(x,y);
   if(invulnerable>0 && Math.floor(elapsed*9)%2===0) g.globalAlpha=.4;
   if(shield) {g.strokeStyle='#73eaff';g.lineWidth=4;g.beginPath();g.arc(0,0,37,0,Math.PI*2);g.stroke();}
   g.lineWidth=2;g.strokeStyle='#111827';
   const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);g.strokeRect(x,y,w,h);};
   rect(-12,8,11,18,skin.legs);rect(1,8,11,18,skin.legs);
   rect(-22,-15,9,25,skin.arms);rect(13,-15,9,25,skin.arms);
   rect(-13,-15,26,26,skin.body);rect(-11,-39,22,23,skin.head);
   if(skin.hair){g.fillStyle='#754326';g.fillRect(-13,-42,26,8);g.fillRect(-14,-36,6,16);}
   g.fillStyle='#151515';g.fillRect(-6,-31,2,3);g.fillRect(4,-31,2,3);
   g.beginPath();g.arc(0,-25,5,0,Math.PI);g.stroke();
   if(boost>0){g.fillStyle='#ffdf58';g.font='20px sans-serif';g.fillText('⚡',15,-30);}
   g.restore();
 }
 function drawPowerup(p) {
   if(p.taken)return;
   g.save();g.translate(p.x,p.y);g.fillStyle=p.type==='shield'?'#1d5c87':'#8b631b';
   g.strokeStyle=p.type==='shield'?'#64eaff':'#ffe278';g.lineWidth=3;
   g.beginPath();g.arc(0,0,20,0,Math.PI*2);g.fill();g.stroke();
   g.font='23px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(p.type==='shield'?'🛡':'⚡',0,1);g.restore();
 }
 function drawFrame(now) {
   requestAnimationFrame(drawFrame);
   if(!active)return;
   const original=$('animation-canvas');
   if(!original || !original.getBoundingClientRect().width)return;
   if(original.style.visibility!=='hidden')original.style.visibility='hidden';
   const rect = original.getBoundingClientRect();
const dpr = Math.min(devicePixelRatio || 1, 2);

// Leave room for the original Animator controls on the right.
// Find the original Animator controls on the right.
const controls = document.querySelector('select:not(#laser-mode):not(#laser-avatar):not(#laser-color)');

let gameWidth = rect.width;

if (controls) {
  const controlRect = controls.getBoundingClientRect();

  // Stop the game canvas before the control panel.
  gameWidth = Math.max(
    200,
    Math.min(rect.width, controlRect.left - rect.left - 35)
  );
}

overlay.style.left = rect.left + 'px';
overlay.style.top = rect.top + 'px';
overlay.style.width = gameWidth + 'px';
overlay.style.height = rect.height + 'px';

const w = Math.round(gameWidth * dpr);
const h = Math.round(rect.height * dpr);
   
   if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
   g.setTransform(w/1000,0,0,h/1000,w/2,h/2);
   g.fillStyle='#0c1223';g.fillRect(-500,-500,1000,1000);
   g.lineWidth=1;g.strokeStyle='#1d2942';
   for(let z=-500;z<=500;z+=100){g.beginPath();g.moveTo(z,-500);g.lineTo(z,500);g.moveTo(-500,z);g.lineTo(500,z);g.stroke();}
   const dt=clamp((now-prevTime)/1000,0,.05);prevTime=now;
   const paths=getLaserPaths();
   const signature=paths.length+':'+(paths[0]?.pts[0]??'')+':'+(paths[0]?.pts[2]??'');
   if(laserSignature && signature!==laserSignature)ready();
   laserSignature=signature;
   if(gameStarted && countdown>0) {
     countdown=Math.max(0,3-(now-countdownStart)/1000);
     if(countdown===0) prevTime=now;
   }
   if(!finished && gameStarted && countdown===0){
     elapsed+=dt; invulnerable=Math.max(0,invulnerable-dt);boost=Math.max(0,boost-dt);
     let dx=0,dy=0;
     if(keys.has('a')||keys.has('arrowleft'))dx--;
     if(keys.has('d')||keys.has('arrowright'))dx++;
     if(keys.has('w')||keys.has('arrowup'))dy--;
     if(keys.has('s')||keys.has('arrowdown'))dy++;
     const mag=Math.hypot(dx,dy)||1, speed=boost?360:210;
     player.x=clamp(player.x+dx/mag*speed*dt,-470,470);
     player.y=clamp(player.y+dy/mag*speed*dt,-455,470);
     for(const p of powerups)if(!p.taken&&Math.hypot(player.x-p.x,player.y-p.y)<40){
       p.taken=true;collected++;score+=75;
       if(p.type==='shield')shield=1;else boost=6;
     }
     if(Math.floor(elapsed)>lastScoreSecond){score+=10*(Math.floor(elapsed)-lastScoreSecond);lastScoreSecond=Math.floor(elapsed);}
   }
   const palette=colors[$('laser-color').value];
   let hit=false, maxEnd=0;
   for(let i=0;i<paths.length;i++){
     const p=paths[i];maxEnd=Math.max(maxEnd,p.start,p.end);
     const segs=lineSegments(p,elapsed);
     if(!segs.length)continue;
     const color=palette==='rainbow'?`hsl(${(i*47+elapsed*55)%360} 100% 65%)`:palette;
     g.strokeStyle=color;g.lineWidth=Math.max(3,p.thickness);g.shadowBlur=13;g.shadowColor=color;
     g.beginPath();g.moveTo(segs[0][0],segs[0][1]);
     for(const s of segs)g.lineTo(s[2],s[3]);
     g.stroke();g.shadowBlur=0;
     if(!finished && gameStarted && countdown===0 && invulnerable===0){
       for(const s of segs)if(distanceToSegment(player.x,player.y,...s)<18+p.thickness/2){hit=true;break;}
     }
   }
   if(hit){
     if(shield)shield=0;else lives--;
     invulnerable=1.6;
     if(lives<=0){finished=true;won=false;}
   }
   for(const p of powerups)drawPowerup(p);
   drawAvatar();
   if(!finished && gameStarted && countdown===0 && maxEnd>0 && elapsed>=Math.max(12,maxEnd/10+5)) {finished=true;won=true;score+=150;}
   g.fillStyle='#f7f8ff';g.font='bold 24px monospace';g.textAlign='left';
   g.fillText('♥ '.repeat(lives),-475,-453);
   g.textAlign='right';g.fillText(`${Math.floor(elapsed)}s  |  ${score} pts`,475,-453);
   if(!gameStarted || countdown>0){
     g.fillStyle='rgba(8,10,24,.84)';g.fillRect(-340,-115,680,210);
     g.textAlign='center';g.fillStyle='#fff';g.font='bold 42px monospace';
     g.fillText(!gameStarted?'LASER ESCAPE':String(Math.ceil(countdown)),0,-25);
     g.font='18px monospace';
     g.fillText(!gameStarted?'Choose your avatar and press Start!':'Get ready to dodge!',0,28);
   }
   if(finished){
     g.fillStyle='rgba(8,10,24,.82)';g.fillRect(-300,-100,600,190);
     g.fillStyle=won?'#72f4b1':'#ff7895';g.font='bold 48px monospace';g.textAlign='center';
     g.fillText(won?'YOU SURVIVED!':'GAME OVER',0,-22);
     g.fillStyle='#fff';g.font='21px monospace';g.fillText(`Score: ${score}  •  Press Restart`,0,30);
   }
   $('laser-stats').textContent=`${'♥ '.repeat(lives)} · Time ${Math.floor(elapsed)}s · Score ${score} · Shield ${shield?'ON':'—'} · Coil ${boost?Math.ceil(boost)+'s':'—'}`;
 }
 reset();requestAnimationFrame(drawFrame);
