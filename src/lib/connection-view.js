export function connectionAfter(route,index){
 const s=route.segments?.[index], next=route.segments?.[index+1];
 if(!s||!next||s.direction!==next.direction)return null;
 const stop=route.roundTrip?(s.direction==='return'?route.return?.stopover:route.outbound?.stopover):route.stopover;
 const hub=stop && [s.toCode,next.fromCode,next.routeFromCode].includes(stop.hubCode);
 const wait=Number(next.connectMin|| (hub?stop.waitMin:0));
 return hub?{stop,wait}:wait>0?{stop:null,wait}:null;
}
