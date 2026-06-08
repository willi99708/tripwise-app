import React, { useState, useRef, useEffect } from "react";

/*
  TripWiseAI — MVP (8 экранов). Живой бэкенд + mock-фолбэк.
  Поиск аэропортов с фильтром, шеринг через Telegram, переход в «Маршруты» при поиске,
  интеграция с Telegram WebApp (имя/тема/шеринг). Фото = градиенты-заглушки.
*/

const API_BASE = "https://functions.yandexcloud.net/d4e3hpvr0lrijksc8i1r";

const T = {
  bg: "#0a0a18", bg2: "#0d0d20", card: "#14142e", card2: "#1a1a3a",
  line: "rgba(255,255,255,0.08)", line2: "rgba(255,255,255,0.14)",
  text: "#f4f5ff", sub: "#9aa0c4", subd: "#6b7099",
  violet: "#7c5cff", cyan: "#48dcdc", green: "#39d98a", gold: "#f5c451", pink: "#ff6db0",
};
/* ФОТО-ЗАГЛУШКИ: все «фото» (иллюминаторы, идеи, отели, hero) — это CSS-градиенты ниже.
   Чтобы заменить на реальные фото: в компоненте Porthole вместо `background: grad`
   подставь `backgroundImage: url("ссылка-на-фото"), backgroundSize:"cover"`.
   Места с фото помечены в коде словом Porthole. */
const GRAD = {
  hero: "linear-gradient(135deg,#3a1d6e,#7c3a9e 40%,#f0863a 78%,#ffd16b)",
  ocean: "linear-gradient(135deg,#0f3b5e,#1b7a8c,#3fe0c0)", city: "linear-gradient(135deg,#2a1b4e,#7a3a9e,#ff7db0)",
  sunset: "linear-gradient(135deg,#3a1d6e,#b14a8a,#f0863a)", night: "linear-gradient(135deg,#141438,#3a2a7e,#5e4ad0)",
  violet: "linear-gradient(135deg,#7c5cff,#6d4dff)", cta: "linear-gradient(100deg,#7c5cff,#6d4dff 55%,#48b0ff)",
};
const GP = [GRAD.ocean, GRAD.city, GRAD.sunset, GRAD.night];
const gradFor = (code) => GP[((code || "X").charCodeAt(0) + (code || "X").charCodeAt(1 || 0)) % GP.length];

/* ---- датасет аэропортов (курированный, ~130). destId — наши «умные» направления ---- */
const CUR = { USM: "samui", DPS: "bali", MLE: "maldives", HND: "tokyo", HKT: "phuket" };
const RAW_AIRPORTS = [
  ["MOW", "Москва", "Россия", "🇷🇺"], ["LED", "Санкт-Петербург", "Россия", "🇷🇺"], ["AER", "Сочи", "Россия", "🇷🇺"],
  ["SVX", "Екатеринбург", "Россия", "🇷🇺"], ["OVB", "Новосибирск", "Россия", "🇷🇺"], ["KZN", "Казань", "Россия", "🇷🇺"],
  ["KRR", "Краснодар", "Россия", "🇷🇺"], ["VVO", "Владивосток", "Россия", "🇷🇺"], ["KGD", "Калининград", "Россия", "🇷🇺"],
  ["MSQ", "Минск", "Беларусь", "🇧🇾"], ["ALA", "Алматы", "Казахстан", "🇰🇿"], ["NQZ", "Астана", "Казахстан", "🇰🇿"],
  ["TAS", "Ташкент", "Узбекистан", "🇺🇿"], ["GYD", "Баку", "Азербайджан", "🇦🇿"], ["EVN", "Ереван", "Армения", "🇦🇲"],
  ["TBS", "Тбилиси", "Грузия", "🇬🇪"], ["IST", "Стамбул", "Турция", "🇹🇷"], ["AYT", "Анталья", "Турция", "🇹🇷"],
  ["DXB", "Дубай", "ОАЭ", "🇦🇪"], ["AUH", "Абу-Даби", "ОАЭ", "🇦🇪"], ["DOH", "Доха", "Катар", "🇶🇦"],
  ["CAI", "Каир", "Египет", "🇪🇬"], ["HRG", "Хургада", "Египет", "🇪🇬"], ["SSH", "Шарм-эль-Шейх", "Египет", "🇪🇬"],
  ["LHR", "Лондон", "Великобритания", "🇬🇧"], ["CDG", "Париж", "Франция", "🇫🇷"], ["AMS", "Амстердам", "Нидерланды", "🇳🇱"],
  ["FRA", "Франкфурт", "Германия", "🇩🇪"], ["BER", "Берлин", "Германия", "🇩🇪"], ["MAD", "Мадрид", "Испания", "🇪🇸"],
  ["BCN", "Барселона", "Испания", "🇪🇸"], ["FCO", "Рим", "Италия", "🇮🇹"], ["MXP", "Милан", "Италия", "🇮🇹"],
  ["VIE", "Вена", "Австрия", "🇦🇹"], ["ZRH", "Цюрих", "Швейцария", "🇨🇭"], ["PRG", "Прага", "Чехия", "🇨🇿"],
  ["ATH", "Афины", "Греция", "🇬🇷"], ["LIS", "Лиссабон", "Португалия", "🇵🇹"], ["HEL", "Хельсинки", "Финляндия", "🇫🇮"],
  ["BKK", "Бангкок", "Таиланд", "🇹🇭"], ["HKT", "Пхукет", "Таиланд", "🇹🇭"], ["USM", "Самуи", "Таиланд", "🇹🇭"],
  ["KBV", "Краби", "Таиланд", "🇹🇭"], ["DPS", "Бали", "Индонезия", "🇮🇩"], ["CGK", "Джакарта", "Индонезия", "🇮🇩"],
  ["SIN", "Сингапур", "Сингапур", "🇸🇬"], ["KUL", "Куала-Лумпур", "Малайзия", "🇲🇾"], ["MLE", "Мальдивы", "Мальдивы", "🇲🇻"],
  ["HAN", "Ханой", "Вьетнам", "🇻🇳"], ["SGN", "Хошимин", "Вьетнам", "🇻🇳"], ["CXR", "Нячанг", "Вьетнам", "🇻🇳"],
  ["HKG", "Гонконг", "Гонконг", "🇭🇰"], ["PEK", "Пекин", "Китай", "🇨🇳"], ["PVG", "Шанхай", "Китай", "🇨🇳"],
  ["ICN", "Сеул", "Южная Корея", "🇰🇷"], ["HND", "Токио", "Япония", "🇯🇵"], ["NRT", "Токио (Нарита)", "Япония", "🇯🇵"],
  ["DEL", "Дели", "Индия", "🇮🇳"], ["BOM", "Мумбаи", "Индия", "🇮🇳"], ["GOI", "Гоа", "Индия", "🇮🇳"],
  ["CMB", "Коломбо", "Шри-Ланка", "🇱🇰"], ["KTM", "Катманду", "Непал", "🇳🇵"], ["TLV", "Тель-Авив", "Израиль", "🇮🇱"],
  ["JFK", "Нью-Йорк", "США", "🇺🇸"], ["LAX", "Лос-Анджелес", "США", "🇺🇸"], ["MIA", "Майами", "США", "🇺🇸"],
  ["YYZ", "Торонто", "Канада", "🇨🇦"], ["GRU", "Сан-Паулу", "Бразилия", "🇧🇷"], ["MEX", "Мехико", "Мексика", "🇲🇽"],
  ["CUN", "Канкун", "Мексика", "🇲🇽"], ["HAV", "Гавана", "Куба", "🇨🇺"], ["PUJ", "Пунта-Кана", "Доминикана", "🇩🇴"],
  ["CPT", "Кейптаун", "ЮАР", "🇿🇦"], ["JNB", "Йоханнесбург", "ЮАР", "🇿🇦"], ["NBO", "Найроби", "Кения", "🇰🇪"],
  ["MRU", "Маврикий", "Маврикий", "🇲🇺"], ["SEZ", "Сейшелы", "Сейшелы", "🇸🇨"], ["SYD", "Сидней", "Австралия", "🇦🇺"],
  ["MEL", "Мельбурн", "Австралия", "🇦🇺"], ["AKL", "Окленд", "Новая Зеландия", "🇳🇿"], ["WAW", "Варшава", "Польша", "🇵🇱"],
  ["OTP", "Бухарест", "Румыния", "🇷🇴"], ["BEG", "Белград", "Сербия", "🇷🇸"], ["TLL", "Таллин", "Эстония", "🇪🇪"],
  ["RIX", "Рига", "Латвия", "🇱🇻"], ["VNO", "Вильнюс", "Литва", "🇱🇹"], ["KIV", "Кишинёв", "Молдова", "🇲🇩"],
  ["BJV", "Бодрум", "Турция", "🇹🇷"], ["DLM", "Даламан", "Турция", "🇹🇷"], ["RAK", "Марракеш", "Марокко", "🇲🇦"],
  ["BAH", "Бахрейн", "Бахрейн", "🇧🇭"], ["MCT", "Маскат", "Оман", "🇴🇲"], ["KWI", "Кувейт", "Кувейт", "🇰🇼"],
  ["PEN", "Пенанг", "Малайзия", "🇲🇾"], ["TPE", "Тайбэй", "Тайвань", "🇹🇼"], ["MNL", "Манила", "Филиппины", "🇵🇭"],
  ["DAD", "Дананг", "Вьетнам", "🇻🇳"], ["REP", "Сием-Рип", "Камбоджа", "🇰🇭"], ["VTE", "Вьентьян", "Лаос", "🇱🇦"],
];
const AIRPORTS = RAW_AIRPORTS.map(([code, city, country, flag]) => ({ code, city, country, flag, destId: CUR[code] || null, grad: gradFor(code) }));
const byDest = (id) => AIRPORTS.find(a => a.destId === id) || AIRPORTS.find(a => a.code === "DPS");
const filterAirports = (q) => { const s = (q || "").trim().toLowerCase(); if (!s) return AIRPORTS; return AIRPORTS.filter(a => a.city.toLowerCase().includes(s) || a.country.toLowerCase().includes(s) || a.code.toLowerCase().includes(s)); };

