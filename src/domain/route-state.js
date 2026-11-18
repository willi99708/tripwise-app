// A travel date is a calendar day, not midnight UTC.
export function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T12:00:00');
  return !Number.isNaN(+d) && localDay(d) === value ? d : null;
}
export function localDay(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join('-');
}
export function routeSearch(route, query = {}, snapshot) {
  const legs = route?.outbound?.segments?.length ? route.outbound.segments :
    (route?.segments || []).filter(s => s.direction !== 'return');
  return { oc:snapshot?.oc || query.originCode || legs[0]?.fromCode || '',
    dc:snapshot?.dc || query.destCode || legs.at(-1)?.toCode || '',
    df:snapshot?.df ?? query.depISO ?? '', dt:snapshot?.dt ?? query.retISO ?? '',
    a:snapshot?.a ?? query.adults ?? 1, ch:snapshot?.ch ?? query.children ?? [] };
}
export function routeKey(route, context) {
  const legs = route?.segments?.length ? route.segments : [...(route?.outbound?.segments || []), ...(route?.return?.segments || [])];
  return JSON.stringify([context.oc,context.dc,context.df,context.dt,context.a,context.ch,
    !!route?.agent,!!route?.selfTransfer,legs.length ? legs.map(s=>[s.mode,s.fromCode,s.toCode,s.departISO,s.flightNumber,s.direction,s.transfers]) : route?.id]);
}
export function matchesSaved(entry, route, context) {
  return !!entry.route && routeKey(entry.route, routeSearch(entry.route, entry.query, entry.search)) === routeKey(route, context);
}
