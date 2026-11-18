import {telegram} from './telegram.js';
export const maxDuration=60;
const api='https://functions.yandexcloud.net/d4e3hpvr0lrijksc8i1r';
async function call(action,body){
 const r=await fetch(api+'?action=document-relay-'+action,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Proxy-Key':process.env.PROXY_SHARED_SECRET},body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Object.assign(Error('request rejected'),{status:r.status});
 return r.json();
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 if(!process.env.PROXY_SHARED_SECRET)return res.status(503).json({ok:false,error:'Сервис доставки не настроен'});
 const {initData,requestId,docId,answers,formats}=req.body||{};
 if(!initData||!Array.isArray(formats)||!formats.length||formats.length>2||formats.some(f=>!['pdf','docx'].includes(f)))return res.status(422).json({ok:false,error:'Некорректный запрос'});
 const files=await Promise.all([...new Set(formats)].map(async format=>{
  let d;try{d=await call('claim',{initData,requestId,docId,answers,format});}catch{return {format,status:'not_confirmed',sent:false};}
  let status=d.status,needStart=false,recorded=false;
  if(status==='claimed'){
    let messageId;try{
      const r=await telegram(d.token,'sendDocument',{body:{chat_id:d.chatId,protect_content:true,caption:'TripWise · Проверьте данные перед использованием.'},file:{data:d.data,name:d.name,type:d.mime}},12000);
      const b=JSON.parse(r.text);
      messageId=b.result?.message_id;
      status=b.ok&&Number.isSafeInteger(messageId)&&messageId>0?'sent':[400,403,429].includes(b.error_code)?'failed':'uncertain';
      needStart=b.error_code===403||/chat not found/i.test(b.description||'');
    }catch{status='uncertain';}
    try{const result=await call('finish',{initData,requestId,format,op:d.op,status,messageId});recorded=result.ok===true;}catch{}
  }
  return {format,name:d.name,kind:d.kind,missing:d.missing,status,sent:status==='sent',needStart,recorded};
 }));
 const ok=files.every(f=>f.sent);
 return res.status(200).json({ok,files,kind:files[0]?.kind,missing:files[0]?.missing||[],needStart:files.some(f=>f.needStart),...(!ok?{error:'Не все файлы доставлены. Проверьте чат; копию можно скачать здесь.'}:{})});
}