const MONTHS_S = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MON_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const AIRLINES = { SU: "Аэрофлот", CA: "Air China", TR: "Scoot", AK: "AirAsia", MH: "Malaysia Airlines", EK: "Emirates", QR: "Qatar Airways", TK: "Turkish Airlines", WY: "Oman Air", S7: "S7 Airlines", U6: "Уральские", FZ: "flydubai", GA: "Garuda", TG: "Thai Airways", KE: "Korean Air", D7: "AirAsia X" };
const airlineName = (c) => AIRLINES[c] || (c ? c : "Авиакомпания");

const MOCK_ROUTES = [
  { id: "m1", picks: ["recommended"], badge: "stopover", priced: true, title: "2 дня в Куала-Лумпуре почти бесплатно", total: 69000, savings: 12000, transfers: 1,
    stopover: { city: "Куала-Лумпур", nights: 2, attractions: ["башни Петронас"] },
    segments: [
      { fromCode: "DME", toCode: "KUL", fromName: "Москва", toName: "Куала-Лумпур", airline: "CA", flightNumber: "CA910", durationMin: 670, priceLive: 32400, departISO: "2026-10-12T13:20:00+03:00" },
      { fromCode: "KUL", toCode: "USM", fromName: "Куала-Лумпур", toName: "Самуи", airline: "AK", flightNumber: "AK6066", durationMin: 130, priceLive: 17700, departISO: "2026-10-14T20:25:00+08:00" }],
    bookingLinks: [{ from: "DME", to: "KUL", url: "#" }, { from: "KUL", to: "USM", url: "#" }], notes: ["Два отдельных билета"] },
  { id: "m2", picks: ["cheapest"], badge: "cheapest", priced: true, title: "Прямой маршрут — быстро и без остановок", total: 56600, savings: 18400, transfers: 0, stopover: null,
    segments: [{ fromCode: "DME", toCode: "USM", fromName: "Москва", toName: "Самуи", airline: "SU", flightNumber: "SU276", durationMin: 615, priceLive: 56600, departISO: "2026-10-12T10:00:00+03:00" }],
    bookingLinks: [{ from: "DME", to: "USM", url: "#" }], notes: [] },
  { id: "m3", picks: ["relevant"], badge: "unexpected", priced: true, title: "Через Пекин — удобные стыковки", total: 61200, savings: 7800, transfers: 1, stopover: null,
    segments: [
      { fromCode: "DME", toCode: "PEK", fromName: "Москва", toName: "Пекин", airline: "CA", flightNumber: "CA910", durationMin: 480, priceLive: 38000, departISO: "2026-10-12T19:30:00+03:00" },
      { fromCode: "PEK", toCode: "USM", fromName: "Пекин", toName: "Самуи", airline: "TG", flightNumber: "TG615", durationMin: 360, priceLive: 23200, departISO: "2026-10-13T09:00:00+08:00" }],
    bookingLinks: [{ from: "DME", to: "PEK", url: "#" }, { from: "PEK", to: "USM", url: "#" }], notes: ["Два отдельных билета"] },
];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d) => d ? `${d.getDate()} ${MONTHS_S[d.getMonth()]}` : "";
async function apiSearch(req) {
  const r = await fetch(`${API_BASE}?action=search-routes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
  const d = await r.json();
  if (d && d.ok) return d.routes || [];
  return [];
}
const rub = (n) => (n == null ? "—" : Math.round(n).toLocaleString("ru-RU") + " ₽");
const hm = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h}ч${m ? " " + m + "м" : ""}`; };
const timeOf = (s) => { if (!s) return "--:--"; return new Date(s).toUTCString().slice(17, 22); };
const legDur = (segs) => (segs || []).filter(s => s.mode !== "ferry").reduce((s, x) => s + (x.durationMin || 0), 0);
const LABELS = { recommended: { t: "Выбор TripWise", c: T.violet, icon: "✦" }, cheapest: { t: "Самый дешёвый", c: T.green, icon: "₽" }, relevant: { t: "Хитрый маршрут", c: T.cyan, icon: "✈" }, stopover: { t: "Лучший stopover", c: T.violet, icon: "🌙" } };
const dayWord = (n) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return "дней"; if (b === 1) return "день"; if (b >= 2 && b <= 4) return "дня"; return "дней"; };
const PREP = { "Куала-Лумпур": "Куала-Лумпуре", "Сингапур": "Сингапуре", "Стамбул": "Стамбуле", "Дубай": "Дубае", "Пекин": "Пекине", "Бангкок": "Бангкоке", "Сеул": "Сеуле", "Доха": "Дохе", "Гонконг": "Гонконге", "Абу-Даби": "Абу-Даби" };
const prep = (c) => PREP[c] || c;
const stopLabel = (s) => `${s.nights} ${dayWord(s.nights)} в ${prep(s.city)}`;

function Icon({ d, size = 20, color = T.violet }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>; }
const I = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>, pin: <><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></>, swap: <><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" /></>,
  back: <><path d="M15 18l-6-6 6-6" /></>, arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  moon: <><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></>, heart: <><path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 5a5 5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z" /></>,
  plane: <><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L11 19v-5.5z" /></>,
  spark: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>, home: <><path d="M3 11l9-8 9 8M5 10v10h14V10" /></>,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a4 4 0 000-8H9a4 4 0 010-8h7" /></>, hotel: <><path d="M3 21V5h18v16M3 21h18M7 9h.01M11 9h.01M15 9h.01" /></>,
  chevR: <><path d="M9 6l6 6-6 6" /></>, chevL: <><path d="M15 6l-6 6 6 6" /></>, close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  bag: <><rect x="5" y="8" width="14" height="12" rx="2" /><path d="M9 8V6a3 3 0 016 0v2" /></>, copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></>, search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
};

