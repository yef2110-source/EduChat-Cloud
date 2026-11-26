/* EduChat V2 call-signaling client helper.
 * Requires Supabase JS v2 and an authenticated user. Not yet wired into legacy UI.
 */
export function createCallSignalingClient({ supabase, onIncoming, onStatus, timeoutMs = 45000 }) {
  if (!supabase?.auth || !supabase?.from || !supabase?.channel) throw new Error('Authenticated Supabase client required');
  let activeCall = null, incomingChannel = null, watchChannel = null, timer = null, disposed = false;
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
    if (incomingChannel) await supabase.removeChannel(incomingChannel);
    incomingChannel = supabase.channel('educhat-v2-incoming-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'educhat_v2_calls', filter: 'callee_id=eq.' + uid }, async ({ new: call }) => {
        if (!call || call.status !== 'invited' || disposed) return;
        if (activeCall) {
          await supabase.from('educhat_v2_calls').update({ status: 'busy' }).eq('id', call.id).eq('status', 'invited');
          return;
        }
        activeCall = call;
        const { data, error } = await supabase.from('educhat_v2_calls').update({ status: 'ringing' }).eq('id', call.id).eq('status', 'invited').select().maybeSingle();
        if (error || !data) { activeCall = null; notifyStatus('failed', call); return; }
        activeCall = data; notifyStatus('ringing', data);
        onIncoming?.(data, { answer: () => answer(data), decline: () => decline(data) });
      })
      .subscribe(s => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') notifyStatus('connection_error'); });
    return incomingChannel;
  }
  async function watchCall(callId) {
    const uid = await getUserId();
    if (watchChannel) await supabase.removeChannel(watchChannel);
    watchChannel = supabase.channel('educhat-v2-watch-' + callId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'educhat_v2_calls', filter: 'id=eq.' + callId }, ({ new: call }) => {
        if (!call || (call.caller_id !== uid && call.callee_id !== uid)) return;
        activeCall = call;
        notifyStatus(call.status, call);
        if (['declined','busy','no_answer','failed','ended'].includes(call.status)) { stopTimer(); activeCall = null; }
      })
      .subscribe(s => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') notifyStatus('connection_error'); });
    return watchChannel;
  }
  async function startCall(calleeId, callType = 'audio', roomName) {
    const callerId = await getUserId();
    if (activeCall) throw new Error('Already handling a call');
    if (!calleeId || calleeId === callerId) throw new Error('Invalid recipient');
    if (!['audio','video'].includes(callType)) throw new Error('Invalid call type');
    const room = roomName || ('edu-' + crypto.randomUUID());
    const expires = new Date(Date.now() + timeoutMs).toISOString();
    const { data, error } = await supabase.from('educhat_v2_calls').insert({
      caller_id: callerId, callee_id: calleeId, call_type: callType, room_name: room, expires_at: expires, status: 'invited'
    }).select().single();
    if (error) throw error;
    activeCall = data; notifyStatus('connecting', data);
    await watchCall(data.id);
    timer = setTimeout(async () => {
      const c = activeCall;
      if (!c || c.id !== data.id || !['invited','ringing'].includes(c.status)) return;
      const { error: timeoutError } = await supabase.from('educhat_v2_calls').update({ status: 'no_answer' }).eq('id', data.id).eq('caller_id', callerId).in('status', ['invited','ringing']);
      if (timeoutError) notifyStatus('timeout_update_failed', c);
    }, timeoutMs + 150);
    return data;
  }
  async function answer(call) {
    if (!call || call.callee_id !== await getUserId()) throw new Error('Only the recipient can answer');
    const { data, error } = await supabase.from('educhat_v2_calls').update({ status: 'answered' }).eq('id', call.id).eq('status', 'ringing').select().single();
    if (error) throw error;
    activeCall = data; stopTimer(); notifyStatus('answered', data); return data;
  }
  async function decline(call) {
    if (!call || call.callee_id !== await getUserId()) throw new Error('Only the recipient can decline');
    const { error } = await supabase.from('educhat_v2_calls').update({ status: 'declined' }).eq('id', call.id).eq('status', 'ringing');
    if (error) throw error;
    stopTimer(); notifyStatus('declined', call); activeCall = null;
  }
  async function endCall() {
    if (!activeCall) return;
    const call = activeCall, uid = await getUserId();
    if (uid !== call.caller_id && uid !== call.callee_id) throw new Error('Not a participant');
    const { error } = await supabase.from('educhat_v2_calls').update({ status: 'ended' }).eq('id', call.id).in('status', ['answered','ringing','invited']);
    if (error) throw error;
    stopTimer(); notifyStatus('ended', call); activeCall = null;
  }
  async function dispose() {
    disposed = true; stopTimer();
    if (incomingChannel) await supabase.removeChannel(incomingChannel);
    if (watchChannel) await supabase.removeChannel(watchChannel);
    incomingChannel = watchChannel = null; activeCall = null;
  }
  return { subscribeIncoming, startCall, watchCall, answer, decline, endCall, dispose, get activeCall() { return activeCall; } };
}
