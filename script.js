const cfg = {use24h:false,units:'fahrenheit',showChr:true,showJew:true,showIsl:true,showHin:true,showSec:true};
let wData=null,uLat=null,uLon=null,wInt=null,aInt=null,tTO=null,cleanAnim=null,locationWatcherId=null,firstRun=false;
let locationStatus='';
let lastChimeMinute=null;
let chimeTimeouts=[];
let audioUnlocked=false;
const audioFiles={
  '15min':'./15min.m4a',
  '30min':'./30min.m4a',
  '45min':'./45min.m4a',
  'Hour':'./Hour.m4a',
  'Chime':'./Chime.m4a'
};
const COUNTDOWN_STORAGE_KEY='lcCountdowns';
let countdowns=[];

function createAudioElement(name){
  const audio=document.createElement('audio');
  audio.src=audioFiles[name]||name;
  audio.preload='auto';
  audio.volume=0.25;
  audio.playsInline=true;
  audio.style.display='none';
  audio.addEventListener('ended',()=>audio.remove());
  audio.addEventListener('pause',()=>{if(!audio.ended)audio.remove();});
  document.body.appendChild(audio);
  return audio;
}

function saveS(){try{localStorage.setItem('lcS',JSON.stringify(cfg))}catch(e){}renderToggles()}
function saveLocation(){try{localStorage.setItem('lcLoc',JSON.stringify({lat:uLat,lon:uLon}))}catch(e){}}
function saveLocationStatus(status){try{localStorage.setItem('lcLocStatus',status)}catch(e){}}
function hideLocationButton(){const btn=document.getElementById('loc-btn');if(btn)btn.style.display='none'}
function loadLocation(){try{const stored=JSON.parse(localStorage.getItem('lcLoc')||'null');if(stored&&typeof stored.lat==='number'&&typeof stored.lon==='number'){uLat=stored.lat;uLon=stored.lon;document.getElementById('loc-label').textContent='Located';hideLocationButton();return true}}catch(e){}return false}
function loadLocationStatus(){try{const s=localStorage.getItem('lcLocStatus');if(s)locationStatus=s}catch(e){locationStatus=''}}
function loadS(){const stored=localStorage.getItem('lcS');firstRun=!stored;try{const s=JSON.parse(stored||'{}');Object.assign(cfg,s)}catch(e){}renderToggles();const sel=document.getElementById('t-units');if(sel)sel.value=cfg.units;loadLocation();loadLocationStatus();return firstRun}
function renderToggles(){
  const m={use24h:'t-24h',showChr:'t-chr',showJew:'t-jew',showIsl:'t-isl',showHin:'t-hin',showSec:'t-sec'};
  for(const[k,id]of Object.entries(m)){const el=document.getElementById(id);if(el)el.className='tog'+(cfg[k]?' on':'')}
}
function clearChimeTimeouts(){
  while(chimeTimeouts.length){clearTimeout(chimeTimeouts.pop())}
}
function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked=true;
  const unlockClip=createAudioElement('15min');
  unlockClip.muted=true;
  unlockClip.play().then(()=>{unlockClip.pause();unlockClip.muted=false;unlockClip.remove()}).catch(()=>{unlockClip.remove()});
}
function playAudio(name){
  const audio=createAudioElement(name);
  audio.play().catch(()=>{audio.remove()});
  return audio;
}
function playHourlyCount(hour){
  const count = hour%12||12;
  clearChimeTimeouts();
  for(let i=0;i<count;i++){
    chimeTimeouts.push(setTimeout(()=>playAudio('Chime'), i * 1100));
  }
}
function runQuarterChime(min,hour){
  clearChimeTimeouts();
  if(min===15){
    playAudio('15min');
    return;
  }
  if(min===30){
    playAudio('30min');
    return;
  }
  if(min===45){
    playAudio('45min');
    return;
  }
  if(min===0){
    playAudio('Hour');
    flashHour();
    chimeTimeouts.push(setTimeout(()=>playHourlyCount(hour), 1400));
  }
}
function flashHour(){
  const app=document.getElementById('app');
  if(!app)return;
  app.classList.add('hour-flash');
  setTimeout(()=>app.classList.remove('hour-flash'),900);
}
function toggleS(k){cfg[k]=!cfg[k];saveS();checkHolidays()}

