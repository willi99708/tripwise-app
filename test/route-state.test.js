import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDay,localDay,routeSearch,matchesSaved} from '../src/domain/route-state.js';
test('calendar day survives timezone, leap year and invalid input',()=>{
  assert.equal(localDay(parseDay('2028-02-29')),'2028-02-29');
  assert.equal(parseDay('2026-02-29'),null);
  assert.equal(parseDay('2026-11-23T00:00:00Z'),null);
});
test('legacy favorites match itinerary, not repeated result index',()=>{
  const route={id:'gen-ow-0',segments:[{fromCode:'MOW',toCode:'BKK',departISO:'2026-11-23T15:00:00+03:00'}]};
  const query={depISO:'2026-11-23',adults:1,children:[7]};
  const saved={route,query,id:'liked-gen-ow-0'},ctx=routeSearch(route,query);
  assert.equal(ctx.dc,'BKK');assert.deepEqual(ctx.ch,[7]);
  assert.ok(matchesSaved(saved,{...route,id:'gen-ow-3'},ctx));
  assert.ok(!matchesSaved(saved,route,{...ctx,df:'2026-11-24'}));
  assert.ok(!matchesSaved(saved,route,{...ctx,ch:[]}));
  assert.ok(!matchesSaved(saved,{...route,segments:[{fromCode:'MOW',toCode:'DXB'}]},ctx));
});
