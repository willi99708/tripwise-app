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
const CUR = { USM: "samui", DPS: "bali", MLE: "maldives", HND: "tokyo", HKT: "phuket", ZNZ: "zanzibar", PQC: "phuquoc", CMB: "srilanka", MRU: "mauritius", SEZ: "seychelles", MNL: "philippines" };
const RAW_AIRPORTS = [
  ["MOW", "Москва", "Россия", "🇷🇺"], ["LED", "Санкт-Петербург", "Россия", "🇷🇺"], ["AER", "Сочи", "Россия", "🇷🇺"],
  ["MRV", "Минеральные Воды", "Россия", "🇷🇺"], ["AAQ", "Анапа", "Россия", "🇷🇺"], ["GDZ", "Геленджик", "Россия", "🇷🇺"],
  ["SVX", "Екатеринбург", "Россия", "🇷🇺"], ["OVB", "Новосибирск", "Россия", "🇷🇺"], ["KZN", "Казань", "Россия", "🇷🇺"],
  ["KRR", "Краснодар", "Россия", "🇷🇺"], ["VVO", "Владивосток", "Россия", "🇷🇺"], ["KGD", "Калининград", "Россия", "🇷🇺"],
  ["UFA", "Уфа", "Россия", "🇷🇺"],
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
  ["RIX", "Рига", "Латвия", "🇱🇻"], ["VNO", "Вильнюс", "Литва", "🇱🇹"], ["RMO", "Кишинёв", "Молдова", "🇲🇩"],
  ["BJV", "Бодрум", "Турция", "🇹🇷"], ["DLM", "Даламан", "Турция", "🇹🇷"], ["RAK", "Марракеш", "Марокко", "🇲🇦"],
  ["BAH", "Бахрейн", "Бахрейн", "🇧🇭"], ["MCT", "Маскат", "Оман", "🇴🇲"], ["KWI", "Кувейт", "Кувейт", "🇰🇼"],
  ["PEN", "Пенанг", "Малайзия", "🇲🇾"], ["TPE", "Тайбэй", "Тайвань", "🇹🇼"], ["MNL", "Манила", "Филиппины", "🇵🇭"],
  ["DAD", "Дананг", "Вьетнам", "🇻🇳"], ["REP", "Сием-Рип", "Камбоджа", "🇰🇭"], ["VTE", "Вьентьян", "Лаос", "🇱🇦"],
  // --- Расширение справочника (выверенные IATA) ---
  ["LCA", "Ларнака", "Кипр", "🇨🇾"], ["PFO", "Пафос", "Кипр", "🇨🇾"],
  ["HER", "Ираклион", "Греция", "🇬🇷"], ["RHO", "Родос", "Греция", "🇬🇷"], ["CFU", "Корфу", "Греция", "🇬🇷"], ["JMK", "Миконос", "Греция", "🇬🇷"], ["JTR", "Санторини", "Греция", "🇬🇷"], ["KGS", "Кос", "Греция", "🇬🇷"],
  ["AGP", "Малага", "Испания", "🇪🇸"], ["PMI", "Пальма-де-Майорка", "Испания", "🇪🇸"], ["IBZ", "Ибица", "Испания", "🇪🇸"], ["ALC", "Аликанте", "Испания", "🇪🇸"], ["TFS", "Тенерифе", "Испания", "🇪🇸"], ["LPA", "Гран-Канария", "Испания", "🇪🇸"], ["VLC", "Валенсия", "Испания", "🇪🇸"],
  ["OPO", "Порту", "Португалия", "🇵🇹"], ["FAO", "Фару", "Португалия", "🇵🇹"], ["FNC", "Фуншал (Мадейра)", "Португалия", "🇵🇹"],
  ["VCE", "Венеция", "Италия", "🇮🇹"], ["NAP", "Неаполь", "Италия", "🇮🇹"], ["CTA", "Катания", "Италия", "🇮🇹"], ["PMO", "Палермо", "Италия", "🇮🇹"], ["BLQ", "Болонья", "Италия", "🇮🇹"],
  ["NCE", "Ницца", "Франция", "🇫🇷"], ["LYS", "Лион", "Франция", "🇫🇷"], ["MRS", "Марсель", "Франция", "🇫🇷"],
  ["MUC", "Мюнхен", "Германия", "🇩🇪"], ["DUS", "Дюссельдорф", "Германия", "🇩🇪"], ["HAM", "Гамбург", "Германия", "🇩🇪"],
  ["BRU", "Брюссель", "Бельгия", "🇧🇪"], ["CPH", "Копенгаген", "Дания", "🇩🇰"], ["ARN", "Стокгольм", "Швеция", "🇸🇪"], ["OSL", "Осло", "Норвегия", "🇳🇴"], ["DUB", "Дублин", "Ирландия", "🇮🇪"], ["MAN", "Манчестер", "Великобритания", "🇬🇧"], ["EDI", "Эдинбург", "Великобритания", "🇬🇧"], ["GVA", "Женева", "Швейцария", "🇨🇭"], ["BUD", "Будапешт", "Венгрия", "🇭🇺"], ["KRK", "Краков", "Польша", "🇵🇱"], ["SOF", "София", "Болгария", "🇧🇬"], ["DBV", "Дубровник", "Хорватия", "🇭🇷"], ["SPU", "Сплит", "Хорватия", "🇭🇷"], ["ZAG", "Загреб", "Хорватия", "🇭🇷"], ["TIV", "Тиват", "Черногория", "🇲🇪"],
  ["ADB", "Измир", "Турция", "🇹🇷"], ["GZP", "Аланья-Газипаша", "Турция", "🇹🇷"],
  ["BUS", "Батуми", "Грузия", "🇬🇪"], ["FRU", "Бишкек", "Киргизия", "🇰🇬"], ["DYU", "Душанбе", "Таджикистан", "🇹🇯"], ["SKD", "Самарканд", "Узбекистан", "🇺🇿"],
  ["JED", "Джидда", "Саудовская Аравия", "🇸🇦"], ["RUH", "Эр-Рияд", "Саудовская Аравия", "🇸🇦"], ["AMM", "Амман", "Иордания", "🇯🇴"], ["BEY", "Бейрут", "Ливан", "🇱🇧"],
  ["RMF", "Марса-Алам", "Египет", "🇪🇬"], ["TUN", "Тунис", "Тунис", "🇹🇳"], ["DJE", "Джерба", "Тунис", "🇹🇳"], ["CMN", "Касабланка", "Марокко", "🇲🇦"], ["AGA", "Агадир", "Марокко", "🇲🇦"], ["ZNZ", "Занзибар", "Танзания", "🇹🇿"], ["JRO", "Килиманджаро", "Танзания", "🇹🇿"], ["MBA", "Момбаса", "Кения", "🇰🇪"], ["LOS", "Лагос", "Нигерия", "🇳🇬"], ["ACC", "Аккра", "Гана", "🇬🇭"], ["ADD", "Аддис-Абеба", "Эфиопия", "🇪🇹"],
  ["UTP", "Паттайя", "Таиланд", "🇹🇭"], ["CNX", "Чиангмай", "Таиланд", "🇹🇭"], ["HDY", "Хатъяй", "Таиланд", "🇹🇭"], ["LGK", "Лангкави", "Малайзия", "🇲🇾"], ["BKI", "Кота-Кинабалу", "Малайзия", "🇲🇾"], ["CEB", "Себу", "Филиппины", "🇵🇭"], ["SUB", "Сурабая", "Индонезия", "🇮🇩"], ["PQC", "Фукуок", "Вьетнам", "🇻🇳"], ["PNH", "Пномпень", "Камбоджа", "🇰🇭"], ["RGN", "Янгон", "Мьянма", "🇲🇲"],
  ["KIX", "Осака", "Япония", "🇯🇵"], ["CTS", "Саппоро", "Япония", "🇯🇵"], ["FUK", "Фукуока", "Япония", "🇯🇵"], ["OKA", "Окинава", "Япония", "🇯🇵"], ["CAN", "Гуанчжоу", "Китай", "🇨🇳"], ["CTU", "Чэнду", "Китай", "🇨🇳"],
  ["MAA", "Ченнаи", "Индия", "🇮🇳"], ["BLR", "Бангалор", "Индия", "🇮🇳"], ["HYD", "Хайдарабад", "Индия", "🇮🇳"], ["COK", "Кочи", "Индия", "🇮🇳"], ["TRV", "Тривандрам", "Индия", "🇮🇳"],
  ["YVR", "Ванкувер", "Канада", "🇨🇦"], ["YUL", "Монреаль", "Канада", "🇨🇦"], ["YYC", "Калгари", "Канада", "🇨🇦"],
  ["SFO", "Сан-Франциско", "США", "🇺🇸"], ["LAS", "Лас-Вегас", "США", "🇺🇸"], ["ORD", "Чикаго", "США", "🇺🇸"], ["BOS", "Бостон", "США", "🇺🇸"], ["SEA", "Сиэтл", "США", "🇺🇸"], ["MCO", "Орландо", "США", "🇺🇸"], ["HNL", "Гонолулу", "США", "🇺🇸"],
  ["GIG", "Рио-де-Жанейро", "Бразилия", "🇧🇷"], ["EZE", "Буэнос-Айрес", "Аргентина", "🇦🇷"], ["LIM", "Лима", "Перу", "🇵🇪"], ["BOG", "Богота", "Колумбия", "🇨🇴"], ["SCL", "Сантьяго", "Чили", "🇨🇱"], ["MBJ", "Монтего-Бей", "Ямайка", "🇯🇲"], ["AUA", "Аруба", "Аруба", "🇦🇼"], ["NAS", "Нассау", "Багамы", "🇧🇸"], ["SJU", "Сан-Хуан", "Пуэрто-Рико", "🇵🇷"],
  ["BNE", "Брисбен", "Австралия", "🇦🇺"], ["PER", "Перт", "Австралия", "🇦🇺"], ["NAN", "Нанди", "Фиджи", "🇫🇯"],
];
const AIRPORTS = RAW_AIRPORTS.map(([code, city, country, flag]) => ({ code, city, country, flag, destId: CUR[code] || null, grad: gradFor(code) }));
const byDest = (id) => AIRPORTS.find(a => a.destId === id) || AIRPORTS.find(a => a.code === "DPS");
const filterAirports = (q) => { const s = (q || "").trim().toLowerCase(); if (!s) return AIRPORTS; return AIRPORTS.filter(a => a.city.toLowerCase().includes(s) || a.country.toLowerCase().includes(s) || a.code.toLowerCase().includes(s)); };

const MONTHS_S = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MON_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
/* Названия авиакомпаний по IATA-коду. Добавить новую — просто новая строка КОД:"Название".
   ЛОГОТИПЫ: см. компонент AirlineLogo ниже — там описано, как подставить картинки логотипов. */
const AIRLINES = { SU: "Аэрофлот", S7: "S7 Airlines", U6: "Уральские авиалинии", DP: "Победа", UT: "ЮТэйр", N4: "Nordwind", "5N": "Smartavia", WZ: "Red Wings",
  TK: "Turkish Airlines", PC: "Pegasus", LH: "Lufthansa", AF: "Air France", KL: "KLM", BA: "British Airways", AY: "Finnair", LX: "Swiss", OS: "Austrian", AZ: "ITA Airways", IB: "Iberia", VY: "Vueling", W6: "Wizz Air", FR: "Ryanair", U2: "easyJet",
  EK: "Emirates", QR: "Qatar Airways", FZ: "flydubai", EY: "Etihad", WY: "Oman Air", GF: "Gulf Air", SV: "Saudia", MS: "EgyptAir", ET: "Ethiopian",
  CA: "Air China", MU: "China Eastern", CZ: "China Southern", CX: "Cathay Pacific", HX: "Hong Kong Airlines", SQ: "Singapore Airlines", TR: "Scoot", MH: "Malaysia Airlines", AK: "AirAsia", D7: "AirAsia X", TG: "Thai Airways", GA: "Garuda", KE: "Korean Air", OZ: "Asiana", JL: "JAL", NH: "ANA",
  VN: "Vietnam Airlines", VJ: "VietJet", AI: "Air India", "6E": "IndiGo", UL: "SriLankan", PG: "Bangkok Airways",
  HY: "Uzbekistan Airways", KC: "Air Astana", J2: "AZAL", PS: "МАУ", B2: "Belavia",
  JQ: "Jetstar", QF: "Qantas", VA: "Virgin Australia", NZ: "Air New Zealand", BR: "EVA Air", CI: "China Airlines", PR: "Philippine Airlines", "5J": "Cebu Pacific", ID: "Batik Air", QZ: "AirAsia Indonesia", FD: "Thai AirAsia", SL: "Thai Lion Air", DD: "Nok Air", OD: "Batik Malaysia", "9C": "Spring Airlines", HU: "Hainan Airlines", MF: "Xiamen Air", "3U": "Sichuan Airlines", SC: "Shandong Airlines", G9: "Air Arabia", XY: "flynas", J9: "Jazeera", WF: "Widerøe", DY: "Norwegian", SK: "SAS", A3: "Aegean", RO: "TAROM", JU: "Air Serbia", OK: "Czech Airlines", LO: "LOT", SN: "Brussels Airlines", TP: "TAP Portugal", EW: "Eurowings", HV: "Transavia", DE: "Condor" };
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
const hm = (min) => { if (!min || min <= 0) return "—"; const h = Math.floor(min / 60), m = min % 60; return `${h}ч${m ? " " + m + "м" : ""}`; };
const timeOf = (s) => { if (!s) return "--:--"; return new Date(s).toUTCString().slice(17, 22); };
// смещение из ISO ("...+05:00") в минутах
const isoOff = (iso) => { const m = String(iso || "").match(/([+-]\d{2}):?(\d{2})$/); if (!m) return 0; const sign = m[1][0] === "-" ? -1 : 1; return sign * (parseInt(m[1].slice(1), 10) * 60 + parseInt(m[2], 10)); };
// время вылета: берём готовое от бэка, иначе из ISO (локальное время вылета)
const depOf = (s) => s.departHM || (s.departISO ? String(s.departISO).slice(11, 16) : (s.departISO ? timeOf(s.departISO) : "—"));
// время прилёта: берём готовое от бэка, иначе считаем вылет+длительность в локальном времени вылета (фолбэк)
const arrOf = (s) => { if (s.arriveHM) return s.arriveHM; if (s.departISO && s.durationMin != null) { const t = Date.parse(s.departISO) + s.durationMin * 60000 + isoOff(s.departISO) * 60000; return new Date(t).toISOString().slice(11, 16); } return "—"; };
const legDur = (segs) => (segs || []).filter(s => s.mode !== "ferry").reduce((s, x) => s + (x.durationMin || 0), 0);
const LABELS = { recommended: { t: "Выбор TripWise", c: T.violet, icon: "✦" }, cheapest: { t: "Самый дешёвый", c: T.green, icon: "₽" }, fastest: { t: "Самый быстрый", c: T.cyan, icon: "⚡" }, relevant: { t: "Хитрый маршрут", c: T.cyan, icon: "✈" }, stopover: { t: "Лучший stopover", c: T.violet, icon: "🌙" } };
const dayWord = (n) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return "дней"; if (b === 1) return "день"; if (b >= 2 && b <= 4) return "дня"; return "дней"; };
const PREP = { "Куала-Лумпур": "Куала-Лумпуре", "Сингапур": "Сингапуре", "Стамбул": "Стамбуле", "Дубай": "Дубае", "Пекин": "Пекине", "Бангкок": "Бангкоке", "Сеул": "Сеуле", "Доха": "Дохе", "Гонконг": "Гонконге", "Абу-Даби": "Абу-Даби" };
const prep = (c) => PREP[c] || c;
const stopLabel = (s) => `${s.nights} ${dayWord(s.nights)} в ${prep(s.city)}`;
// безопасное хранилище: на Vercel/в Telegram работает, в песочнице — no-op
const store = {
  get(k, d) { try { const v = localStorage.getItem("tw_" + k); return v != null ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("tw_" + k, JSON.stringify(v)); } catch (e) { } },
};
// склонение существительного: plural(1,'способ','способа','способов')
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b === 1) return one; if (b >= 2 && b <= 4) return few; return many; };