function loadCountdowns(){try{const stored=JSON.parse(localStorage.getItem(COUNTDOWN_STORAGE_KEY)||'[]');countdowns=Array.isArray(stored)?stored:[]}catch(e){countdowns=[]}}
function saveCountdownData(){try{localStorage.setItem(COUNTDOWN_STORAGE_KEY,JSON.stringify(countdowns))}catch(e){}}
function startOfDay(dt){return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate())}
function formatCountdown(ms){const totalSeconds=Math.max(0,Math.floor(ms/1000));const days=Math.floor(totalSeconds/86400);const hours=Math.floor((totalSeconds%86400)/3600);const minutes=Math.floor((totalSeconds%3600)/60);const seconds=totalSeconds%60;const parts=[];if(days)parts.push(`${days} day${days===1?'':'s'}`);if(hours)parts.push(`${hours} hr${hours===1?'':'s'}`);if(minutes)parts.push(`${minutes} min${minutes===1?'':'s'}`);if(seconds||!parts.length)parts.push(`${seconds} sec${seconds===1?'':'s'}`);return parts.join(' ')}
function formatTarget(date){const opts={year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'};return `Target: ${date.toLocaleString([],opts)}`}
function renderCountdowns(){const container=document.getElementById('countdowns-list');if(!container)return;container.innerHTML='';if(countdowns.length===0){container.innerHTML='<p class="countdown-empty">No countdowns saved yet. Add one to begin.</p>';return;}const now=new Date();for(const countdown of countdowns){const target=new Date(countdown.targetTime||countdown.targetDate);const isPast=target.getTime()<now.getTime();const remainingMs=Math.max(0,target.getTime()-now.getTime());const countdownText=isPast?'<strong>Completed</strong>':formatCountdown(remainingMs);const targetText=formatTarget(target);const card=document.createElement('div');card.className='countdown-card';card.innerHTML=`<h3>${countdown.name}</h3><div class="countdown-meta"><span>${targetText}</span><span>${countdownText}</span></div><div class="countdown-actions"><button type="button" onclick="deleteCountdown('${countdown.id}')">Delete</button></div>`;container.appendChild(card);} }
function addCountdown(e){e.preventDefault();const name=document.getElementById('countdown-name').value.trim();const date=document.getElementById('countdown-date').value;const time=document.getElementById('countdown-time').value; if(!name||!date){return;}const [year,month,day]=date.split('-').map(Number);const [hour,minute]=time?time.split(':').map(Number):[0,0];const target=new Date(year,month-1,day,hour||0,minute||0,0,0);const now=new Date();if(target.getTime()<now.getTime()){return;}countdowns.push({id:Date.now().toString(),name,targetTime:target.toISOString(),createdAt:now.toISOString()});saveCountdownData();renderCountdowns();document.getElementById('countdowns-form').reset();}
function deleteCountdown(id){countdowns=countdowns.filter(c=>c.id!==id);saveCountdownData();renderCountdowns();}
function openCountdownsPanel(){const panel=document.getElementById('countdowns-panel');if(!panel)return;panel.classList.add('open');renderCountdowns();showControls();}
function closeCountdownsPanel(){const panel=document.getElementById('countdowns-panel');if(!panel)return;panel.classList.remove('open');hideControlsAfterDelay();}

let controlsTimer=null;
function showControls(){
  const app=document.getElementById('app');
  app.classList.add('controls-visible');
  if(controlsTimer)clearTimeout(controlsTimer);
  unlockAudio();
  if(document.getElementById('settings-panel').classList.contains('open'))return;
  controlsTimer=setTimeout(()=>{document.getElementById('app').classList.remove('controls-visible')},3000);
}
function hideControlsAfterDelay(){
  if(controlsTimer)clearTimeout(controlsTimer);
  controlsTimer=setTimeout(()=>{const settingsOpen=document.getElementById('settings-panel').classList.contains('open');const countdownsOpen=document.getElementById('countdowns-panel').classList.contains('open');if(!settingsOpen&&!countdownsOpen)document.getElementById('app').classList.remove('controls-visible')},3000);
}
function toggleSettingsPanel(){
  const panel=document.getElementById('settings-panel');
  const open=panel.classList.toggle('open');
  if(open){showControls()} else {hideControlsAfterDelay()}
}
function closeSettingsPanel(){
  const panel=document.getElementById('settings-panel');
  if(panel.classList.contains('open')){panel.classList.remove('open');hideControlsAfterDelay();}
}
function initControls(){
  ['mousemove','mousedown','touchstart','keydown','click'].forEach(evt=>document.addEventListener(evt,showControls,{passive:true}));
  document.addEventListener('click',e=>{const settingsPanel=document.getElementById('settings-panel');if(settingsPanel.classList.contains('open')&&!settingsPanel.contains(e.target)&&!e.target.closest('#settings-btn'))closeSettingsPanel();const countdownsPanel=document.getElementById('countdowns-panel');if(countdownsPanel.classList.contains('open')&&!countdownsPanel.contains(e.target)&&!e.target.closest('#countdowns-btn'))closeCountdownsPanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSettingsPanel();closeCountdownsPanel();}});
  const countdownsBtn=document.getElementById('countdowns-btn');
  if(countdownsBtn)countdownsBtn.addEventListener('click',e=>{e.stopPropagation();openCountdownsPanel()});
  const locBtn=document.getElementById('loc-btn');
  if(locBtn)locBtn.addEventListener('click',e=>{e.stopPropagation();requestLocation()});
  const settingsBtn=document.getElementById('settings-btn');
  if(settingsBtn)settingsBtn.addEventListener('click',e=>{e.stopPropagation();toggleSettingsPanel()});
  const closeBtn=document.getElementById('close-btn');
  if(closeBtn)closeBtn.addEventListener('click',e=>{e.stopPropagation();closeSettingsPanel()});
  const closeCountdownsBtn=document.getElementById('close-countdowns-btn');
  if(closeCountdownsBtn)closeCountdownsBtn.addEventListener('click',e=>{e.stopPropagation();closeCountdownsPanel()});
  const zipBtn=document.getElementById('zip-submit');
  if(zipBtn)zipBtn.addEventListener('click',e=>{e.stopPropagation();geocodeZipCode(document.getElementById('zip-input').value);});
  const zipInput=document.getElementById('zip-input');
  if(zipInput)zipInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();geocodeZipCode(zipInput.value)}});
  const countdownsForm=document.getElementById('countdowns-form');
  if(countdownsForm)countdownsForm.addEventListener('submit',addCountdown);
  showControls();
}

