export const starterHabits = [
  {id:'prep', title:'One placement block', category:'Study', cue:'After my first chai or coffee', tiny:'Open one DSA problem and read it for 2 minutes', target:5},
  {id:'outside', title:'Get outside', category:'Life', cue:'After lunch', tiny:'Step outside for 5 minutes', target:4},
  {id:'connect', title:'Reach out to someone', category:'People', cue:'When I put my laptop away', tiny:'Send one genuine check-in', target:2}
];
export const quests = [
  {id:'lodhi', title:'Lodhi art walk', area:'Lodhi Colony', kind:'Outdoors', cost:'Free', time:'45–90 min', company:'Either', prompt:'Pick a lane and find three murals you would want to photograph.'},
  {id:'geeta', title:'An East Delhi photo walk', area:'Geeta Colony', kind:'Outdoors', cost:'Free', time:'30–45 min', company:'Either', prompt:'Pick one theme like old signs or interesting doors. Take five photos on a route you know.'},
  {id:'tibetan', title:'Thukpa in the Tibetan Colony', area:'Majnu ka Tilla', kind:'Food', cost:'Paid', time:'45–90 min', company:'Either', prompt:'Order one dish you have never tried, then walk through the small shops.'},
  {id:'ina', title:'One new regional dish', area:'Dilli Haat INA', kind:'Food', cost:'Paid', time:'45–90 min', company:'Either', prompt:'Walk through the craft stalls and pick one regional dish you have not tried.'},
  {id:'badminton', title:'One badminton session', area:'DTU or your neighbourhood', kind:'People', cost:'Free', time:'30–45 min', company:'With someone', prompt:'Ask one person for a quick game. If it goes well, pick a time for next week.'},
  {id:'books', title:'Browse a used book market', area:'Mahila Haat, Daryaganj area', kind:'Curiosity', cost:'Free', time:'45–90 min', company:'Either', prompt:'Find one book you would normally walk past. Browsing is the whole outing.'},
  {id:'lake', title:'A daylight loop at Sanjay Lake', area:'Trilokpuri', kind:'Outdoors', cost:'Free', time:'30–45 min', company:'Either', prompt:'Pick a daylight slot and take a slow walk by the lake.'},
  {id:'chai', title:'Chai with someone you miss', area:'Near home or campus', kind:'People', cost:'Paid', time:'30–45 min', company:'With someone', prompt:'Send a specific invite. Try “Chai after class on Thursday?”'},
  {id:'museum', title:'An hour at the Science Centre', area:'Pragati Maidan', kind:'Curiosity', cost:'Paid', time:'45–90 min', company:'Either', prompt:'Pick one exhibit and work out how you would explain it to someone else.'}
];
export function dateKey(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
export const asDate = key => new Date(key+'T12:00:00');
export function shift(key, days) {
  const d = asDate(key);
  d.setDate(d.getDate()+days);
  return dateKey(d);
}
export const weekStart = key => shift(key,-((asDate(key).getDay()+6)%7));
export const validDay = key => /^\d{4}-\d\d-\d\d$/.test(key) && dateKey(asDate(key)) === key;
export function nextOccurrence(plan, today) {
  if (!plan.repeat || plan.date >= today) return plan.date;
  const a = Date.parse(plan.date+'T00:00:00Z'), b = Date.parse(today+'T00:00:00Z');
  return shift(plan.date, Math.ceil((b-a)/604800000)*7);
}
const starterRows = starterHabits.map(({id,...data}) => ({
  kind:'habit', id, data, updated_at:'2000-01-01T00:00:00.000Z', deleted:false
}));
const kinds = new Set(['habit','log','checkin','plan','quest','review','prefs']);
const text = (value, max) => typeof value==='string' && value.length<=max;
function validData(kind, id, d) {
  if (!d || typeof d!=='object' || Array.isArray(d)) return false;
  switch(kind) {
    case 'habit': return text(d.title,90) && !!d.title.trim() && ['Study','Life','People'].includes(d.category) &&
      text(d.cue,120) && text(d.tiny,120) && Number.isInteger(d.target) && d.target>=1 && d.target<=7;
    case 'log': return validDay(d.day) && text(d.habit,130) && id===d.habit+'.'+d.day && ['full','tiny'].includes(d.status);
    case 'checkin': return validDay(id) && text(d.study,160) && text(d.personal,160) && text(d.look,160) &&
      ['','Low','Okay','Good'].includes(d.energy);
    case 'plan': return text(d.title,100) && !!d.title.trim() && text(d.place,140) && text(d.note,400) && validDay(d.date) &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.time) && typeof d.repeat==='boolean' && (!d.invite || /^[a-f0-9-]{36}$/.test(d.invite));
    case 'quest': return quests.some(q=>q.id===id) && ['saved','done'].includes(d.status);
    case 'review': return validDay(id) && ['good','drained','next'].every(k=>text(d[k],600));
    case 'prefs': return id==='view' && typeof d.tinyMode==='boolean';
    default: return false;
  }
}
export function normalize(row) {
  if (!row || !kinds.has(row.kind) || !/^[\w.-]{1,150}$/.test(row.id) ||
      typeof row.deleted!=='boolean' || !Number.isFinite(Date.parse(row.updated_at))) return null;
  if (!row.deleted && !validData(row.kind,row.id,row.data)) return null;
  return {kind:row.kind,id:row.id,data:row.deleted?{}:row.data,updated_at:new Date(row.updated_at).toISOString(),deleted:row.deleted};
}
export const rowKey = row => row.kind+'/'+row.id;
export const compare = (a,b) => a.updated_at.localeCompare(b.updated_at) || Number(a.deleted)-Number(b.deleted);
const prefix = 'show-up.v1.';
function load(scope) {
  try {
    const raw = localStorage.getItem(prefix+scope);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {rows:(data.rows||[]).map(normalize).filter(Boolean), pending:Array.isArray(data.pending)?data.pending:[]};
  } catch { return null; }
}
export function createStore(scope, warn) {
  const previous = load(scope);
  const rows = new Map((previous?.rows ?? starterRows).map(row=>[rowKey(row),row]));
  const pending = new Set(previous?.pending ?? starterRows.map(rowKey));
  let latest = 0;
  function persist() {
    try {localStorage.setItem(prefix+scope, JSON.stringify({rows:[...rows.values()],pending:[...pending]}));}
    catch {warn('Device storage is unavailable. Download a backup before closing this page.');}
  }
  function merge(incoming, queue=false) {
    for (const value of incoming) {
      const row=normalize(value);
      if (!row) continue;
      const key=rowKey(row), old=rows.get(key);
      if (!old || compare(row,old)>0) {
        rows.set(key,row);
        if (queue) pending.add(key);
      }
    }
    persist();
  }
  return {
    scope,
    get(kind,id) {const r=rows.get(kind+'/'+id);return r && !r.deleted?r.data:null;},
    list(kind) {return [...rows.values()].filter(r=>r.kind===kind&&!r.deleted).map(r=>({...r.data,id:r.id}));},
    set(kind,id,data,deleted=false) {
      const key=kind+'/'+id, old=rows.get(key);
      latest=Math.max(Date.now(),latest+1,(old?Date.parse(old.updated_at):0)+1);
      const row=normalize({kind,id,data,updated_at:new Date(latest).toISOString(),deleted});
      if (!row) throw Error('Check the details and try again.');
      rows.set(key,row);
      pending.add(key);
      persist();
    },
    rows:()=>[...rows.values()],
    queued:()=>[...pending].map(key=>rows.get(key)).filter(Boolean),
    confirm(sent) {
      for (const row of sent) {
        const key=rowKey(row);
        if (rows.get(key)===row) pending.delete(key);
      }
      persist();
    },
    merge,
  };
}