function Icon({ d, size = 20, color = T.violet }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>; }
const I = {
  grid: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  check: <path d="M5 13l4 4 10-11" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  doc: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  armchair: <><path d="M6 11V7a3 3 0 013-3h6a3 3 0 013 3v4" /><path d="M4 11a2 2 0 012 2v2h12v-2a2 2 0 114 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z" /></>,
  sim: <><rect x="5" y="3" width="14" height="18" rx="2" /><rect x="9" y="12" width="6" height="5" rx="1" /></>,
  car: <><path d="M5 15l1.2-4.5A2 2 0 018.1 9h7.8a2 2 0 011.9 1.5L19 15" /><rect x="3.5" y="15" width="17" height="4" rx="1.2" /><circle cx="7.5" cy="19.5" r="1.2" /><circle cx="16.5" cy="19.5" r="1.2" /></>,
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

function Porthole({ grad = GRAD.sunset, image, h = 150, label, sub, codeRight, style }) {
  /* ФОТО-ЗАГЛУШКА: замените `background: grad` ниже на backgroundImage:url(...) для реальных фото */
  return <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", height: h, background: image ? undefined : grad, backgroundImage: image ? `url(${image})` : undefined, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 0 0 40px rgba(0,0,0,.35), inset 0 0 0 3px rgba(255,255,255,.08)", ...style }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 70% 20%, rgba(255,255,255,.25), transparent 60%)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: -2, height: "60%", background: "linear-gradient(transparent, rgba(5,5,20,.9))" }} />
    {label && <div style={{ position: "absolute", left: 12, bottom: 10 }}><div style={{ color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "Sora,sans-serif" }}>{label}</div>{sub && <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12 }}>{sub}</div>}</div>}
    {codeRight && <div style={{ position: "absolute", right: 10, bottom: 10, color: "#fff", fontWeight: 700, fontSize: 12, opacity: .9 }}>{codeRight}</div>}
  </div>;
}
function Badge({ label, color = T.violet, icon }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: color + "22", border: `1px solid ${color}55`, color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}</span>; }
function Btn({ children, onClick, grad = GRAD.cta, style }) { return <button onClick={onClick} className="press" style={{ border: "none", cursor: "pointer", color: "#fff", fontWeight: 700, fontFamily: "Sora,sans-serif", fontSize: 15, borderRadius: 16, padding: "16px 20px", width: "100%", background: grad, boxShadow: "0 10px 30px -8px rgba(124,92,255,.6)", ...style }}>{children}</button>; }
function Logo() { return <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text, letterSpacing: .2 }}>TripWise<span style={{ color: T.violet }}>AI</span></div>; }
function KidsPicker({ ages, onChange }) {
  const [adding, setAdding] = useState(false);
  return <div>
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
      <span style={{ fontSize: 12.5, color: T.subd, marginRight: 2 }}>Дети</span>
      {(ages || []).map((a, i) => <span key={i} className="press" onClick={() => onChange(ages.filter((_, k) => k !== i))} style={{ fontSize: 12, fontWeight: 700, color: T.violet, background: T.violet + "16", border: `1px solid ${T.violet}44`, borderRadius: 999, padding: "4px 9px", cursor: "pointer" }}>{a} {plural(a, "год", "года", "лет")} ×</span>)}
      <span onClick={() => setAdding(!adding)} className="press" style={{ fontSize: 12, fontWeight: 700, color: T.subd, border: `1px dashed ${T.line}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>＋ ребёнок</span>
    </div>
    {adding && <div className="carousel" style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8, paddingBottom: 2 }}>
      {Array.from({ length: 18 }, (_, a) => <span key={a} onClick={() => { onChange([...(ages || []), a]); setAdding(false); }} className="press" style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: T.text, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "7px 12px", cursor: "pointer" }}>{a}</span>)}
    </div>}
  </div>;
}
function Header({ onBack, title, subtitle, onEdit }) {
  if (!title && !subtitle && !onEdit) return null;   // пустая шапка не съедает высоту — логотип теперь фиксированный
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px 8px", position: "relative", minHeight: 30 }}>
    
    <div style={{ transform: title ? "translateY(-4px)" : "translateY(-7px)" }}>{title ? <div style={{ textAlign: "center", maxWidth: 220 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>{subtitle && <div style={{ fontSize: 11, color: T.subd, marginTop: 2 }}>{subtitle}</div>}</div> : null}</div>
    {onEdit && <span onClick={onEdit} className="press" style={{ position: "absolute", right: 20, top: 16, transform: "translateY(25px)", color: T.violet, fontSize: 13, fontWeight: 700, zIndex: 5, cursor: "pointer" }}>Изменить</span>}
  </div>;
}
function BottomNav({ tab, setTab, bottomStr = "0px" }) {
  const items = [["home", "Главная", I.home], ["routes", "Путешествия", I.route], ["hotels", "Отели", I.hotel], ["docs", "Документы", I.doc], ["profile", "Профиль", I.user]];
  return <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, zIndex: 40, minHeight: 64, paddingBottom: `max(${bottomStr}, 12px)`, display: "flex", background: "rgba(10,10,24,.92)", backdropFilter: "blur(12px)", borderTop: `1px solid ${T.line}` }}>
    {items.map(([k, label, ic]) => (<button key={k} onClick={() => setTab(k)} className="press" style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8, color: tab === k ? T.violet : T.subd }}><Icon d={ic} size={22} color={tab === k ? T.violet : T.subd} /><span style={{ fontSize: 10, fontWeight: tab === k ? 700 : 500, whiteSpace: "nowrap" }}>{label}</span></button>))}
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
    ["Откуда", form.origin ? form.origin.city : "Выберите аэропорт", I.pin, () => setPicker("origin"), true],
    ["Куда", form.dest ? `${form.dest.city}, ${form.dest.country}` : "Выберите направление", I.pin, () => setPicker("dest")],
    ["Когда", datesLabel, I.cal, () => setCal(true), false, form.round ? "Туда и обратно" : "В одну сторону"],
    ["Пассажиры и класс", `${form.adults} взр.${(form.children || []).length ? ` · ${form.children.length} дет.` : ""}, Эконом`, I.user, null],
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
      <div style={{ marginTop: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "11px 12px" }}><KidsPicker ages={form.children || []} onChange={(a) => setForm({ ...form, children: a })} /></div>
      <div style={{ marginTop: 14 }}><Btn onClick={() => valid ? onSubmit() : setToast("Заполните откуда, куда и даты")} style={{ opacity: valid ? 1 : .55 }}>Найти маршруты&nbsp;&nbsp;✦</Btn></div>
    </Overlay>
    {picker && <AirportPicker title={picker === "origin" ? "Откуда" : "Куда"} onClose={() => setPicker(null)} onPick={(a) => { setForm({ ...form, [picker]: a }); setPicker(null); }} />}
    {cal && <Calendar initial={{ round: form.round, dep: form.dep, ret: form.ret }} onClose={() => setCal(false)} onApply={(v) => { setForm({ ...form, ...v }); setCal(false); }} />}
  </>;
}

/* ================================ Главная =============================== */
function Home({ onSearch, onPickDest, goTab, openServices }) {
  const tiles = [
    ["Отели", "Промокоды\nи скидки", I.hotel, () => goTab("hotels")],
    ["Документы", "Визы, чек-листы\nи помощь ИИ", I.doc, () => goTab("docs")],
    ["Сервисы", "eSIM, страховка,\nбизнес-залы", I.bag, openServices],
  ];
  const ideas = [["Бали", "через Сингапур", "20–40%", "/graphics/bali.png", "SIN", "bali"], ["Токио", "через Сеул", "30–50%", "/graphics/tokyo.png", "ICN", "tokyo"], ["Мальдивы", "через Дубай", "25–45%", "/graphics/male.png", "DXB", "maldives"], ["Пхукет", "через Куала-Лумпур", "20–40%", "/graphics/phuket.png", "KUL", "phuket"]];
  return <div style={{ paddingBottom: 16, animation: "fadeUp .18s ease-out" }}>
    <div style={{ padding: "18px 30px 0" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><h1 style={{ fontFamily: "Sora,sans-serif", fontSize: 30, lineHeight: 1.08, margin: 0, fontWeight: 800, color: T.text }}>Куда<br />хочется<br /><span style={{ background: "linear-gradient(90deg,#48dcdc,#7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>отправиться?</span></h1><p style={{ color: T.sub, fontSize: 13, marginTop: 12, lineHeight: 1.4 }}>Найдём лучшие маршруты,<br />о которых вы не знали</p></div>
<div
  style={{
    width: 170,
    height: 150,
    borderRadius: 22,
    overflow: "hidden",
    backgroundImage: "url('/graphics/main.png')",
    backgroundSize: "contain",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat"
  }}
/>
      </div>
    </div>
    <div style={{ padding: "18px 30px 0" }}>
      <div onClick={onSearch} className="press" style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, cursor: "pointer", boxShadow: "0 8px 30px -12px rgba(124,92,255,.5)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: GRAD.violet, display: "grid", placeItems: "center" }}><Icon d={I.pin} size={18} color="#fff" /></div>
        <span style={{ color: T.sub, flex: 1, fontSize: 15 }}>Выберите направление</span>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: GRAD.cta, display: "grid", placeItems: "center" }}><Icon d={I.spark} size={18} color="#fff" /></div>
      </div>
    </div>
    {/* три продающие плитки-ярлыка (макет): ведут в разделы */}
    <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {tiles.map(([t, s, ic, go]) => (
        <div key={t} onClick={go} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: "14px 12px 12px", cursor: "pointer", display: "flex", flexDirection: "column", minHeight: 128 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: T.violet + "1e", border: `1px solid ${T.violet}44`, display: "grid", placeItems: "center" }}><Icon d={ic} size={21} color={T.violet} /></div>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 14.5, marginTop: 10 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: T.subd, marginTop: 3, lineHeight: 1.25, whiteSpace: "pre-line", flex: 1 }}>{s}</div>
          <div style={{ alignSelf: "flex-end", width: 28, height: 28, borderRadius: 999, background: "rgba(255,255,255,.06)", border: `1px solid ${T.line}`, display: "grid", placeItems: "center", marginTop: 8 }}><Icon d={I.arrow} size={13} color={T.sub} /></div>
        </div>))}
    </div>
    <div style={{ padding: "24px 0 0 20px" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 17, marginBottom: 12 }}>Идеи для выгодных маршрутов ✨</div>
      <div className="carousel" style={{ display: "flex", gap: 12, overflowX: "auto", paddingRight: 20, paddingBottom: 4, scrollSnapType: "x mandatory" }}>
        {ideas.map(([name, via, save, g, code, id]) => (<div key={name} onClick={() => onPickDest(id)} className="press" style={{ minWidth: 160, cursor: "pointer", scrollSnapAlign: "start" }}><Porthole image={g} h={110} label={name} sub={via} codeRight={"→ " + code} style={{ borderRadius: 16 }} /><div style={{ marginTop: 8, fontSize: 11, color: T.subd }}>Скидка</div><div style={{ fontSize: 15, fontWeight: 800, color: T.green, fontFamily: "Sora,sans-serif" }}>{save}</div></div>))}
      </div>
    </div>
    {/* тизер комплексного ведения поездки -> «Путешествия» */}
    <div style={{ padding: "15px 20px 0" }}>
      <div onClick={() => goTab("routes")} className="press" style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, cursor: "pointer" }}>
        <div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>Подготовьте поездку целиком</div><div style={{ color: T.subd, fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>TripWise поможет с визой, документами, скидками на отели и напомнит о важных датах.</div></div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: GRAD.cta, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.arrow} size={18} color="#fff" /></div>
      </div>
    </div>
  </div>;
}

/* ================================ Результаты ============================ */
function Skeleton() { return <div style={{ height: 150, borderRadius: 18, background: "linear-gradient(90deg,#14142e,#1a1a3a,#14142e)", backgroundSize: "200% 100%", animation: "sh 1.3s infinite" }} />; }
function RouteCard({ r, onOpen, liked, onLike, i }) {
  const grad = r.badge === "cheapest" ? GRAD.sunset : r.badge === "unexpected" ? GRAD.city : GRAD.night;
  const dur = legDur(r.segments);
  const codesOf = (segs) => (segs || []).map((s, idx) => idx === 0 ? [s.fromCode, s.toCode] : [s.toCode]).flat();
  const outSegs = r.roundTrip ? ((r.outbound && r.outbound.segments) || r.segments.filter(s => s.direction !== "return")) : r.segments;
  const retSegs = r.roundTrip ? ((r.return && r.return.segments) || r.segments.filter(s => s.direction === "return")) : [];
  const CodeLine = ({ segs, dir }) => { const cs = codesOf(segs); if (!cs.length) return null; const planeIcon = dir === "ret" ? "/graphics/plane_l.png" : "/graphics/plane_r.png"; return <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>{cs.map((c, idx) => (<React.Fragment key={idx}>{idx > 0 && <img src={planeIcon} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0, opacity: 0.8 }} />}<span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c}</span></React.Fragment>))}</div>; };
  // подстрока под направлением: пересадки + ожидание; стоповер пересадкой не считаем и показываем зелёным
  const LegSub = ({ segs, stop, waitMin }) => {
    const planes = (segs || []).filter(s => s.mode === "plane" || !s.mode);
    const intra = planes.reduce((n, s) => n + (s.transfers || 0), 0);
    const junctions = Math.max(0, Math.max(0, planes.length - 1) - (stop ? 1 : 0));
    const t = intra + junctions;
    let txt, col = T.subd;
    if (stop) { txt = `${stop.nights} ${plural(stop.nights, "ночь", "ночи", "ночей")} отдыха в ${stop.city}${t > 0 ? ` · ${t} ${plural(t, "пересадка", "пересадки", "пересадок")}` : " · без пересадок"}`; col = T.green; }
    else if (t > 0) txt = `${t} ${plural(t, "пересадка", "пересадки", "пересадок")}${waitMin > 0 ? ` на ${hm(waitMin)}` : ""}`;
    else txt = r.agent ? "детали рейса — в билете" : "прямой";
    return <div style={{ fontSize: 10.5, color: col, marginTop: 1 }}>{txt}</div>;
  };
  return <div onClick={onOpen} className="press card-in" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 20, padding: 14, cursor: "pointer", animationDelay: `${i * 70}ms` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(r.picks || [r.badge]).map(p => { const l = LABELS[p]; return l ? <Badge key={p} label={l.t} color={l.c} icon={l.icon} /> : null; })}</div>
      {r.priced && r.savings > 0 && <span style={{ color: T.green, fontWeight: 800, fontSize: 14 }}>↓ {rub(r.savings)}</span>}
    </div>
    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 15.5, color: T.text, lineHeight: 1.25 }}>{r.title || (r.stopover ? `Через ${r.stopover.city}` : "План путешествия")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div><CodeLine segs={outSegs} dir="out" /><LegSub segs={outSegs} stop={r.roundTrip ? (r.outbound && r.outbound.stopover) : r.stopover} waitMin={r.roundTrip ? ((r.outbound && r.outbound.waitMin) || 0) : (r.waitMin || 0)} /></div>
            {r.roundTrip && retSegs.length > 0 && <div><CodeLine segs={retSegs} dir="ret" /><LegSub segs={retSegs} stop={r.return && r.return.stopover} waitMin={(r.return && r.return.waitMin) || 0} /></div>}
          </div>
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
  return <div style={{ animation: "slideIn .18s ease-out" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px", position: "relative" }}>
      <div style={{ width: 22 }} />
      <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", transform: "translateY(-4px)", pointerEvents: "none" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15 }}>{query.origin} → {query.destName}</div><div style={{ fontSize: 11, color: T.subd }}>{query.datesLabel}</div></div>
      <span onClick={onEdit} className="press" style={{ color: T.violet, fontSize: 13, fontWeight: 700, cursor: "pointer", transform: "translateY(1px)", zIndex: 5 }}>Изменить</span>
    </div>
    {error ? <div style={{ textAlign: "center", padding: "40px 20px" }}><div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>Не удалось загрузить данные</div><div style={{ fontSize: 13, marginTop: 6, marginBottom: 16, color: T.subd }}>Проверьте соединение и попробуйте ещё раз</div><Btn onClick={onRetry}>Повторить</Btn></div> : <>
    <div style={{ padding: "9px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>{loading ? "Ищем лучшие варианты…" : <>Нашли <span style={{ color: T.violet }}>{routes.length} {plural(routes.length, "хитрый способ", "хитрых способа", "хитрых способов")}</span> добраться</>}</div>
      <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4 }}>Показываем только лучшее — не сотни билетов.</div>
    </div>
    <div style={{ padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
      {loading ? [0, 1, 2].map(i => <Skeleton key={i} />) : (routes.length ? routes.map((r, i) => <RouteCard key={r.id} r={r} i={i} liked={isLiked(r)} onLike={onLike} onOpen={() => onOpen(r)} />) : <Empty onEdit={onEdit} />)}
    </div></>}
  </div>;
}
function Empty({ onEdit }) { return <div style={{ textAlign: "center", padding: "40px 20px" }}><div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>Ничего не найдено</div><div style={{ fontSize: 13, marginTop: 6, marginBottom: 16, color: T.subd }}>Попробуйте изменить параметры</div><Btn onClick={onEdit}>Изменить параметры поиска</Btn></div>; }

/* ================================ Детали ================================ */
/* ЛОГОТИПЫ АВИАКОМПАНИЙ.
   Сейчас в аватарке — 2 буквы кода (заглушка). Чтобы показать картинки логотипов:
   1) положи файлы в проект (напр. public/airlines/TK.png) или возьми URL;
   2) заведи карту: const AIRLINE_LOGO = { TK: "/airlines/TK.png", SU: "/airlines/SU.png", ... };
   3) в AirlineLogo: если AIRLINE_LOGO[code] есть — вернуть
      <img src={AIRLINE_LOGO[code]} style={{width:30,height:30,borderRadius:8,objectFit:"cover"}}/>,
      иначе оставить текущую заглушку с буквами. */
/* ЛОГОТИПЫ АВИАКОМПАНИЙ: положи PNG в public/graphics/airlines/ с именем = код перевозчика
   (например SU.png, TK.png, DP.png). Файл есть — покажется логотип; файла нет — цветной кружок с кодом. */
/* ЛОГОТИПЫ СЕРВИСОВ: положи PNG в public/graphics/services/ с именем = id сервиса
   (yandex.png, ostrovok.png, ...). Нет файла — цветной кружок с первой буквой. */
function ServiceLogo({ id, name }) {
  return <div style={{ position: "relative", width: 30, height: 30, borderRadius: 9, background: T.violet + "26", border: `1px solid ${T.violet}55`, display: "grid", placeItems: "center", color: T.violet, fontWeight: 800, fontSize: 13, overflow: "hidden", flexShrink: 0 }}>
    {(name || "?").slice(0, 1)}
    {id && <img src={`/graphics/services/${id}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
  </div>;
}
function AirlineLogo({ code }) {
  const colors = ["#7c5cff", "#48dcdc", "#39d98a", "#f5c451", "#ff6db0", "#f59640"]; const c = colors[(code || "X").charCodeAt(0) % colors.length];
  return <div style={{ position: "relative", width: 30, height: 30, borderRadius: 8, background: c + "26", border: `1px solid ${c}55`, display: "grid", placeItems: "center", color: c, fontWeight: 800, fontSize: 11, fontFamily: "Sora,sans-serif", overflow: "hidden" }}>
    {(code || "✈").slice(0, 2)}
    {code && <img src={`/graphics/airlines/${String(code).toUpperCase()}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />}
  </div>;
}
function Detail({ r, query, onBack, onEdit, liked, onLike, onShare, goHotels, onTakeTrip, inTrip }) {
  const dur = legDur(r.segments);
  const segs = r.segments || [];
  const twoTicketNote = (segs.length === 2 && (r.notes || []).some(n => /раздельны|отдельных билета|два отдельных/i.test(n))) ? "Два отдельных билета" : null;
  return <div style={{ animation: "slideIn .18s ease-out" }}>
    <Header onBack={onBack} onEdit={onEdit} title={`${query.origin} → ${query.destName}`} subtitle={query.datesLabel} />
    <div style={{ padding: "9px 20px 0" }}>
      <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", height: 150, background: GRAD.sunset, padding: 16, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(5,5,20,.7))" }} />
        <div style={{ position: "relative" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>{r.stopover ? stopLabel(r.stopover) : (r.title || "План путешествия")}</div>{r.stopover && <div style={{ background: "linear-gradient(90deg,#48dcdc,#7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800, fontSize: 20, fontFamily: "Sora,sans-serif" }}>почти бесплатно</div>}</div>
      </div>
    </div>
    {/* ПРОМОКОДЫ ПОД БАННЕРОМ (макет): чипсы сервисов с макс. скидкой, релевантные этой поездке */}
    {(() => {
      const rel = promosForTrip({ country: query.destCountry, city: query.destName, depISO: query.depISO });
      const bySvc = new Map();
      for (const p of rel) { const c = bySvc.get(p.serviceId); if (!c || p.discountRub > c.discountRub) bySvc.set(p.serviceId, p); }
      const chips = [...bySvc.values()];
      if (!chips.length) return null;
      return <div style={{ margin: "12px 20px 0", background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: "12px 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.violet + "22", border: `1px solid ${T.violet}55`, display: "grid", placeItems: "center", fontSize: 13 }}>🏷️</div>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif" }}>Маршрут нашёлся. Промокоды на жильё тоже.</span>
        </div>
        <div className="carousel" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {chips.map((p) => (
            <div key={p.serviceId} onClick={() => goHotels(p.serviceId)} className="press" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: `1px solid ${T.line}`, borderRadius: 14, padding: "8px 10px", cursor: "pointer", flexShrink: 0 }}>
              <ServiceLogo id={p.serviceId} name={p.service} />
              <div><div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>{p.service}</div><div style={{ fontSize: 12, fontWeight: 800, color: T.violet, whiteSpace: "nowrap" }}>до {rub(p.discountRub)}</div></div>
              <Icon d={I.chevR} size={14} color={T.subd} />
            </div>))}
        </div>
      </div>;
    })()}
    <div style={{ padding: "12px 20px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(r.picks || [r.badge]).map(p => { const l = LABELS[p]; return l ? <Badge key={p} label={l.t} color={l.c} icon={l.icon} /> : null; })}
      {r.priced && r.savings > 0 && <Badge label={`Экономия ${rub(r.savings)}`} color={T.green} />}
    </div>
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: r.roundTrip ? "repeat(5,1fr)" : "repeat(4,1fr)", gap: r.roundTrip ? 5 : 8, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "14px 10px" }}>
        {(r.roundTrip
          ? [[rub(r.total), "Билеты"], [hm(r.durationOut || dur), "Туда"], [hm(r.durationRet || 0), "Обратно"], [`${query.adults || 1} пасс.`, "Эконом"], [r.transfers ? `${r.transfers}` : "0", "Пересадки"]]
          : [[rub(r.total), "Билеты"], [hm(dur), "Туда"], [`${query.adults || 1} пасс.`, "Эконом"], [r.transfers ? `${r.transfers}` : "0", "Пересадки"]]
        ).map(([a, b], i) => (<div key={i} style={{ textAlign: "center" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: r.roundTrip ? 12 : 13.5 }}>{a}</div><div style={{ fontSize: r.roundTrip ? 9.5 : 10.5, color: T.subd, marginTop: 2 }}>{b}</div></div>))}
      </div>
    </div>
    <div style={{ padding: "12px 20px 0" }}>
      <div className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, opacity: .75 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${T.subd}` }} />
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, color: T.text, fontWeight: 600 }}>Добавить багаж на весь маршрут</div><div style={{ fontSize: 11, color: T.subd }}>В разработке — данные по багажу появятся позже</div></div>
      </div>
    </div>
    <div style={{ padding: "18px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 16 }}>{segs.length > 0 ? "Маршрут по сегментам" : ""}</div>
        {twoTicketNote && <span style={{ fontSize: 11, color: T.cyan, fontWeight: 700 }}>{twoTicketNote}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {r.segments.map((s, i) => (<div key={i}>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AirlineLogo code={s.airline} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{airlineName(s.airline) || "Авиакомпания"}</div><div style={{ fontSize: 11, color: T.subd }}>{s.flightNumber || (s.mode === "ferry" ? "Паром" : "номер рейса — в билете")}</div></div>
              {s.mode === "ferry" ? <Badge label="паром" color={T.cyan} /> : (r.segments.length === 1 && (s.transfers || 0) === 0 ? <Badge label="Прямой рейс" color={T.green} /> : (r.segments.length === 1 ? null : <Badge label={`Рейс ${i + 1}`} color={T.violet} />))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 16 }}>{depOf(s)}</div><div style={{ fontSize: 11, color: T.subd }}>{s.fromCode}</div></div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: T.subd }}>{hm(s.durationMin || 0)}<div style={{ height: 1, background: T.line, margin: "5px 0" }} />{(s.transfers || 0) > 0 ? `${s.transfers} ${s.transfers === 1 ? "пересадка" : "пересадки"}` : (r.agent ? "детали в билете" : "прямой")}</div>
              <div style={{ textAlign: "right" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 16 }}>{arrOf(s)}</div><div style={{ fontSize: 11, color: T.subd }}>{s.toCode}</div></div>
              {(s.priceLive || s.priceEstimate) ? <a href={s.deepLink || (((r.bookingLinks || []).find(l => l.from === s.fromCode && l.to === s.toCode) || {}).url) || undefined} target="_blank" rel="noreferrer" className="press" style={{ textDecoration: "none" }}><div style={{ background: GRAD.cta, borderRadius: 12, padding: "8px 12px", color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{rub(s.priceLive || s.priceEstimate)}</div></a> : null}
            </div>
          </div>
          {r.stopover && i === 0 && r.segments.length > 1 && (
            <div style={{ background: T.card2, border: `1px solid ${T.violet}33`, borderRadius: 14, padding: 12, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={I.moon} size={16} color={T.violet} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.stopover.nights} {plural(r.stopover.nights, "ночь", "ночи", "ночей")} в {prep(r.stopover.city)}</span></div>
              <div style={{ fontSize: 11.5, color: T.subd, marginTop: 6 }}>Жильё подберём со скидкой — промокоды уже в карточке выше</div>
              <div onClick={() => goHotels(null)} className="press" style={{ marginTop: 10, textAlign: "center", background: T.violet + "22", border: `1px solid ${T.violet}55`, borderRadius: 10, padding: 8, color: T.violet, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Посмотреть варианты</div>
            </div>)}
        </div>))}
      </div>
      {(() => { const notes = (r.notes || []).filter(n => !/раздельны|отдельных билета|два отдельных|один билет туда-обратно/i.test(n)); return notes.length > 0 ? <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>{notes.map((n, i) => <Badge key={i} label={n} color={T.cyan} />)}</div> : null; })()}
    </div>
    {(r.agent || (r.segments && r.segments.length === 0)) && r.bookingLinks && r.bookingLinks.length > 0 && (
      <div style={{ padding: "12px 20px 0" }}>
        <a href={r.bookingLinks[0].url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn>Купить билет туда-обратно · {rub(r.total)}</Btn></a>
      </div>)}
    <div style={{ padding: "16px 20px 8px", display: "flex", gap: 10 }}>
      <Btn style={{ flex: 1 }} onClick={() => onTakeTrip(r)}>{inTrip ? "Открыть поездку" : "✈ Взять в поездку"}</Btn>
      <div onClick={() => onShare(r)} className="press" style={{ width: 52, borderRadius: 16, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", background: T.card, cursor: "pointer" }}><Icon d={I.share} size={19} color={T.subd} /></div>
      <div onClick={() => onLike(r)} className="press" style={{ width: 52, borderRadius: 16, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", background: T.card, cursor: "pointer" }}><Icon d={I.heart} size={20} color={liked ? T.pink : T.subd} /></div>
    </div>
  </div>;
}

/* ================================ Профиль =============================== */
function Profile({ name, onTraveler, onEditName, setToast }) {
  return <div style={{ animation: "fadeUp .18s ease-out" }}>
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
      <ServiceGrid setToast={setToast} />
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
  const [cit, setCit] = useState(() => store.get("cit", { "Россия": true, "Казахстан": true }));
  useEffect(() => { store.set("cit", cit); }, [cit]);
  const allVisas = [["🇪🇺", "Шенгенская зона", "26 стран"], ["🇺🇸", "США"], ["🇨🇦", "Канада"], ["🇬🇧", "Великобритания"], ["🇯🇵", "Япония"], ["🇨🇳", "Китай"], ["🇦🇺", "Австралия"], ["🇳🇿", "Новая Зеландия"], ["🇰🇷", "Южная Корея"], ["🇹🇭", "Таиланд"], ["🇹🇷", "Турция"], ["🇦🇪", "ОАЭ"]];
  const [vis, setVis] = useState(() => store.get("vis", { "Шенгенская зона": true, "США": true, "Канада": true }));
  useEffect(() => { store.set("vis", vis); }, [vis]);
  const f = (arr) => arr.filter(x => x[1].toLowerCase().includes(q.toLowerCase()));
  return <div style={{ position: "fixed", inset: 0, zIndex: 50, background: T.bg2, display: "flex", flexDirection: "column", maxWidth: 420, margin: "0 auto", paddingTop: safeTop || 0, animation: "slideIn .18s ease-out" }}>
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
/* ================== ПОЕЗДКИ (Trip) ==================
   Trip хранится в localStorage (store, ключ trips), структура совместима с будущей серверной
   синхронизацией для напоминаний. Документы берутся из DOC_MATRIX по стране назначения.
   ЧЕРНОВИК матрицы: названия/сроки сверить с официальными источниками на шаге B.
   E — «не раньше чем за E дней до вылета» (9999 = можно всегда), P — дней на оформление. */
const DOC_PASS = { id: "pass6", name: "Загранпаспорт 6+ мес после возвращения", E: 9999, P: 0 };
const DOC_INS = { id: "ins", name: "Страховка путешественника", E: 9999, P: 1 };
const DOC_MATRIX = {
  "Индонезия": [DOC_PASS, { id: "evisa_id", name: "eVisa (e-VOA)", E: 90, P: 5 }, DOC_INS, { id: "ecd", name: "Таможенная декларация e-CD", E: 3, P: 0 }],
  "Таиланд": [DOC_PASS, { id: "tdac", name: "Digital Arrival Card (TDAC)", E: 3, P: 0 }, DOC_INS],
  "Мальдивы": [DOC_PASS, { id: "imuga", name: "Декларация Imuga", E: 3, P: 0 }, DOC_INS],
  "Япония": [DOC_PASS, { id: "jvisa", name: "Виза Японии (консульская)", E: 90, P: 10 }, DOC_INS, { id: "vjw", name: "Visit Japan Web", E: 14, P: 0 }],
  "Танзания": [DOC_PASS, { id: "tz_visa", name: "eVisa Танзании", E: 90, P: 10 }, DOC_INS],
  "Вьетнам": [DOC_PASS, { id: "vn_evisa", name: "eVisa Вьетнама", E: 90, P: 5 }, DOC_INS],
  "Шри-Ланка": [DOC_PASS, { id: "eta", name: "ETA Шри-Ланки", E: 90, P: 3 }, DOC_INS],
  "Маврикий": [DOC_PASS, DOC_INS, { id: "mu_form", name: "Форма въезда All-in-One", E: 7, P: 0 }],
  "Сейшелы": [DOC_PASS, { id: "sc_ta", name: "Travel Authorization", E: 10, P: 1 }, DOC_INS],
  "Филиппины": [DOC_PASS, { id: "ph_etd", name: "eTravel декларация", E: 3, P: 0 }, DOC_INS],
  "Турция": [DOC_PASS, DOC_INS],
  "ОАЭ": [DOC_PASS, DOC_INS],
  "Египет": [DOC_PASS, { id: "eg_voa", name: "Виза по прилёте (марка)", E: 9999, P: 0 }, DOC_INS],
  "Индия": [DOC_PASS, { id: "in_evisa", name: "eVisa Индии", E: 120, P: 4 }, DOC_INS],
  "Китай": [DOC_PASS, DOC_INS],
  "Куба": [DOC_PASS, DOC_INS],
};
const DOC_BASE = [DOC_PASS, DOC_INS];
/* По ситуации: документы на детей (добавляются в комплект, если едут дети) */
const KID_DOCS = [
  { id: "kid_birth", name: "Свидетельство о рождении ребёнка", E: 9999, P: 0 },
  { id: "kid_consent", name: "Согласие на выезд (если ребёнок с одним родителем)", E: 9999, P: 3 },
];
/* Карточки документов: тип, описание, что потребуется, официальные ссылки.
   URL пустые — впиши официальные/партнёрские ссылки, пустые не показываются. */
const DOC_INFO = {
  pass6: { type: "info", desc: "Проверьте срок действия загранпаспорта: для большинства стран — минимум 6 месяцев после даты возвращения.", req: ["Загранпаспорт"], links: [] },
  ins: { type: "online", desc: "Медицинская страховка на весь срок поездки. Оформляется онлайн за несколько минут.", req: ["Паспортные данные", "Даты поездки"], links: [{ label: "Оформить страховку", url: "" }] },
  evisa_id: { type: "online", desc: "Электронная виза Индонезии (e-VOA). Заполняется онлайн, понадобится оплата картой.", req: ["Скан загранпаспорта", "Фото", "Обратный билет"], links: [{ label: "Официальный сайт eVisa", url: "" }] },
  ecd: { type: "online", desc: "Электронная таможенная декларация Индонезии. Доступна не раньше чем за 3 дня до прилёта.", req: ["Данные рейса", "Загранпаспорт"], links: [{ label: "Сайт e-CD", url: "" }] },
  tdac: { type: "online", desc: "Электронная карта прибытия Таиланда. Открывается за 3 дня до прилёта — раньше заполнить нельзя.", req: ["Загранпаспорт", "Номер рейса", "Адрес проживания"], links: [{ label: "Официальный сайт TDAC", url: "" }] },
  imuga: { type: "online", desc: "Декларация прибытия на Мальдивы. Заполняется онлайн в течение 96 часов до вылета.", req: ["Загранпаспорт", "Данные рейса", "Отель"], links: [{ label: "Сайт Imuga", url: "" }] },
  jvisa: { type: "paper", desc: "Консульская виза Японии. Подаётся через визовый центр или консульство, потребуется пакет документов.", req: ["Загранпаспорт", "Анкета", "Фото 45×45", "Брони билетов и жилья", "Справка с работы", "Выписка из банка"], links: [{ label: "Визовый центр", url: "" }, { label: "Консульство Японии", url: "" }] },
  vjw: { type: "online", desc: "Visit Japan Web — регистрация для ускоренного прохождения контроля по прилёте.", req: ["Загранпаспорт", "Данные рейса"], links: [{ label: "Visit Japan Web", url: "" }] },
  tz_visa: { type: "online", desc: "Электронная виза Танзании (включая Занзибар).", req: ["Скан загранпаспорта", "Фото", "Обратный билет"], links: [{ label: "Сайт eVisa Танзании", url: "" }] },
  vn_evisa: { type: "online", desc: "Электронная виза Вьетнама.", req: ["Скан загранпаспорта", "Фото"], links: [{ label: "Сайт eVisa Вьетнама", url: "" }] },
  eta: { type: "online", desc: "Электронное разрешение на въезд в Шри-Ланку (ETA).", req: ["Загранпаспорт", "Данные рейса"], links: [{ label: "Сайт ETA", url: "" }] },
  mu_form: { type: "online", desc: "Единая форма въезда на Маврикий (All-in-One). Заполняется онлайн перед вылетом.", req: ["Загранпаспорт", "Данные рейса", "Отель"], links: [{ label: "Форма въезда", url: "" }] },
  sc_ta: { type: "online", desc: "Travel Authorization для въезда на Сейшелы. Оформляется онлайн, есть небольшой сбор.", req: ["Загранпаспорт", "Данные рейса", "Отель"], links: [{ label: "Сайт Travel Authorization", url: "" }] },
  ph_etd: { type: "online", desc: "Электронная декларация eTravel для въезда на Филиппины. Бесплатно, за 72 часа до вылета.", req: ["Загранпаспорт", "Данные рейса"], links: [{ label: "Сайт eTravel", url: "" }] },
  schengen: { type: "paper", desc: "Анкета на шенгенскую визу. Подаётся в визовый центр вместе с полным пакетом документов — начинайте заранее.", req: ["Загранпаспорт", "Фото 35×45", "Страховка от 30 000 €", "Брони жилья и билетов", "Финансовые гарантии", "Справка с работы"], links: [{ label: "Визовый центр", url: "" }, { label: "Требования консульства", url: "" }] },
  kid_birth: { type: "info", desc: "Оригинал или нотариальная копия свидетельства о рождении — могут спросить на границе.", req: ["Свидетельство о рождении"], links: [] },
  kid_consent: { type: "paper", desc: "Нотариальное согласие второго родителя, если ребёнок выезжает с одним из родителей. Требования зависят от страны.", req: ["Паспортные данные родителей", "Данные ребёнка", "Нотариус"], links: [] },
  eg_voa: { type: "info", desc: "Виза Египта оформляется по прилёте (марка в аэропорту) за ~25 $. Для Шарм-эль-Шейха до 15 дней действует синайский штамп без визы.", req: ["Загранпаспорт", "Наличные $"], links: [] },
  in_evisa: { type: "online", desc: "Электронная виза Индии. Подаётся онлайн минимум за 4 дня до вылета.", req: ["Скан загранпаспорта", "Фото", "Обратный билет"], links: [{ label: "Официальный сайт eVisa Индии", url: "" }] },
};
const DOC_TYPE_LABEL = { online: "онлайн-форма", paper: "бумажный документ", info: "проверка" };
/* Единый каталог документов для поиска (сценарий «конкретный документ») */
/* Ключевые слова для поиска документов: «тайская карта», «дубай», «бали» и т.п. */
const DOC_KW = {
  tdac: "тайская таиланд digital arrival card дак бангкок пхукет самуи", evisa_id: "индонезийская индонезия бали evoa evisa виза",
  ecd: "индонезия бали таможенная декларация", imuga: "мальдивы мальдивская декларация мале", jvisa: "японская япония виза токио",
  vjw: "япония visit japan web токио", tz_visa: "танзания занзибар танзанийская виза", vn_evisa: "вьетнам вьетнамская виза фукуок",
  eta: "шри-ланка ланкийская коломбо разрешение", mu_form: "маврикий форма въезда", sc_ta: "сейшелы разрешение",
  ph_etd: "филиппины декларация манила", schengen: "шенген шенгенская европа виза анкета франция италия испания",
  in_evisa: "индия индийская виза гоа дели", eg_voa: "египет египетская виза хургада шарм синай",
  ins: "страховка полис медицинская", pass6: "загранпаспорт паспорт срок действия",
  kid_birth: "свидетельство рождение ребёнок дети", kid_consent: "согласие выезд ребёнок дети нотариус",
};
const ALL_DOCS = (() => {
  const m = new Map();
  for (const [country, arr] of Object.entries(DOC_MATRIX)) for (const dd of arr) if (!m.has(dd.id)) m.set(dd.id, { ...dd, country, kw: DOC_KW[dd.id] || "" });
  m.set("schengen", { id: "schengen", name: "Шенгенская анкета", E: 180, P: 15, country: "Европа (Шенген)", kw: DOC_KW.schengen });
  for (const k of KID_DOCS) if (!m.has(k.id)) m.set(k.id, { ...k, country: "любая страна", kw: DOC_KW[k.id] || "" });
  return [...m.values()];
})();

/* ================== МАСТЕР ЗАПОЛНЕНИЯ (шаг C) ==================
   Отвечаешь по-русски -> получаешь готовые значения для официальной онлайн-формы.
   Транслитерация по ИКАО 9303 (как в загранпаспорте). Данные никуда не отправляются
   и живут только на устройстве до нажатия «Очистить». */
const TR_MAP = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "ie", "ы": "y", "ь": "", "э": "e", "ю": "iu", "я": "ia" };
const translit = (s) => String(s || "").toLowerCase().split("").map((c) => TR_MAP[c] !== undefined ? TR_MAP[c] : c).join("").toUpperCase();
const copyText = async (v) => {
  try { await navigator.clipboard.writeText(v); return true; }
  catch (e) { try { const ta = document.createElement("textarea"); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return true; } catch (_) { return false; } }
};
const FW = {
  surname: { k: "surname", label: "Фамилия (кириллицей, как в паспорте)", en: "Surname / Family name", type: "name" },
  given: { k: "given", label: "Имя", en: "Given name(s)", type: "name" },
  passport: { k: "passport", label: "Номер загранпаспорта", en: "Passport number", type: "up", hint: "без пробелов" },
  dob: { k: "dob", label: "Дата рождения", en: "Date of birth", type: "date" },
  arr: { k: "arr", label: "Дата прилёта", en: "Arrival date", type: "date" },
  flight: { k: "flight", label: "Номер рейса", en: "Flight number", type: "up", hint: "например SU274" },
  email: { k: "email", label: "Email", en: "Email", type: "text" },
  phone: { k: "phone", label: "Телефон с кодом страны", en: "Phone number", type: "text", hint: "+7…" },
};
const DOC_FIELDS = {
  tdac: [FW.surname, FW.given, FW.passport, FW.dob, FW.flight, FW.arr, { k: "addr", label: "Адрес проживания в Таиланде (отель)", en: "Address in Thailand", type: "text" }, FW.phone, FW.email],
  evisa_id: [FW.surname, FW.given, FW.passport, FW.dob, { k: "pexp", label: "Срок действия паспорта", en: "Passport expiry date", type: "date" }, FW.arr, { k: "addr", label: "Адрес в Индонезии (отель)", en: "Address in Indonesia", type: "text" }, FW.email],
  eta: [FW.surname, FW.given, FW.passport, FW.dob, FW.arr, { k: "addr", label: "Адрес на Шри-Ланке (отель)", en: "Address in Sri Lanka", type: "text" }, FW.email],
  imuga: [FW.surname, FW.given, FW.passport, FW.arr, FW.flight, { k: "addr", label: "Отель на Мальдивах", en: "Accommodation", type: "text" }, FW.email],
};
function DocWizard({ doc, onClose, setToast }) {
  const fields = DOC_FIELDS[doc.id] || [];
  const [ans, setAns] = useState({});
  const [done, setDone] = useState(false);
  const inputSt = { width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" };
  const val = (f) => {
    const raw = String(ans[f.k] || "").trim();
    if (!raw) return "";
    if (f.type === "name") return translit(raw);
    if (f.type === "up") return raw.toUpperCase().replace(/\s+/g, "");
    if (f.type === "date") { const p = raw.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : raw; }
    return raw;
  };
  const filled = fields.filter((f) => val(f));
  const copyOne = async (f) => { (await copyText(val(f))) ? setToast(`${f.en} — скопировано`) : setToast("Не удалось скопировать"); };
  const copyAll = async () => { const s = filled.map((f) => `${f.en}: ${val(f)}`).join("\n"); (await copyText(s)) ? setToast("Все поля скопированы") : setToast("Не удалось скопировать"); };
  return <Overlay onClose={onClose}>
    <SheetHead title={done ? "Поля для формы" : "Помощник заполнения"} onClose={onClose} />
    <div style={{ maxHeight: "58vh", overflowY: "auto", overscrollBehavior: "contain", paddingRight: 2 }}>
      {!done ? <>
        <div style={{ fontSize: 12, color: T.subd, lineHeight: 1.45, marginBottom: 12 }}>{doc.name}: отвечайте по-русски — подготовим значения в формате официальной формы. Данные никуда не отправляются и остаются на этом устройстве.</div>
        {fields.map((f) => <div key={f.k} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.sub, fontWeight: 600, marginBottom: 5 }}>{f.label}{f.hint ? <span style={{ color: T.subd, fontWeight: 400 }}> · {f.hint}</span> : null}</div>
          <input type={f.type === "date" ? "date" : "text"} value={ans[f.k] || ""} onChange={(e) => setAns({ ...ans, [f.k]: e.target.value })} style={inputSt} />
          {f.type === "name" && ans[f.k] ? <div style={{ fontSize: 11, color: T.violet, marginTop: 4 }}>В форме: {translit(ans[f.k])}</div> : null}
        </div>)}
      </> : <>
        <div style={{ fontSize: 12, color: T.subd, marginBottom: 10 }}>Копируйте значения в официальную форму. Перед отправкой сверьте с документами.</div>
        {filled.map((f) => <div key={f.k} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10.5, color: T.subd }}>{f.en}</div><div style={{ fontSize: 14, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{val(f)}</div></div>
          <span onClick={() => copyOne(f)} className="press" style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px solid ${T.violet}55`, background: T.violet + "14", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>Копировать</span>
        </div>)}
      </>}
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      {!done
        ? <div onClick={() => filled.length ? setDone(true) : setToast("Заполните хотя бы одно поле")} className="press" style={{ flex: 1, textAlign: "center", background: filled.length ? GRAD.cta : T.card, border: filled.length ? "none" : `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: filled.length ? "#fff" : T.subd, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Подготовить поля</div>
        : <>
          <div onClick={() => setDone(false)} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Изменить</div>
          <div onClick={copyAll} className="press" style={{ flex: 1.3, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Скопировать всё</div>
        </>}
    </div>
    <div onClick={() => { setAns({}); onClose(); setToast("Данные удалены с устройства"); }} className="press" style={{ textAlign: "center", fontSize: 11.5, color: T.subd, cursor: "pointer", padding: "10px 0 2px" }}>Очистить мои данные</div>
  </Overlay>;
}
// какие блоки включены (по источнику создания поездки); старые поездки — все блоки
const tripBlocks = (t) => t.blocksOn || { tickets: true, lodging: true, docs: true };
const tripDocs = (t) => {
  const base = DOC_MATRIX[t.country] || DOC_BASE;
  const extra = (t.docsExtra || []).map((id) => ALL_DOCS.find((x) => x.id === id)).filter((x) => x && !base.some((b) => b.id === x.id));
  return [...base, ...extra];
};
const daysTo = (iso) => iso ? Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000)) : null;
// статус документа по таймингу относительно даты вылета
function docStatus(doc, df) {
  const d = daysTo(df);
  if (d == null) return { key: "info", label: doc.P > 0 ? `оформляется ${doc.P} дн.` : "" };
  if (doc.E < 9999 && d > doc.E) { const open = new Date(new Date(df).getTime() - doc.E * 86400000); return { key: "early", label: `рано · с ${fmtShort(open)}` }; }
  if (doc.P > 0 && d < doc.P) return { key: "late", label: "можно не успеть" };
  if (doc.P > 0 && d < doc.P + 3) return { key: "urgent", label: `срочно · ${doc.P} дн.` };
  return { key: "now", label: doc.P > 0 ? `можно сейчас · ${doc.P} дн.` : "можно сейчас" };
}
const ST_COLOR = { early: null, now: null, urgent: "#f59640", late: "#ff6db0", info: null };
// прогресс: билеты + жильё + документы + ДОБАВЛЕННЫЕ услуги (опциональные считаются после добавления)
function tripProgress(t) {
  const b = tripBlocks(t);
  const docs = b.docs ? tripDocs(t) : [];
  const items = [];
  if (b.tickets) items.push(["tickets", t.checks.tickets]);
  if (b.lodging && !t.lodgingOff) {
    items.push(["lodgeMain", t.checks.lodgeMain]);
    if (t.route && t.route.stopover) items.push(["lodgeStop", t.checks.lodgeStop]);
  }
  for (const c of (t.custom || [])) items.push(["c:" + c.id, !!c.done]);
  for (const d of docs) items.push(["doc:" + d.id, !!t.checks.docs[d.id]]);
  for (const id of (t.servicesAdded || [])) items.push(["svc:" + id, !!t.checks.services[id]]);
  const done = items.filter(([, v]) => v).length;
  return { done, total: items.length, pct: items.length ? Math.round(done / items.length * 100) : 0 };
}
// «следующее действие»: всегда ровно одно, по приоритету
function nextAction(t) {
  const b = tripBlocks(t);
  const docs = b.docs ? tripDocs(t) : [], d = daysTo(t.df);
  if (b.tickets && !t.route) return { block: "tickets", title: "Найдите билеты", sub: t.dcName ? `${t.dcName} · ваши даты` : "на ваши даты", btn: "Найти", act: "search", tone: T.violet };
  const un = docs.filter((x) => !t.checks.docs[x.id]);
  const stOf = (x) => docStatus(x, t.df);
  const urgent = un.find((x) => ["urgent", "late"].includes(stOf(x).key));
  if (urgent) return { block: "docs", title: `Срочно: ${urgent.name}`, sub: `вылет через ${d} дн.`, btn: "К документам", act: "docs", tone: "#f59640" };
  if (b.tickets && t.route && !t.checks.tickets) return { block: "tickets", title: "Купите билеты", sub: "маршрут выбран — цены меняются", btn: "К билетам", act: "tickets", tone: T.violet };
  const now = un.filter((x) => stOf(x).key === "now").sort((a, b) => (b.P || 0) - (a.P || 0))[0];
  if (now) return { block: "docs", title: `Пора: ${now.name}`, sub: now.P ? `оформляется ${now.P} дн. · вылет через ${d} дн.` : `вылет через ${d} дн.`, btn: "К документам", act: "docs", tone: T.violet };
  if (b.lodging && !t.lodgingOff && (!t.checks.lodgeMain || (t.route && t.route.stopover && !t.checks.lodgeStop))) return { block: "lodging", title: "Подберите жильё со скидкой", sub: "промокоды уже внутри", btn: "К отелям", act: "hotels", tone: T.violet };
  const sun = (t.servicesAdded || []).find((id) => !t.checks.services[id]);
  if (sun) { const s = EXTRA_SERVICES.find((x) => x.id === sun); return { block: "services", title: `Оформите: ${s ? s.title : sun}`, sub: "добавлено в план поездки", btn: "К услугам", act: "services", tone: T.cyan }; }
  const early = un.map((x) => ({ x, s: stOf(x) })).find((e) => e.s.key === "early");
  if (early) return { block: "docs", title: "Пока всё по плану", sub: `${early.x.name} — ${early.s.label}`, btn: null, act: null, tone: T.green };
  return { block: null, title: "Всё готово ✈️", sub: "Отличной поездки!", btn: null, act: null, tone: T.green };
}
const tripCodes = (r) => {
  const segs = (r.roundTrip && r.outbound ? r.outbound.segments : r.segments) || [];
  const cs = []; for (const s of segs) { if (!cs.length) cs.push(s.fromCode); cs.push(s.toCode); }
  return cs.join(" → ");
};
const Check = ({ on, onClick }) => (
  <div onClick={onClick} className="press" style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${on ? T.green : T.line}`, background: on ? T.green + "22" : "transparent", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>{on && <Icon d={I.check} size={13} color={T.green} />}</div>
);
const TimeBadge = ({ st }) => st.label ? <span style={{ fontSize: 10, fontWeight: 700, color: ST_COLOR[st.key] || (st.key === "now" ? T.violet : T.subd), background: (ST_COLOR[st.key] || (st.key === "now" ? T.violet : T.subd)) + "1c", border: `1px solid ${(ST_COLOR[st.key] || (st.key === "now" ? T.violet : T.subd))}44`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>{st.label}</span> : null;

function TripCard({ t, onOpen }) {
  const p = tripProgress(t), act = nextAction(t), d = daysTo(t.df);
  return <div onClick={onOpen} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 12, marginBottom: 10, cursor: "pointer" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: gradFor(t.dc), display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0 }}>✈️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, fontFamily: "Sora,sans-serif" }}>{t.title}</div>
        <div style={{ fontSize: 11.5, color: T.subd }}>{t.df ? fmtShort(new Date(t.df)) : ""}{t.dt ? ` — ${fmtShort(new Date(t.dt))}` : ""}{d != null ? ` · через ${d} дн.` : ""}</div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 11 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)" }}><div style={{ width: p.pct + "%", height: 6, borderRadius: 3, background: GRAD.cta }} /></div>
      <span style={{ fontSize: 11.5, color: T.subd, whiteSpace: "nowrap" }}>{p.done} из {p.total}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: (act.tone || T.violet) + "14", border: `1px solid ${(act.tone || T.violet)}33`, borderRadius: 10, padding: "8px 10px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: act.tone || T.violet, flex: 1 }}>{act.title}</span>
      {act.btn && <Icon d={I.arrow} size={14} color={act.tone || T.violet} />}
    </div>
  </div>;
}

function TripScreen({ t, onBack, onUpdate, onDelete, onFindTickets, goHotels, goDocs, setToast }) {
  const bOn = tripBlocks(t);
  const docs = bOn.docs ? tripDocs(t) : [];
  const p = tripProgress(t), act = nextAction(t), d = daysTo(t.df);
  const [blk, setBlk] = useState("overview");
  const [menu, setMenu] = useState(false);
  const [nameDraft, setNameDraft] = useState(t.title);
  const [svcPick, setSvcPick] = useState(false);
  const [addCustom, setAddCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const upd = (fn) => onUpdate(t.id, fn);
  const nightsAll = (t.df && t.dt) ? Math.max(1, Math.round((new Date(t.dt) - new Date(t.df)) / 86400000)) : null;
  const stopN = (t.route && t.route.stopover && t.route.stopover.nights) || 0;
  const nightsMain = nightsAll != null ? Math.max(1, nightsAll - stopN) : null;
  const lodgeOn = bOn.lodging && !t.lodgingOff;
  const lodgeTotal = 1 + (t.route && t.route.stopover ? 1 : 0);
  const lodgeDone = (t.checks.lodgeMain ? 1 : 0) + (t.route && t.route.stopover && t.checks.lodgeStop ? 1 : 0);
  const docsDone = docs.filter((x) => t.checks.docs[x.id]).length;
  const svcAdded = t.servicesAdded || [];
  const svcDone = svcAdded.filter((id) => t.checks.services[id]).length;
  const custom = t.custom || [];
  const extrasOn = !!bOn.extras || svcAdded.length > 0 || custom.length > 0;
  const extrasDone = svcDone + custom.filter((c) => c.done).length;
  const extrasTotal = svcAdded.length + custom.length;
  const TABS = [
    ["overview", "Обзор", I.grid, null],
    ...(bOn.tickets ? [["tickets", "Билеты", I.plane, t.route ? (t.checks.tickets ? "done" : "part") : "none"]] : []),
    ...(lodgeOn ? [["lodging", "Жильё", I.hotel, lodgeDone === lodgeTotal ? "done" : (lodgeDone ? "part" : "none")]] : []),
    ...(bOn.docs ? [["docs", "Документы", I.doc, docs.length && docsDone === docs.length ? "done" : (docsDone ? "part" : "none")]] : []),
    ...(extrasOn ? [["extras", "Сборы", I.bag, extrasTotal && extrasDone === extrasTotal ? "done" : (extrasDone ? "part" : "none")]] : []),
  ];
  const vblk = TABS.some((x) => x[0] === blk) ? blk : "overview";
  const runAct = () => { if (act.act === "search") onFindTickets(t); else if (act.act === "hotels") goHotels(); else if (act.act === "services") setBlk(extrasOn ? "extras" : "overview"); else if (act.block && TABS.some((x) => x[0] === act.block)) setBlk(act.block); };
  const Mark = ({ s }) => s === "done"
    ? <span style={{ width: 15, height: 15, borderRadius: 999, background: T.green + "26", border: `1px solid ${T.green}`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.check} size={9} color={T.green} /></span>
    : s === "part" ? <span style={{ width: 7, height: 7, borderRadius: 999, background: T.violet, flexShrink: 0 }} /> : null;
  const toggleDoc = (id) => upd((x) => ({ ...x, checks: { ...x.checks, docs: { ...x.checks.docs, [id]: !x.checks.docs[id] } } }));
  const toggleSvc = (id) => upd((x) => ({ ...x, checks: { ...x.checks, services: { ...x.checks.services, [id]: !x.checks.services[id] } } }));
  const toggleCustom = (id) => upd((x) => ({ ...x, custom: (x.custom || []).map((c) => c.id === id ? { ...c, done: !c.done } : c) }));
  const addItem = (name) => { const v = String(name || "").trim(); if (!v) return; if (custom.some((c) => c.name === v)) { setToast("Уже в списке"); return; } upd((x) => ({ ...x, custom: [...(x.custom || []), { id: "c" + Date.now(), name: v, done: false }] })); };
  const enableBlock = (k) => { upd((x) => ({ ...x, blocksOn: { ...tripBlocks(x), [k]: true }, ...(k === "lodging" ? { lodgingOff: false } : {}) })); setToast("Раздел добавлен"); };
  // страховка — это доп-услуга, не документ: ведём в «Сборы»/услуги
  const insTap = () => { if (extrasOn) setBlk("extras"); else setSvcPick(true); };
  const docTap = (doc) => { if (doc.id === "ins") insTap(); else goDocs(doc.id); };
  return <div style={{ animation: "slideIn .18s ease-out", paddingBottom: 8 }}>
    <div style={{ padding: "12px 20px 0" }}>
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: gradFor(t.dc), padding: 14, minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(5,5,20,.72))" }} />
        <div onClick={() => { setMenu(!menu); setNameDraft(t.title); }} className="press" style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 999, background: "rgba(8,8,22,.55)", border: "1px solid rgba(255,255,255,.22)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", fontSize: 15 }}>⋯</div>
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 19, color: "#fff" }}>{t.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)" }}>{t.dcName}{t.country && t.country !== t.dcName ? `, ${t.country}` : ""}{t.df ? ` · ${fmtShort(new Date(t.df))}` : ""}{t.dt ? ` — ${fmtShort(new Date(t.dt))}` : ""}{d != null ? ` · через ${d} дн.` : ""}{t.adults > 1 ? ` · ${t.adults} чел.` : ""}</div>
        </div>
      </div>
      {menu && <div style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginTop: 10 }}>
        <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 6 }}>Название поездки</div>
        <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div onClick={() => { upd((x) => ({ ...x, title: nameDraft || x.title })); setMenu(false); setToast("Сохранено"); }} className="press" style={{ flex: 1, textAlign: "center", background: T.violet + "22", border: `1px solid ${T.violet}55`, borderRadius: 10, padding: 8, color: T.violet, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Сохранить</div>
          <div onClick={() => { onDelete(t.id); }} className="press" style={{ flex: 1, textAlign: "center", background: "#ff6db01a", border: "1px solid #ff6db055", borderRadius: 10, padding: 8, color: "#ff6db0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Удалить поездку</div>
        </div>
      </div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 2px 12px" }}>
        <div style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,.08)" }}><div style={{ width: p.pct + "%", height: 7, borderRadius: 4, background: GRAD.cta }} /></div>
        <span style={{ fontSize: 12, color: T.subd, whiteSpace: "nowrap" }}>{p.done} из {p.total} · {p.pct}%</span>
      </div>
      <div className="carousel" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
        {TABS.map(([k, label, ic, st]) => (
          <div key={k} onClick={() => setBlk(k)} className="press" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 12, border: `1px solid ${vblk === k ? T.violet : T.line}`, background: vblk === k ? T.violet + "16" : T.card, cursor: "pointer", flexShrink: 0 }}>
            <Icon d={ic} size={15} color={vblk === k ? T.violet : T.subd} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: vblk === k ? T.violet : T.text, whiteSpace: "nowrap" }}>{label}</span>
            <Mark s={st} />
          </div>))}
      </div>
      {vblk === "overview" && <>
        <div style={{ background: T.card, border: `1.5px solid ${(act.tone || T.violet)}66`, borderRadius: 16, padding: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: act.tone || T.violet, background: (act.tone || T.violet) + "1c", borderRadius: 999, padding: "3px 8px", letterSpacing: .3 }}>СЛЕДУЮЩЕЕ ДЕЙСТВИЕ</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{act.title}</div><div style={{ fontSize: 11.5, color: T.subd, marginTop: 2 }}>{act.sub}</div></div>
            {act.btn && <div onClick={runAct} className="press" style={{ background: GRAD.cta, borderRadius: 11, padding: "9px 13px", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{act.btn}</div>}
          </div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "4px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", padding: "10px 0 4px" }}>Ваши задачи</div>
          {bOn.tickets && (t.route
            ? <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={t.checks.tickets} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, tickets: !x.checks.tickets } }))} />
              <div onClick={() => setBlk("tickets")} className="press" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}><div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>Билеты</div><div style={{ fontSize: 10.5, color: T.subd }}>{t.route.codes}</div></div>
              {t.checks.tickets && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.green }}>куплены</span>}
            </div>
            : <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px dashed ${T.line}`, flexShrink: 0 }} />
              <div onClick={() => onFindTickets(t)} className="press" style={{ flex: 1, cursor: "pointer" }}><div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>Найти билеты</div><div style={{ fontSize: 10.5, color: T.subd }}>маршрут пока не выбран</div></div>
              <Icon d={I.chevR} size={14} color={T.subd} />
            </div>)}
          {lodgeOn && <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={t.checks.lodgeMain} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, lodgeMain: !x.checks.lodgeMain } }))} />
              <div onClick={() => setBlk("lodging")} className="press" style={{ flex: 1, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: T.text }}>Отель: {t.dcName}{nightsMain != null ? ` · ${nightsMain} ноч.` : ""}</div>
            </div>
            {t.route && t.route.stopover && <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={t.checks.lodgeStop} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, lodgeStop: !x.checks.lodgeStop } }))} />
              <div onClick={() => setBlk("lodging")} className="press" style={{ flex: 1, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: T.text }}>Отель в {prep(t.route.stopover.city)} · {t.route.stopover.nights} ноч.</div>
            </div>}
          </>}
          {docs.map((doc) => { const st = docStatus(doc, t.df); return (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={!!t.checks.docs[doc.id]} onClick={() => toggleDoc(doc.id)} />
              <div onClick={() => docTap(doc)} className="press" style={{ flex: 1, minWidth: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: st.key === "early" ? T.subd : T.text, lineHeight: 1.25 }}>{doc.name}</div>
              {t.checks.docs[doc.id] ? <span style={{ fontSize: 10.5, fontWeight: 700, color: T.green }}>готово</span> : <TimeBadge st={st} />}
            </div>); })}
          {svcAdded.map((id) => { const s = EXTRA_SERVICES.find((x) => x.id === id); if (!s) return null; return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={!!t.checks.services[id]} onClick={() => toggleSvc(id)} />
              <div onClick={() => setBlk("extras")} className="press" style={{ flex: 1, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: T.text }}>{s.title}</div>
              {t.checks.services[id] && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.green }}>готово</span>}
            </div>); })}
          {custom.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={!!c.done} onClick={() => toggleCustom(c.id)} />
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.text }}>{c.name}</div>
              <span onClick={() => upd((x) => ({ ...x, custom: (x.custom || []).filter((y) => y.id !== c.id) }))} className="press" style={{ color: T.subd, fontSize: 15, cursor: "pointer", padding: "0 4px" }}>×</span>
            </div>))}
          {/* добавление недостающих категорий — вещи-подсказки живут в «Сборах» */}
          <div style={{ display: "flex", gap: 6, padding: "10px 0", borderTop: `1px solid ${T.line}`, flexWrap: "wrap" }}>
            {!bOn.tickets && <span onClick={() => enableBlock("tickets")} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px dashed ${T.violet}66`, background: T.violet + "0d", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Билеты</span>}
            {!lodgeOn && <span onClick={() => enableBlock("lodging")} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px dashed ${T.violet}66`, background: T.violet + "0d", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Жильё</span>}
            {!bOn.docs && <span onClick={() => enableBlock("docs")} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px dashed ${T.violet}66`, background: T.violet + "0d", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Документы</span>}
            {!extrasOn && <span onClick={() => { enableBlock("extras"); setBlk("extras"); }} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px dashed ${T.violet}66`, background: T.violet + "0d", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Сборы</span>}
            {extrasOn && <span onClick={() => setBlk("extras")} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.subd, border: `1px dashed ${T.line}`, borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Пункт в сборы</span>}
          </div>
        </div>
        {/* призыв к допам */}
        <div onClick={() => setSvcPick(true)} className="press" style={{ borderRadius: 16, padding: 14, marginBottom: 10, cursor: "pointer", background: "linear-gradient(120deg,#233a7d,#3b2a86)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}><Icon d={I.shield} size={19} color="#fff" /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "Sora,sans-serif" }}>Оформите страховку, eSIM или бизнес-зал</div><div style={{ fontSize: 11.5, color: "rgba(255,255,255,.8)", marginTop: 2 }}>Добавьте к поездке — напомним оформить вовремя</div></div>
            <Icon d={I.arrow} size={17} color="#fff" />
          </div>
        </div>
      </>}
      {vblk !== "overview" && <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 12, marginBottom: 12 }}>
        {vblk === "tickets" && (t.route ? <>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.route.codes}</div>
          <div style={{ fontSize: 11.5, color: T.subd, marginTop: 2 }}>{t.route.stopover ? `стоповер в ${prep(t.route.stopover.city)} · ${t.route.stopover.nights} ноч. · ` : ""}{rub(t.route.total)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
            <Check on={t.checks.tickets} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, tickets: !x.checks.tickets } }))} />
            <span style={{ fontSize: 13, color: T.text, flex: 1 }}>Билеты куплены</span>
            <span onClick={() => onFindTickets(t)} className="press" style={{ fontSize: 12, color: T.violet, fontWeight: 700, cursor: "pointer" }}>Искать снова</span>
          </div>
        </> : <div onClick={() => onFindTickets(t)} className="press" style={{ textAlign: "center", background: T.violet + "22", border: `1px solid ${T.violet}55`, borderRadius: 10, padding: 9, color: T.violet, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Найти билеты</div>)}
        {vblk === "lodging" && <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0 8px" }}>
            <Check on={t.checks.lodgeMain} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, lodgeMain: !x.checks.lodgeMain } }))} />
            <span style={{ fontSize: 13, color: T.text, flex: 1 }}>Отель: {t.dcName}{nightsMain != null ? ` · ${nightsMain} ноч.` : ""}</span>
            <span onClick={goHotels} className="press" style={{ fontSize: 12, color: T.violet, fontWeight: 700, cursor: "pointer" }}>Подобрать</span>
          </div>
          {t.route && t.route.stopover && <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
            <Check on={t.checks.lodgeStop} onClick={() => upd((x) => ({ ...x, checks: { ...x.checks, lodgeStop: !x.checks.lodgeStop } }))} />
            <span style={{ fontSize: 13, color: T.text, flex: 1 }}>Отель в {prep(t.route.stopover.city)} · {t.route.stopover.nights} ноч.</span>
            <span onClick={goHotels} className="press" style={{ fontSize: 12, color: T.violet, fontWeight: 700, cursor: "pointer" }}>Подобрать</span>
          </div>}
          <div onClick={() => { upd((x) => ({ ...x, lodgingOff: true })); setBlk("overview"); setToast("Жильё скрыто — вернуть можно в Обзоре"); }} className="press" style={{ fontSize: 11.5, color: T.subd, cursor: "pointer", paddingTop: 10, borderTop: `1px solid ${T.line}`, textAlign: "center" }}>Жильё не нужно — убрать из плана</div>
        </>}
        {vblk === "docs" && <>
          {docs.map((doc, i) => { const st = docStatus(doc, t.df); return (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <Check on={!!t.checks.docs[doc.id]} onClick={() => toggleDoc(doc.id)} />
              <span onClick={() => docTap(doc)} className="press" style={{ fontSize: 12.5, color: st.key === "early" ? T.subd : T.text, flex: 1, lineHeight: 1.25, cursor: "pointer" }}>{doc.name}</span>
              <TimeBadge st={st} />
            </div>); })}
          <div style={{ fontSize: 10.5, color: T.subd, marginTop: 8 }}>Сроки ориентировочные — проверяйте на официальных сайтах</div>
        </>}
        {vblk === "extras" && <>
          {EXTRA_SERVICES.map((s, i) => { const added = svcAdded.includes(s.id); return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              {added ? <Check on={!!t.checks.services[s.id]} onClick={() => toggleSvc(s.id)} />
                : <div style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px dashed ${T.line}`, flexShrink: 0 }} />}
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: T.text, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 10.5, color: T.subd }}>от {s.from} ₽ · {s.sub}</div></div>
              {added
                ? <span onClick={() => upd((x) => ({ ...x, servicesAdded: (x.servicesAdded || []).filter((id) => id !== s.id) }))} className="press" style={{ fontSize: 11.5, color: T.subd, cursor: "pointer" }}>убрать</span>
                : <span onClick={() => upd((x) => ({ ...x, servicesAdded: [...(x.servicesAdded || []), s.id] }))} className="press" style={{ fontSize: 11.5, color: s.color, fontWeight: 700, border: `1px solid ${s.color}55`, background: s.color + "14", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>＋ Добавить</span>}
            </div>); })}
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", padding: "12px 0 2px", borderTop: `1px solid ${T.line}`, marginTop: 4 }}>Свои пункты</div>
          {custom.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
              <Check on={!!c.done} onClick={() => toggleCustom(c.id)} />
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.text }}>{c.name}</div>
              <span onClick={() => upd((x) => ({ ...x, custom: (x.custom || []).filter((y) => y.id !== c.id) }))} className="press" style={{ color: T.subd, fontSize: 15, cursor: "pointer", padding: "0 4px" }}>×</span>
            </div>))}
          <div style={{ display: "flex", gap: 8, padding: "10px 0 4px" }}>
            <input value={customDraft} onChange={(e) => setCustomDraft(e.target.value)} placeholder="Свой пункт…" style={{ flex: 1, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", color: T.text, fontSize: 13, outline: "none" }} />
            <div onClick={() => { addItem(customDraft); setCustomDraft(""); }} className="press" style={{ background: GRAD.cta, borderRadius: 10, padding: "9px 13px", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>＋</div>
          </div>
          {PACK_SUGGEST.map(([grp, items]) => { const rest = items.filter((n) => !custom.some((c) => c.name === n)); if (!rest.length) return null; return (
            <div key={grp} style={{ paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.subd, letterSpacing: .4, marginBottom: 6 }}>{grp.toUpperCase()}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {rest.map((n) => <span key={n} onClick={() => addItem(n)} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.text, border: `1px dashed ${T.line}`, borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ {n}</span>)}
              </div>
            </div>); })}
        </>}
      </div>}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px" }}>
        <Icon d={I.moon} size={16} color={T.subd} />
        <span style={{ fontSize: 12.5, color: T.subd, flex: 1 }}>Напоминания о дедлайнах</span>
        <Badge label="скоро" color={T.subd} />
      </div>
    </div>
    {svcPick && <Overlay onClose={() => setSvcPick(false)}>
      <SheetHead title="Услуги для поездки" onClose={() => setSvcPick(false)} />
      <div style={{ fontSize: 12, color: T.subd, marginBottom: 10 }}>Добавьте к поездке — попадёт в задачи, напомним оформить вовремя.</div>
      {EXTRA_SERVICES.map((s) => { const added = svcAdded.includes(s.id); return (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: s.color + "22", border: `1px solid ${s.color}55`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I[s.icon]} size={17} color={s.color} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{s.title}</div><div style={{ fontSize: 10.5, color: T.subd }}>от {s.from} ₽ · {s.sub}</div></div>
          {added
            ? <span style={{ fontSize: 11.5, fontWeight: 700, color: T.green }}>✓ в плане</span>
            : <span onClick={() => upd((x) => ({ ...x, servicesAdded: [...(x.servicesAdded || []), s.id] }))} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: s.color, border: `1px solid ${s.color}55`, background: s.color + "14", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>＋ Добавить</span>}
        </div>); })}
    </Overlay>}
  </div>;
}

/* Ручное создание поездки: направление + даты, без билетов */
function NewTripSheet({ onClose, onCreate }) {
  const [q, setQ] = useState(""); const [dest, setDest] = useState(null);
  const [df, setDf] = useState(""); const [dt, setDt] = useState(""); const [adults, setAdults] = useState(1);
  const [kidsAges, setKidsAges] = useState([]);
  const list = q.trim().length >= 2 && !dest ? AIRPORTS.filter((a) => a.city.toLowerCase().startsWith(q.trim().toLowerCase())).slice(0, 6) : [];
  const ok = dest && df;
  const inputSt = { width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" };
  const create = () => {
    if (!ok) return;
    const dep = new Date(df);
    onCreate({ id: "t" + Date.now(), title: `${dest.city} · ${MONTHS_S[dep.getMonth()]}`, dcName: dest.city, dc: dest.code, country: dest.country, oc: "", ocName: "", df, dt: dt || "", adults, children: kidsAges, route: null, checks: { tickets: false, lodgeMain: false, lodgeStop: false, docs: {}, services: {} }, servicesAdded: [], custom: [], docsExtra: [], lodgingOff: false, blocksOn: { tickets: true, lodging: true, docs: true }, createdAt: Date.now() });
  };
  return <Overlay onClose={onClose}>
    <SheetHead title="Новая поездка" onClose={onClose} />
    <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 6 }}>Куда едем</div>
    {dest ? <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.violet}55`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
      <span style={{ fontSize: 14, color: T.text, fontWeight: 700, flex: 1 }}>{dest.flag} {dest.city}, {dest.country}</span>
      <span onClick={() => { setDest(null); setQ(""); }} className="press" style={{ fontSize: 12, color: T.subd, cursor: "pointer" }}>изменить</span>
    </div> : <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Город или страна" style={{ ...inputSt, marginBottom: 6 }} />
      {list.map((a) => <div key={a.code} onClick={() => setDest(a)} className="press" style={{ padding: "9px 10px", fontSize: 13.5, color: T.text, cursor: "pointer", borderRadius: 10 }}>{a.flag} {a.city} <span style={{ color: T.subd, fontSize: 11.5 }}>· {a.country}</span></div>)}
      <div style={{ height: 6 }} />
    </>}
    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: T.subd, marginBottom: 6 }}>Туда</div><input type="date" value={df} onChange={(e) => setDf(e.target.value)} style={inputSt} /></div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: T.subd, marginBottom: 6 }}>Обратно</div><input type="date" value={dt} onChange={(e) => setDt(e.target.value)} style={inputSt} /></div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 13, color: T.text, flex: 1 }}>Путешественники</span>
      <div onClick={() => setAdults(Math.max(1, adults - 1))} className="press" style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", color: T.text, cursor: "pointer" }}>−</div>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{adults}</span>
      <div onClick={() => setAdults(Math.min(9, adults + 1))} className="press" style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", color: T.text, cursor: "pointer" }}>＋</div>
    </div>
    <div style={{ marginBottom: 14 }}><KidsPicker ages={kidsAges} onChange={setKidsAges} /></div>
    <div onClick={create} className="press" style={{ textAlign: "center", background: ok ? GRAD.cta : T.card, border: ok ? "none" : `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: ok ? "#fff" : T.subd, fontSize: 14.5, fontWeight: 800, cursor: ok ? "pointer" : "default" }}>Создать поездку</div>
  </Overlay>;
}

function RoutesScreen({ trips, onOpenTrip, onNewTrip, onPickDest, onSearch, saved, onUnlike, onOpenSaved, recent, onClearRecent, onRunRecent }) {
  const [showAll, setShowAll] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const today = todayISO();
  const active = (trips || []).filter((t) => !t.df || t.df >= today).sort((a, b) => (a.df || "9999") < (b.df || "9999") ? -1 : 1);
  const past = (trips || []).filter((t) => t.df && t.df < today);
  const visible = showAll ? saved : saved.slice(0, 3);
  const Fold = ({ icon, title, count, open, onToggle, children, extra }) => (<div style={{ padding: "0 20px" }}>
    <div onClick={onToggle} className="press" style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 2px", cursor: "pointer", borderTop: `1px solid ${T.line}` }}>
      <Icon d={icon} size={16} color={T.subd} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Sora,sans-serif" }}>{title}</span>
      {extra}
      <span style={{ fontSize: 12, color: T.subd }}>{count}</span>
      <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-flex" }}><Icon d={I.chevR} size={13} color={T.subd} /></span>
    </div>
    {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
  </div>);
  return <div style={{ animation: "fadeUp .18s ease-out", paddingBottom: 8 }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 20, flex: 1 }}>Путешествия</div>
        <div onClick={onNewTrip} className="press" style={{ display: "flex", alignItems: "center", gap: 5, background: T.violet + "22", border: `1px solid ${T.violet}55`, borderRadius: 999, padding: "6px 12px", color: T.violet, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>＋ Новая</div>
      </div>
      {active.length ? active.map((t) => <TripCard key={t.id} t={t} onOpen={() => onOpenTrip(t.id)} />) : (
        <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 18, padding: "22px 16px", textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🧳</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, fontFamily: "Sora,sans-serif" }}>Пока нет поездок</div>
          <div style={{ fontSize: 12, color: T.subd, marginTop: 4, marginBottom: 14 }}>Найдите билеты и нажмите «Взять в поездку» — TripWise поможет подготовить всё остальное</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <div onClick={onSearch} className="press" style={{ background: GRAD.cta, borderRadius: 12, padding: "9px 14px", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Найти билеты</div>
            <div onClick={onNewTrip} className="press" style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "9px 14px", color: T.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Создать вручную</div>
          </div>
        </div>)}
    </div>
    <Section title="Сохранённые маршруты" action={saved.length > 3 ? (showAll ? "Свернуть" : "Смотреть все") : null} onAction={() => setShowAll(!showAll)}>
      {visible.length ? visible.map((s) => (<div key={s.id} onClick={() => onOpenSaved(s)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: GRAD.night, display: "grid", placeItems: "center", fontSize: 18 }}>{s.emoji}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.name}</div><div style={{ fontSize: 11, color: T.subd }}>{s.dates} • {s.adults || 1} взрослый • Эконом</div></div>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>от {rub(s.price)}</div>
        <div onClick={(e) => { e.stopPropagation(); onUnlike(s.id); }} className="press" style={{ cursor: "pointer", padding: 4 }}><Icon d={I.heart} size={18} color={T.pink} /></div>
      </div>)) : <div style={{ color: T.subd, fontSize: 13, padding: "8px 2px" }}>Пока пусто — лайкните маршрут в результатах поиска</div>}
    </Section>
    <Fold icon={I.clock} title="Последние поиски" count={recent.length} open={histOpen} onToggle={() => setHistOpen(!histOpen)}
      extra={recent.length && histOpen ? <span onClick={(e) => { e.stopPropagation(); onClearRecent(); }} className="press" style={{ fontSize: 11.5, color: T.subd, cursor: "pointer" }}>очистить</span> : null}>
      {recent.length ? recent.map((s, i) => (<div key={i} onClick={() => onRunRecent(s)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}><Icon d={I.clock} size={18} color={T.violet} /><div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.name}</div><div style={{ fontSize: 11, color: T.subd }}>{s.dates} • {(s.form && s.form.adults) || 1} {plural((s.form && s.form.adults) || 1, "взрослый", "взрослых", "взрослых")} • Эконом</div></div></div>)) : <div style={{ color: T.subd, fontSize: 13, padding: "8px 2px" }}>История пуста</div>}
    </Fold>
    {past.length > 0 && <Fold icon={I.moon} title="Прошедшие поездки" count={past.length} open={pastOpen} onToggle={() => setPastOpen(!pastOpen)}>
      {past.map((t) => <TripCard key={t.id} t={t} onOpen={() => onOpenTrip(t.id)} />)}
    </Fold>}
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
/*
  ПОЛЯ ПРОМОКОДА (все, кроме обязательных, можно опускать):
    header      — заголовок-предложение над кодом (обяз.)
    code        — сам промокод (обяз.)
    discountRub — скидка в рублях, для сортировки (обяз.)
    endDate     — действует до (YYYY-MM-DD), показываем только если >= сегодня (обяз.)
    stayFrom/stayTo — даты проживания (YYYY-MM-DD): покажем «на проживания с дд/мм по дд/мм»
    url         — КУДА вести при копировании этого кода (если не задан — общий url сервиса).
                  Иконка копирования и подменяет ссылку у нижней кнопки «Перейти…».
*/
/*
  ПРОМОКОДЫ. Поля каждого промо:
    header      — заголовок-предложение (обяз.)
    code        — сам промокод (обяз.)
    discountRub — скидка в рублях, для сортировки (обяз.)
    endDate     — КРАЙНИЙ срок бронирования (YYYY-MM-DD): промо доступен, если сегодня <= endDate
    stayFrom/stayTo — окно ДАТ ПОЕЗДКИ (YYYY-MM-DD): промо подходит, если дата вылета попадает в это окно
    country     — страна назначения (как в датасете, напр. "Индонезия"); пусто = действует для всех стран
    city        — город назначения (как в датасете, напр. "Бали"); пусто = любой город страны
    url         — куда вести (если пусто — общий url сервиса)
  Промокод сам появится в результатах поиска, если: сегодня<=endDate И страна/город совпали (или пусто=глобальный) И дата вылета в окне stayFrom..stayTo.
*/
const SERVICES = [
  { id: "yandex", name: "Яндекс Путешествия", desc: "Отели по всему миру", grad: GRAD.ocean, url: "https://travel.yandex.ru",
    promos: [
      { header: "Скидка на первое бронирование отеля", code: "TRIPWISE20", discountRub: 5000, endDate: "2026-12-31", stayFrom: "2026-06-01", stayTo: "2026-12-31", country: "", city: "", url: "https://travel.yandex.ru/hotels/" },
      { header: "Промокод на отели Чувашии", code: "CHUVASHIA10", discountRub: 1500, endDate: "2026-09-30", stayFrom: "2026-07-01", stayTo: "2026-09-30", country: "Россия", city: "Чебоксары", url: "https://travel.yandex.ru/hotels/cheboksary/" },
    ] },
  { id: "ostrovok", name: "Островок", desc: "Кэшбэк на бронирования", grad: GRAD.sunset, url: "https://ostrovok.ru",
    promos: [
      { header: "Скидка на отели в Азии", code: "OSTROVOK15", discountRub: 3000, endDate: "2026-11-15", stayFrom: "2026-08-01", stayTo: "2026-11-30", country: "", city: "" },
    ] },
  { id: "bali", name: "Bali Resorts", desc: "Спецпредложение на виллы", grad: GRAD.city, url: "https://example.com",
    promos: [
      { header: "Скидка на виллы с бассейном", code: "BALI25", discountRub: 8000, endDate: "2026-10-01", stayFrom: "2026-09-01", stayTo: "2026-10-31", country: "Индонезия", city: "Бали" },
    ] },
];
const todayISO = () => new Date().toISOString().slice(0, 10);
// промокоды, релевантные конкретной поездке (страна/город назначения + дата вылета)
function promosForTrip({ country, city, depISO }) {
  const today = todayISO(); const out = [];
  for (const s of SERVICES) for (const p of (s.promos || [])) {
    if (p.endDate && p.endDate < today) continue;                  // бронировать уже нельзя
    if (p.country && country && p.country !== country) continue;   // другая страна
    if (p.city && city && p.city !== city) continue;               // другой город
    if (p.stayFrom && depISO && depISO < p.stayFrom) continue;     // вылет раньше окна
    if (p.stayTo && depISO && depISO > p.stayTo) continue;         // вылет позже окна
    out.push({ ...p, service: s.name, serviceId: s.id, serviceUrl: s.url });
  }
  return out.sort((a, b) => b.discountRub - a.discountRub);
}

/* ПОЛЕЗНЫЕ СЕРВИСЫ (партнёрские). url — впиши реф-ссылку партнёра; пусто = покажем «скоро».
   from — цена «от», для чипа. Иконка/цвет — оформление плитки. */
/* Чек-лист сборов по группам — пользователь добавляет нужное в раздел «Сборы» */
const PACK_SUGGEST = [
  ["Техника", ["Повербанк", "Зарядки и кабели", "Переходник для розеток", "Наушники", "Ноутбук"]],
  ["Финансы", ["Обменять валюту", "Наличные $", "Предупредить банк о поездке"]],
  ["Здоровье", ["Аптечка", "Личные лекарства", "Солнцезащитный крем", "Репеллент"]],
  ["Разное", ["Офлайн-карты", "Копии документов", "Очки или линзы", "Зонт/дождевик", "Бутылка для воды"]],
];
const EXTRA_SERVICES = [
  { id: "insurance", title: "Страхование", sub: "медицина · рейс · багаж", from: 200, icon: "shield", color: "#7c5cff", url: "" },
  { id: "lounge", title: "Бизнес-залы", sub: "комфорт в ожидании рейса", from: 1500, icon: "armchair", color: "#48dcdc", url: "" },
  { id: "esim", title: "eSIM", sub: "интернет в любой стране", from: 99, icon: "sim", color: "#f59640", url: "" },
  { id: "transfer", title: "Трансфер", sub: "из аэропорта до отеля", from: 700, icon: "car", color: "#39d98a", url: "" },
];
function ServiceGrid({ setToast }) {
  const go = (s) => { if (s.url) { try { window.open(s.url, "_blank"); } catch (e) { } setToast(`Открываем: ${s.title}…`); } else setToast("Скоро подключим партнёра"); };
  return <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {EXTRA_SERVICES.map((s) => (
        <div key={s.id} onClick={() => go(s)} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", minHeight: 118 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: s.color + "22", border: `1px solid ${s.color}55`, display: "grid", placeItems: "center" }}><Icon d={I[s.icon]} size={19} color={s.color} /></div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginTop: 8, fontFamily: "Sora,sans-serif" }}>{s.title}</div>
          <div style={{ fontSize: 10.5, color: T.subd, marginTop: 2, flex: 1, lineHeight: 1.3 }}>{s.sub}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: s.color, background: s.color + "1a", border: `1px solid ${s.color}44`, borderRadius: 999, padding: "4px 9px" }}>от {s.from} ₽</span>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(255,255,255,.06)", border: `1px solid ${T.line}`, display: "grid", placeItems: "center" }}><Icon d={I.arrow} size={12} color={T.sub} /></div>
          </div>
        </div>))}
    </div>
    <div style={{ fontSize: 10.5, color: T.subd, marginTop: 8, textAlign: "center" }}>Услуги оказывают партнёры — переход по кнопке</div>
  </>;
}

/* Заглушка раздела «Документы» (этап 4 наполнит контентом) */
function Docs({ trips, onOpenTrip, onCreateTrip, onAddDocToTrip, preOpenDoc, onPreDone, setToast }) {
  const [mode, setMode] = useState("home");   // home | pick | kit
  const [country, setCountry] = useState(null);
  const [cq, setCq] = useState("");                    // поиск страны в подборе
  const [adults, setAdults] = useState(1);
  const [kidsAges, setKidsAges] = useState([]);        // возрасты детей
  const kids = kidsAges.length > 0;
  const [kitSel, setKitSel] = useState([]);            // выбранные документы «по ситуации»
  const [df, setDf] = useState("");           // дата вылета (опционально) — включает тайминг
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState(null);        // открытая карточка документа
  const [addOpen, setAddOpen] = useState(false); // «добавить в путешествие»
  const [searchOpen, setSearchOpen] = useState(false); // нижний лист поиска (над клавиатурой)
  const [wiz, setWiz] = useState(null);                // открытый мастер заполнения
  // открытие карточки конкретного документа из поездки
  useEffect(() => {
    if (preOpenDoc) { const dd = ALL_DOCS.find((x) => x.id === preOpenDoc); if (dd) setDoc(dd); onPreDone && onPreDone(); }
  }, [preOpenDoc]);
  const countries = Object.keys(DOC_MATRIX);
  const found = q.trim().length >= 2 ? ALL_DOCS.filter((x) => (x.name + " " + x.country + " " + (x.kw || "")).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const popular = ["tdac", "evisa_id", "schengen", "eta"].map((id) => ALL_DOCS.find((x) => x.id === id)).filter(Boolean);
  const inputSt = { width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" };
  const timingText = (dd) => { if (df) { const st = docStatus(dd, df); return <TimeBadge st={st} />; }
    const parts = []; if (dd.E < 9999) parts.push(`не раньше чем за ${dd.E} дн.`); if (dd.P > 0) parts.push(`оформляется ~${dd.P} дн.`);
    return parts.length ? <span style={{ fontSize: 10, color: T.subd, whiteSpace: "nowrap" }}>{parts.join(" · ")}</span> : null; };
  const DocRow = ({ dd, dim }) => { const info = DOC_INFO[dd.id] || {}; return (
    <div onClick={() => setDoc(dd)} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: `1px solid ${T.line}`, cursor: "pointer" }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: T.violet + "1a", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.doc} size={15} color={dim ? T.subd : T.violet} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: dim ? T.subd : T.text, lineHeight: 1.25 }}>{dd.name}</div><div style={{ fontSize: 10.5, color: T.subd }}>{DOC_TYPE_LABEL[info.type] || ""}</div></div>
      {timingText(dd)}
      <Icon d={I.chevR} size={14} color={T.subd} />
    </div>); };
  const createTripFromKit = (c) => {
    const cc = c || country; if (!cc) return;
    const dep = df ? new Date(df) : null;
    onCreateTrip({ id: "t" + Date.now(), title: `${cc}${dep ? " · " + MONTHS_S[dep.getMonth()] : ""}`, dcName: cc, dc: "", country: cc, oc: "", ocName: "", df: df || "", dt: "", adults, children: kidsAges, route: null, checks: { tickets: false, lodgeMain: false, lodgeStop: false, docs: {}, services: {} }, servicesAdded: [], docsExtra: (doc && !country) ? [doc.id] : [...kitSel], custom: [], lodgingOff: false, blocksOn: { tickets: false, lodging: false, docs: true }, createdAt: Date.now() });
    setAddOpen(false);
  };
  const matching = (trips || []).filter((t) => t.country === (doc ? doc.country : country));
  return <div style={{ animation: "fadeUp .18s ease-out", paddingBottom: 8 }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      {mode === "home" && <>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>Документы</div>
        <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4, marginBottom: 14 }}>Соберём комплект под поездку или поможем с одним документом.</div>
        {/* Сценарий 1: подбор комплекта */}
        <div style={{ background: T.card, border: `1.5px solid ${T.violet}55`, borderRadius: 18, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: GRAD.cta, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.doc} size={20} color="#fff" /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif" }}>Подобрать документы для поездки</div><div style={{ fontSize: 11.5, color: T.subd, marginTop: 2 }}>Пара вопросов — и персональный комплект со сроками</div></div>
          </div>
          <div onClick={() => setMode("pick")} className="press" style={{ marginTop: 12, textAlign: "center", background: GRAD.cta, borderRadius: 12, padding: 11, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>Начать</div>
        </div>
        {/* Сценарий 2: конкретный документ */}
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Sora,sans-serif", marginBottom: 4 }}>Помочь с конкретным документом</div>
          <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 10 }}>Например: TDAC, eVisa, шенгенская анкета</div>
          <div onClick={() => setSearchOpen(true)} className="press" style={{ ...inputSt, color: T.subd, cursor: "pointer" }}>Название документа или страна</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {popular.map((x) => <span key={x.id} onClick={() => setDoc(x)} className="press" style={{ fontSize: 11.5, color: T.violet, fontWeight: 700, background: T.violet + "14", border: `1px solid ${T.violet}44`, borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>{x.name.length > 22 ? x.name.slice(0, 22) + "…" : x.name}</span>)}
          </div>
        </div>
      </>}
      {mode === "pick" && <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div onClick={() => setMode("home")} className="press" style={{ cursor: "pointer" }}><Icon d={I.back} size={20} color={T.text} /></div>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text }}>Подбор документов</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.subd, marginBottom: 8 }}>Куда едете?</div>
        {country ? <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.violet}55`, borderRadius: 12, padding: "10px 12px", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: T.text, fontWeight: 700, flex: 1 }}>{country}</span>
          <span onClick={() => { setCountry(null); setCq(""); }} className="press" style={{ fontSize: 12, color: T.subd, cursor: "pointer" }}>изменить</span>
        </div> : <div style={{ marginBottom: 16 }}>
          <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Страна поездки" style={inputSt} />
          {(cq.trim() ? countries.filter((c) => c.toLowerCase().includes(cq.trim().toLowerCase())) : countries).slice(0, 6).map((c) => (
            <div key={c} onClick={() => { setCountry(c); setCq(""); }} className="press" style={{ padding: "10px 8px", fontSize: 13.5, color: T.text, cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>{c}</div>))}
        </div>}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.subd, marginBottom: 8 }}>Кто едет?</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: T.text, flex: 1 }}>Взрослые</span>
          <div onClick={() => setAdults(Math.max(1, adults - 1))} className="press" style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", color: T.text, cursor: "pointer" }}>−</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 16, textAlign: "center" }}>{adults}</span>
          <div onClick={() => setAdults(Math.min(9, adults + 1))} className="press" style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", color: T.text, cursor: "pointer" }}>＋</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", marginBottom: 16 }}><KidsPicker ages={kidsAges} onChange={setKidsAges} /></div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.subd, marginBottom: 8 }}>Когда вылет? <span style={{ fontWeight: 400 }}>(можно пропустить — включит сроки)</span></div>
        <input type="date" value={df} onChange={(e) => setDf(e.target.value)} style={{ ...inputSt, marginBottom: 16 }} />
        <div onClick={() => country && setMode("kit")} className="press" style={{ textAlign: "center", background: country ? GRAD.cta : T.card, border: country ? "none" : `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: country ? "#fff" : T.subd, fontSize: 14.5, fontWeight: 800, cursor: country ? "pointer" : "default" }}>Собрать комплект</div>
      </>}
      {mode === "kit" && country && <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div onClick={() => setMode("pick")} className="press" style={{ cursor: "pointer" }}><Icon d={I.back} size={20} color={T.text} /></div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text }}>{country}</div><div style={{ fontSize: 11.5, color: T.subd }}>{adults} {plural(adults, "взрослый", "взрослых", "взрослых")}{kids ? " · с детьми" : ""}{df ? ` · вылет ${fmtShort(new Date(df))}` : ""}</div></div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, margin: "12px 0 2px", fontFamily: "Sora,sans-serif" }}>Обязательно</div>
        {(DOC_MATRIX[country] || DOC_BASE).map((dd) => <DocRow key={dd.id} dd={dd} />)}
        {kids && <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.subd, margin: "14px 0 2px", fontFamily: "Sora,sans-serif" }}>По ситуации <span style={{ fontWeight: 400 }}>— добавьте нужное</span></div>
          {KID_DOCS.filter((x) => x.id !== "kid_birth").map((dd) => { const sel = kitSel.includes(dd.id); return (
            <div key={dd.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: `1px solid ${T.line}` }}>
              <div onClick={() => setDoc(dd)} className="press" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: T.violet + "1a", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.doc} size={15} color={sel ? T.violet : T.subd} /></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: sel ? T.text : T.subd, lineHeight: 1.25 }}>{dd.name}</div>
              </div>
              <span onClick={() => setKitSel(sel ? kitSel.filter((x) => x !== dd.id) : [...kitSel, dd.id])} className="press" style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: sel ? T.green : T.violet, border: `1px solid ${(sel ? T.green : T.violet)}55`, background: (sel ? T.green : T.violet) + "14", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>{sel ? "✓ В комплекте" : "＋ Добавить"}</span>
            </div>); })}
        </>}
        <div onClick={() => setAddOpen(true)} className="press" style={{ marginTop: 14, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Добавить комплект в путешествие</div>
        <div style={{ fontSize: 10.5, color: T.subd, marginTop: 8, textAlign: "center" }}>Сроки ориентировочные — проверяйте официальные источники</div>
      </>}
    </div>
    {wiz && <DocWizard doc={wiz} onClose={() => setWiz(null)} setToast={setToast} />}
    {/* Поиск документа: нижний лист — вместе с подсказками сидит над клавиатурой */}
    {searchOpen && <Overlay onClose={() => { setSearchOpen(false); setQ(""); }}>
      <SheetHead title="Поиск документа" onClose={() => { setSearchOpen(false); setQ(""); }} />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Например: тайская карта, eVisa, шенген" style={inputSt} />
      <div style={{ marginTop: 8 }}>
        {found.map((x) => <div key={x.id} onClick={() => { setDoc(x); setSearchOpen(false); setQ(""); }} className="press" style={{ padding: "11px 6px", cursor: "pointer", borderBottom: `1px solid ${T.line}` }}><span style={{ fontSize: 13.5, color: T.text, fontWeight: 600 }}>{x.name}</span> <span style={{ fontSize: 11, color: T.subd }}>· {x.country}</span></div>)}
        {!found.length && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {popular.map((x) => <span key={x.id} onClick={() => { setDoc(x); setSearchOpen(false); }} className="press" style={{ fontSize: 11.5, color: T.violet, fontWeight: 700, background: T.violet + "14", border: `1px solid ${T.violet}44`, borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>{x.name.length > 22 ? x.name.slice(0, 22) + "…" : x.name}</span>)}
        </div>}
      </div>
    </Overlay>}
    {/* Карточка документа */}
    {doc && (() => { const info = DOC_INFO[doc.id] || {}; const links = (info.links || []).filter((l) => l.url); return (
      <Overlay onClose={() => setDoc(null)}>
        <SheetHead title={doc.name} onClose={() => setDoc(null)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge label={DOC_TYPE_LABEL[info.type] || "документ"} color={T.cyan} />
          <Badge label={doc.country} color={T.subd} />
          {df && <TimeBadge st={docStatus(doc, df)} />}
        </div>
        {info.desc && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.45, marginBottom: 12 }}>{info.desc}</div>}
        {(doc.E < 9999 || doc.P > 0) && <div style={{ fontSize: 12, color: T.subd, marginBottom: 12 }}>Когда заниматься: {doc.E < 9999 ? `не раньше чем за ${doc.E} дн. до вылета` : "в любое время"}{doc.P > 0 ? ` · оформляется ~${doc.P} дн.` : ""}</div>}
        {(info.req || []).length > 0 && <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 6, fontFamily: "Sora,sans-serif" }}>Что потребуется</div>
          {(info.req || []).map((rq) => <div key={rq} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}><span style={{ width: 5, height: 5, borderRadius: 999, background: T.violet }} /><span style={{ fontSize: 12.5, color: T.sub }}>{rq}</span></div>)}
        </>}
        <div onClick={() => { if (DOC_FIELDS[doc.id]) { setWiz(doc); setDoc(null); } else setToast("Мастер для этого документа появится позже"); }} className="press" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Заполнить с помощником {!DOC_FIELDS[doc.id] && <Badge label="скоро" color="#fff" />}</div>
        {links.length > 0 && <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, margin: "14px 0 6px", fontFamily: "Sora,sans-serif" }}>Официальные ссылки</div>
          {links.map((l) => <div key={l.label} onClick={() => { try { window.open(l.url, "_blank"); } catch (e) { } }} className="press" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${T.line}`, cursor: "pointer" }}><span style={{ fontSize: 13, color: T.violet, fontWeight: 600, flex: 1 }}>{l.label}</span><Icon d={I.chevR} size={14} color={T.subd} /></div>)}
        </>}
        {DOC_MATRIX[doc.country] && <div onClick={() => setAddOpen(true)} className="press" style={{ marginTop: 12, textAlign: "center", background: T.violet + "1a", border: `1px solid ${T.violet}55`, borderRadius: 12, padding: 11, color: T.violet, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Добавить в путешествие</div>}
      </Overlay>); })()}
    {/* Добавление в путешествие: существующее или новое */}
    {addOpen && <Overlay onClose={() => setAddOpen(false)}>
      <SheetHead title="В какое путешествие?" onClose={() => setAddOpen(false)} />
      {matching.map((t) => <div key={t.id} onClick={() => { const ids = doc ? [doc.id] : [...kitSel]; setAddOpen(false); setDoc(null); onAddDocToTrip(t.id, ids); }} className="press" style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: gradFor(t.dc), display: "grid", placeItems: "center", fontSize: 16 }}>✈️</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{t.title}</div><div style={{ fontSize: 11, color: T.subd }}>документы уже внутри — отметьте готовые</div></div>
        <Icon d={I.chevR} size={15} color={T.subd} />
      </div>)}
      {(doc ? DOC_MATRIX[doc.country] : country) && <div onClick={() => { createTripFromKit(doc ? doc.country : country); setDoc(null); }} className="press" style={{ textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋ Создать новое путешествие</div>}
    </Overlay>}
  </div>;
}
const ddmm = (s) => { if (!s) return ""; const p = String(s).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : s; };
function Hotels({ setToast, preOpen, onPreDone }) {
  const [svc, setSvc] = useState(null);
  const [goUrl, setGoUrl] = useState(null); // ссылка нижней кнопки, подменяется при копировании
  // авто-открытие сервиса по клику на промо-чипс из карточки маршрута
  useEffect(() => {
    if (preOpen) {
      const s = SERVICES.find((x) => x.id === preOpen);
      if (s) { setSvc(s); setGoUrl(null); }
      onPreDone && onPreDone();
    }
  }, [preOpen]);
  const today = new Date().toISOString().slice(0, 10);
  const copy = async (p) => { try { await navigator.clipboard.writeText(p.code); setGoUrl(p.url || null); setToast("Промокод скопирован"); } catch (e) { setToast("Не удалось скопировать"); } };
  const activePromos = (s) => (s.promos || []).filter(p => p.endDate >= today).sort((a, b) => b.discountRub - a.discountRub);
  return <div style={{ animation: "fadeUp .18s ease-out" }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>Промокоды на отели</div>
      <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>Выберите сервис — внутри активные промокоды.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SERVICES.map((s, i) => { const n = activePromos(s).length; return (
          <div key={s.id} onClick={() => { setSvc(s); setGoUrl(null); }} className="press card-in" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", animationDelay: `${i * 70}ms` }}>
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
              <div onClick={() => copy(p)} className="press" style={{ cursor: "pointer", padding: 6, borderRadius: 8, background: T.violet + "22" }}><Icon d={I.copy} size={18} color={T.violet} /></div>
            </div>
            <div style={{ fontSize: 11, color: T.subd, marginTop: 4 }}>Действует до {p.endDate}{(p.stayFrom && p.stayTo) ? ` · на проживания с ${ddmm(p.stayFrom)} по ${ddmm(p.stayTo)}` : ""}</div>
          </div>
        )) : <div style={{ color: T.subd, fontSize: 13, textAlign: "center", padding: 12 }}>Активных промокодов пока нет</div>}
      </div>
      <div style={{ marginTop: 16 }}><Btn onClick={() => { try { window.open(goUrl || svc.url, "_blank"); } catch (e) { } setToast(`Открываем ${svc.name}…`); }}>Перейти в {svc.name}</Btn></div>
    </Overlay>}
  </div>;
}

