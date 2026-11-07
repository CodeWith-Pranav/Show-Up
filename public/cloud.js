const cfg = window.SHOW_UP_CONFIG || {};
const clientVersion = '2.57.4';
export const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey);
export async function googleEnabled() {
  const result=await fetch(cfg.supabaseUrl+'/auth/v1/settings',{
    headers:{apikey:cfg.supabasePublishableKey},cache:'no-store'
  });
  if(!result.ok) throw Error('Could not check Google sign-in. Try again when you’re online.');
  return (await result.json()).external?.google===true;
}
let connection;
export function connect() {
  if (!configured) return Promise.reject(Error('Cloud setup is required for this deployment.'));
  connection ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@'+clientVersion+'/+esm')
    .then(({createClient})=>createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
      auth:{flowType:'pkce',storageKey:'show-up.auth'}
    }))
    .catch(error=>{connection=undefined;throw error;});
  return connection;
}
export async function sync(store, userId) {
  const client = await connect();
  const sent = store.queued();
  for (let i=0;i<sent.length;i+=50) {
    const batch=sent.slice(i,i+50);
    const {error}=await client.from('show_up_records').upsert(batch.map(row=>({...row,user_id:userId})),
      {onConflict:'user_id,kind,id'});
    if(error) throw error;
    store.confirm(batch);
  }
  let changed = false;
  for(let start=0;;start+=500) {
    const {data,error}=await client.from('show_up_records').select('kind,id,data,deleted,updated_at')
      .eq('user_id',userId).order('kind').order('id').range(start,start+499);
    if(error) throw error;
    if (store.merge(data)) changed = true;
    if(data.length<500) break;
  }
  return changed;
}
export async function inviteCall(name, args) {
  const result=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{
    method:'POST',headers:{apikey:cfg.supabasePublishableKey,'Content-Type':'application/json'},
    body:JSON.stringify(args)
  });
  const value=await result.json();
  if(!result.ok) throw Error(value.message || 'Could not open this invite.');
  return value;
}