function Porthole({ grad = GRAD.sunset, h = 150, label, sub, codeRight, style }) {
  /* ФОТО-ЗАГЛУШКА: замените `background: grad` ниже на backgroundImage:url(...) для реальных фото */
  return <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", height: h, background: grad, boxShadow: "inset 0 0 40px rgba(0,0,0,.35), inset 0 0 0 3px rgba(255,255,255,.08)", ...style }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 70% 20%, rgba(255,255,255,.25), transparent 60%)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", background: "linear-gradient(transparent, rgba(5,5,20,.85))" }} />
    {label && <div style={{ position: "absolute", left: 12, bottom: 10 }}><div style={{ color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "Sora,sans-serif" }}>{label}</div>{sub && <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12 }}>{sub}</div>}</div>}
    {codeRight && <div style={{ position: "absolute", right: 10, bottom: 10, color: "#fff", fontWeight: 700, fontSize: 12, opacity: .9 }}>{codeRight}</div>}
  </div>;
}
function Badge({ label, color = T.violet, icon }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: color + "22", border: `1px solid ${color}55`, color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}</span>; }
function Btn({ children, onClick, grad = GRAD.cta, style }) { return <button onClick={onClick} className="press" style={{ border: "none", cursor: "pointer", color: "#fff", fontWeight: 700, fontFamily: "Sora,sans-serif", fontSize: 15, borderRadius: 16, padding: "16px 20px", width: "100%", background: grad, boxShadow: "0 10px 30px -8px rgba(124,92,255,.6)", ...style }}>{children}</button>; }
function Logo() { return <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text, letterSpacing: .2 }}>TripWise<span style={{ color: T.violet }}>AI</span></div>; }
function Header({ onBack, title, subtitle }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px 8px", position: "relative", minHeight: 30 }}>
    {onBack && <div onClick={onBack} className="press" style={{ position: "absolute", left: 20, top: 16, transform: "translateY(20px)", zIndex: 5, cursor: "pointer" }}><Icon d={I.back} size={22} color={T.text} /></div>}
    <div style={{ transform: title ? "translateY(-5px)" : "translateY(-20px)" }}>{title ? <div style={{ textAlign: "center", maxWidth: 240 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>{subtitle && <div style={{ fontSize: 11, color: T.subd, marginTop: 2 }}>{subtitle}</div>}</div> : <Logo />}</div>
  </div>;
}
function BottomNav({ tab, setTab, bottomStr = "0px" }) {
  const items = [["home", "Главная", I.home], ["routes", "Маршруты", I.route], ["hotels", "Отели", I.hotel], ["profile", "Профиль", I.user]];
  return <div style={{ flexShrink: 0, minHeight: 64, paddingBottom: `max(${bottomStr}, 12px)`, display: "flex", background: "rgba(10,10,24,.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${T.line}` }}>
    {items.map(([k, label, ic]) => (<button key={k} onClick={() => setTab(k)} className="press" style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8, color: tab === k ? T.violet : T.subd }}><Icon d={ic} size={22} color={tab === k ? T.violet : T.subd} /><span style={{ fontSize: 11, fontWeight: tab === k ? 700 : 500 }}>{label}</span></button>))}
  </div>;
}
function Toast({ msg }) { if (!msg) return null; return <div style={{ position: "fixed", left: "50%", bottom: 86, transform: "translateX(-50%)", zIndex: 100, background: "#1c1c40", border: `1px solid ${T.line2}`, color: T.text, fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 999, boxShadow: "0 8px 30px rgba(0,0,0,.5)", animation: "fadeUp .25s ease" }}>{msg}</div>; }
function Overlay({ children, onClose }) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fade .2s ease" }} />
    <div style={{ position: "relative", background: T.bg2, borderRadius: "24px 24px 0 0", border: `1px solid ${T.line}`, paddingTop: 16, paddingLeft: 20, paddingRight: 20, paddingBottom: "calc(24px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 420, margin: "0 auto", animation: "slideUp .28s cubic-bezier(.2,.8,.2,1)" }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line2, margin: "0 auto 14px" }} />{children}
    </div>
  </div>;
}
function SheetHead({ title, onClose }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 17, color: T.text }}>{title}</span><div onClick={onClose} className="press" style={{ cursor: "pointer" }}><Icon d={I.close} size={20} color={T.sub} /></div></div>; }

/* ---- выбор аэропорта с поиском ---- */
function AirportPicker({ title, onPick, onClose }) {
  const [q, setQ] = useState("");
  const list = filterAirports(q).slice(0, 60);
  return <Overlay onClose={onClose}>
    <SheetHead title={title} onClose={onClose} />
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.line2}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
      <Icon d={I.search} size={18} color={T.subd} />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Город, страна или код" style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 15, fontFamily: "Manrope,sans-serif" }} />
    </div>
    <div style={{ maxHeight: 320, overflowY: "auto" }}>
      {list.map((a) => (<div key={a.code} onClick={() => onPick(a)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}>
        <span style={{ fontSize: 22 }}>{a.flag}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, color: T.text, fontWeight: 600 }}>{a.city} {a.destId && <span style={{ fontSize: 10, color: T.violet }}>✦ умный поиск</span>}</div><div style={{ fontSize: 11.5, color: T.subd }}>{a.country}</div></div>
        <span style={{ fontSize: 12, color: T.subd, fontWeight: 700 }}>{a.code}</span>
      </div>))}
      {!list.length && <div style={{ color: T.subd, fontSize: 13, padding: 20, textAlign: "center" }}>Ничего не найдено</div>}
    </div>
  </Overlay>;
}

/* ---- календарь ---- */
function Calendar({ initial, onClose, onApply }) {
  const [round, setRound] = useState(initial.round);
  const [dep, setDep] = useState(initial.dep);
  const [ret, setRet] = useState(initial.ret);
  const [view, setView] = useState(new Date(initial.dep || Date.now()));
  const y = view.getFullYear(), m = view.getMonth();
  const startWd = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pick = (d) => { if (!round) { setDep(d); return; } if (!dep || (dep && ret) || d < dep) { setDep(d); setRet(null); } else if (d > dep) setRet(d); else setDep(d); };
  const inRange = (d) => round && dep && ret && d > dep && d < ret;
  const same = (a, b) => a && b && a.getTime() === b.getTime();
  const cells = []; for (let i = 0; i < startWd; i++) cells.push(null); for (let dn = 1; dn <= days; dn++) cells.push(new Date(y, m, dn));
  return <Overlay onClose={onClose}>
    <SheetHead title="Когда летим?" onClose={onClose} />
    <div style={{ display: "flex", background: T.card, borderRadius: 12, padding: 4, marginBottom: 16 }}>
      {[["Туда и обратно", true], ["В одну сторону", false]].map(([t, r]) => (<button key={t} onClick={() => { setRound(r); if (!r) setRet(null); }} style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: 10, fontWeight: 700, fontSize: 13, background: round === r ? GRAD.violet : "transparent", color: round === r ? "#fff" : T.sub }}>{t}</button>))}
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div onClick={() => setView(new Date(y, m - 1, 1))} className="press" style={{ cursor: "pointer", padding: 6 }}><Icon d={I.chevL} size={18} color={T.sub} /></div>
      <span style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>{MON_NOM[m]} {y}</span>
      <div onClick={() => setView(new Date(y, m + 1, 1))} className="press" style={{ cursor: "pointer", padding: 6 }}><Icon d={I.chevR} size={18} color={T.sub} /></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>{WD.map(w => <div key={w} style={{ textAlign: "center", fontSize: 11, color: T.subd, padding: "4px 0" }}>{w}</div>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
      {cells.map((d, i) => { if (!d) return <div key={i} />; const dis = d < today; const sel = same(d, dep) || same(d, ret); const rng = inRange(d);
        return <div key={i} onClick={() => !dis && pick(d)} style={{ textAlign: "center", padding: "9px 0", borderRadius: 9, fontSize: 13.5, cursor: dis ? "default" : "pointer", color: dis ? T.subd + "66" : sel ? "#fff" : T.text, fontWeight: sel ? 800 : 500, background: sel ? GRAD.violet : rng ? T.violet + "22" : "transparent" }}>{d.getDate()}</div>; })}
    </div>
    <div style={{ marginTop: 16 }}><Btn onClick={() => (dep && (!round || ret)) && onApply({ round, dep, ret: round ? ret : null })} style={{ opacity: dep && (!round || ret) ? 1 : .5 }}>{dep ? (round ? (ret ? `${fmtShort(dep)} — ${fmtShort(ret)}` : "Выберите дату возврата") : fmtShort(dep)) : "Выберите дату"}</Btn></div>
  </Overlay>;
}

function Stepper({ v, set }) {
  return <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div onClick={() => set(Math.max(1, v - 1))} className="press" style={{ width: 26, height: 26, borderRadius: 8, background: T.card2, display: "grid", placeItems: "center", cursor: "pointer", color: T.sub }}>−</div>
    <span style={{ fontWeight: 700, color: T.text, minWidth: 12, textAlign: "center" }}>{v}</span>
    <div onClick={() => set(Math.min(9, v + 1))} className="press" style={{ width: 26, height: 26, borderRadius: 8, background: T.card2, display: "grid", placeItems: "center", cursor: "pointer", color: T.violet }}>+</div>
  </div>;
}
function SearchSheet({ form, setForm, onClose, onSubmit, setToast }) {
  const [picker, setPicker] = useState(null); const [cal, setCal] = useState(false);
  const datesLabel = form.dep ? (form.round && form.ret ? `${fmtShort(form.dep)} — ${fmtShort(form.ret)}` : fmtShort(form.dep)) : "Выберите даты";
  const rows = [
    ["Откуда", form.origin.city, I.pin, () => setPicker("origin"), true],
    ["Куда", `${form.dest.city}, ${form.dest.country}`, I.pin, () => setPicker("dest")],
    ["Когда", datesLabel, I.cal, () => setCal(true), false, form.round ? "Туда и обратно" : "В одну сторону"],
    ["Пассажиры и класс", `${form.adults} ${form.adults === 1 ? "взрослый" : "взрослых"}, Эконом`, I.user, null],
  ];
  const valid = form.origin && form.dest && form.dep && (!form.round || form.ret);
  return <>
    <Overlay onClose={onClose}>
      <SheetHead title="Выберите данные для поиска" onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(([label, val, ic, fn, swap, tag]) => (<div key={label} onClick={fn || undefined} className={fn ? "press" : ""} style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 14px", cursor: fn ? "pointer" : "default" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: GRAD.violet, display: "grid", placeItems: "center" }}><Icon d={ic} size={17} color="#fff" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.subd }}>{label}</div><div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{val}</div></div>
          {tag && <span style={{ fontSize: 11, color: T.sub }}>{tag}</span>}
          {label === "Откуда" ? <div onClick={(e) => { e.stopPropagation(); setForm({ ...form, origin: form.dest, dest: form.origin }); }} style={{ cursor: "pointer" }}><Icon d={I.swap} size={18} color={T.sub} /></div>
            : label === "Пассажиры и класс" ? <Stepper v={form.adults} set={(n) => setForm({ ...form, adults: n })} /> : <Icon d={I.chevR} size={18} color={T.subd} />}
        </div>))}
      </div>
      <div style={{ marginTop: 18 }}><Btn onClick={() => valid ? onSubmit() : setToast("Заполните откуда, куда и даты")} style={{ opacity: valid ? 1 : .55 }}>Найти маршруты&nbsp;&nbsp;✦</Btn></div>
    </Overlay>
    {picker && <AirportPicker title={picker === "origin" ? "Откуда" : "Куда"} onClose={() => setPicker(null)} onPick={(a) => { setForm({ ...form, [picker]: a }); setPicker(null); }} />}
    {cal && <Calendar initial={{ round: form.round, dep: form.dep, ret: form.ret }} onClose={() => setCal(false)} onApply={(v) => { setForm({ ...form, ...v }); setCal(false); }} />}
  </>;
}