/* ================================ APP ================================== */
export default function App() {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]); // overlay под вкладкой «Маршруты»: results/detail
  const [sheet, setSheet] = useState(false);
  const [traveler, setTraveler] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);      // оверлей «Сервисы» с главной
  const [trips, setTrips] = useState(() => store.get("trips", []));
  useEffect(() => { store.set("trips", trips); }, [trips]);
  const [tripOpen, setTripOpen] = useState(null);      // id открытой поездки
  const [newTrip, setNewTrip] = useState(false);       // оверлей ручного создания
  const [confirmTrip, setConfirmTrip] = useState(null); // маршрут, ожидающий подтверждения «Взять в поездку»
  const [kb, setKb] = useState(false);                 // открыта ли клавиатура (по фокусу в полях)
  useEffect(() => {
    let tm = null;
    const isField = (el) => el && el.tagName && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    const onIn = (e) => { if (isField(e.target)) { clearTimeout(tm); setKb(true); } };
    const onOut = (e) => { if (isField(e.target)) { clearTimeout(tm); tm = setTimeout(() => setKb(false), 120); } };
    document.addEventListener("focusin", onIn); document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); clearTimeout(tm); };
  }, []);
  const [hotelsPre, setHotelsPre] = useState(null);    // авто-открытие сервиса промокодов в «Отелях»
  const [docsPre, setDocsPre] = useState(null);        // авто-открытие карточки документа в «Документах»
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(() => store.get("name", "TripWise tester"));
  useEffect(() => { store.set("name", name); }, [name]);
  const [inset, setInset] = useState({ top: 0, bottomStr: "env(safe-area-inset-bottom)", logoTop: null });
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
      // вертикальный центр полосы системных кнопок Telegram («Закрыть» слева, меню справа) — для логотипа
      const logoTop = sum > 0 ? Math.round((sa.top || 0) + Math.max(ci.top || 0, 44) / 2 - 13) : null;
      setInset({ top, bottomStr, logoTop });
    };
    try {
      tg.ready(); tg.expand();
      const isMobile = tg.platform === "ios" || tg.platform === "android";
      const goFullscreen = () => { try { if (tg.requestFullscreen && isMobile && (!tg.isVersionAtLeast || tg.isVersionAtLeast("8.0")) && !tg.isFullscreen) tg.requestFullscreen(); } catch (e) { } };
      const noSwipe = () => { try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { } };
      goFullscreen(); noSwipe();
      const u = tg.initDataUnsafe && tg.initDataUnsafe.user; if (u && u.first_name) setName([u.first_name, u.last_name].filter(Boolean).join(" "));
      recalc();
      ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"].forEach((ev) => tg.onEvent && tg.onEvent(ev, recalc));
      // некоторые клиенты готовы дать fullscreen/swipe-lock не сразу после ready — повторяем
      [150, 500, 1200].forEach((ms) => setTimeout(() => { recalc(); goFullscreen(); noSwipe(); }, ms));
    } catch (e) { }
    return () => { try { ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"].forEach((ev) => tg.offEvent && tg.offEvent(ev, recalc)); } catch (e) { } };
  }, []);

  const [form, setForm] = useState({ origin: null, dest: null, round: true, dep: null, ret: null, adults: 1, children: [] });
  const [query, setQuery] = useState({ origin: "", destName: "", destinationId: "", adults: 1, datesLabel: "" });
  const [routes, setRoutes] = useState([]); const [loading, setLoading] = useState(false); const [selected, setSelected] = useState(null);
  const [searchError, setSearchError] = useState(false);

  const [saved, setSaved] = useState(() => store.get("saved", []));
  useEffect(() => { store.set("saved", saved); }, [saved]);
  const [recent, setRecent] = useState(() => store.get("recent", []));
  useEffect(() => { store.set("recent", recent); }, [recent]);

  // открыть конкретный маршрут по ссылке-шарингу: start_param из Telegram (t.me/.../app?startapp=...) или #r= в браузере
  const pendingOpenId = useRef(null);
  const lastSearchRef = useRef(null); // параметры последнего успешного поиска — для шеринга
  const b64urlEnc = (s) => btoa(unescape(encodeURIComponent(s))).split("+").join("-").split("/").join("_").replace(/=+$/, "");
  const b64urlDec = (s) => decodeURIComponent(escape(atob(s.split("-").join("+").split("_").join("/"))));
  const deepLinkDone = useRef(false);
  useEffect(() => {
    const tryOpen = () => {
      if (deepLinkDone.current) return;
      try {
        const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
        const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
        const h = (typeof location !== "undefined" && location.hash) || "";
        const m = h.match(/[#&]r=([^&]+)/);
        const raw = sp || (m && m[1]) || "";
        if (!raw) return;
        const d = JSON.parse(b64urlDec(raw)); // {oc,dc,df,dt,a,id}
        const o = AIRPORTS.find(a => a.code === d.oc), ds = AIRPORTS.find(a => a.code === d.dc);
        if (o && ds && d.df) {
          deepLinkDone.current = true;
          const f = { origin: o, dest: ds, round: !!d.dt, dep: new Date(d.df), ret: d.dt ? new Date(d.dt) : null, adults: d.a || 1 };
          setForm(f); pendingOpenId.current = d.id || null;
          setTimeout(() => runSearch(f), 0); // после маунта
        }
        try { history.replaceState(null, "", location.pathname); } catch (e) { }
      } catch (e) { }
    };
    tryOpen();
    const t = setTimeout(tryOpen, 700); // ретрай: WebApp мог не успеть отдать start_param
    return () => clearTimeout(t);
  }, []);

  const top = stack[stack.length - 1];
  const datesLabel = (f) => f.dep ? (f.round && f.ret ? `${fmtShort(f.dep)} — ${fmtShort(f.ret)}` : fmtShort(f.dep)) : "";

  const runSearch = async (f) => {
    const ff = f || form;
    if (!ff.origin || !ff.dest || !ff.dep) { setSheet(true); setToast("Заполните откуда, куда и дату"); return; }
    const nq = { origin: ff.origin.city, destName: ff.dest.city, destCountry: ff.dest.country, destinationId: ff.dest.destId || ff.dest.code, adults: ff.adults, datesLabel: datesLabel(ff), depISO: iso(ff.dep) };
    lastSearchRef.current = { oc: ff.origin.code, dc: ff.dest.code, df: iso(ff.dep), dt: (ff.round && ff.ret) ? iso(ff.ret) : "", a: ff.adults || 1, ch: ff.children || [] };
    setQuery(nq); setSheet(false); setTab("routes"); setStack(["results"]); setLoading(true); setSearchError(false);  // <- переходим в «Маршруты»
    const recForm = { origin: ff.origin, dest: ff.dest, round: ff.round, dep: iso(ff.dep), ret: ff.ret ? iso(ff.ret) : null, adults: ff.adults };
    setRecent((p) => [{ name: `${nq.origin} — ${nq.destName}`, dates: nq.datesLabel, form: recForm }, ...p.filter(x => x.name !== `${nq.origin} — ${nq.destName}`)].slice(0, 7));
    try {
      const res = await apiSearch({ origin: ff.origin.city, originCode: ff.origin.code, destinationId: ff.dest.destId || undefined, destCode: ff.dest.code, destName: ff.dest.city, dateFrom: iso(ff.dep), dateTo: ff.round && ff.ret ? iso(ff.ret) : undefined, style: "stopover", tier: "free", roundTrip: !!(ff.round && ff.ret), passengers: { adults: ff.adults, children: ff.children || [] } });
      setRoutes(res);
      // если пришли по шеринг-ссылке — сразу открываем нужную карточку
      if (pendingOpenId.current) {
        const match = res.find(x => x.id === pendingOpenId.current);
        pendingOpenId.current = null;
        if (match) { setSelected(match); setStack(["results", "detail"]); }
      }
    } catch (e) { setSearchError(true); setRoutes([]); }
    setLoading(false);
  };
  const updateTrip = (id, fn) => setTrips((p) => p.map((t) => t.id === id ? fn(t) : t));
  const openTripScreen = (id) => { setTripOpen(id); setTab("routes"); setStack(["trip"]); };
  // «Взять в поездку»: сперва подтверждение (пользователь осознаёт создание карточки поездки)
  const askTakeTrip = (r) => {
    const ls = lastSearchRef.current || {};
    const dup = trips.find((t) => t.route && t.route.rid === r.id && t.df === (ls.df || ""));
    if (dup) { openTripScreen(dup.id); return; }
    setConfirmTrip(r);
  };
  const takeTrip = (r) => {
    const ls = lastSearchRef.current || {};
    const dup = trips.find((t) => t.route && t.route.rid === r.id && t.df === (ls.df || ""));
    if (dup) { openTripScreen(dup.id); return; }
    const dep = ls.df ? new Date(ls.df) : null;
    const t = {
      id: "t" + Date.now(),
      title: `${query.destName || ls.dc || "Поездка"}${dep ? " · " + MONTHS_S[dep.getMonth()] : ""}`,
      dcName: query.destName || "", dc: ls.dc || "", country: query.destCountry || "",
      oc: ls.oc || "", ocName: query.origin || "", df: ls.df || "", dt: ls.dt || "", adults: ls.a || 1,
      route: { rid: r.id, total: r.total, codes: tripCodes(r), stopover: r.stopover ? { city: r.stopover.city, nights: r.stopover.nights } : null },
      blocksOn: { tickets: true, lodging: false, docs: false },  // из билетов показываем только билеты; жильё/документы добавляются в Обзоре
      checks: { tickets: false, lodgeMain: false, lodgeStop: false, docs: {}, services: {} },
      servicesAdded: [], custom: [], docsExtra: [], lodgingOff: false, children: ls.ch || [], createdAt: Date.now(),
    };
    setTrips((p) => [t, ...p]); setToast("Поездка создана"); openTripScreen(t.id);
  };
  const findTicketsForTrip = (t) => {
    const o = AIRPORTS.find((a) => a.code === t.oc) || null, ds = AIRPORTS.find((a) => a.code === t.dc) || null;
    const f = { origin: o, dest: ds, round: !!t.dt, dep: t.df ? new Date(t.df) : null, ret: t.dt ? new Date(t.dt) : null, adults: t.adults || 1 };
    setForm(f);
    if (o && ds && t.df) runSearch(f); else setSheet(true);
  };
  const openSheetWithDest = (id) => { const a = byDest(id); setForm((f) => ({ ...f, dest: a })); setSheet(true); };

  // системная кнопка «Назад» Telegram: показывается вместо «Закрыть», когда есть куда вернуться
  useEffect(() => {
    const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.BackButton) return;
    const canBack = stack.length > 0 || sheet || traveler || editName || svcOpen || newTrip || confirmTrip;
    let fired = false; // защита от двойного срабатывания (две подписки)
    const onBack = () => {
      if (fired) return; fired = true; setTimeout(() => { fired = false; }, 300);
      if (confirmTrip) return setConfirmTrip(null);
      if (newTrip) return setNewTrip(false);
      if (svcOpen) return setSvcOpen(false);
      if (editName) return setEditName(false);
      if (traveler) return setTraveler(false);
      if (sheet) return setSheet(false);
      setStack((p) => p.slice(0, -1));
    };
    try {
      if (canBack) {
        tg.BackButton.show();
        if (tg.BackButton.onClick) tg.BackButton.onClick(onBack);
        if (tg.onEvent) tg.onEvent("backButtonClicked", onBack);
      } else tg.BackButton.hide();
    } catch (e) { }
    return () => {
      try { if (tg.BackButton.offClick) tg.BackButton.offClick(onBack); } catch (e) { }
      try { if (tg.offEvent) tg.offEvent("backButtonClicked", onBack); } catch (e) { }
    };
  }, [stack, sheet, traveler, editName, svcOpen, newTrip, confirmTrip]);
  const isLiked = (r) => !!saved.find(x => x.id === ("liked-" + r.id));
  const likeRoute = (r) => {
    const id = "liked-" + r.id;
    if (saved.find(x => x.id === id)) { setSaved(p => p.filter(x => x.id !== id)); setToast("Удалено из маршрутов"); }
    else { setSaved(p => [{ id, name: `${query.origin} — ${query.destName}`, dates: query.datesLabel, price: r.total, emoji: "🛫", route: r, query }, ...p]); setToast("Добавлено в «Маршруты»"); }
  };
  const shareRoute = (r) => {
    let weblink = "https://t.me/TripWiseAI_bot/app";
    try {
      // компактный payload (startapp ограничен 512 симв.): параметры поиска + id маршрута
      const ls = lastSearchRef.current || { oc: (form.origin && form.origin.code) || "", dc: (form.dest && form.dest.code) || "", df: form.dep ? iso(form.dep) : "", dt: (form.round && form.ret) ? iso(form.ret) : "", a: form.adults || 1 };
      if (ls.oc && ls.dc && ls.df) weblink = `https://t.me/TripWiseAI_bot/app?startapp=${b64urlEnc(JSON.stringify({ ...ls, id: r.id }))}`;
    } catch (e) { }
    const text = `${query.origin} → ${query.destName} за ${rub(r.total)} — нашёл в TripWiseAI ✈️`;
    const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(weblink)}&text=${encodeURIComponent(text)}`;
    try {
      if (tg && tg.openTelegramLink) { tg.openTelegramLink(shareUrl); return; }
      if (typeof navigator !== "undefined" && navigator.share) { navigator.share({ title: "TripWiseAI", text, url: weblink }); return; }
      window.open(shareUrl, "_blank"); setToast("Открываю Telegram…");
    } catch (e) { try { navigator.clipboard.writeText(text + " " + weblink); setToast("Ссылка скопирована"); } catch (_) { setToast("Поделиться недоступно"); } }
  };
  const openSaved = (s) => { setSelected(s.route); setQuery({ ...s.query, datesLabel: s.dates }); setTab("routes"); setStack(["results", "detail"]); };

  let main = null;
  if (tab === "routes") {
    const curTrip = trips.find((t) => t.id === tripOpen);
    if (top === "trip" && curTrip) main = <TripScreen t={curTrip} onBack={() => setStack([])} onUpdate={updateTrip} onDelete={(id) => { setTrips((p) => p.filter((x) => x.id !== id)); setStack([]); setToast("Поездка удалена"); }} onFindTickets={findTicketsForTrip} goHotels={() => { setHotelsPre(null); setTab("hotels"); }} goDocs={(docId) => { setDocsPre(typeof docId === "string" ? docId : null); setTab("docs"); }} setToast={setToast} />;
    else if (top === "trip") main = <RoutesScreen trips={trips} onOpenTrip={openTripScreen} onNewTrip={() => setNewTrip(true)} onPickDest={openSheetWithDest} onSearch={() => setSheet(true)} saved={saved} onUnlike={(id) => setSaved((p) => p.filter((x) => x.id !== id))} onOpenSaved={openSaved} recent={recent} onClearRecent={() => setRecent([])} onRunRecent={(s) => { const f = { ...s.form, dep: s.form.dep ? new Date(s.form.dep) : null, ret: s.form.ret ? new Date(s.form.ret) : null }; setForm(f); runSearch(f); }} />;
    else if (top === "detail") main = <Detail r={selected} query={query} onBack={() => setStack(["results"])} onEdit={() => { setTab("home"); setSheet(true); }} liked={isLiked(selected)} onLike={likeRoute} onShare={shareRoute} goHotels={(svc) => { setHotelsPre(svc || null); setTab("hotels"); }} onTakeTrip={askTakeTrip} inTrip={!!(selected && trips.some((t) => t.route && t.route.rid === selected.id && t.df === ((lastSearchRef.current || {}).df || "")))} />;
    else if (top === "results") main = <Results query={query} routes={routes} loading={loading} error={searchError} onRetry={() => runSearch()} onEdit={() => { setTab("home"); setSheet(true); }} onBack={() => setStack([])} onOpen={(r) => { setSelected(r); setStack(["results", "detail"]); }} isLiked={isLiked} onLike={likeRoute} />;
    else main = <RoutesScreen trips={trips} onOpenTrip={openTripScreen} onNewTrip={() => setNewTrip(true)} onPickDest={openSheetWithDest} onSearch={() => setSheet(true)} saved={saved} onUnlike={(id) => setSaved(p => p.filter(x => x.id !== id))} onOpenSaved={openSaved} recent={recent} onClearRecent={() => setRecent([])} onRunRecent={(s) => { const f = { ...s.form, dep: s.form.dep ? new Date(s.form.dep) : null, ret: s.form.ret ? new Date(s.form.ret) : null }; setForm(f); runSearch(f); }} />;
  } else if (tab === "home") main = <Home onSearch={() => setSheet(true)} onPickDest={openSheetWithDest} goTab={setTab} openServices={() => setSvcOpen(true)} />;
  else if (tab === "hotels") main = <Hotels setToast={setToast} preOpen={hotelsPre} onPreDone={() => setHotelsPre(null)} />;
  else if (tab === "docs") main = <Docs trips={trips} preOpenDoc={docsPre} onPreDone={() => setDocsPre(null)} onOpenTrip={openTripScreen} onAddDocToTrip={(tripId, ids) => { updateTrip(tripId, (x) => { const cur = x.docsExtra || []; const base = (DOC_MATRIX[x.country] || DOC_BASE).map((dd) => dd.id); const add = (ids || []).filter((id) => !cur.includes(id) && !base.includes(id)); return { ...x, docsExtra: [...cur, ...add], blocksOn: { ...tripBlocks(x), docs: true } }; }); openTripScreen(tripId); }} onCreateTrip={(t) => { setTrips((p) => [t, ...p]); setToast("Поездка создана"); openTripScreen(t.id); }} setToast={setToast} />;
  else if (tab === "profile") main = <Profile name={name} onTraveler={() => setTraveler(true)} onEditName={() => setEditName(true)} setToast={setToast} />;

  return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", justifyContent: "center" }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap');
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes fadeUp{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      @keyframes slideIn{from{opacity:0;transform:translate3d(10px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
      @keyframes fade{from{opacity:0}to{opacity:1}}
      .card-in{opacity:0;animation:fadeUp .4s ease forwards}
      .press{transition:transform .12s ease, opacity .12s ease}
      .press:active{transform:scale(.97);opacity:.9}
      .carousel{scrollbar-width:none}
      ::-webkit-scrollbar{display:none}
      input::placeholder{color:${T.subd}}
      input,select,textarea{font-size:16px}
      html,body{touch-action:pan-y;background:#0a0a18}
      .app-root{height:100vh;height:100dvh}
    `}</style>
    <div className="app-root" style={{ width: "100%", maxWidth: 420, paddingTop: safeTop, background: `radial-gradient(120% 60% at 80% 0%, #1a1340 0%, ${T.bg} 55%)`, color: T.text, fontFamily: "Manrope,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: inset.logoTop != null ? inset.logoTop + "px" : "calc(env(safe-area-inset-top, 0px) + 14px)", zIndex: 30, pointerEvents: "none" }}><Logo /></div>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", background: "transparent", paddingTop: 10, paddingBottom: 92 }}>{main}</div>
      {!kb && <BottomNav tab={tab} setTab={(k) => { if (k === tab && (k === "routes" || k === "profile" || k === "hotels" || k === "docs")) setStack([]); if (k === "routes" && tab === "routes") setStack([]); setTab(k); }} bottomStr={inset.bottomStr} />}
      {sheet && <SearchSheet form={form} setForm={setForm} onClose={() => setSheet(false)} onSubmit={() => runSearch()} setToast={setToast} />}
      {traveler && <Traveler safeTop={safeTop} bottomStr={inset.bottomStr} onBack={() => setTraveler(false)} />}
      {confirmTrip && <Overlay onClose={() => setConfirmTrip(null)}>
        <SheetHead title="Создать поездку?" onClose={() => setConfirmTrip(null)} />
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif" }}>{query.origin} → {query.destName}</div>
          <div style={{ fontSize: 12, color: T.subd, marginTop: 3 }}>{query.datesLabel}{confirmTrip.stopover ? ` · стоповер в ${prep(confirmTrip.stopover.city)} ${confirmTrip.stopover.nights} ноч.` : ""} · {rub(confirmTrip.total)}</div>
          <div style={{ fontSize: 11.5, color: T.subd, marginTop: 8, lineHeight: 1.4 }}>TripWise создаст карточку поездки: соберёт документы по стране, подскажет сроки, подберёт жильё со скидкой и напомнит о важном.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div onClick={() => setConfirmTrip(null)} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: T.subd, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Отмена</div>
          <div onClick={() => { const r = confirmTrip; setConfirmTrip(null); takeTrip(r); }} className="press" style={{ flex: 1.4, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>✈ Создать</div>
        </div>
      </Overlay>}
      {newTrip && <NewTripSheet onClose={() => setNewTrip(false)} onCreate={(t) => { setTrips((p) => [t, ...p]); setNewTrip(false); setToast("Поездка создана"); openTripScreen(t.id); }} />}
      {svcOpen && <Overlay onClose={() => setSvcOpen(false)}><SheetHead title="Сервисы для поездки" onClose={() => setSvcOpen(false)} /><ServiceGrid setToast={setToast} /></Overlay>}
      {editName && <NameEdit name={name} onClose={() => setEditName(false)} onSave={(n) => { setName(n); setEditName(false); setToast("Имя сохранено"); }} />}
      <Toast msg={toast} />
    </div>
  </div>;
}
