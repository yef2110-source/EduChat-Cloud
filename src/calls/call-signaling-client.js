/* EduChat V2 call-signaling client helper.
 * Requires Supabase JS v2 client and a signed-in Auth user.
 * This helper is a module prototype for integration; legacy UID-only UI is not wired yet.
 */
export function createCallSignalingClient({ supabase, onIncoming, onStatus, timeoutMs = 45000 }) {
  if (!supabase?.auth || !supabase?.from || !supabase?.channel) throw new Error('Authenticated Supabase client required');
  let activeCall = null;
  let channel = null;
  let timer = null;
  let disposed = false;

  const stopTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  const notifyStatus = (status, call = activeCall) => onStatus?.({ status, call });

  async function getUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Sign in is required to place or receive calls');
    return data.user.id;
  }

  async function subscribeIncoming() {
    const uid = await getUserId();
    if (disposed) return;
    channel = supabase.channel('educhat-v2-incoming-calls-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'educhat_v2_calls', filter: 'callee_id=eq.' + uid }, async payload => {
        const call = payload?.new;
        if (!call || call.status !== 'invited' || disposed) return;
        if (activeCall) {
          await supabase.from('educhat_v2_calls').update({ status: 'busy', ended_at: new Date().toISOString() }).eq('id', call.id);
          return;
        }
        activeCall = call;
        const ack = await supabase.from('educhat_v2_calls').update({ status: 'ringing' }).eq('id', call.id).eq('status', 'invited');
        if (ack.error) { activeCall = null; notifyStatus('failed', call); return; }
        notifyStatus('ringing', call);
        onIncoming?.(call, { answer: () => answer(call), decline: () => decline(call) });
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notifyStatus('failed');
      });
    return channel;
  }

  async function watchCall(callId) {
    const uid = await getUserId();
    if (channel) await supabase.removeChannel(channel);
    channel = supabase.channel('educhat-v2-call-watch-' + callId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'educhat_v2_calls', filter: 'id=eq.' + callId }, payload => {
        const call = payload?.new;
        if (!call || !['caller_id','callee_id'].some(k => call[k] === uid)) return;
        activeCall = call;
        notifyStatus(call.status, call);
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notifyStatus('failed');
      });
  }

  async function startCall(calleeId, callType = 'audio', roomName) {
    const callerId = await getUserId();
    if (activeCall) throw new Error('Already handling a call');
    const room = roomName || ('edu-' + crypto.randomUUID());
    const expires = new Date(Date.now() + timeoutMs).toISOString();
    const { data, error } = await supabase.from('educhat_v2_calls').insert({
      caller_id: callerId, callee_id: calleeId, call_type: callType,
      room_name: room, expires_at: expires, status: 'invited'
    }).select().single();
    if (error) throw error;
    activeCall = data;
    notifyStatus('connecting', data);
    await watchCall(data.id);
    timer = setTimeout(async () => {
      if (activeCall?.id !== data.id || !['invited','ringing'].includes(activeCall.status)) return;
      await supabase.from('educhat_v2_calls').update({ status: 'no_answer', ended_at: new Date().toISOString() }).eq('id', data.id).in('status', ['invited','ringing']);
    }, timeoutMs);
    return data;
  }

  async function answer(call) {
    stopTimer();
    const { data, error } = await supabase.from('educhat_v2_calls').update({ status: 'answered', answered_at: new Date().toISOString() }).eq('id', call.id).eq('status', 'ringing').select().single();
    if (error) throw error;
    activeCall = data;
    notifyStatus('answered', data);
    return data;
  }

  async function decline(call) {
    stopTimer();
    const { error } = await supabase.from('educhat_v2_calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', call.id).eq('status', 'ringing');
    if (error) throw error;
    notifyStatus('declined', call);
    activeCall = null;
  }

  async function endCall() {
    stopTimer();
    if (!activeCall) return;
    const call = activeCall;
    const { error } = await supabase.from('educhat_v2_calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id).in('status', ['answered','ringing','invited']);
    if (error) throw error;
    notifyStatus('ended', call);
    activeCall = null;
  }

  function dispose() {
    disposed = true;
    stopTimer();
    if (channel) supabase.removeChannel(channel);
    channel = null;
    activeCall = null;
  }

  return { subscribeIncoming, startCall, watchCall, answer, decline, endCall, dispose, get activeCall() { return activeCall; } };
}
