import https from 'node:https';
import {createHash, createDecipheriv} from 'node:crypto';

export const maxDuration = 60;
const API = 'https://functions.yandexcloud.net/d4e3hpvr0lrijksc8i1r';

function ticketPayload(ticket) {
  const shared = process.env.PROXY_SHARED_SECRET;
  if (!shared || typeof ticket !== 'string') throw Object.assign(Error('Bridge unavailable'), {status:503});
  try {
    const chunks = ticket.split('.');
    if (chunks.length !== 3 || chunks.some(x => x.length > 50000)) throw Error();
    const [iv, tag, data] = chunks.map(x => Buffer.from(x, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) throw Error();
    const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(shared).digest(), iv);
    cipher.setAAD(Buffer.from('tripwise-widget-v1'));
    cipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString());
    if (payload.v !== 1 || payload.exp < Date.now() || payload.exp > Date.now() + 120000 ||
        !['sendWidget','editMessageWidgetData'].includes(payload.method) ||
        !/^\d+:[A-Za-z0-9_-]{30,}$/.test(payload.botToken || '') ||
        String(payload.body?.chat_id) !== payload.user || !/^[a-f0-9-]{36}$/.test(payload.op || '')) throw Error();
    return payload;
  } catch { throw Object.assign(Error('Invalid or expired ticket'), {status:403}); }
}

async function updateState(action, ticket, result) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const response = await fetch(`${API}?action=trip-cockpit-${action}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ticket, ...(result ? {result} : {})}), signal:ctrl.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw Object.assign(Error('Bridge state unavailable'), {status:response.status || 502});
    return data;
  } finally { clearTimeout(timer); }
}

function telegram(token, method, body, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({hostname:'api.telegram.org', port:443, family:4,
      path:`/bot${token}/${method}`, method:'POST', rejectUnauthorized:true, timeout,
      headers:{'Content-Type':'application/json','Content-Length':data.length,'Accept-Encoding':'identity',Connection:'close'}}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try { resolve({status:res.statusCode || 502, body:JSON.parse(Buffer.concat(chunks).toString())}); }
        catch { resolve({status:res.statusCode || 502, body:{ok:false}}); }
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(Error('Telegram timeout'), {code:'ETIMEDOUT'})));
    req.on('error', reject);
    req.end(data);
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ok:false,error:'Method not allowed'});
  let payload;
  try { payload = ticketPayload(request.body?.ticket); }
  catch (error) { return response.status(error.status || 403).json({ok:false,error:error.message}); }
  const ticket = request.body.ticket;
  try { await updateState('claim', ticket); }
  catch { return response.status(409).json({ok:false,error:'Не удалось закрепить отправку; сообщение не отправлено'}); }

  let result;
  try {
    const r = await telegram(payload.botToken, payload.method, payload.body);
    const messageId = payload.method === 'sendWidget' ? r.body?.result?.message_id : payload.body.message_id;
    if (r.body?.ok && Number.isSafeInteger(messageId)) result = {status:'sent', messageId};
    else result = {status:[400,403,429].includes(r.body?.error_code) ? 'failed' : 'uncertain',
      code:r.body?.error_code ? `TELEGRAM_${r.body.error_code}` : 'TELEGRAM_HTTP_ERROR',
      description:typeof r.body?.description === 'string' ? r.body.description.slice(0,400) : ''};
  } catch (error) { result = {status:'uncertain', code:error?.code === 'ETIMEDOUT' ? 'TELEGRAM_UPSTREAM_TIMEOUT' : 'TELEGRAM_NETWORK_ERROR'}; }

  let recorded = false;
  try { await updateState('finish', ticket, result); recorded = true; } catch {}
  if (result.status === 'sent' && recorded && payload.oldMessageId && payload.method === 'sendWidget') {
    await telegram(payload.botToken, 'deleteMessage', {chat_id:payload.user, message_id:payload.oldMessageId}, 5000).catch(() => {});
  }
  if (result.status === 'sent') return response.status(200).json({ok:true, mode:'widget', messageId:result.messageId,
    updated:payload.method !== 'sendWidget', recorded});
  return response.status(result.status === 'failed' ? 422 : 503).json({ok:false,error:result.code,
    detail:result.description || undefined, uncertain:result.status !== 'failed', recorded});
}