function setStatus(m){const el=document.getElementById('status-msg');if(el)el.textContent=m}
function showZipFallback(message){const panel=document.getElementById('zip-fallback');if(panel){panel.style.display='flex';document.getElementById('loc-name').textContent=message||'Enter ZIP Code'}}
function hideZipFallback(){const panel=document.getElementById('zip-fallback');if(panel){panel.style.display='none';document.getElementById('zip-input').value=''}}
async function geocodeZipCode(zip){const value=String(zip||'').trim();if(!value){setStatus('Enter a ZIP Code');return}
  try{
    setStatus('Finding location…');
    const query=encodeURIComponent(value);
    const url=`https://nominatim.openstreetmap.org/search?postalcode=${query}&format=json&limit=1`;
    const res=await fetch(url);
    const data=await res.json();
    if(!data||!data.length){throw new Error('ZIP not found')}
    const place=data[0];
    const lat=parseFloat(place.lat),lon=parseFloat(place.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)){throw new Error('Invalid ZIP result')}
    uLat=lat;uLon=lon;saveLocation();saveLocationStatus('granted');
    hideLocationButton();
    reverseGeocode(lat,lon).then(()=>fetchWeather());
    document.getElementById('loc-label').textContent='Located ✓';
    hideZipFallback();
    setStatus('ZIP location loaded');
  }catch(e){setStatus('ZIP not found');showZipFallback('ZIP not found — try again')}
}

function updateLocation(lat, lon){
  const threshold=0.003; // roughly 300m
  if(uLat&&uLon){const dx=Math.abs(lat-uLat),dy=Math.abs(lon-uLon);if(dx<threshold&&dy<threshold)return}
  uLat=lat;uLon=lon;
  saveLocation();
  hideLocationButton();
  document.getElementById('loc-label').textContent='Located ✓';
  reverseGeocode(lat,lon).then(()=>fetchWeather());
}