/* ================================ Главная =============================== */
function Home({ onSearch, onPickDest, goProfile }) {
  const adv = [["Умные маршруты", "Экономим до 20%", GRAD.violet, I.spark], ["StopOver-маршруты", "Ещё одна страна бесплатно", GRAD.night, I.moon], ["Промокоды на отели", "Скидки до 20%", GRAD.city, I.hotel], ["Сервисы путешествий", "Залы, eSIM, страховка", GRAD.ocean, I.bag]];
  const ideas = [["Бали", "через Сингапур", "20–40%", GRAD.ocean, "SIN", "bali"], ["Токио", "через Сеул", "30–50%", GRAD.city, "ICN", "tokyo"], ["Мальдивы", "через Дубай", "25–45%", GRAD.sunset, "DXB", "maldives"], ["Пхукет", "через Куала-Лумпур", "20–40%", GRAD.night, "KUL", "phuket"]];
  return <div style={{ paddingBottom: 16, animation: "fadeUp .3s ease" }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><h1 style={{ fontFamily: "Sora,sans-serif", fontSize: 30, lineHeight: 1.08, margin: 0, fontWeight: 800, color: T.text }}>Куда<br />хочется<br /><span style={{ background: "linear-gradient(90deg,#48dcdc,#7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>отправиться?</span></h1><p style={{ color: T.sub, fontSize: 13, marginTop: 12, lineHeight: 1.4 }}>Найдём лучшие маршруты,<br />о которых вы не знали</p></div>
        <Porthole grad={GRAD.hero} h={170} style={{ width: 130, borderRadius: 22 }} />
      </div>
    </div>
    <div style={{ padding: "18px 30px 0" }}>
      <div onClick={onSearch} className="press" style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, cursor: "pointer", boxShadow: "0 8px 30px -12px rgba(124,92,255,.5)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: GRAD.violet, display: "grid", placeItems: "center" }}><Icon d={I.pin} size={18} color="#fff" /></div>
        <span style={{ color: T.sub, flex: 1, fontSize: 15 }}>Выберите направление</span>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: GRAD.cta, display: "grid", placeItems: "center" }}><Icon d={I.spark} size={18} color="#fff" /></div>
      </div>
    </div>
    <div style={{ padding: "21px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
      {adv.map(([t, s, g, ic]) => (<div key={t} style={{ textAlign: "center" }}><div style={{ height: 52, borderRadius: 14, background: g, display: "grid", placeItems: "center", marginBottom: 6 }}><Icon d={ic} size={20} color="#fff" /></div><div style={{ fontSize: 10.5, color: T.text, fontWeight: 700, lineHeight: 1.15 }}>{t}</div><div style={{ fontSize: 9.5, color: T.subd, marginTop: 2 }}>{s}</div></div>))}
    </div>
    <div style={{ padding: "22px 0 0 20px" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 17, marginBottom: 12 }}>Идеи для путешествий ✨</div>
      <div className="carousel" style={{ display: "flex", gap: 12, overflowX: "auto", paddingRight: 20, paddingBottom: 4, scrollSnapType: "x mandatory" }}>
        {ideas.map(([name, via, save, g, code, id]) => (<div key={name} onClick={() => onPickDest(id)} className="press" style={{ minWidth: 160, cursor: "pointer", scrollSnapAlign: "start" }}><Porthole grad={g} h={110} label={name} sub={via} codeRight={"→ " + code} style={{ borderRadius: 16 }} /><div style={{ marginTop: 8, fontSize: 11, color: T.subd }}>Скидка</div><div style={{ fontSize: 15, fontWeight: 800, color: T.green, fontFamily: "Sora,sans-serif" }}>{save}</div></div>))}
      </div>
    </div>
    <div style={{ padding: "15px 20px 0" }}>
      <div onClick={goProfile} className="press" style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, cursor: "pointer" }}>
        <div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>Бизнес-залы, eSIM и страховка</div><div style={{ color: T.subd, fontSize: 12, marginTop: 4 }}>Всё для комфортной поездки</div></div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: GRAD.cta, display: "grid", placeItems: "center" }}><Icon d={I.arrow} size={18} color="#fff" /></div>
      </div>
    </div>
  </div>;
}

