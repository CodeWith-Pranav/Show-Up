import {asDate,dateKey,shift,weekStart,validDay,nextOccurrence,quests,createStore,normalize} from './data.js';
import * as cloud from './cloud.js';
import {updateViewMotion, habitFeedback} from './motion.js';

const icons = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m3-7a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  week:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 6 2 2 5-5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 3-.6 2.6-2 .9-2.4-1.1-2 3.5 1.9 1.8v2.6L3 15.1l2 3.5 2.4-1.1 2 .9L10 21h4l.6-2.6 2-.9 2.4 1.1 2-3.5-1.9-1.8v-2.6L21 8.9l-2-3.5-2.4 1.1-2-.9L14 3z"/>',
  book:'<path d="M4 5h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4zm16 0h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5z"/>',
  leaf:'<path d="M20 4C11 3 5 7 5 13a6 6 0 0 0 6 6c6 0 10-6 9-15ZM4 21l10-10"/>',
  cup:'<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm12 1h2a2.5 2.5 0 0 1 0 5h-2M2 21h18M8 5V3m4 2V3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>', prev:'<path d="m15 6-6 6 6 6"/>', next:'<path d="m9 6 6 6-6 6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const $ = id => document.getElementById(id);
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatters = new Map();
function dateFormatter(options) {
  const key = JSON.stringify(options);
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat('en-IN',options));
  return formatters.get(key);
}
const fmt = (date, options) => dateFormatter(options).format(asDate(date));
const action = (act, label, cls='', data={}, pressed) => '<button type="button" class="btn '+cls+'" data-act="'+act+'" '+Object.entries(data).map(([k,v])=>'data-'+k+'="'+esc(v)+'"').join(' ')+(pressed===undefined?'':' aria-pressed="'+pressed+'"')+'>'+label+'</button>';
const link = (href,label,cls='')=>'<a class="btn '+cls+'" href="'+esc(href)+'">'+label+'</a>';
const intro = (eyebrow,title,copy,cta='')=>'<div class="intro"><div><p class="eyebrow">'+eyebrow+'</p><h1>'+title+'</h1><p>'+copy+'</p></div>'+cta+'</div>';
const header = (title,copy='',cta='')=>'<div class="section-head"><div><h2>'+title+'</h2>'+(copy?'<p>'+copy+'</p>':'')+'</div>'+cta+'</div>';
const empty = text => '<div class="card empty">'+text+'</div>';
const maps = q => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const external = (url,label)=>'<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+label+'</a>';
let toastId;
function toast(message) {
  $('toast').textContent=message;
  clearTimeout(toastId);
  toastId=setTimeout(()=>$('toast').textContent='',4200);
}
let today=dateKey(), selected=today, week=weekStart(today);
let store=createStore('local',toast), user, syncStatus='On this device', syncing=false, again=false;
let filters={kind:'All',cost:'All',time:'All',company:'All',saved:false};
let installPrompt=null;
let timer={seconds:1500,until:0,duration:1500,done:false};
let timerTick;
const dialog=$('dialog');
const inviteToken=new URLSearchParams(location.search).get('invite');
const inviteDate=new URLSearchParams(location.search).get('on');
const inviteMode=Boolean(inviteToken);
let guestInvite=null, guestError='', guestLoading=inviteMode;

