import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const DEMO_KEY='loadin.notifications.demo.v1';

function demoState(){
  const fallback={preferences:{booking_alerts:true,scheduled_reminders:true,document_expiry:true,high_demand:true,return_load:true,support_updates:true,quiet_hours_enabled:false,quiet_hours_start:null,quiet_hours_end:null},notifications:[
    {id:'DEMO-N1',notification_type:'TRIP_UPDATE',priority:'NORMAL',title:'Partner assigned',body:'Cidco → Waluj MIDC',status:'DELIVERED',created_at:new Date(Date.now()-6*60000).toISOString()},
    {id:'DEMO-N2',notification_type:'BOOKING_ALERT',priority:'HIGH',title:'LOADIN booking update',body:'Fare Lock is active for your booking.',status:'OPENED',opened_at:new Date(Date.now()-40*60000).toISOString(),created_at:new Date(Date.now()-42*60000).toISOString()}
  ]};
  try{const raw=localStorage.getItem(DEMO_KEY);return raw?JSON.parse(raw):fallback}catch{return fallback}
}
function saveDemo(s){try{localStorage.setItem(DEMO_KEY,JSON.stringify(s))}catch{}return s}
function withUnread(s){return {...s,unreadCount:(s.notifications||[]).filter(n=>!['OPENED','CANCELLED','EXPIRED'].includes(n.status)).length,demo:true}}

export const notificationsProduction={
  configured:client.configured,
  async snapshot(){if(!client.configured)return withUnread(demoState());return client.rpc('get_my_notification_center')},
  async markOpened(id){if(!client.configured){const s=demoState();const n=s.notifications.find(x=>x.id===id);if(n){n.status='OPENED';n.opened_at=n.opened_at||new Date().toISOString()}saveDemo(s);return n}return client.rpc('mark_notification_opened',{p_notification_id:id})},
  async markAll(){if(!client.configured){const s=demoState();let c=0;for(const n of s.notifications){if(!['OPENED','CANCELLED','EXPIRED'].includes(n.status)){n.status='OPENED';n.opened_at=n.opened_at||new Date().toISOString();c++}}saveDemo(s);return c}return client.rpc('mark_all_my_notifications_opened')},
  async setPreferences(p={}){if(!client.configured){const s=demoState();s.preferences={...s.preferences,...p};saveDemo(s);return s.preferences}return client.rpc('set_my_notification_preferences',{
    p_booking_alerts:p.booking_alerts??null,
    p_scheduled_reminders:p.scheduled_reminders??null,
    p_document_expiry:p.document_expiry??null,
    p_high_demand:p.high_demand??null,
    p_return_load:p.return_load??null,
    p_support_updates:p.support_updates??null,
    p_quiet_hours_enabled:p.quiet_hours_enabled??null,
    p_quiet_hours_start:p.quiet_hours_start??null,
    p_quiet_hours_end:p.quiet_hours_end??null
  })}
};