/* ================================ Результаты ============================ */
function Skeleton() { return <div style={{ height: 150, borderRadius: 18, background: "linear-gradient(90deg,#14142e,#1a1a3a,#14142e)", backgroundSize: "200% 100%", animation: "sh 1.3s infinite" }} />; }
function RouteCard({ r, onOpen, liked, onLike, i }) {
  const grad = r.badge === "cheapest" ? GRAD.sunset : r.badge === "unexpected" ? GRAD.city : GRAD.night;
  const dur = legDur(r.segments);
  const codes = r.segments.map((s, idx) => idx === 0 ? [s.fromCode, s.toCode] : [s.toCode]).flat();
  return <div onClick={onOpen} className="press card-in" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 20, padding: 14, cursor: "pointer", animationDelay: `${i * 70}ms` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(r.picks || [r.badge]).map(p => { const l = LABELS[p]; return l ? <Badge key={p} label={l.t} color={l.c} icon={l.icon} /> : null; })}</div>
      {r.priced && r.savings > 0 && <span style={{ color: T.green, fontWeight: 800, fontSize: 14 }}>↓ {rub(r.savings)}</span>}
    </div>
    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 15.5, color: T.text, lineHeight: 1.25 }}>{r.title || (r.stopover ? `Через ${r.stopover.city}` : "Маршрут")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", flex: 1 }}>{codes.map((c, idx) => (<React.Fragment key={idx}>{idx > 0 && <Icon d={I.plane} size={12} color={T.subd} />}<span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c}</span></React.Fragment>))}</div>
          <Icon d={I.chevR} size={16} color={T.violet} />
        </div>
      </div>
      <Porthole grad={grad} h={84} style={{ width: 110, borderRadius: 14 }} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
      <Icon d={r.stopover ? I.moon : I.clock} size={18} color={T.violet} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: T.text, fontWeight: 600 }}>{r.stopover ? `Stopover: ${r.stopover.city}` : (r.transfers ? "Пересадка" : "Прямой перелёт")}</div><div style={{ fontSize: 11, color: T.subd }}>{r.stopover ? `${r.stopover.nights} ноч.` : (r.transfers ? hm(dur) : "Без пересадок")}</div></div>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text }}>{rub(r.total)}</div>
      <div onClick={(e) => { e.stopPropagation(); onLike(r); }} className="press" style={{ cursor: "pointer", padding: 4 }}><Icon d={I.heart} size={20} color={liked ? T.pink : T.subd} /></div>
    </div>
  </div>;
}
function Results({ query, routes, loading, error, onRetry, onBack, onEdit, onOpen, isLiked, onLike }) {
  return <div style={{ animation: "slideIn .28s ease" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px", position: "relative" }}>
      <div onClick={onBack} className="press" style={{ cursor: "pointer", transform: "translateY(20px)", zIndex: 5 }}><Icon d={I.back} size={22} color={T.text} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", transform: "translateY(20px)", pointerEvents: "none" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>{query.origin} → {query.destName}</div><div style={{ fontSize: 11, color: T.subd }}>{query.datesLabel}</div></div>
      <span onClick={onBack} className="press" style={{ color: T.violet, fontSize: 13, fontWeight: 700, cursor: "pointer", transform: "translateY(20px)", zIndex: 5 }}>Изменить</span>
    </div>
    {error ? <div style={{ textAlign: "center", padding: "40px 20px" }}><div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>Не удалось загрузить данные</div><div style={{ fontSize: 13, marginTop: 6, marginBottom: 16, color: T.subd }}>Проверьте соединение и попробуйте ещё раз</div><Btn onClick={onRetry}>Повторить</Btn></div> : <>
    <div style={{ padding: "4px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>Нашли <span style={{ color: T.violet }}>{loading ? "…" : routes.length} хитрых</span> способов добраться</div>
      <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4 }}>Показываем только лучшее — не сотни билетов.</div>
    </div>
    <div style={{ padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
      {loading ? [0, 1, 2].map(i => <Skeleton key={i} />) : (routes.length ? routes.map((r, i) => <RouteCard key={r.id} r={r} i={i} liked={isLiked(r)} onLike={onLike} onOpen={() => onOpen(r)} />) : <Empty onEdit={onEdit} />)}
    </div></>}
  </div>;
}
function Empty({ onEdit }) { return <div style={{ textAlign: "center", padding: "40px 20px" }}><div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>Ничего не найдено</div><div style={{ fontSize: 13, marginTop: 6, marginBottom: 16, color: T.subd }}>Попробуйте изменить параметры</div><Btn onClick={onEdit}>Изменить параметры поиска</Btn></div>; }

/* ================================ Детали ================================ */
function AirlineLogo({ code }) { const colors = ["#7c5cff", "#48dcdc", "#39d98a", "#f5c451", "#ff6db0", "#f59640"]; const c = colors[(code || "X").charCodeAt(0) % colors.length]; return <div style={{ width: 30, height: 30, borderRadius: 8, background: c + "26", border: `1px solid ${c}55`, display: "grid", placeItems: "center", color: c, fontWeight: 800, fontSize: 11, fontFamily: "Sora,sans-serif" }}>{(code || "✈").slice(0, 2)}</div>; }
function Detail({ r, query, onBack, liked, onLike, onShare, goHotels }) {
  const dur = legDur(r.segments);
  return <div style={{ animation: "slideIn .28s ease" }}>
    <Header onBack={onBack} title={`${query.origin} → ${query.destName}`} subtitle={query.datesLabel} />
    <div style={{ padding: "4px 20px 0" }}>
      <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", height: 150, background: GRAD.sunset, padding: 16, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(5,5,20,.7))" }} />
        <div style={{ position: "relative" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>{r.stopover ? stopLabel(r.stopover) : (r.title || "Маршрут")}</div>{r.stopover && <div style={{ background: "linear-gradient(90deg,#48dcdc,#7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800, fontSize: 20, fontFamily: "Sora,sans-serif" }}>почти бесплатно</div>}</div>
      </div>
    </div>
    <div style={{ padding: "12px 20px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(r.picks || [r.badge]).map(p => { const l = LABELS[p]; return l ? <Badge key={p} label={l.t} color={l.c} icon={l.icon} /> : null; })}
      {r.priced && r.savings > 0 && <Badge label={`Экономия ${rub(r.savings)}`} color={T.green} />}
    </div>
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "14px 10px" }}>
        {[[rub(r.total), "Билеты"], [r.roundTrip ? `${hm(r.durationOut || dur)} · ${hm(r.durationRet || 0)}` : hm(dur), r.roundTrip ? "Туда · Обратно" : "В пути"], [`${query.adults || 1} пасс.`, "Эконом"], [r.transfers ? `${r.transfers}` : "0", "Пересадки"]].map(([a, b], i) => (<div key={i} style={{ textAlign: "center" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 13.5 }}>{a}</div><div style={{ fontSize: 10.5, color: T.subd, marginTop: 2 }}>{b}</div></div>))}
      </div>
    </div>
    <div style={{ padding: "12px 20px 0" }}>
      <div className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, opacity: .75 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${T.subd}` }} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: T.text, fontWeight: 600 }}>Добавить багаж на весь маршрут</div><div style={{ fontSize: 11, color: T.subd }}>В разработке — данные по багажу появятся позже</div></div>
      </div>
    </div>
    <div style={{ padding: "18px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16, marginBottom: 10 }}>{r.segments && r.segments.length > 0 ? "Маршрут по сегментам" : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {r.segments.map((s, i) => (<div key={i}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AirlineLogo code={s.airline} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{airlineName(s.airline)}</div><div style={{ fontSize: 11, color: T.subd }}>{s.flightNumber || (s.mode === "ferry" ? "Паром" : "рейс уточняется")}</div></div>
              {s.mode === "ferry" ? <Badge label="паром" color={T.cyan} /> : (r.segments.length === 1 && (s.transfers || 0) === 0 ? <Badge label="Прямой рейс" color={T.green} /> : (r.segments.length === 1 ? null : <Badge label={`Рейс ${i + 1}`} color={T.violet} />))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 16 }}>{s.departHM || timeOf(s.departISO)}</div><div style={{ fontSize: 11, color: T.subd }}>{s.fromCode}</div></div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: T.subd }}>{hm(s.durationMin || 0)}<div style={{ height: 1, background: T.line, margin: "5px 0" }} />{(s.transfers || 0) > 0 ? `${s.transfers} ${s.transfers === 1 ? "пересадка" : "пересадки"}` : "прямой"}</div>
              <div style={{ textAlign: "right" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 16 }}>{s.arriveHM || "—"}</div><div style={{ fontSize: 11, color: T.subd }}>{s.toCode}</div></div>
              <a href={s.deepLink || (r.bookingLinks && r.bookingLinks[i] && r.bookingLinks[i].url) || "#"} target="_blank" rel="noreferrer" className="press" style={{ textDecoration: "none" }}><div style={{ background: GRAD.cta, borderRadius: 12, padding: "8px 12px", color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{rub(s.priceLive || s.priceEstimate)}</div></a>
            </div>
          </div>
          {r.stopover && i === 0 && r.segments.length > 1 && (
            <div style={{ background: T.card2, border: `1px solid ${T.violet}33`, borderRadius: 14, padding: 12, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={I.moon} size={16} color={T.violet} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Stopover в {r.stopover.city} • {r.stopover.nights} ноч.</span></div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Porthole grad={GRAD.city} h={70} style={{ width: 92, borderRadius: 10 }} />
                <div style={{ flex: 1 }}><Badge label="Рекомендуем" color={T.gold} /><div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 6 }}>The Ritz-Carlton</div><div style={{ fontSize: 11, color: T.gold }}>★ 4.8 · 500 м до башен Петронас</div></div>
              </div>
              <div onClick={goHotels} className="press" style={{ marginTop: 10, textAlign: "center", background: T.violet + "22", border: `1px solid ${T.violet}55`, borderRadius: 10, padding: 8, color: T.violet, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Посмотреть варианты</div>
            </div>)}
        </div>))}
      </div>
      {(() => { const notes = (r.notes || []).filter(n => (r.segments || []).length <= 2 || !/раздельны|отдельных билета/i.test(n)); return notes.length > 0 ? <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>{notes.map((n, i) => <Badge key={i} label={n} color={T.cyan} />)}</div> : null; })()}
    </div>
    {r.segments && r.segments.length === 0 && r.bookingLinks && r.bookingLinks.length > 0 && (
      <div style={{ padding: "8px 20px 0" }}>
        <a href={r.bookingLinks[0].url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn>Купить билет · {rub(r.total)}</Btn></a>
      </div>)}
    <div style={{ padding: "16px 20px 8px", display: "flex", gap: 10 }}>
      <div onClick={() => onLike(r)} className="press" style={{ width: 52, borderRadius: 16, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", background: T.card, cursor: "pointer" }}><Icon d={I.heart} size={20} color={liked ? T.pink : T.subd} /></div>
      <Btn style={{ flex: 1 }} onClick={() => onShare(r)}>Поделиться маршрутом</Btn>
    </div>
  </div>;
}

/* ================================ Профиль =============================== */
function Profile({ name, onTraveler, onEditName, setToast }) {
  const services = [["Страхование", I.shield], ["Бизнес-залы", I.user], ["eSIM", I.bag]];
  return <div style={{ animation: "fadeUp .3s ease" }}>
    <Header />
    <div style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 60, height: 60, borderRadius: 999, background: GRAD.night, display: "grid", placeItems: "center", fontSize: 26 }}>🧑‍✈️</div>
      <div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 19, color: T.text }}>{name}</div></div>
      <div onClick={onEditName} className="press" style={{ cursor: "pointer", padding: 6 }}><Icon d={I.chevR} size={20} color={T.subd} /></div>
    </div>
    <div style={{ padding: "18px 20px 0" }}>
      <div onClick={onTraveler} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon d={I.user} size={18} color={T.violet} /><span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>Путешественник</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}><Icon d={I.pin} size={18} color={T.violet} /><div style={{ flex: 1 }}><div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>Паспорт, гражданство и визы</div><div style={{ fontSize: 11.5, color: T.subd }}>Россия, Шенген, Таиланд и ещё 2</div></div><Icon d={I.chevR} size={18} color={T.subd} /></div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: T.subd }}>✓ Эти данные помогают подбирать маршруты с учётом визовых требований</div>
      </div>
    </div>
    <div style={{ padding: "22px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16, marginBottom: 12 }}>Полезные сервисы</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {services.map(([t, ic]) => (<div key={t} onClick={() => setToast(`${t} — в разработке`)} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, cursor: "pointer" }}><Icon d={ic} size={20} color={T.violet} /><div style={{ fontSize: 11.5, color: T.text, fontWeight: 600, marginTop: 8, lineHeight: 1.2 }}>{t}</div><div style={{ fontSize: 9.5, color: T.subd, marginTop: 2 }}>в разработке</div></div>))}
      </div>
    </div>
    <div style={{ padding: "22px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16, marginBottom: 12 }}>О приложении</div>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
        {[["Поддержка", ""], ["Политика конфиденциальности", ""], ["Версия приложения", "1.0.0"]].map(([t, v], i) => (<div key={t} onClick={() => v || setToast("Раздел в разработке")} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: 15, borderTop: i ? `1px solid ${T.line}` : "none", cursor: "pointer" }}><span style={{ flex: 1, fontSize: 14, color: T.text }}>{t}</span>{v && <span style={{ fontSize: 12.5, color: T.subd }}>{v}</span>}<Icon d={I.chevR} size={16} color={T.subd} /></div>))}
      </div>
    </div>
  </div>;
}
function NameEdit({ name, onSave, onClose }) {
  const [v, setV] = useState(name);
  return <Overlay onClose={onClose}><SheetHead title="Изменить имя" onClose={onClose} />
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.line2}`, borderRadius: 14, padding: "14px 16px", color: T.text, fontSize: 16, fontFamily: "Manrope,sans-serif", outline: "none", marginBottom: 16 }} />
    <Btn onClick={() => onSave(v.trim() || name)}>Сохранить</Btn>
  </Overlay>;
}

/* ===================== Настройки путешественника ===================== */
function TravelerRow({ flag, name, on, onToggle, sub, addMode }) {
  return <div onClick={onToggle} className="press" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}>
    <span style={{ fontSize: 20 }}>{flag}</span>
    <div style={{ flex: 1 }}><span style={{ fontSize: 14, color: T.text }}>{name}</span>{sub && <span style={{ fontSize: 11, color: T.subd, marginLeft: 6 }}>{sub}</span>}</div>
    {addMode ? <div style={{ width: 24, height: 24, borderRadius: 999, background: on ? T.violet : T.violet + "22", color: on ? "#fff" : T.violet, display: "grid", placeItems: "center", fontSize: 16 }}>{on ? "✓" : "+"}</div>
      : <div style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${on ? T.violet : T.subd}`, background: on ? T.violet : "transparent", display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>{on ? "✓" : ""}</div>}
  </div>;
}
function FilterBox({ ph, v, set }) { return <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}><Icon d={I.search} size={16} color={T.subd} /><input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 13.5, fontFamily: "Manrope,sans-serif" }} /></div>; }
function Traveler({ onBack, safeTop, bottomStr = "0px" }) {
  const [tab, setTab] = useState("cit"); const [q, setQ] = useState("");
  const allCit = [["🇷🇺", "Россия"], ["🇰🇿", "Казахстан"], ["🇦🇺", "Австралия"], ["🇦🇹", "Австрия"], ["🇦🇿", "Азербайджан"], ["🇦🇱", "Албания"], ["🇦🇷", "Аргентина"], ["🇦🇲", "Армения"], ["🇧🇾", "Беларусь"], ["🇩🇪", "Германия"], ["🇬🇪", "Грузия"]];
  const [cit, setCit] = useState({ "Россия": true, "Казахстан": true });
  const allVisas = [["🇪🇺", "Шенгенская зона", "26 стран"], ["🇺🇸", "США"], ["🇨🇦", "Канада"], ["🇬🇧", "Великобритания"], ["🇯🇵", "Япония"], ["🇨🇳", "Китай"], ["🇦🇺", "Австралия"], ["🇳🇿", "Новая Зеландия"], ["🇰🇷", "Южная Корея"], ["🇹🇭", "Таиланд"], ["🇹🇷", "Турция"], ["🇦🇪", "ОАЭ"]];
  const [vis, setVis] = useState({ "Шенгенская зона": true, "США": true, "Канада": true });
  const f = (arr) => arr.filter(x => x[1].toLowerCase().includes(q.toLowerCase()));
  return <div style={{ position: "fixed", inset: 0, zIndex: 50, background: T.bg2, display: "flex", flexDirection: "column", maxWidth: 420, margin: "0 auto", paddingTop: safeTop || 0, animation: "slideIn .28s ease" }}>
    <Header onBack={onBack} title="Путешественник" />
    <div style={{ margin: "4px 20px 0", background: T.card, borderRadius: 12, padding: 4, display: "flex" }}>
      {[["cit", "Гражданство"], ["vis", "Визы"]].map(([k, t]) => (<button key={k} onClick={() => { setTab(k); setQ(""); }} style={{ flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: 10, fontWeight: 700, fontSize: 13.5, background: tab === k ? GRAD.violet : "transparent", color: tab === k ? "#fff" : T.sub }}>{t}</button>))}
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 90px" }}>
      {tab === "cit" ? <>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Ваше гражданство</div>
        <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 12 }}>Нажмите на страну, чтобы добавить или убрать</div>
        <FilterBox ph="Поиск страны" v={q} set={setQ} />
        {f(allCit).map(([fl, n]) => <TravelerRow key={n} flag={fl} name={n} on={!!cit[n]} addMode onToggle={() => setCit({ ...cit, [n]: !cit[n] })} />)}
      </> : <>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Ваши визы</div>
        <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 12 }}>Выберите страны, для которых у вас есть действующие визы</div>
        <FilterBox ph="Поиск страны" v={q} set={setQ} />
        {f(allVisas).map(([fl, n, sub]) => <TravelerRow key={n} flag={fl} name={n} sub={sub} on={!!vis[n]} onToggle={() => setVis({ ...vis, [n]: !vis[n] })} />)}
        <div style={{ marginTop: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, fontSize: 11.5, color: T.subd }}>ⓘ <b style={{ color: T.sub }}>Важно знать.</b> Информация о визах используется только для подбора маршрутов и не передаётся третьим лицам.</div>
      </>}
    </div>
    <div style={{ padding: "12px 20px", paddingBottom: `max(${bottomStr}, 16px)`, borderTop: `1px solid ${T.line}` }}><Btn onClick={onBack}>Сохранить</Btn></div>
  </div>;
}

/* ================================ Маршруты ============================== */
function Section({ title, action, onAction, children }) { return <div style={{ padding: "22px 20px 0" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><span style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16 }}>{title}</span>{action && <span onClick={onAction} className="press" style={{ color: T.violet, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{action}</span>}</div>{children}</div>; }
function RoutesScreen({ onPickDest, onSearch, saved, onUnlike, onOpenSaved, recent, onClearRecent, onRunRecent }) {
  const [showAll, setShowAll] = useState(false);
  const picks = [["Stopover в Стамбуле", "от 28 400 ₽", "7 маршрутов", GRAD.sunset, "tokyo"], ["Таиланд с остановкой в Бангкоке", "от 31 150 ₽", "9 маршрутов", GRAD.ocean, "phuket"], ["Сингапур за 1 день", "от 34 900 ₽", "6 маршрутов", GRAD.city, "bali"]];
  const visible = showAll ? saved : saved.slice(0, 3);
  return <div style={{ animation: "fadeUp .3s ease" }}>
    <Header />
    <div style={{ padding: "8px 0 0 20px" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16, marginBottom: 12 }}>TripWise подборки</div>
      <div className="carousel" style={{ display: "flex", gap: 12, overflowX: "auto", paddingRight: 20, paddingBottom: 4, scrollSnapType: "x mandatory" }}>
        {picks.map(([n, p, m, g, id]) => (<div key={n} onClick={() => onPickDest(id)} className="press" style={{ minWidth: 160, cursor: "pointer", scrollSnapAlign: "start" }}><Porthole grad={g} h={110} style={{ borderRadius: 16 }} /><div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 8, lineHeight: 1.2 }}>{n}</div><div style={{ fontSize: 12, color: T.violet, fontWeight: 700, marginTop: 2 }}>{p}</div><div style={{ fontSize: 11, color: T.subd }}>{m}</div></div>))}
      </div>
    </div>
    <Section title="Сохранённые маршруты" action={saved.length > 3 ? (showAll ? "Свернуть" : "Смотреть все") : null} onAction={() => setShowAll(!showAll)}>
      {visible.length ? visible.map((s) => (<div key={s.id} onClick={() => onOpenSaved(s)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: GRAD.night, display: "grid", placeItems: "center", fontSize: 18 }}>{s.emoji}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.name}</div><div style={{ fontSize: 11, color: T.subd }}>{s.dates} • {s.adults || 1} взрослый • Эконом</div></div>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>от {rub(s.price)}</div>
        <div onClick={(e) => { e.stopPropagation(); onUnlike(s.id); }} className="press" style={{ cursor: "pointer", padding: 4 }}><Icon d={I.heart} size={18} color={T.pink} /></div>
      </div>)) : <div style={{ color: T.subd, fontSize: 13, padding: "8px 2px" }}>Пока пусто — лайкните маршрут в результатах поиска</div>}
    </Section>
    <Section title="Последние поиски" action={recent.length ? "Очистить" : null} onAction={onClearRecent}>
      {recent.length ? recent.map((s, i) => (<div key={i} onClick={() => onRunRecent(s)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}><Icon d={I.clock} size={18} color={T.violet} /><div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.name}</div><div style={{ fontSize: 11, color: T.subd }}>{s.dates} • 1 взрослый • Эконом</div></div></div>)) : <div style={{ color: T.subd, fontSize: 13, padding: "8px 2px" }}>История пуста</div>}
    </Section>
    <div style={{ padding: "16px 20px 8px" }}><Btn onClick={onSearch}>＋ Найти новый маршрут</Btn></div>
  </div>;
}

/* ================================ Отели ================================= */
/*
  ╔══════════════════════════════════════════════════════════════════════╗
  ║  КАК ДОБАВЛЯТЬ ПРОМОКОДЫ (заглушка под ручное заполнение)              ║
  ║  Каждый сервис = объект с массивом promos. Новый промокод — новый      ║
  ║  объект в массив promos этого сервиса:                                 ║
  ║    {                                                                   ║
  ║      header: "Одно предложение — заголовок над кодом",                 ║
  ║      code: "PROMO2026",          // сам промокод                       ║
  ║      discountRub: 5000,          // скидка в рублях (для сортировки)    ║
  ║      endDate: "2026-12-31",      // действует до этой даты (вкл.)       ║
  ║    }                                                                   ║
  ║  Показываются только НЕистёкшие (endDate >= сегодня), сортируются по    ║
  ║  discountRub по убыванию. Чтобы добавить новый СЕРВИС — новый объект    ║
  ║  в массив SERVICES.                                                    ║
  ╚══════════════════════════════════════════════════════════════════════╝
*/
const SERVICES = [
  { id: "yandex", name: "Яндекс Путешествия", desc: "Отели по всему миру", grad: GRAD.ocean, url: "https://travel.yandex.ru",
    promos: [
      { header: "Скидка на первое бронирование отеля", code: "TRIPWISE20", discountRub: 5000, endDate: "2026-12-31" },
      { header: "Кэшбэк баллами на популярные направления", code: "YANDEX1500", discountRub: 1500, endDate: "2026-09-30" },
    ] },
  { id: "ostrovok", name: "Островок", desc: "Кэшбэк на бронирования", grad: GRAD.sunset, url: "https://ostrovok.ru",
    promos: [
      { header: "Скидка на отели в Азии", code: "OSTROVOK15", discountRub: 3000, endDate: "2026-11-15" },
    ] },
  { id: "bali", name: "Bali Resorts", desc: "Спецпредложение на виллы", grad: GRAD.city, url: "https://example.com",
    promos: [
      { header: "Скидка на виллы с бассейном", code: "BALI25", discountRub: 8000, endDate: "2026-10-01" },
      // пример истёкшего — НЕ покажется: { header:"Старая акция", code:"OLD", discountRub:9999, endDate:"2025-01-01" },
    ] },
];
function Hotels({ setToast }) {
  const [svc, setSvc] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const copy = async (code) => { try { await navigator.clipboard.writeText(code); setToast("Промокод скопирован"); } catch (e) { setToast("Не удалось скопировать"); } };
  const activePromos = (s) => (s.promos || []).filter(p => p.endDate >= today).sort((a, b) => b.discountRub - a.discountRub);
  return <div style={{ animation: "fadeUp .3s ease" }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>Промокоды на отели</div>
      <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>Выберите сервис — внутри активные промокоды.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SERVICES.map((s, i) => { const n = activePromos(s).length; return (
          <div key={s.id} onClick={() => setSvc(s)} className="press card-in" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", animationDelay: `${i * 70}ms` }}>
            <Porthole grad={s.grad} h={110} style={{ borderRadius: 0 }} />
            <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}><div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>{s.name}</div><div style={{ fontSize: 12, color: T.subd }}>{s.desc}</div></div><Badge label={n ? `${n} промо` : "скоро"} color={n ? T.green : T.subd} /></div>
          </div>); })}
      </div>
    </div>
    {svc && <Overlay onClose={() => setSvc(null)}>
      <SheetHead title={svc.name} onClose={() => setSvc(null)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 380, overflowY: "auto" }}>
        {activePromos(svc).length ? activePromos(svc).map((p) => (
          <div key={p.code}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 8 }}>{p.header}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px dashed ${T.violet}`, borderRadius: 12, padding: "14px 16px" }}>
              <span style={{ flex: 1, fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.violet, letterSpacing: 1 }}>{p.code}</span>
              <div onClick={() => copy(p.code)} className="press" style={{ cursor: "pointer", padding: 6, borderRadius: 8, background: T.violet + "22" }}><Icon d={I.copy} size={18} color={T.violet} /></div>
            </div>
            <div style={{ fontSize: 11, color: T.subd, marginTop: 4 }}>Скидка до {rub(p.discountRub)} · действует до {p.endDate}</div>
          </div>
        )) : <div style={{ color: T.subd, fontSize: 13, textAlign: "center", padding: 12 }}>Активных промокодов пока нет</div>}
      </div>
      <div style={{ marginTop: 16 }}><Btn onClick={() => { try { window.open(svc.url, "_blank"); } catch (e) { } setToast(`Открываем ${svc.name}…`); }}>Перейти в {svc.name}</Btn></div>
    </Overlay>}
  </div>;
}