function save(kind,id,data,deleted=false) {
  store.set(kind,id,data,deleted);
  queueSync();
}
function setStatus(label) {
  syncStatus=label;
  $('save-label').textContent=label;
  $('save-label').parentElement.dataset.state=label==='Saved to cloud'?'saved':label==='Syncing…'?'pending':'local';
}
function queueSync() {
  if(!user) return;
  if(syncing) {again=true;return;}
  const account=user.id, active=store;
  syncing=true;
  setStatus('Syncing…');
  cloud.sync(active,account).then(changed=>{
    if(store===active) {setStatus('Saved to cloud');if(changed && !dialog.open && !inviteMode) render();}
  }).catch(()=>{
    if(store===active) setStatus('Saved here · sync pending');
  }).finally(()=>{
    syncing=false;
    if(again){again=false;queueSync();}
  });
}
async function initializeAuth() {
  if(!cloud.configured || inviteMode) return;
  try {
    const client=await cloud.connect();
    client.auth.onAuthStateChange((_event,session)=> {
      const next=session?.user;
      if(next?.id===user?.id) return;
      const previous=store;
      user=next;
      store=createStore(user?.id || 'local',toast);
      if(user && sessionStorage.getItem('show-up.merge-guest')==='yes'){
        sessionStorage.removeItem('show-up.merge-guest');
        if(previous.scope==='local') store.merge(previous.rows(),true);
      }
      setStatus(user?'Syncing…':'On this device');
      if(dialog.open) dialog.close();
      render();
      queueSync();
    });
    const {error}=await client.auth.getSession();
    if(error) setStatus('On this device · sign-in unavailable');
  } catch {setStatus('On this device · sign-in unavailable');}
}
const habitList=()=>store.list('habit');
const status=(id,day)=>store.get('log',id+'.'+day)?.status || '';
const daysOf=first=>Array.from({length:7},(_,i)=>shift(first,i));
const countFor=(id,first)=>daysOf(first).filter(day=>status(id,day)).length;
const tinyMode=()=>store.get('prefs','view')?.tinyMode||false;
const categoryIcon=category=>({Study:'book',Life:'leaf',People:'people'}[category]);
const todayLabel=key=>key===today?'Today':fmt(key,{weekday:'long'});
function habitCard(habit) {
  const s=status(habit.id,selected), tiny=tinyMode();
  const fullBtn=action('log',s==='full'?icon('check')+' Full done':'Mark full',!tiny?'primary':'',{id:habit.id,status:'full'},s==='full');
  const tinyBtn=action('log',s==='tiny'?icon('check')+' Small done':'Mark small',tiny?'primary':'',{id:habit.id,status:'tiny'},s==='tiny');
  return '<article class="card habit" data-status="'+s+'"><span class="tile-icon" data-category="'+habit.category+'">'+icon(categoryIcon(habit.category))+'</span><div class="habit-main"><div class="habit-top"><div><span class="category-label">'+habit.category+'</span><h3>'+esc(habit.title)+'</h3></div>'+action('habit','Edit','tertiary',{id:habit.id})+'</div><p>'+esc(habit.cue || 'Choose a cue when you edit this habit.')+'</p><p class="small-copy"><strong>Small version</strong> · '+esc(habit.tiny)+'</p><div class="actions">'+(tiny?tinyBtn+fullBtn:fullBtn+tinyBtn)+'</div></div></article>';
}
function strip(first,id='') {
  return '<div class="week-strip">'+daysOf(first).map(day=>{
    const logs=habitList().map(h=>status(h.id,day));
    const s=id?status(id,day):logs.includes('full')?'full':logs.includes('tiny')?'tiny':'';
    const name=fmt(day,{weekday:'short'});
    const label=fmt(day,{dateStyle:'full'})+(s?' · '+s:' · no check-in');
    return '<button class="day-cell" type="button" title="'+esc(label)+'" aria-label="'+esc(label)+'" '+(day===today?'aria-current="date"':'')+' data-act="select-day" data-day="'+day+'" '+(day>today?'disabled':'')+'>'+name.slice(0,2)+'<b class="'+s+'">'+(s==='full'?'✓':s==='tiny'?'·':Number(day.slice(-2)))+'</b></button>';
  }).join('')+'</div>';
}
const legend='<div class="legend"><span><i class="legend-dot full"></i>Full effort</span><span><i class="legend-dot tiny"></i>Small effort</span><span><i class="legend-dot"></i>No entry</span></div>';
function checkinCard() {
  const item=store.get('checkin',selected);
  const fields=[['Placement',item?.study],['Personal',item?.personal],['Look forward to',item?.look]];
  return '<div class="card"><div class="section-head"><h2 class="panel-title">Daily check-in</h2>'+action('checkin',item?'Edit':'Set up')+'</div>'+
    (item?(item.energy?'<p><span class="tag">Energy · '+esc(item.energy)+'</span></p>':'')+fields.filter(([,value])=>value).map(([label,value])=>'<p class="small-text"><strong>'+label+'</strong><br>'+esc(value)+'</p>').join(''):'<p class="small-text">Pick one thing for placements, one for yourself, and one to look forward to.</p>')+'</div>';
}
function timerPanel() {
  return '<section class="card focus-card"><div class="section-head"><div><p class="eyebrow">FOCUS TIMER</p><h2 class="panel-title">One study block</h2></div><span class="tile-icon">'+icon('clock')+'</span></div>'+
    '<div class="timer-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="timer-track" cx="60" cy="60" r="53"/><circle id="timer-arc" cx="60" cy="60" r="53" pathLength="100" stroke-dasharray="100" transform="rotate(-90 60 60)"/></svg><div class="timer-center"><div id="timer-face" class="timer-face"></div><span>'+ (timer.until?'IN PROGRESS':timer.done?'COMPLETE':timer.seconds<timer.duration?'PAUSED':'READY')+'</span></div></div>'+
    '<div class="actions timer-actions">'+action('timer-toggle',timer.until?'Pause':timer.done?'Start again':timer.seconds<timer.duration?'Resume':'Start focus','primary')+action('timer-reset','Reset','tertiary')+'</div>'+
    '<div class="timer-presets" aria-label="Timer duration">'+action('timer-short','10 min','',{},timer.duration===600)+action('timer-long','25 min','',{},timer.duration===1500)+'</div></section>';
}
function plansSorted() {
  return store.list('plan').sort((a,b)=>nextOccurrence(a,today).localeCompare(nextOccurrence(b,today))||a.time.localeCompare(b.time));
}
function displayPlanDate(plan,day=nextOccurrence(plan,today)) {
  const at=new Date(day+'T'+plan.time+'+05:30');
  return dateFormatter({timeZone:'Asia/Kolkata',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(at)+' IST';
}
function todayView() {
  const plan=plansSorted().find(p=>nextOccurrence(p,today)>=today);
  const habits=habitList();
  const check=habits.filter(h=>status(h.id,selected)).length;
  const small=tinyMode();
  const hero=small?['Start with two minutes.','Pick the smallest version of a habit you can do right now.','Use full actions']:['Make today doable.','Give one habit, one focus block, or one plan your attention.','Use small actions'];
  return intro(fmt(selected,{weekday:'long',day:'numeric',month:'long'}).toUpperCase(),todayLabel(selected),'Your habits, focus time, and plans at a glance.',action('checkin','Daily check-in '+icon('arrow'),'primary')) +
    '<section class="hero"><div class="orbit" aria-hidden="true"><canvas></canvas><span class="orbit-caption"></span></div><div class="hero-copy"><p class="hero-label"><span></span>'+(small?'SMALL ACTIONS MODE':'DAILY RHYTHM')+'</p><h2>'+hero[0]+'</h2><p>'+hero[1]+'</p>'+action('tiny-mode',hero[2]+' '+icon('arrow'),'hero-action',{},small)+'</div></section>'+
    '<div class="columns dashboard"><div class="stack"><section>'+header('Your habits','Full and small efforts both count.',action('habit',icon('plus')+' Add habit'))+
    '<div class="habit-progress"><span><strong>'+check+' / '+habits.length+'</strong> logged</span><div class="progress-track"><progress max="'+Math.max(habits.length,1)+'" value="'+check+'" aria-label="Habits logged for this day"></progress><span class="progress-fill" aria-hidden="true"></span></div></div>'+
    '<div class="stack">'+(habits.map(habitCard).join('')||empty('Add one habit with a cue and a small version.'))+'</div>'+
    (selected!==today?'<p>'+action('back-today','Back to today')+'</p>':'')+'</section>'+checkinCard()+
    '<div class="card note-card"><p class="eyebrow">NEXT PLAN</p><h2 class="panel-title">'+(plan?esc(plan.title):'Make time for something')+'</h2><p class="small-text">'+(plan?esc(displayPlanDate(plan)):'Chai, badminton, a walk, or an hour outside.')+'</p>'+link('#plans',plan?'See your plans':'Make a plan')+'</div></div>'+
    '<aside class="stack" aria-label="Today details">'+timerPanel()+
    '<div class="card"><div class="section-head"><h2 class="panel-title">This week</h2>'+link('#week','Review '+icon('arrow'),'tertiary')+'</div>'+strip(weekStart(today))+legend+'</div></aside></div>';
}
function habitsView() {
  return intro('YOUR ROUTINE','Habits','Pick a cue you already encounter. Give the habit a version you can do on a busy day.',action('habit',icon('plus')+' Add habit','primary'))+
    '<div class="columns"><section class="stack">'+(habitList().map(h=>habitCard(h)).join('')||empty('Try one habit first.'))+'</section><aside class="card note-card"><p class="eyebrow">THIS WEEK’S TARGETS</p><h2 class="panel-title">Count the times you show up</h2>'+
    habitList().map(h=>'<p class="small-text">'+esc(h.title)+' · <strong>'+countFor(h.id,weekStart(today))+' / '+h.target+'</strong></p>').join('')+
    '<p class="small-text">Choose a weekly target that fits your schedule. Both small and full efforts count toward it.</p></aside></div>';
}
function plansView() {
  return intro('SAME TIME NEXT WEEK','Make a plan.','Pick a time, invite someone, and make it easy to do again.',action('plan',icon('plus')+' New plan','primary'))+
    '<div class="cards-grid">'+(plansSorted().map(p=>'<article class="card plan-card"><div><span class="tag">'+(p.repeat?'Repeats weekly':'One time')+'</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(displayPlanDate(p))+(p.place?' · '+esc(p.place):'')+'</p>'+
    (p.note?'<p>'+esc(p.note)+'</p>':'')+'<div class="actions">'+action('share',p.invite?'Invite & RSVP':'Share plan','primary',{id:p.id})+
    action('calendar','Add to calendar','',{id:p.id})+action('plan','Edit','',{id:p.id})+'</div></article>').join('')||
    empty('Try a library block, a chai after class, or badminton at the same time every week.'))+'</div>';
}
function select(label,key,options) {
  return '<label>'+label+'<select data-filter="'+key+'">'+options.map(v=>'<option '+(v===filters[key]?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
}
function delhiView() {
  const results=quests.filter(q=>['kind','cost','time','company'].every(k=>filters[k]==='All'||filters[k]===q[k]||(k==='company'&&q[k]==='Either'))&&(!filters.saved||store.get('quest',q.id)));
  return intro('DELHI SIDE QUESTS','Go somewhere.','A short list of ways to get out, see something different, or spend time with someone.')+
    '<div class="filters">'+select('Mood','kind',['All','Outdoors','Food','People','Curiosity'])+select('Budget','cost',['All','Free','Paid'])+
    select('Time there','time',['All','30–45 min','45–90 min'])+select('Company','company',['All','Solo','With someone'])+
    '<label class="check"><input type="checkbox" data-filter="saved" '+(filters.saved?'checked':'')+'> Saved or tried</label></div>'+
    '<div class="cards-grid">'+(results.map(q=>{
      const mark=store.get('quest',q.id)?.status;
      return '<article class="card quest-card"><div class="quest-art" data-kind="'+q.kind+'">'+icon(({Outdoors:'leaf',Food:'cup',People:'people',Curiosity:'book'})[q.kind])+'</div><div><span class="tag">'+q.cost+' · '+q.time+'</span> '+(mark==='done'?'<span class="tag gold">Tried</span>':'')+'</div>'+
        '<h3>'+esc(q.title)+'</h3><p><strong>'+esc(q.area)+'</strong></p><p>'+esc(q.prompt)+'</p><div class="actions">'+action('quest-save',mark?'Remove':'Save','',{id:q.id})+
        action('quest-plan','Plan it','primary',{id:q.id})+action('quest-done',mark==='done'?'Undo tried':'Mark tried','',{id:q.id})+external(maps(q.area==='Near home or campus'||q.area==='DTU or your neighbourhood'?'parks near me Delhi':q.area+' Delhi'),'Map ↗')+'</div></article>';
    }).join('')||empty('No outings match these filters. Try a different mood or budget.'))+'</div><p class="small-text">Time estimates are for the outing itself. Check venue hours, prices and travel before heading out.</p>';
}
function weekView() {
  const days=daysOf(week);
  const logs=store.list('log').filter(l=>l.day>=days[0]&&l.day<=days[6]);
  const review=store.get('review',week)||{};
  return intro('WEEKLY RESET','See your rhythm.',fmt(days[0],{day:'numeric',month:'short'})+' to '+fmt(days[6],{day:'numeric',month:'short',year:'numeric'}),
    '<div class="actions">'+action('change-week',icon('prev')+' <span>Older</span>','',{dir:-1})+(week<weekStart(today)?action('change-week','Newer '+icon('next'),'',{dir:1}):'')+'</div>')+
    '<div class="stats-grid">'+[['Days active',new Set(logs.map(l=>l.day)).size],['Full efforts',logs.filter(l=>l.status==='full').length],['Small efforts',logs.filter(l=>l.status==='tiny').length]].map(([label,n])=>'<div class="card"><p class="small-text">'+label+'</p><div class="summary-number">'+n+'</div></div>').join('')+'</div>'+
    '<div class="columns"><section class="card">'+header('Habit calendar','Tap a date to see or edit that day.')+legend+
    (habitList().map(h=>'<div class="calendar-row"><div><h3>'+esc(h.title)+'</h3><p class="small-text">'+countFor(h.id,week)+' / '+h.target+' target</p></div>'+strip(week,h.id)+'</div>').join('')||'<p>Add a habit to see it here.</p>')+
    '</section><section class="card">'+header('Weekly reflection','A couple of lines is plenty.')+
    '<form class="form-grid" data-form="review"><label>What felt good?<textarea name="good" maxlength="600" rows="2">'+esc(review.good)+'</textarea></label>'+
    '<label>What drained me?<textarea name="drained" maxlength="600" rows="2">'+esc(review.drained)+'</textarea></label>'+
    '<label>One thing I’ll try next week<textarea name="next" maxlength="600" rows="2">'+esc(review.next)+'</textarea></label><button class="btn primary" type="submit">Save reflection</button></form></section></div>';
}
const views={today:todayView,habits:habitsView,plans:plansView,delhi:delhiView,week:weekView};
const viewNames={today:'Today',habits:'Habits',plans:'Plans',delhi:'Explore',week:'Weekly'};
function route() {const key=location.hash.slice(1);return Object.hasOwn(views,key)?key:'today';}
function render() {
  if(inviteMode) {renderInvite();return;}
  const current=route();
  if(current==='week' && document.activeElement?.closest('[data-form=review]')) return;
  const view=$('view'), previous=view.dataset.page;
  view.dataset.page=current;
  $('view-name').textContent=viewNames[current];
  view.innerHTML=views[current]();
  updateViewMotion(view,previous!==current);
  for(const a of $('nav').querySelectorAll('a')){
    if(a.hash==='#'+current) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
  updateTimer();
}
function go(key) {
  if(location.hash==='#'+key) render();
  else location.hash=key;
}
function modal(title,content) {
  dialog.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button type="button" class="btn" data-act="close" aria-label="Close">'+icon('close')+'</button></div>'+content;
  if(!dialog.open) dialog.showModal();
}
const field=(label,name,value,max,required=false,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" maxlength="'+max+'" '+(required?'required':'')+'></label>';
const textarea=(label,name,value,max)=>'<label>'+label+'<textarea name="'+name+'" rows="2" maxlength="'+max+'">'+esc(value)+'</textarea></label>';
const choice=(label,name,values,current)=>'<label>'+label+'<select name="'+name+'">'+values.map(([value,caption])=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(caption)+'</option>').join('')+'</select></label>';
const form=(key,id,fields,buttons='')=>'<form class="form-grid" data-form="'+key+'" data-id="'+esc(id)+'">'+fields+
  '<div class="actions"><button class="btn primary" type="submit">Save</button>'+buttons+'</div></form>';
function editHabit(id='') {
  const h=store.get('habit',id)||{target:3,category:'Life'};
  modal(id?'Edit habit':'Add a habit',form('habit',id,
    field('Habit','title',h.title,90,true)+choice('Area','category',[['Study','Placement / study'],['Life','Personal'],['People','People']],h.category)+
    field('Cue · when will I do it?','cue',h.cue,120)+field('Small version · what is easy to start?','tiny',h.tiny,120,true)+
    choice('Target days per week','target',Array.from({length:7},(_,i)=>[String(i+1),String(i+1)]),String(h.target))+
    '<p class="small-text">Try “After lunch, I’ll walk for five minutes.”</p>',id?action('delete','Archive habit','danger',{kind:'habit',id}):''));
}
function editCheckin() {
  const v=store.get('checkin',selected)||{};
  modal('Check in · '+esc(todayLabel(selected)),form('checkin',selected,
    field('One placement task','study',v.study,160)+field('One personal task','personal',v.personal,160)+
    field('Something to look forward to','look',v.look,160)+choice('Energy · optional','energy',[['','Choose'],['Low','Low'],['Okay','Okay'],['Good','Good']],v.energy||''),
    store.get('checkin',selected)?action('delete','Clear check-in','danger',{kind:'checkin',id:selected}):''));
}
function editPlan(id='',suggestion={}) {
  const p=store.get('plan',id)||{date:today,time:'17:00',...suggestion};
  modal(id?'Edit plan':'Make a plan',form('plan',id,
    field('Plan','title',p.title,100,true)+field('Place','place',p.place,140)+field('Date','date',p.date,10,true,'date')+
    field('Time (IST)','time',p.time,5,true,'time')+textarea('Details for invitees if you share this','note',p.note,400)+
    '<label class="check"><input type="checkbox" name="repeat" '+(p.repeat?'checked':'')+'> Repeat weekly</label>',
    id?action('delete','Delete plan','danger',{kind:'plan',id}):''));
}
function openSettings() {
  modal('Settings & backup',
    '<p class="notice">'+esc(syncStatus)+'</p>'+
    (user?'<p>Signed in as <strong>'+esc(user.email)+'</strong>.</p><div class="actions">'+action('sync','Sync now','primary')+action('logout','Sign out')+'</div>':
      '<p>Cloud sync saves your habits, plans and reflections under the same Google account across devices.</p>'+
      (cloud.configured?'<label class="check"><input type="checkbox" id="merge-guest" checked> Carry entries from this device into my account</label>'+action('login','Continue with Google','primary'):'<p class="alert">Google sign-in and RSVP links need cloud setup. This version saves to this browser. Download a backup to keep a separate copy.</p>'))+
    '<hr class="divider"><h3>Take your data with you</h3><p class="small-text">Download a JSON backup to keep in Google Drive or any folder. Import it on another device to merge entries by their most recent edit.</p>'+
    '<div class="actions">'+action('backup','Download backup','primary')+action('import','Import backup')+'</div><input type="file" id="backup-file" accept=".json,application/json" hidden>'+
    '<hr class="divider"><h3>Use Show Up as an app</h3><p class="small-text">After the first load, the core app can open offline.</p>'+action('install','Install on this device'));
}
function sources() {
  modal('Why it works this way',
    '<p><strong>Start with a cue.</strong> Turn a goal into an if–then plan. Use a familiar moment, like closing your laptop, to prompt a specific action.</p>'+
    '<p><strong>Give a small effort its own mark.</strong> A small version is a design choice for easier starts. You can still choose the full action when you have time.</p>'+
    '<p><strong>Review the week.</strong> Lally and colleagues found that missing a single opportunity did not materially affect habit formation in their study. The app keeps the history visible so you can pick up again.</p>'+
    '<p class="small-text">Reddit accounts differ. Some users like an unbroken streak. Others report dropping the tracker after a miss, or sticking with a simple paper log. These are individual experiences.</p>'+
    '<ul class="ref-list"><li><a href="https://doi.org/10.1002/ejsp.674" target="_blank" rel="noopener noreferrer">Lally et al. · Habit formation in daily life</a></li>'+
    '<li><a href="https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions" target="_blank" rel="noopener noreferrer">National Cancer Institute · If–then planning</a></li>'+
    '<li><a href="https://www.reddit.com/r/getdisciplined/comments/1s0um3d/" target="_blank" rel="noopener noreferrer">Reddit · Losing momentum after a missed day</a></li>'+
    '<li><a href="https://www.reddit.com/r/Habits/comments/1rz00yu/" target="_blank" rel="noopener noreferrer">Reddit · Switching to simple tracking</a></li></ul>');
}
function download(filename,content,mime) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function calendar(plan, day=nextOccurrence(plan,today), recurring=plan.repeat) {
  const start=new Date(day+'T'+plan.time+'+05:30'), end=new Date(start.getTime()+3600000);
  const icsDate=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const clean=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,'\\$&');
  download('show-up-plan.ics',['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Show Up//Plans//EN','BEGIN:VEVENT',
    'UID:'+crypto.randomUUID()+'@showup','DTSTAMP:'+icsDate(new Date()),'DTSTART:'+icsDate(start),'DTEND:'+icsDate(end),
    'SUMMARY:'+clean(plan.title),'LOCATION:'+clean(plan.place),'DESCRIPTION:'+clean(plan.note),...(recurring?['RRULE:FREQ=WEEKLY']:[]),
    'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:Show Up plan','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n'),'text/calendar;charset=utf-8');
  toast('Calendar event downloaded.');
}
async function copy(value) {
  try {await navigator.clipboard.writeText(value);toast('Copied. Send it to whoever you’d like to invite.');}
  catch {modal('Copy and share','<textarea readonly rows="5" aria-label="Text to copy">'+esc(value)+'</textarea>');}
}
function inviteUrl(token,day) {
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('invite',token);
  url.searchParams.set('on',day);
  return url.href;
}
function sharePlan(id) {
  const p=store.get('plan',id);
  const invite=p.invite ? inviteUrl(p.invite,nextOccurrence(p,today)) : '';
  modal('Share this plan','<p>'+esc(p.title)+' · '+esc(displayPlanDate(p))+'</p><div class="actions">'+
    action('copy-plan','Copy invitation text','',{id})+action('calendar','Calendar file','',{id})+'</div><hr class="divider">'+
    (user ? '<p class="small-text">Anyone with the link can see the title, location, time, notes and the RSVP names for this occurrence.</p>'+
      (invite?'<label>Invite link<input readonly value="'+esc(invite)+'"></label><div class="actions">'+action('copy-link','Copy RSVP link','primary',{id})+
        external(invite,'Open RSVP list ↗')+action('revoke','Turn off link','danger',{id})+'</div>':action('publish-invite','Create RSVP link','primary',{id})):
      '<p class="small-text">'+(cloud.configured?'Sign in to create a shared RSVP link.':'You can share the invite text or calendar file. Online RSVPs need cloud setup.')+'</p>'));
}
function guestKey() {
  const key='show-up.rsvp.'+inviteToken;
  let id=localStorage.getItem(key);
  if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
  return id;
}
async function loadInvite() {
  try {
    if(!cloud.configured) throw Error('Online RSVPs need cloud setup.');
    if(!/^[a-f0-9-]{36}$/.test(inviteToken)||!validDay(inviteDate||'')) throw Error('This invite link is incomplete.');
    guestInvite=await cloud.inviteCall('show_up_get_invite',{token:inviteToken,occurrence:inviteDate});
    if(!guestInvite) throw Error('The host may have removed or changed this invitation.');
  } catch(e) {guestError=e.message;}
  finally {guestLoading=false;render();}
}
function renderInvite() {
  $('nav').hidden=true;
  $('nav').classList.add('invite-hidden');
  const v=guestInvite;
  $('view').innerHTML='<div class="invite-view">'+intro('YOU’RE INVITED',v?esc(v.title):'Shared plan',v?esc(displayPlanDate(v,inviteDate)):'')+
    '<section class="card stack">'+(v?
      '<p><strong>'+esc(v.place)+'</strong></p><p>'+esc(v.note)+'</p><div class="actions">'+action('guest-calendar','Add to calendar')+'</div>'+
      '<form class="inline-form" data-form="rsvp">'+field('Your display name','name','',60,true)+
      choice('Response','response',[['going','Going'],['maybe','Maybe'],['no','Can’t make it']],'going')+
      '<button type="submit" class="btn primary">Send RSVP</button></form><p class="small-text">Your display name and response are visible to anyone with this link.</p>'+
      '<div><h3>Responses</h3>'+((v.responses||[]).map(r=>'<p>'+esc(r.name)+' · '+({going:'Going',maybe:'Maybe',no:'Can’t make it'}[r.response]||'')+'</p>').join('')||'<p>No replies yet.</p>')+'</div>':
      '<p>'+esc(guestLoading?'Loading invite…':guestError)+'</p>')+'<a href="/">Open my Show Up workspace →</a></section></div>';
}
function updateTimer() {
  clearTimeout(timerTick);
  const display=$('timer-face');
  if(timer.until){
    timer.seconds=Math.max(0,Math.ceil((timer.until-Date.now())/1000));
    if(timer.seconds===0){
      timer.until=0;
      timer.done=true;
      toast('Focus block finished. Mark the habit if you’re ready.');
      if(display) {render();return;}
    }
    if(timer.until && !document.hidden) timerTick=setTimeout(updateTimer,Math.max(30,(timer.until-Date.now())%1000+25));
  }
  if(display){
    const label=String(Math.floor(timer.seconds/60)).padStart(2,'0')+':'+String(timer.seconds%60).padStart(2,'0');
    if(display.textContent!==label) display.textContent=label;
    $('timer-arc').setAttribute('stroke-dashoffset',String(100*(1-timer.seconds/timer.duration)));
  }
}
function timerAction(act) {
  updateTimer();
  if(act==='timer-toggle'){
    if(timer.until) timer.until=0;
    else {
      if(timer.seconds===0) timer.seconds=timer.duration;
      timer.until=Date.now()+timer.seconds*1000;
      timer.done=false;
    }
  } else {
    if(act==='timer-short') timer.duration=600;
    if(act==='timer-long') timer.duration=1500;
    timer={...timer,seconds:timer.duration,until:0,done:false};
  }
  render();
}
async function runAction(button) {
  const {act,id,status:mark,kind,day,dir}=button.dataset;
  if(act.startsWith('timer-')) return timerAction(act);
  switch(act) {
    case 'close': dialog.close(); break;
    case 'habit': editHabit(id); break;
    case 'checkin': editCheckin(); break;
    case 'plan': editPlan(id); break;
    case 'settings': openSettings(); break;
    case 'install':
      if(installPrompt){
        const prompt=installPrompt;
        installPrompt=null;
        await prompt.prompt();
        $('install-app').hidden=true;
      } else {
        modal('Install Show Up','<p>On Android, open Show Up in Chrome. Tap the three-dot menu, choose <strong>Add to Home screen</strong>, then tap <strong>Install</strong>. Show Up opens from your launcher.</p>');
      }
      break;
    case 'sources': sources(); break;
    case 'log': {
      const previousProgress=$('view').querySelector('progress')?.value;
      const undo=status(id,selected)===mark;
      save('log',id+'.'+selected,{habit:id,day:selected,status:mark},undo);
      render();
      const updated=document.querySelector('[data-act="log"][data-id="'+CSS.escape(id)+'"][data-status="'+mark+'"]');
      updated?.focus({preventScroll:true});
      habitFeedback($('view'),updated,previousProgress);
      break;
    }
    case 'delete':
      if(!window.confirm(kind==='habit'?'Archive this habit? Previous effort still counts in the weekly totals.':'Remove this entry?')) break;
      save(kind,id,{},true);
      dialog.close();
      render();
      break;
    case 'tiny-mode':
      save('prefs','view',{tinyMode:!tinyMode()});
      render();
      break;
    case 'back-today': selected=today;render();break;
    case 'select-day': selected=day;go('today');break;
    case 'change-week': week=shift(week,Number(dir)*7);render();break;
    case 'quest-save': case 'quest-done': {
      const old=store.get('quest',id)?.status;
      const next=act==='quest-save'?'saved':old==='done'?'saved':'done';
      save('quest',id,{status:next},act==='quest-save'&&Boolean(old));
      render();
      break;
    }
    case 'quest-plan': {
      const q=quests.find(item=>item.id===id);
      editPlan('',{title:q.title,place:q.area});
      break;
    }
    case 'share': sharePlan(id);break;
    case 'copy-plan': {
      const p=store.get('plan',id);
      await copy([p.title,displayPlanDate(p),p.place,p.note].filter(Boolean).join('\n'));
      break;
    }
    case 'calendar': calendar(store.get('plan',id));break;
    case 'guest-calendar': calendar(guestInvite,inviteDate,false);break;
    case 'publish-invite': case 'revoke': {
      const activeStore=store, account=user?.id;
      if(!account) throw Error('Sign in to share an RSVP link.');
      const p={...activeStore.get('plan',id),invite:act==='revoke'?'':crypto.randomUUID()};
      activeStore.set('plan',id,p);
      await cloud.sync(activeStore,account);
      if(store!==activeStore) break;
      sharePlan(id);
      render();
      toast(p.invite?'RSVP link created.':'Invite link disabled.');
      break;
    }
    case 'copy-link': {
      const p=store.get('plan',id);
      await copy(inviteUrl(p.invite,nextOccurrence(p,today)));
      break;
    }
    case 'sync': queueSync();dialog.close();break;
    case 'login': {
      if(!await cloud.googleEnabled()) throw Error('Google sign-in is awaiting activation. Your entries are saved on this device.');
      sessionStorage.setItem('show-up.merge-guest',$('merge-guest').checked?'yes':'no');
      const client=await cloud.connect();
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/'}});
      if(error) throw error;
      break;
    }
    case 'logout': {
      const client=await cloud.connect();
      const {error}=await client.auth.signOut({scope:'local'});
      if(error) throw error;
      break;
    }
    case 'backup':
      download('show-up-backup-'+today+'.json',JSON.stringify({app:'Show Up',version:1,rows:store.rows()},null,2),'application/json');
      toast('Backup downloaded.');
      break;
    case 'import': $('backup-file').click();break;
  }
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-act]');
  if(!button) return;
  runAction(button).catch(error=>toast(error.message||'That action could not be saved.'));
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.dataset.filter){
    filters[el.dataset.filter]=el.type==='checkbox'?el.checked:el.value;
    render();
    document.querySelector('[data-filter="'+el.dataset.filter+'"]')?.focus();
  }
  if(el.id==='backup-file'&&el.files[0]) {
    try {
      if(el.files[0].size>8_000_000) throw Error('This file is too large for a Show Up backup.');
      const content=JSON.parse(await el.files[0].text());
      if(content.app!=='Show Up'||content.version!==1||!Array.isArray(content.rows)||content.rows.some(r=>!normalize(r))) throw Error('Select a valid Show Up backup.');
      if(!window.confirm('Merge '+content.rows.length+' backup entries into this workspace?')) return;
      store.merge(content.rows,true);
      queueSync();
      render();
      toast('Backup merged.');
    } catch(e){toast(e.message);}
    finally {el.value='';}
  }
});
document.addEventListener('submit',async event=>{
  const f=event.target;
  if(!f.dataset.form) return;
  event.preventDefault();
  const values=Object.fromEntries(new FormData(f));
  for(const key of Object.keys(values)) values[key]=values[key].trim();
  const submit=f.querySelector('[type=submit]');
  submit.disabled=true;
  try {
    const type=f.dataset.form;
    const id=f.dataset.id||crypto.randomUUID();
    if(type==='rsvp') {
      await cloud.inviteCall('show_up_submit_rsvp',{token:inviteToken,occurrence:inviteDate,guest:guestKey(),display_name:values.name,answer:values.response});
      await loadInvite();
      toast('RSVP saved.');
      return;
    }
    if(type==='habit') values.target=Number(values.target);
    if(type==='plan'){
      values.repeat=Boolean(values.repeat);
      values.invite=store.get('plan',id)?.invite||'';
    }
    save(type,type==='review'?week:id,values);
    if(dialog.open) dialog.close();
    if(type==='review') document.activeElement?.blur();
    render();
    toast(type==='review'?'Reflection saved.':'Saved.');
  } catch(e){toast(e.message);}
  finally {submit.disabled=false;}
});
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  if(!inviteMode) $('install-app').hidden=false;
});
window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  $('install-app').hidden=true;
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
window.addEventListener('online',queueSync);
document.addEventListener('visibilitychange',()=>{
  updateTimer();
  if(document.hidden) return;
  const now=dateKey();
  if(now!==today){
    if(selected===today) selected=now;
    if(week===weekStart(today)) week=weekStart(now);
    today=now;
    render();
  }
  queueSync();
});
setInterval(()=>{if(!document.hidden) queueSync();},60000);
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
render();
if(inviteMode) loadInvite();
else initializeAuth();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
