import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallSignalingClient } from '../src/calls/call-signaling-client.js';

function mockSupabase(userId='u-caller') {
  const calls = new Map(); let inserted = null; const channels = [];
  const supabase = {
    auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},
    from(table){
      return {
        insert(row){ inserted={id:'call-1',...row}; calls.set(inserted.id,inserted); return {select(){return {single:async()=>({data:inserted,error:null})}}}; },
        update(patch){ let target=null; const q={eq(k,v){target={k,v};return q;},in(k,values){target={k,v:values};return q;},select(){return {single:async()=>{const c=calls.get(target?.v)||inserted; if(!c)return {data:null,error:{message:'missing'}}; Object.assign(c,patch); return {data:c,error:null};}};},maybeSingle:async()=>({data:inserted,error:null})}; return q; }
      };
    },
    channel(name){const ch={name,on(){return ch;},subscribe(){channels.push(ch);return ch;}};return ch;},
    removeChannel:async()=>{}
  };
  return {supabase,calls,channels,get inserted(){return inserted;}};
}
test('creates an invited call record and returns it',async()=>{
 const m=mockSupabase(); const client=createCallSignalingClient({supabase:m.supabase});
 const call=await client.startCall('u-recipient','audio','room-test-name-123');
 assert.equal(call.status,'invited'); assert.equal(call.callee_id,'u-recipient');
 await client.dispose();
});
test('rejects self-call and invalid call type',async()=>{
 const m=mockSupabase('self'); const client=createCallSignalingClient({supabase:m.supabase});
 await assert.rejects(()=>client.startCall('self','audio'),/Invalid recipient/);
 await assert.rejects(()=>client.startCall('other','screen'),/Invalid call type/);
 await client.dispose();
});
test('creates separate realtime channels for incoming and outgoing monitoring',async()=>{
 const m=mockSupabase(); const client=createCallSignalingClient({supabase:m.supabase});
 await client.subscribeIncoming(); await client.startCall('u-peer','video');
 assert.equal(m.channels.length,2);
 assert.notEqual(m.channels[0].name,m.channels[1].name);
 await client.dispose();
});