function startLocationWatch(){
  if(!navigator.geolocation||locationWatcherId!==null)return;
  locationWatcherId=navigator.geolocation.watchPosition(pos=>{
    updateLocation(pos.coords.latitude,pos.coords.longitude);
  },err=>{console.warn('Location watch error',err);},
  {enableHighAccuracy:false,maximumAge:120000,timeout:20000});
}

async function requestLocation(){
  saveLocationStatus('asked');
  setStatus('Requesting location...');
  if(!navigator.geolocation){setStatus('Geolocation not supported');return}
  navigator.geolocation.getCurrentPosition(pos=>{
    updateLocation(pos.coords.latitude,pos.coords.longitude);
    setStatus('');
    saveLocationStatus('granted');
    startLocationWatch();
  },()=>{setStatus('Location denied');document.getElementById('loc-label').textContent='No location';saveLocationStatus('denied');showZipFallback('Location failed, enter ZIP')})
}

async function autoRequestLocation(){
  if(!navigator.geolocation)return;
  if(uLat&&uLon){reverseGeocode(uLat,uLon).then(()=>fetchWeather());
    if(navigator.permissions&&navigator.permissions.query){
      try{const p=await navigator.permissions.query({name:'geolocation'});if(p.state!=='denied')startLocationWatch();}catch(e){startLocationWatch();}
    } else {startLocationWatch();}
    return;
  }
  if(locationStatus==='denied'||locationStatus==='asked'){
    showZipFallback('Location blocked, enter ZIP');
    return;
  }
  if(navigator.permissions&&navigator.permissions.query){
    try{
      const p=await navigator.permissions.query({name:'geolocation'});
      if(p.state==='denied'){setStatus('Location blocked');saveLocationStatus('denied');return}
    }catch(e){}
  }
  requestLocation();
}

async function reverseGeocode(lat,lon){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const d=await r.json();
    const addr=d.address||{};
    const city=addr.city||addr.town||addr.village||addr.county||'';
    const state=addr.state_code||addr.state||'';
    const country=addr.country_code?addr.country_code.toUpperCase():'';
    let loc='';
    if(city&&state&&country==='US') loc=`${city}, ${state}`;
    else if(city&&country) loc=`${city}, ${country}`;
    else if(city) loc=city;
    else loc=country||'Unknown';
    document.getElementById('loc-name').textContent=loc;
  }catch(e){document.getElementById('loc-name').textContent='Location found'}
}

async function fetchWeather(){
  if(!uLat||!uLon)return;
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${uLat}&longitude=${uLon}&current=temperature_2m,weathercode,apparent_temperature&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    const r=await fetch(url);const d=await r.json();
    wData=d;applyWeather(d);fetchNWSAlerts();
    if(wInt)clearInterval(wInt);
    wInt=setInterval(fetchWeather,300000);
    if(aInt)clearInterval(aInt);
    aInt=setInterval(fetchNWSAlerts,600000);
  }catch(e){setStatus('Weather unavailable')}
}

async function fetchNWSAlerts(){
  if(!uLat||!uLon)return;
  try{
    const pointsUrl=`https://api.weather.gov/points/${uLat.toFixed(4)},${uLon.toFixed(4)}`;
    const pointsRes=await fetch(pointsUrl);
    if(!pointsRes.ok){console.warn('Points lookup failed',pointsRes.status);return}
    const pointsData=await pointsRes.json();
    const alertsUrl=pointsData.properties?.alerts;
    if(!alertsUrl){
      document.getElementById('nws-alerts').innerHTML='';
      return;
    }
    const alertsRes=await fetch(alertsUrl);
    if(!alertsRes.ok){console.warn('Alerts fetch failed',alertsRes.status);return}
    const alertsData=await alertsRes.json();
    const features=alertsData.features||alertsData['@graph']||[];
    console.log('NWS alerts fetched:',features.length,'alerts');
    displayNWSAlerts(features);
  }catch(e){console.warn('NWS alerts error:',e.message)}
}