/* ================================ APP ================================== */
export default function App() {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]); // overlay под вкладкой «Маршруты»: results/detail
  const [sheet, setSheet] = useState(false);
  const [traveler, setTraveler] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("Даниил");
  const [inset, setInset] = useState({ top: 0, bottomStr: "env(safe-area-inset-bottom)" });
  const safeTop = inset.top;
  const [toast, setToastRaw] = useState(null);
  const toastTimer = useRef(null);
  const setToast = (m) => { setToastRaw(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastRaw(null), 2200); };

  // Telegram Mini App layout. Высоту держим на CSS (100dvh) — НЕ в JS, иначе меню "застревает" после клавиатуры.
  useEffect(() => {
    try {
      let mv = document.querySelector('meta[name="viewport"]');
      if (!mv) { mv = document.createElement("meta"); mv.name = "viewport"; document.head.appendChild(mv); }
      mv.content = "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover";
    } catch (e) { }
    const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
    if (!tg) return; // вне Telegram отступы не нужны
    const recalc = () => {
      const sa = tg.safeAreaInset || {}, ci = tg.contentSafeAreaInset || {};
      const sum = (sa.top || 0) + (ci.top || 0);
      // если Telegram прислал инсеты — берём их; иначе гарантированный запас под шапку Telegram (вырез + ~хедер)
      const top = sum > 0 ? Math.max(sum, 48) : "calc(env(safe-area-inset-top) + 52px)";
      const bottomStr = (sa.bottom || 0) > 0 ? `${sa.bottom}px` : "env(safe-area-inset-bottom)";
      setInset({ top, bottomStr });
    };
    try {
      tg.ready(); tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      const u = tg.initDataUnsafe && tg.initDataUnsafe.user; if (u && u.first_name) setName([u.first_name, u.last_name].filter(Boolean).join(" "));
      recalc();
      ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((ev) => tg.onEvent && tg.onEvent(ev, recalc));
      setTimeout(recalc, 400);
    } catch (e) { }
    return () => { try { ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((ev) => tg.offEvent && tg.offEvent(ev, recalc)); } catch (e) { } };
  }, []);

  const [form, setForm] = useState({ origin: AIRPORTS.find(a => a.code === "MOW"), dest: byDest("samui"), round: true, dep: new Date(2026, 9, 12), ret: new Date(2026, 9, 26), adults: 1 });
  const [query, setQuery] = useState({ origin: "Москва", destName: "Самуи", destinationId: "samui", adults: 1, datesLabel: "12 окт — 26 окт" });
  const [routes, setRoutes] = useState([]); const [loading, setLoading] = useState(false); const [selected, setSelected] = useState(null);
  const [searchError, setSearchError] = useState(false);

  const [saved, setSaved] = useState([
    { id: "s-bali", name: "Москва — Бали", dates: "12 окт — 26 окт", price: 45230, emoji: "🏝", route: MOCK_ROUTES[0], query: { origin: "Москва", destName: "Бали", adults: 1, datesLabel: "12 окт — 26 окт" } },
    { id: "s-tokyo", name: "Санкт-Петербург — Токио", dates: "1 ноя — 14 ноя", price: 52840, emoji: "🗼", route: MOCK_ROUTES[2], query: { origin: "Санкт-Петербург", destName: "Токио", adults: 1, datesLabel: "1 ноя — 14 ноя" } },
    { id: "s-cape", name: "Москва — Кейптаун", dates: "2 дек — 16 дек", price: 48910, emoji: "🦁", route: MOCK_ROUTES[1], query: { origin: "Москва", destName: "Кейптаун", adults: 1, datesLabel: "2 дек — 16 дек" } },
    { id: "s-x1", name: "Москва — Пхукет", dates: "5 янв — 19 янв", price: 51200, emoji: "🏖", route: MOCK_ROUTES[0], query: { origin: "Москва", destName: "Пхукет", adults: 1, datesLabel: "5 янв — 19 янв" } },
    { id: "s-x2", name: "Москва — Мальдивы", dates: "10 фев — 20 фев", price: 63400, emoji: "🐠", route: MOCK_ROUTES[1], query: { origin: "Москва", destName: "Мальдивы", adults: 1, datesLabel: "10 фев — 20 фев" } },
  ]);
  const [recent, setRecent] = useState([
    { name: "Москва — Самуи", dates: "12 окт — 26 окт", form: { origin: AIRPORTS.find(a => a.code === "MOW"), dest: byDest("samui"), round: true, dep: new Date(2026, 9, 12), ret: new Date(2026, 9, 26), adults: 1 } },
  ]);

  const top = stack[stack.length - 1];
  const datesLabel = (f) => f.dep ? (f.round && f.ret ? `${fmtShort(f.dep)} — ${fmtShort(f.ret)}` : fmtShort(f.dep)) : "";

  const runSearch = async (f) => {
    const ff = f || form;
    const nq = { origin: ff.origin.city, destName: ff.dest.city, destinationId: ff.dest.destId || ff.dest.code, adults: ff.adults, datesLabel: datesLabel(ff) };
    setQuery(nq); setSheet(false); setTab("routes"); setStack(["results"]); setLoading(true); setSearchError(false);  // <- переходим в «Маршруты»
    setRecent((p) => [{ name: `${nq.origin} — ${nq.destName}`, dates: nq.datesLabel, form: ff }, ...p.filter(x => x.name !== `${nq.origin} — ${nq.destName}`)].slice(0, 7));
    try {
      const res = await apiSearch({ origin: ff.origin.city, originCode: ff.origin.code, destinationId: ff.dest.destId || undefined, destCode: ff.dest.code, destName: ff.dest.city, dateFrom: iso(ff.dep), dateTo: ff.round && ff.ret ? iso(ff.ret) : undefined, style: "stopover", tier: "free", roundTrip: !!(ff.round && ff.ret), passengers: { adults: ff.adults } });
      setRoutes(res);
    } catch (e) { setSearchError(true); setRoutes([]); }
    setLoading(false);
  };
  const openSheetWithDest = (id) => { const a = byDest(id); setForm((f) => ({ ...f, dest: a })); setSheet(true); };
  const isLiked = (r) => !!saved.find(x => x.id === ("liked-" + r.id));
  const likeRoute = (r) => {
    const id = "liked-" + r.id;
    if (saved.find(x => x.id === id)) { setSaved(p => p.filter(x => x.id !== id)); setToast("Удалено из маршрутов"); }
    else { setSaved(p => [{ id, name: `${query.origin} — ${query.destName}`, dates: query.datesLabel, price: r.total, emoji: "🛫", route: r, query }, ...p]); setToast("Добавлено в «Маршруты»"); }
  };
  const shareRoute = (r) => {
    const link = "https://t.me/tripwiseai_bot"; // заменить на реального бота
    const text = `${query.origin} → ${query.destName} за ${rub(r.total)} — нашёл в TripWiseAI ✈️`;
    const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    try {
      if (tg && tg.openTelegramLink) { tg.openTelegramLink(shareUrl); return; }
      if (typeof navigator !== "undefined" && navigator.share) { navigator.share({ title: "TripWiseAI", text, url: link }); return; }
      window.open(shareUrl, "_blank"); setToast("Открываю Telegram…");
    } catch (e) { try { navigator.clipboard.writeText(text + " " + link); setToast("Ссылка скопирована"); } catch (_) { setToast("Поделиться недоступно"); } }
  };
  const openSaved = (s) => { setSelected(s.route); setQuery({ ...s.query, datesLabel: s.dates }); setTab("routes"); setStack(["results", "detail"]); };

  let main = null;
  if (tab === "routes") {
    if (top === "detail") main = <Detail r={selected} query={query} onBack={() => setStack(["results"])} liked={isLiked(selected)} onLike={likeRoute} onShare={shareRoute} goHotels={() => setTab("hotels")} />;
    else if (top === "results") main = <Results query={query} routes={routes} loading={loading} error={searchError} onRetry={() => runSearch()} onEdit={() => { setTab("home"); setSheet(true); }} onBack={() => setStack([])} onOpen={(r) => { setSelected(r); setStack(["results", "detail"]); }} isLiked={isLiked} onLike={likeRoute} />;
    else main = <RoutesScreen onPickDest={openSheetWithDest} onSearch={() => setSheet(true)} saved={saved} onUnlike={(id) => setSaved(p => p.filter(x => x.id !== id))} onOpenSaved={openSaved} recent={recent} onClearRecent={() => setRecent([])} onRunRecent={(s) => { setForm(s.form); runSearch(s.form); }} />;
  } else if (tab === "home") main = <Home onSearch={() => setSheet(true)} onPickDest={openSheetWithDest} goProfile={() => setTab("profile")} />;
  else if (tab === "hotels") main = <Hotels setToast={setToast} />;
  else if (tab === "profile") main = <Profile name={name} onTraveler={() => setTraveler(true)} onEditName={() => setEditName(true)} setToast={setToast} />;

  return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", justifyContent: "center" }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap');
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
      @keyframes fade{from{opacity:0}to{opacity:1}}
      .card-in{opacity:0;animation:fadeUp .4s ease forwards}
      .press{transition:transform .12s ease, opacity .12s ease}
      .press:active{transform:scale(.97);opacity:.9}
      .carousel{scrollbar-width:none}
      ::-webkit-scrollbar{display:none}
      input::placeholder{color:${T.subd}}
      input,select,textarea{font-size:16px}
      html,body{touch-action:pan-y}
      .app-root{height:100vh;height:100dvh}
    `}</style>
    <div className="app-root" style={{ width: "100%", maxWidth: 420, paddingTop: safeTop, background: `radial-gradient(120% 60% at 80% 0%, #1a1340 0%, ${T.bg} 55%)`, color: T.text, fontFamily: "Manrope,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingTop: 45 }}>{main}</div>
      <BottomNav tab={tab} setTab={setTab} bottomStr={inset.bottomStr} />
      {sheet && <SearchSheet form={form} setForm={setForm} onClose={() => setSheet(false)} onSubmit={() => runSearch()} setToast={setToast} />}
      {traveler && <Traveler safeTop={safeTop} bottomStr={inset.bottomStr} onBack={() => setTraveler(false)} />}
      {editName && <NameEdit name={name} onClose={() => setEditName(false)} onSave={(n) => { setName(n); setEditName(false); setToast("Имя сохранено"); }} />}
      <Toast msg={toast} />
    </div>
  </div>;
}