function displayNWSAlerts(features){
  const container=document.getElementById('nws-alerts');
  container.innerHTML='';
  if(features.length===0){console.log('No alerts to display');return}
  console.log('Displaying',Math.min(3,features.length),'alerts');
  features.slice(0,3).forEach((feature,idx)=>{
    const props=feature.properties||feature||{};
    const event=props.event||props['nws:event']||'Alert';
    const headline=props.headline||props['nws:headline']||'Weather Alert';
    const severity=props.severity||props['nws:severity']||'Unknown';
    const iconMap={Extreme:'🔴',Severe:'🟠',Moderate:'🟡',Minor:'🔵',Unknown:'⚪'};
    const icon=iconMap[severity]||'⚪';
    const div=document.createElement('div');
    div.className='nws-alert';
    div.innerHTML=`<div class="nws-alert-title"><span class="nws-alert-icon">${icon}</span>${event}</div><div>${headline}</div>`;
    container.appendChild(div);
    console.log(`Alert ${idx+1}:`,event,severity);
  });
}

function wmoDesc(c){
  const m={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',77:'Snow grains',80:'Showers',81:'Heavy showers',82:'Violent showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm'};
  return m[c]||'Unknown';
}

function applyWeather(d){
  const code=d.current.weathercode;
  const temp=d.current.temperature_2m;
  const tempF=temp*9/5+32;
  const disp=cfg.units==='celsius'?Math.round(temp)+'°C':Math.round(tempF)+'°F';
  document.getElementById('weather-text').textContent=`${disp}  ·  ${wmoDesc(code)}`;
  updateSky(code,temp,d.daily.sunrise[0],d.daily.sunset[0]);
  animWeather(code);
}

function getPalette(code,temp,nowMs,srMs,ssMs){
  const isNight=nowMs<srMs||nowMs>ssMs;
  const isSunrise=nowMs>=srMs&&nowMs<=srMs+45*60000;
  const isSunset=nowMs>=ssMs-45*60000&&nowMs<=ssMs+30*60000;
  if(isNight)return{sky:'#0b0f2e',tx:'#dde8ff'};
  if(isSunrise)return{sky:'#e07830',tx:'#fff3e0'};
  if(isSunset)return{sky:'#b03525',tx:'#ffe0cc'};
  if(code===0||code===1){
    if(temp>=35)return{sky:'#d05020',tx:'#fff0e0'};
    if(temp>=28)return{sky:'#c07838',tx:'#fff4e0'};
    if(temp<=10)return{sky:'#3a6fc2',tx:'#e5f2ff'};
    return{sky:'#6ab8e0',tx:'#0d2040'};
  }
  if(code===2)return{sky:'#6aa8c8',tx:'#0d2040'};
  if(code===3)return{sky:'#4a5f70',tx:'#e8f2f8'};
  if(code===45||code===48)return{sky:'#7a8e98',tx:'#f0f5f8'};
  if(code>=51&&code<=67)return{sky:'#304a60',tx:'#cce4f8'};
  if(code>=71&&code<=77)return{sky:'#9ab8d0',tx:'#0d2040'};
  if(code>=80&&code<=86)return{sky:'#253d52',tx:'#cce4f8'};
  if(code>=95)return{sky:'#14152a',tx:'#d0d8ff'};
  return{sky:'#6ab8e0',tx:'#0d2040'};
}

function setTextColor(col){
  ['time-display','seconds-display','ampm-display','date-display','weather-text','location-display','loc-name','status-msg'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.color=col;
  });
  const wi=document.getElementById('weather-info');if(wi)wi.style.color=col;
  const hd=document.getElementById('holiday-display');if(hd)hd.style.color=col;
  const lb=document.getElementById('loc-btn');if(lb)lb.style.color='white';
}

function updateSky(code,temp,srStr,ssStr){
  const now=new Date();
  const srMs=new Date(srStr).getTime();
  const ssMs=new Date(ssStr).getTime();
  const pal=getPalette(code,temp,now.getTime(),srMs,ssMs);
  document.getElementById('sky-layer').style.background=pal.sky;
  setTextColor(pal.tx);
  updateSunMoon(code,now.getTime(),srMs,ssMs);
  document.getElementById('fog-layer').style.background=(code===45||code===48)?'rgba(200,210,220,0.32)':'transparent';
}

function updateSunMoon(code,nowMs,srMs,ssMs){
  const el=document.getElementById('sun-moon');
  const isNight=nowMs<srMs||nowMs>ssMs;
  const prog=Math.max(0,Math.min(1,(nowMs-srMs)/(ssMs-srMs)));
  const appW=document.getElementById('app').offsetWidth||680;
  const xPos=Math.max(appW*0.10,Math.min(appW*0.15+prog*(appW*0.72),appW*0.82));
  if(isNight){
    el.style.cssText=`position:absolute;width:clamp(36px,6vw,58px);height:clamp(36px,6vw,58px);border-radius:50%;top:clamp(12px,2.5vh,30px);left:${xPos}px;background:#f0f0cc;box-shadow:0 0 18px rgba(240,240,200,0.4);z-index:2;transition:all 4s ease`;
  }else{
    const isClear=code<=2;
    const sc=prog<0.15||prog>0.85?'#ff9944':'#ffe033';
    if(isClear){
      el.style.cssText=`position:absolute;width:clamp(40px,7vw,66px);height:clamp(40px,7vw,66px);border-radius:50%;top:clamp(12px,2.5vh,32px);left:${xPos}px;background:${sc};box-shadow:0 0 28px rgba(255,210,50,0.55);z-index:2;transition:all 4s ease`;
    }else{
      el.style.cssText=`position:absolute;width:clamp(36px,6vw,56px);height:clamp(36px,6vw,56px);border-radius:50%;top:clamp(12px,2.5vh,32px);left:${xPos}px;background:rgba(255,220,80,0.35);z-index:2;transition:all 4s ease`;
    }
  }
}

function clearWeatherAnim(){
  if(cleanAnim){cleanAnim();cleanAnim=null}
  document.getElementById('weather-anim').innerHTML='';
  if(tTO)clearTimeout(tTO);
}

function animWeather(code){
  clearWeatherAnim();
  const anim=document.getElementById('weather-anim');
  const h=document.getElementById('app').offsetHeight||520;

  if(code>=51&&code<=67||code>=80&&code<=86){
    const n=code>=63?90:45;const els=[];
    for(let i=0;i<n;i++){
      const d=document.createElement('div');d.className='rain-drop';
      const rh=6+Math.random()*14;
      d.style.cssText=`left:${Math.random()*100}%;height:${rh}px;top:-20px;opacity:${0.4+Math.random()*0.4};animation-duration:${0.45+Math.random()*0.4}s;animation-delay:${Math.random()*0.8}s`;
      anim.appendChild(d);els.push(d);
    }
    cleanAnim=()=>els.forEach(e=>e.remove());
  }else if(code>=71&&code<=77||code>=85&&code<=86){
    const els=[];
    for(let i=0;i<65;i++){
      const f=document.createElement('div');f.className='snow-flake';
      const sz=3+Math.random()*5;
      f.style.cssText=`left:${Math.random()*100}%;width:${sz}px;height:${sz}px;animation-duration:${3+Math.random()*4}s;animation-delay:${Math.random()*3}s;opacity:${0.6+Math.random()*0.4}`;
      anim.appendChild(f);els.push(f);
    }
    cleanAnim=()=>els.forEach(e=>e.remove());
  }else if(code===2||code===3){
    const n=code===3?5:3;const els=[];
    for(let i=0;i<n;i++){
      const c=document.createElement('div');c.className='cloud';
      const w=100+Math.random()*130,ch=28+Math.random()*22;
      c.style.cssText=`top:${15+i*28}px;left:${Math.random()*400}px;width:${w}px;height:${ch}px;animation-duration:${40+Math.random()*30}s;animation-delay:${-Math.random()*20}s;opacity:${0.35+Math.random()*0.3}`;
      anim.appendChild(c);els.push(c);
    }
    cleanAnim=()=>els.forEach(e=>e.remove());
  }else if(code===0||code===1){
    const nowMs=Date.now();
    const isNight=wData&&(()=>{const sr=new Date(wData.daily.sunrise[0]).getTime();const ss=new Date(wData.daily.sunset[0]).getTime();return nowMs<sr||nowMs>ss})();
    if(isNight){
      const els=[];
      for(let i=0;i<65;i++){
        const s=document.createElement('div');s.className='star';
        const sz=1+Math.random()*2.5;
        s.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*55}%;width:${sz}px;height:${sz}px;animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*3}s`;
        anim.appendChild(s);els.push(s);
      }
      cleanAnim=()=>els.forEach(e=>e.remove());
    }
  }else if(code>=95){
    const drop=()=>{const d=document.createElement('div');d.className='rain-drop';const rh=8+Math.random()*16;d.style.cssText=`left:${Math.random()*100}%;height:${rh}px;top:-20px;animation-duration:${0.3+Math.random()*0.25}s;animation-delay:${Math.random()*0.4}s;opacity:${0.5+Math.random()*0.4}`;return d};
    const els=[];for(let i=0;i<100;i++){const d=drop();anim.appendChild(d);els.push(d)}
    const doFlash=()=>{const f=document.createElement('div');f.className='t-flash';anim.appendChild(f);setTimeout(()=>f.remove(),200);tTO=setTimeout(doFlash,3000+Math.random()*5000)};
    doFlash();
    cleanAnim=()=>{els.forEach(e=>e.remove());clearTimeout(tTO)};
  }
}

function getEaster(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d2=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d2-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m2=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m2+114)/31),dy=((h+l-7*m2+114)%31)+1;
  return{m:mo,d:dy};
}
function getHanukkah(now){
  const y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
  const starts={2024:{m:12,d:25},2025:{m:12,d:14},2026:{m:12,d:4},2027:{m:12,d:24},2028:{m:12,d:12}};
  const s=starts[y];if(!s)return null;
  const diff=Math.floor((new Date(y,m-1,d)-new Date(y,s.m-1,s.d))/86400000);
  return(diff>=0&&diff<8)?{day:diff+1}:null;
}

function checkHolidays(){
  const now=new Date(),m=now.getMonth()+1,d=now.getDate();
  const hdEl=document.getElementById('holiday-display');
  const xl=document.getElementById('xmas-lights');
  const oldMen=document.querySelector('.menorah-wrap');if(oldMen)oldMen.remove();
  hdEl.textContent='';

  let holiday=null;
  if(cfg.showChr){
    if(m===12&&d===25)holiday={e:'🎁'};
    else if(m===10&&d===31)holiday={e:'🎃'};
    else{const ea=getEaster(now.getFullYear());if(m===ea.m&&d===ea.d)holiday={e:'🐣'}}
    if(!holiday&&m===2&&d===14)holiday={e:'💝'};
    if(!holiday&&m===11&&d>=22&&d<=28)holiday={e:'🦃'};
    if(!holiday&&m===1&&d===1)holiday={e:'🎆'};
  }
  if(!holiday&&cfg.showJew){
    const han=getHanukkah(now);
    if(han)holiday={type:'menorah',day:han.day};
    else if(m===9&&d>=15&&d<=25)holiday={e:'🍎'};
    else if(m===3&&d>=10&&d<=15)holiday={e:'✡️'};
  }
  if(!holiday&&cfg.showHin){
    if(m===11&&d>=1&&d<=5)holiday={e:'🪔'};
    else if(m===3&&d>=24&&d<=26)holiday={e:'🌸'};
  }
  if(!holiday&&cfg.showIsl){
    if(m===4&&d>=10&&d<=12)holiday={e:'☪️'};
    else if(m===6&&d>=16&&d<=19)holiday={e:'🌙'};
  }
  if(!holiday&&cfg.showSec){
    if(m===7&&d===4)holiday={e:'🎇'};
    else if(m===3&&d===17)holiday={e:'🍀'};
    else if(m===5&&d>=8&&d<=14)holiday={e:'💐'};
  }

  if(holiday){
    if(holiday.type==='menorah'){drawMenorah(holiday.day)}
    else{hdEl.textContent=holiday.e}
  }

  if(cfg.showChr&&m===12){xl.style.display='block';drawXmasLights()}
  else{xl.style.display='none'}
}

function drawXmasLights(){
  const el=document.getElementById('xmas-lights');el.innerHTML='';
  const cols=['#ff3333','#33cc33','#3399ff','#ffcc00','#ff66cc','#ff6600'];
  const appW=document.getElementById('app').offsetWidth||680;
  const sp=Math.max(22,appW/28);const n=Math.floor(appW/sp);
  for(let i=0;i<n;i++){
    const b=document.createElement('div');b.className='light-bulb';
    const c=cols[i%cols.length];
    b.style.cssText=`left:${i*sp+6}px;background:${c};box-shadow:0 0 7px ${c};animation-duration:${1.5+Math.random()}s;animation-delay:${Math.random()*1.2}s`;
    el.appendChild(b);
  }
  const wire=document.createElement('div');
  wire.style.cssText='position:absolute;top:13px;left:0;right:0;height:1px;background:rgba(80,60,20,0.45)';
  el.appendChild(wire);
}

function isMemorialDay(now){
  const year=now.getFullYear();
  const may31=new Date(year,4,31);
  const offset=(may31.getDay()+6)%7;
  const lastMonday=31-offset;
  return now.getMonth()===4 && now.getDate()===lastMonday;
}

function updateMemorialOverlay(now){
  const overlay=document.getElementById('memorial-overlay');
  if(!overlay)return;

  const is911=now.getMonth()===8 && now.getDate()===11;
  const isMemDay=isMemorialDay(now);
  const isThreePM=isMemDay && now.getHours()===15 && now.getMinutes()===0;

  if(is911 || isThreePM){
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

function updateClock(){
  const now=new Date();
  const h=now.getHours(),min=now.getMinutes(),sec=now.getSeconds();
  let dH,ap;
  if(cfg.use24h){dH=String(h).padStart(2,'0');ap=''}
  else{const h12=h%12||12;dH=String(h12).padStart(2,'0');ap=h<12?'AM':'PM'}
  document.getElementById('time-display').textContent=`${dH}:${String(min).padStart(2,'0')}`;
  document.getElementById('seconds-display').textContent=String(sec).padStart(2,'0');
  document.getElementById('ampm-display').textContent=ap;
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('date-display').textContent=`${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  updateMemorialOverlay(now);
  if(sec===0){
    checkHolidays();
    if(wData)updateSky(wData.current.weathercode,wData.current.temperature_2m,wData.daily.sunrise[0],wData.daily.sunset[0]);
    if(min%15===0&&min!==lastChimeMinute){
      lastChimeMinute=min;
      runQuarterChime(min,h);
    }
  }
  const countdownsPanel=document.getElementById('countdowns-panel');
  if(countdownsPanel && countdownsPanel.classList.contains('open')) renderCountdowns();
}

function drawMenorah(lit){
  const wrap=document.createElement('div');wrap.className='menorah-wrap';
  const sz=Math.min(200,document.getElementById('app').offsetWidth*0.32);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width',sz);svg.setAttribute('height',sz*0.48);
  svg.setAttribute('viewBox','0 0 200 96');
  const cx=100;
  const mk=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el};
  svg.appendChild(mk('rect',{x:'56',y:'82',width:'88',height:'9',rx:'3',fill:'#c8a040'}));
  svg.appendChild(mk('line',{x1:cx,y1:'82',x2:cx,y2:'54',stroke:'#c8a040','stroke-width':'3'}));
  const positions=[-80,-60,-40,-20,0,20,40,60,80];
  positions.forEach((off,i)=>{
    const x=cx+off;const isSh=i===4;
    const armY=isSh?52:58;
    svg.appendChild(mk('line',{x1:cx,y1:isSh?50:56,x2:x,y2:armY,stroke:'#c8a040','stroke-width':'1.8'}));
    const cH=isSh?16:13;
    const ci=i<4?i:i-1;
    const isLit=isSh?(lit>=1):(ci<lit-1);
    svg.appendChild(mk('rect',{x:x-3,y:armY-cH,width:'6',height:cH,rx:'1',fill:isLit?'#fffdd0':'#ccc'}));
    if(isLit){
      svg.appendChild(mk('ellipse',{cx:x,cy:armY-cH-4,rx:'3',ry:'5',fill:'#ff9922'}));
    }
  });
  wrap.appendChild(svg);
  document.getElementById('content').appendChild(wrap);
}

function fallbackSky(){
  const h=new Date().getHours();
  let sky='#6ab8e0',tx='#0d2040';
  if(h<5||h>=21){sky='#0b0f2e';tx='#dde8ff'}
  else if(h<7){sky='#e07830';tx='#fff3e0'}
  else if(h>=19){sky='#b03525';tx='#ffe0cc'}
  document.getElementById('sky-layer').style.background=sky;
  setTextColor(tx);
}

const initialSetup=loadS();
loadCountdowns();
initControls();
fallbackSky();
updateClock();
checkHolidays();
autoRequestLocation();
if(initialSetup){
  const heading=document.getElementById('settings-heading');
  const intro=document.getElementById('setup-instructions');
  if(heading)heading.textContent='Setup';
  if(intro)intro.textContent='Select how you want the clock to behave. These settings can be changed anytime.';
  toggleSettingsPanel();
}
setInterval(updateClock,1000);