import React, { useState, useRef, useEffect } from "react";

/*
  TripWiseAI — MVP (8 экранов). Живой бэкенд + mock-фолбэк.
  Поиск аэропортов с фильтром, шеринг через Telegram, переход в «Маршруты» при поиске,
  интеграция с Telegram WebApp (имя/тема/шеринг). Фото = градиенты-заглушки.
*/

const API_BASE = "https://functions.yandexcloud.net/d4e3hpvr0lrijksc8i1r";

/* ================== АНАЛИТИКА (Яндекс.Метрика) ==================
   Все вызовы безопасны: если ym ещё не загрузился в Telegram WebView — тихо пропускаем.
   trackPage — виртуальный просмотр вкладки; trackGoal — цель (reachGoal). */
const YM_ID = 110545946;
const YM_TAB_PATH = { home: "/home", routes: "/trips", hotels: "/hotels", docs: "/documents", profile: "/profile" };
const YM_TAB_TITLE = { home: "Главная", routes: "Путешествия", hotels: "Отели", docs: "Документы", profile: "Профиль" };
function ym_safe() { try { return typeof window !== "undefined" && typeof window.ym === "function" ? window.ym : null; } catch (e) { return null; } }
function trackPage(path, title) { const f = ym_safe(); if (!f) return; try { f(YM_ID, "hit", path, { title }); } catch (e) { } }
function trackGoal(goal, params) { const f = ym_safe(); if (!f) return; try { params ? f(YM_ID, "reachGoal", goal, params) : f(YM_ID, "reachGoal", goal); } catch (e) { } }
// backend MAU-counter: валидный источник MAU по Telegram user_id (не зависит от Метрики)
function trackAppOpenBackend() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    const initData = tg && tg.initData;
    if (!initData) return;
    fetch(API_BASE + "?action=track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "app_open", initData }) }).catch(() => {});
  } catch (e) { }
}

const T = {
  // v4: общая визуальная система приведена к главной странице — глубокий navy,
  // спокойные поверхности и один акцент вместо «фиолетового SaaS» на каждом экране.
  bg: "#020914", bg2: "#010610", card: "#061321", card2: "#091a2c",
  line: "rgba(129,156,204,.22)", line2: "rgba(141,171,228,.38)",
  text: "#f7f8fc", sub: "#9aa3b8", subd: "#737e97",
  violet: "#9364f5", cyan: "#31c7f3", green: "#39d98a", gold: "#d7b46a", pink: "#d66cf1",
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

/* ======================== ГЛАВНАЯ: ВИЗУАЛЬНАЯ СИСТЕМА ========================
   Эти токены применяются только к главной странице и общей нижней навигации.
   Остальные экраны, API, аналитика и бизнес-логика не изменены. */
const HOME_T = {
  bg: "#020914",
  bgDeep: "#010610",
  surface: "#061321",
  surface2: "#091a2c",
  surface3: "#0d1d32",
  border: "rgba(129,156,204,.22)",
  borderStrong: "rgba(141,171,228,.38)",
  text: "#f7f8fc",
  sub: "#9aa3b8",
  subDim: "#737e97",
  violet: "#9364f5",
  pink: "#d66cf1",
  cyan: "#31c7f3",
  gold: "#d7b46a",
};

/* Все пути к новой графике собраны здесь. Если файлы в репозитории названы иначе,
   достаточно поправить только этот объект. */
const HOME_ASSETS = {
  hero: "/graphics/main.png",
  documents: "/graphics/home/documents.png",
  hotels: "/graphics/home/hotels.png",
  services: "/graphics/home/services.png",
  fullTrip: "/graphics/home/full-trip.png",
  actionLocation: "/graphics/actions/action-location.png",
  actionAi: "/graphics/actions/action-ai.png",
  actionArrow: "/graphics/actions/action-arrow.png",
  nav: {
    home: "/graphics/nav/nav-home.png",
    routes: "/graphics/nav/nav-trips.png",
    hotels: "/graphics/nav/nav-hotels.png",
    docs: "/graphics/nav/nav-documents.png",
    profile: "/graphics/nav/nav-profile.png",
  },
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

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d) => d ? `${d.getDate()} ${MONTHS_S[d.getMonth()]}` : "";
async function apiSearch(req) {
  try {
    const r = await fetch(`${API_BASE}?action=search-routes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    if (!r.ok) { console.warn("[TripWiseAI] search-routes HTTP", r.status); return []; }
    const d = await r.json();
    if (d && d.ok) return d.routes || [];
    return [];
  } catch (error) {
    console.warn("[TripWiseAI] search request failed", error); // сеть/JSON — отдаём пустой результат, UI покажет «ничего не найдено»
    return [];
  }
}
// синхронизация поездки и настроек уведомлений на сервер (для пуш-напоминаний)
function tgInitData() { try { return (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || ""; } catch (e) { return ""; } }
async function sharedApi(action, payload = {}, timeoutMs = 30000) {
  const initData = tgInitData();
  if (!initData) return { ok: false, error: "telegram required" };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs || 30000)) : null;
  try {
    const r = await fetch(API_BASE + "?action=" + encodeURIComponent(action), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, initData }), signal: ctrl ? ctrl.signal : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok && d.ok !== true) return { ...d, ok:false, error:d.error || ("HTTP " + r.status), status:r.status };
    return d;
  } catch (e) {
    if (e && (e.name === "AbortError" || String(e.message || e).toLowerCase().includes("abort"))) return { ok: false, error: "timeout" };
    return { ok: false, error: String(e && e.message || e) };
  } finally { if (timer) clearTimeout(timer); }
}
function stripServerFields(trip) {
  if (!trip) return trip;
  const { members, askGroup, creatorId, shareCode, schemaVersion, revision, updatedAt, _viewer, activityLog, travelerStates, settlementPayments, ...core } = trip;
  return core;
}
async function syncTripToServer(trip, baseRevision) {
  if (!trip) return { ok: false };
  const d = await sharedApi("save-trip", { trip: stripServerFields(trip), baseRevision: baseRevision == null ? (trip.revision || 0) : baseRevision });
  if (!d.ok && d.error !== "revision conflict") console.warn("[TripWiseAI] save-trip failed", d.error);
  return d;
}
async function deleteTripOnServer(tripId) {
  if (!tripId) return { ok: false };
  const d = await sharedApi("delete-trip", { tripId });
  if (!d.ok) console.warn("[TripWiseAI] delete-trip failed", d.error);
  return d;
}
function syncNotifyPrefs(prefs) {
  const initData = tgInitData(); if (!initData) return;
  fetch(API_BASE + "?action=notify-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, prefs }) }).catch((e) => console.warn("[TripWiseAI] notify-prefs failed", e));
}
const rub = (n) => (n == null ? "—" : Math.round(n).toLocaleString("ru-RU") + " ₽");
const hm = (min) => { if (!min || min <= 0) return "—"; const h = Math.floor(min / 60), m = min % 60; return `${h}ч${m ? " " + m + "м" : ""}`; };
// смещение из ISO ("...+05:00") в минутах
const isoOff = (iso) => { const m = String(iso || "").match(/([+-]\d{2}):?(\d{2})$/); if (!m) return 0; const sign = m[1][0] === "-" ? -1 : 1; return sign * (parseInt(m[1].slice(1), 10) * 60 + parseInt(m[2], 10)); };
// время вылета: берём готовое от бэка, иначе из ISO (локальное время вылета)
const depOf = (s) => s.departHM || (s.departISO ? String(s.departISO).slice(11, 16) : "—");
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
// Незасинхронизированные изменения Trip переживают закрытие Mini App.
// При следующем запуске делаем трёхстороннее объединение: base → local поверх актуального server.
const _jEq=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch(e){return a===b;}};
function mergeTripRecovery(base,local,remote){
  if(_jEq(local,base))return remote;
  if(_jEq(remote,base))return local;
  if(local===undefined)return undefined;
  if(base===null||local===null||remote===null||typeof base!=="object"||typeof local!=="object"||typeof remote!=="object")return local;
  if(Array.isArray(base)||Array.isArray(local)||Array.isArray(remote)){
    if(!Array.isArray(local)||!Array.isArray(remote))return local;
    const objIds=[...base,...local,...remote].filter(Boolean).every(x=>typeof x==="object"&&!Array.isArray(x)&&x.id!=null);
    if(objIds){
      const bm=new Map((base||[]).map(x=>[String(x.id),x])),lm=new Map(local.map(x=>[String(x.id),x])),rm=new Map(remote.map(x=>[String(x.id),x]));
      const order=[...remote.map(x=>String(x.id)),...local.map(x=>String(x.id)).filter(id=>!rm.has(id))],out=[];
      for(const id of [...new Set(order)]){
        const bh=bm.has(id),lh=lm.has(id),rh=rm.has(id);
        if(bh&&!lh)continue; // локальное удаление
        if(!lh){if(rh)out.push(rm.get(id));continue;}
        if(!bh){out.push(rh?mergeTripRecovery(undefined,lm.get(id),rm.get(id)):lm.get(id));continue;}
        if(!rh){out.push(lm.get(id));continue;}
        out.push(mergeTripRecovery(bm.get(id),lm.get(id),rm.get(id)));
      }
      return out;
    }
    const primitive=[...base,...local,...remote].every(x=>x==null||["string","number","boolean"].includes(typeof x));
    if(primitive){const bs=new Set(base),ls=new Set(local),out=[...remote.filter(x=>!(bs.has(x)&&!ls.has(x)))];for(const x of local)if(!bs.has(x)&&!out.some(y=>_jEq(x,y)))out.push(x);return out;}
    return local;
  }
  const out={...remote},keys=new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})]);
  for(const k of keys){const bh=Object.prototype.hasOwnProperty.call(base||{},k),lh=Object.prototype.hasOwnProperty.call(local||{},k),rh=Object.prototype.hasOwnProperty.call(remote||{},k);if(bh&&!lh){delete out[k];continue;}if(!lh){continue;}if(!bh){out[k]=rh?mergeTripRecovery(undefined,local[k],remote[k]):local[k];continue;}out[k]=mergeTripRecovery(base[k],local[k],remote[k]);}
  return out;
}
const localDocRecord = (tripId, docId) => (store.get("mydocs", []) || []).filter((x)=>String(x.docKey||"")===String(docId||"") && String(x.tripId||"")===String(tripId||"")).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0] || null;
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
function PageHero({ title, sub, emoji, grad = GRAD.night, bullets }) {
  return <div style={{ margin: "4px 20px 14px" }}>
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: grad, padding: "18px 16px", minHeight: 96, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 78% 10%, rgba(255,255,255,.22), transparent 55%)" }} />
      <div style={{ position: "relative", flex: 1 }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1.15 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.82)", marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
      </div>
      <div style={{ position: "relative", width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", display: "grid", placeItems: "center", fontSize: 30, flexShrink: 0 }}>{emoji}</div>
    </div>
    {bullets && bullets.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {bullets.map((b, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: T.violet, flexShrink: 0 }} /><span style={{ fontSize: 12, color: T.sub }}>{b}</span></div>)}
    </div>}
  </div>;
}
function Badge({ label, color = T.violet, icon }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: color + "22", border: `1px solid ${color}55`, color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}</span>; }
function Btn({ children, onClick, grad = GRAD.cta, style }) { return <button onClick={onClick} className="press" style={{ border: "none", cursor: "pointer", color: "#fff", fontWeight: 700, fontFamily: "Sora,sans-serif", fontSize: 15, borderRadius: 16, padding: "16px 20px", width: "100%", background: grad, boxShadow: "0 10px 30px -8px rgba(124,92,255,.6)", ...style }}>{children}</button>; }
function UiImage({ src, alt = "", style, fallback = null }) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} style={{ display: "block", userSelect: "none", ...style }} />;
}
function Logo({ home = false }) {
  return <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: home ? HOME_T.text : T.text, letterSpacing: .2 }}>
    TripWise<span style={{ color: home ? HOME_T.cyan : T.violet }}>AI</span>
  </div>;
}
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
/* Единый герой-блок раздела (референс из макетов): заголовок с градиент-акцентом,
   подзаголовок и иллюстрация справа. img — PNG в /graphics/hero/, при отсутствии
   показывается запасная эмодзи-плашка. accentWord подсвечивается градиентом. */
function Header({ onBack, title, subtitle, onEdit }) {
  if (!title && !subtitle && !onEdit) return null;   // пустая шапка не съедает высоту — логотип теперь фиксированный
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px 8px", position: "relative", minHeight: 30 }}>
    
    <div style={{ transform: title ? "translateY(-4px)" : "translateY(-7px)" }}>{title ? <div style={{ textAlign: "center", maxWidth: 220 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.text, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>{subtitle && <div style={{ fontSize: 11, color: T.subd, marginTop: 2 }}>{subtitle}</div>}</div> : null}</div>
    {onEdit && <span onClick={onEdit} className="press" style={{ position: "absolute", right: 20, top: 16, transform: "translateY(25px)", color: T.violet, fontSize: 13, fontWeight: 700, zIndex: 5, cursor: "pointer" }}>Изменить</span>}
  </div>;
}
function BottomNav({ tab, setTab, bottomStr = "0px" }) {
  const items = [
    ["home", "Главная", HOME_ASSETS.nav.home, I.home],
    ["routes", "Путешествия", HOME_ASSETS.nav.routes, I.route],
    ["hotels", "Отели", HOME_ASSETS.nav.hotels, I.hotel],
    ["docs", "Документы", HOME_ASSETS.nav.docs, I.doc],
    ["profile", "Профиль", HOME_ASSETS.nav.profile, I.user],
  ];
  return <div style={{
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 420, zIndex: 40, minHeight: 82,
    padding: `8px 7px max(${bottomStr}, 12px)`, display: "flex",
    background: "rgba(3,11,23,.97)", backdropFilter: "blur(18px)",
    borderTop: `1px solid ${HOME_T.border}`,
    boxShadow: "0 -10px 28px rgba(0,0,0,.18)"
  }}>
    {items.map(([k, label, src, fallbackIcon]) => {
      const active = tab === k;
      return <button key={k} onClick={() => {
        trackPage(YM_TAB_PATH[k] || "/" + k, YM_TAB_TITLE[k] || label);
        if (k === "hotels") trackGoal("hotels_opened");
        else if (k === "docs") trackGoal("documents_opened");
        setTab(k);
      }} className="press" style={{
        flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 4, padding: "1px 0 0", color: active ? HOME_T.pink : HOME_T.subDim
      }}>
        <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <UiImage src={src} alt="" style={{
            width: 38, height: 38, objectFit: "contain",
            opacity: active ? 1 : .7,
            filter: active ? "none" : "saturate(.72) brightness(.9)",
            transition: "opacity .16s ease, filter .16s ease"
          }} fallback={<Icon d={fallbackIcon} size={24} color={active ? HOME_T.pink : HOME_T.subDim} />} />
        </div>
        <span style={{ fontSize: 11, lineHeight: 1.05, fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>{label}</span>
      </button>;
    })}
  </div>;
}
function Toast({ msg }) { if (!msg) return null; return <div style={{ position: "fixed", left: "50%", bottom: 86, transform: "translateX(-50%)", zIndex: 100, background: "#1c1c40", border: `1px solid ${T.line2}`, color: T.text, fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 999, boxShadow: "0 8px 30px rgba(0,0,0,.5)", animation: "fadeUp .25s ease" }}>{msg}</div>; }
function Overlay({ children, onClose, zIndex = 60, centered = false }) {
  return <div style={{ position: "fixed", inset: 0, zIndex, display: "flex", flexDirection: "column", justifyContent: centered ? "center" : "flex-end", padding: centered ? "max(env(safe-area-inset-top),16px) 16px max(env(safe-area-inset-bottom),16px)" : 0 }}>
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.66)", backdropFilter:"blur(4px)", animation: "fade .2s ease" }} />
    <div style={{ position: "relative", background: T.bg2, borderRadius: centered ? 24 : "24px 24px 0 0", border: `1px solid ${T.line}`, paddingTop: 16, paddingLeft: 20, paddingRight: 20, paddingBottom: centered ? 18 : "calc(24px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 420, maxHeight: centered ? "calc(100dvh - max(env(safe-area-inset-top),16px) - max(env(safe-area-inset-bottom),16px) - 24px)" : "calc(100dvh - max(env(safe-area-inset-top),12px) - 8px)", overflowY:"auto", overscrollBehavior:"contain", margin: "0 auto", animation: centered ? "fadeUp .22s ease" : "slideUp .28s cubic-bezier(.2,.8,.2,1)" }}>
      {!centered&&<div style={{ width: 40, height: 4, borderRadius: 2, background: T.line2, margin: "0 auto 14px" }} />}{children}
    </div>
  </div>;
}
function SheetHead({ title, onClose }) { return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 17, color: T.text }}>{title}</span><div onClick={onClose} className="press" style={{ cursor: "pointer" }}><Icon d={I.close} size={20} color={T.sub} /></div></div>; }

function FullScreenOverlay({ children, onClose }) {
  // Один стабильный обработчик Back на весь жизненный цикл модального экрана.
  // Раньше inline onClose переустанавливал Telegram BackButton при каждом rerender,
  // из-за чего на некоторых WebView накапливались обработчики и fullscreen-flow мог зациклиться.
  const closeRef=useRef(onClose); closeRef.current=onClose;
  useEffect(()=>{ if(typeof window==="undefined")return; const prev=window.__tripwiseModalBack||null; const localBack=()=>{try{closeRef.current&&closeRef.current();}catch(e){}}; window.__tripwiseModalBack=localBack; const tg=window.Telegram&&window.Telegram.WebApp, bb=tg&&tg.BackButton, wasVisible=!!(bb&&bb.isVisible); try{if(bb){bb.show();bb.onClick&&bb.onClick(localBack);}}catch(e){} return()=>{ if(window.__tripwiseModalBack===localBack) window.__tripwiseModalBack=prev; try{if(bb){bb.offClick&&bb.offClick(localBack);if(wasVisible)bb.show();else bb.hide();}}catch(e){} }; },[]);
  return <div style={{ position:"fixed", inset:0, zIndex:72, background:`radial-gradient(110% 58% at 82% 0%,#0d1830 0%,${T.bg} 52%,#010610 100%)`, maxWidth:420, margin:"0 auto", overflowY:"auto", overscrollBehavior:"contain", padding:"calc(env(safe-area-inset-top,0px) + 58px) 18px calc(28px + env(safe-area-inset-bottom,0px))", animation:"slideIn .18s ease-out" }}>
    {children}
  </div>;
}
function ScreenHero({ title, sub, image, eyebrow, action, onAction }) {
  return <div style={{ margin:"0 16px 14px", minHeight:118, borderRadius:22, overflow:"hidden", position:"relative", background:`linear-gradient(135deg,${HOME_T.surface2},${HOME_T.surface})`, border:`1px solid ${HOME_T.borderStrong}`, padding:"18px 16px", display:"flex", alignItems:"center", gap:10 }}>
    <div style={{ flex:1, minWidth:0, position:"relative", zIndex:2 }}>
      {eyebrow && <div style={{ color:HOME_T.cyan, fontSize:10.5, fontWeight:800, letterSpacing:.45, textTransform:"uppercase", marginBottom:6 }}>{eyebrow}</div>}
      <div style={{ fontFamily:"Sora,sans-serif", fontWeight:800, fontSize:22, color:HOME_T.text, lineHeight:1.08 }}>{title}</div>
      {sub && <div style={{ color:HOME_T.sub, fontSize:11.7, lineHeight:1.38, marginTop:7, maxWidth:230 }}>{sub}</div>}
      {action && <div onClick={onAction} className="press" style={{ display:"inline-flex", marginTop:10, padding:"7px 11px", borderRadius:999, border:`1px solid ${HOME_T.borderStrong}`, background:"rgba(255,255,255,.04)", color:HOME_T.text, fontSize:11.5, fontWeight:800, cursor:"pointer" }}>{action}</div>}
    </div>
    {image && <UiImage src={image} alt="" style={{ width:105, height:100, objectFit:"contain", flexShrink:0, opacity:.96 }} />}
  </div>;
}
function EmptyState({ icon="✦", title, sub, action, onAction, compact=false }) {
  return <div style={{ textAlign:"center", padding:compact?"18px 12px":"34px 18px", background:T.card, border:`1px solid ${T.line}`, borderRadius:18 }}>
    <div style={{ width:42, height:42, borderRadius:14, margin:"0 auto 10px", background:`linear-gradient(135deg,${T.card2},rgba(147,100,245,.22))`, border:`1px solid ${T.line}`, display:"grid", placeItems:"center", fontSize:18 }}>{icon}</div>
    <div style={{ fontFamily:"Sora,sans-serif", fontSize:14, fontWeight:800, color:T.text }}>{title}</div>
    {sub && <div style={{ fontSize:11.5, lineHeight:1.45, color:T.subd, margin:"6px auto 0", maxWidth:280 }}>{sub}</div>}
    {action && <div onClick={onAction} className="press" style={{ display:"inline-block", marginTop:12, color:T.cyan, fontSize:12, fontWeight:800, cursor:"pointer" }}>{action} →</div>}
  </div>;
}
function ErrorState({ title="Что-то пошло не так", sub="Попробуйте ещё раз.", onRetry }) {
  return <EmptyState icon="!" title={title} sub={sub} action={onRetry ? "Повторить" : null} onAction={onRetry} />;
}
function ConfirmSheet({ title, text, danger=false, confirmLabel="Подтвердить", onConfirm, onClose }) {
  return <Overlay onClose={onClose}><SheetHead title={title} onClose={onClose} />
    <div style={{ fontSize:12.5, color:T.sub, lineHeight:1.5, marginBottom:14 }}>{text}</div>
    <div style={{ display:"flex", gap:9 }}><div onClick={onClose} className="press" style={{ flex:1, textAlign:"center", border:`1px solid ${T.line}`, background:T.card, borderRadius:13, padding:12, color:T.text, fontSize:12.5, fontWeight:800, cursor:"pointer" }}>Отмена</div><div onClick={onConfirm} className="press" style={{ flex:1.25, textAlign:"center", border:`1px solid ${danger?"#ff6db055":T.violet+"55"}`, background:danger?"#ff6db018":GRAD.cta, borderRadius:13, padding:12, color:danger?"#ff7ba9":"#fff", fontSize:12.5, fontWeight:800, cursor:"pointer" }}>{confirmLabel}</div></div>
  </Overlay>;
}
function ActionToast({ data }) { if(!data)return null; return <div style={{ position:"fixed", left:"50%", bottom:94, transform:"translateX(-50%)", zIndex:120, width:"calc(100% - 32px)", maxWidth:388, background:"#081728", border:`1px solid ${T.line2}`, boxShadow:"0 14px 40px rgba(0,0,0,.45)", borderRadius:15, padding:"11px 12px", display:"flex", alignItems:"center", gap:10, animation:"fadeUp .2s ease" }}><span style={{ flex:1, color:T.text, fontSize:12.5, fontWeight:700 }}>{data.text}</span>{data.action && <span onClick={data.onAction} className="press" style={{ color:T.cyan, fontSize:12, fontWeight:900, cursor:"pointer" }}>{data.action}</span>}</div>; }
const addIsoDays=(v,n)=>{if(!v)return"";const d=new Date(v+"T12:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const promoHeadline=(p)=>{const disc=Number(p&&p.discountRub)||0,min=Number(p&&p.minSpendRub)||0;if(disc&&min)return `−${disc.toLocaleString("ru-RU")} ₽ от ${min.toLocaleString("ru-RU")} ₽`;if(disc)return `−${disc.toLocaleString("ru-RU")} ₽`;return (p&&p.header)||"Промокод";};

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


function DateRangePicker({ title="Выберите даты", from="", to="", minDate="", allowSameDay=false, onApply, onClose }) {
  const parse = (v) => v ? new Date(v + "T12:00:00") : null;
  const [start, setStart] = useState(parse(from));
  const [end, setEnd] = useState(parse(to));
  const [view, setView] = useState(parse(from) || new Date());
  const y=view.getFullYear(),m=view.getMonth();
  const startWd=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  const min = minDate ? new Date(minDate + "T00:00:00") : (()=>{const d=new Date();d.setHours(0,0,0,0);return d;})();
  const same=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const between=(d)=>start&&end&&d>start&&d<end;
  const pick=(d)=>{ if(d<min)return; if(!start||end||d<start){setStart(d);setEnd(null);} else if(same(d,start)){if(allowSameDay)setEnd(d);else{setStart(d);setEnd(null);}} else setEnd(d); };
  const cells=[];for(let i=0;i<startWd;i++)cells.push(null);for(let n=1;n<=days;n++)cells.push(new Date(y,m,n));
  return <Overlay onClose={onClose}><SheetHead title={title} onClose={onClose}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div onClick={()=>setView(new Date(y,m-1,1))} className="press" style={{padding:6,cursor:"pointer"}}><Icon d={I.chevL} size={18} color={T.sub}/></div><div style={{fontFamily:"Sora,sans-serif",fontSize:15,fontWeight:800,color:T.text}}>{MON_NOM[m]} {y}</div><div onClick={()=>setView(new Date(y,m+1,1))} className="press" style={{padding:6,cursor:"pointer"}}><Icon d={I.chevR} size={18} color={T.sub}/></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{WD.map(w=><div key={w} style={{textAlign:"center",fontSize:10.5,color:T.subd,padding:"4px 0"}}>{w}</div>)}{cells.map((d,i)=>{if(!d)return <div key={i}/>;const disabled=d<min,sel=same(d,start)||same(d,end),rng=between(d);return <div key={i} onClick={()=>!disabled&&pick(d)} style={{textAlign:"center",padding:"9px 0",borderRadius:9,fontSize:13.5,cursor:disabled?"default":"pointer",color:disabled?T.subd+"55":sel?"#fff":T.text,fontWeight:sel?800:500,background:sel?GRAD.violet:rng?T.violet+"22":"transparent"}}>{d.getDate()}</div>;})}</div>
    <div style={{marginTop:14,background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 11px",fontSize:12,color:start?T.text:T.subd}}>{start?`${fmtShort(start)}${end?` — ${fmtShort(end)}`:" · выберите дату окончания"}`:"Выберите дату начала и окончания"}</div>
    <div style={{marginTop:12}}><Btn onClick={()=>start&&end&&onApply&&onApply(iso(start),iso(end))} style={{opacity:start&&end?1:.45}}>Применить даты</Btn></div>
  </Overlay>;
}
function DateRangeField({ from="", to="", title="Даты", placeholder="Выберите период", minDate="", allowSameDay=false, onChange, style }) {
  const [open,setOpen]=useState(false);
  const label=from&&to?(from===to?ddmm(from):`${ddmm(from)} — ${ddmm(to)}`):placeholder;
  return <><div onClick={()=>setOpen(true)} className="press" style={{display:"flex",alignItems:"center",gap:9,background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 11px",color:from&&to?T.text:T.subd,fontSize:13,cursor:"pointer",...(style||{})}}><span style={{fontSize:15}}>📅</span><span style={{flex:1}}>{label}</span><Icon d={I.chevR} size={14} color={T.subd}/></div>{open&&<DateRangePicker title={title} from={from} to={to} minDate={minDate} allowSameDay={allowSameDay} onClose={()=>setOpen(false)} onApply={(a,b)=>{onChange&&onChange(a,b);setOpen(false);}}/>}</>;
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
  const ideas = [
    ["Бали", "через Сингапур", "/graphics/bali.png", "SIN", "bali"],
    ["Токио", "через Сеул", "/graphics/tokyo.png", "ICN", "tokyo"],
    ["Мальдивы", "через Дубай", "/graphics/male.png", "DXB", "maldives"],
    ["Пхукет", "через Куала-Лумпур", "/graphics/phuket.png", "KUL", "phuket"],
  ];

  const ArrowAsset = ({ size = 38 }) => <UiImage
    src={HOME_ASSETS.actionArrow}
    alt=""
    style={{ width: size, height: size, objectFit: "contain" }}
    fallback={<div style={{ width: size, height: size, borderRadius: 12, background: HOME_T.surface3, border: `1px solid ${HOME_T.border}`, display: "grid", placeItems: "center" }}><Icon d={I.arrow} size={17} color={HOME_T.text} /></div>}
  />;

  const IdeaCard = ({ name, via, image, code, id }) => <div
    onClick={() => onPickDest(id)}
    className="press"
    style={{
      position: "relative", flex: "0 0 calc((100% - 16px)/3)", minWidth: 116,
      height: 111, overflow: "hidden", cursor: "pointer", scrollSnapAlign: "start",
      borderRadius: 15, border: `1px solid ${HOME_T.border}`,
      backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center",
      boxShadow: "inset 0 0 34px rgba(0,0,0,.18)"
    }}
  >
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(1,6,16,.02) 35%,rgba(1,6,16,.42) 62%,rgba(1,6,16,.94) 100%)" }} />
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 8, minWidth: 0 }}>
      <div style={{ color: "#fff", fontFamily: "Sora,sans-serif", fontWeight: 700, fontSize: 14.5, lineHeight: 1.1, textShadow: "0 1px 8px rgba(0,0,0,.55)" }}>{name}</div>
      <div style={{ color: "rgba(255,255,255,.84)", fontSize: 10.5, lineHeight: 1.2, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{via} → {code}</div>
    </div>
  </div>;

  return <div style={{ paddingBottom: 16, animation: "fadeUp .18s ease-out", color: HOME_T.text }}>
    {/* HERO: композиция не меняется; нижняя зона PNG слегка обрезается, чтобы не тянуть встроенное свечение. */}
    <div style={{ padding: "13px 18px 0" }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 164, gap: 4 }}>
        <div style={{ flex: "1 1 49%", minWidth: 0, position: "relative", zIndex: 2 }}>
          <h1 className="home-compact-title" style={{ fontFamily: "Sora,sans-serif", fontSize: 30, lineHeight: 1.08, margin: 0, fontWeight: 800, color: HOME_T.text, letterSpacing: "-.45px" }}>
            Куда<br />хочется<br />
            <span style={{ background: `linear-gradient(90deg,${HOME_T.pink},${HOME_T.violet} 48%,${HOME_T.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>отправиться?</span>
          </h1>
          <p style={{ color: HOME_T.sub, fontSize: 13, margin: "12px 0 0", lineHeight: 1.42 }}>Найдём лучшие маршруты,<br />о которых вы не знали</p>
        </div>
        <div style={{ flex: "1 1 51%", minWidth: 0, height: 160, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "flex-end", transform: "translate(7px,-5px)" }}>
          <UiImage src={HOME_ASSETS.hero} alt="Паспорт и билеты" style={{ width: "100%", maxWidth: 178, height: 166, objectFit: "contain", objectPosition: "center", transform: "translateY(-5px)", clipPath: "inset(0 0 7% 0)" }} />
        </div>
      </div>
    </div>

    {/* Поиск — главный CTA, но без неонового ореола вокруг рамки. */}
    <div style={{ padding: "11px 16px 0" }}>
      <div style={{
        padding: 1, borderRadius: 21,
        background: `linear-gradient(100deg,rgba(214,108,241,.54),rgba(126,116,226,.24) 46%,rgba(49,199,243,.52))`
      }}>
        <div onClick={onSearch} className="press" style={{
          minHeight: 58, display: "flex", alignItems: "center", gap: 11,
          background: `linear-gradient(110deg,${HOME_T.surface2},${HOME_T.surface})`,
          borderRadius: 20, padding: "7px 8px", cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)"
        }}>
          <UiImage src={HOME_ASSETS.actionLocation} alt="" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} fallback={<div style={{ width: 44, height: 44, borderRadius: 13, background: HOME_T.surface3, display: "grid", placeItems: "center" }}><Icon d={I.pin} size={20} color={HOME_T.text} /></div>} />
          <span style={{ color: "#aeb6ca", flex: 1, minWidth: 0, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Куда планируете поехать?</span>
          <UiImage src={HOME_ASSETS.actionAi} alt="Подобрать маршрут" style={{ width: 46, height: 46, objectFit: "contain", flexShrink: 0 }} fallback={<div style={{ width: 46, height: 46, borderRadius: 14, background: HOME_T.surface3, display: "grid", placeItems: "center" }}><Icon d={I.spark} size={19} color={HOME_T.text} /></div>} />
        </div>
      </div>
    </div>

    {/* Bento: размеры артов и стрелок сохранены, текстовые зоны уплотнены. */}
    <div style={{ padding: "9px 16px 0", display: "grid", gridTemplateColumns: "minmax(0,.94fr) minmax(0,1.54fr)", gap: 8, height: 210 }}>
      <div onClick={() => goTab("docs")} className="press" style={{
        position: "relative", overflow: "hidden", cursor: "pointer",
        background: `linear-gradient(155deg,${HOME_T.surface2},${HOME_T.surface})`,
        border: `1px solid ${HOME_T.border}`, borderRadius: 18,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)"
      }}>
        <UiImage src={HOME_ASSETS.documents} alt="Документы" style={{ position: "absolute", left: -2, top: 1, width: "101%", height: 129, objectFit: "contain", objectPosition: "center top" }} />
        <div style={{ position: "absolute", left: 13, right: 10, bottom: 11 }}>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: HOME_T.text, fontSize: 15 }}>Документы</div>
          <div style={{ color: HOME_T.subDim, fontSize: 10.6, lineHeight: 1.23, marginTop: 3, paddingRight: 38 }}>Визы, чек-листы и помощь ИИ</div>
        </div>
        <div style={{ position: "absolute", right: 9, bottom: 8 }}><ArrowAsset size={36} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 8, minWidth: 0 }}>
        <div onClick={() => goTab("hotels")} className="press" style={{
          position: "relative", overflow: "hidden", cursor: "pointer",
          display: "grid", gridTemplateColumns: "55% 45%", alignItems: "stretch",
          background: `linear-gradient(140deg,${HOME_T.surface2},${HOME_T.surface})`,
          border: `1px solid ${HOME_T.border}`, borderRadius: 18
        }}>
          <UiImage src={HOME_ASSETS.hotels} alt="Отели" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
          <div style={{ position: "relative", minWidth: 0, padding: "13px 8px 8px 2px" }}>
            <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: HOME_T.text, fontSize: 14.8, lineHeight: 1.08 }}>Отели</div>
            <div style={{ color: HOME_T.subDim, fontSize: 10.4, lineHeight: 1.22, marginTop: 4, maxWidth: 72 }}>Промокоды и скидки</div>
            <div style={{ position: "absolute", right: 7, bottom: 6 }}><ArrowAsset size={34} /></div>
          </div>
        </div>

        <div onClick={openServices} className="press" style={{
          position: "relative", overflow: "hidden", cursor: "pointer",
          display: "grid", gridTemplateColumns: "55% 45%", alignItems: "stretch",
          background: `linear-gradient(140deg,${HOME_T.surface2},${HOME_T.surface})`,
          border: `1px solid ${HOME_T.border}`, borderRadius: 18
        }}>
          <UiImage src={HOME_ASSETS.services} alt="Сервисы" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
          <div style={{ position: "relative", minWidth: 0, padding: "12px 7px 8px 2px" }}>
            <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: HOME_T.text, fontSize: 14.8, lineHeight: 1.08 }}>Сервисы</div>
            <div style={{ color: HOME_T.subDim, fontSize: 10.1, lineHeight: 1.2, marginTop: 4, maxWidth: 76 }}>Бизнес-залы, eSIM и страховка</div>
            <div style={{ position: "absolute", right: 7, bottom: 6 }}><ArrowAsset size={34} /></div>
          </div>
        </div>
      </div>
    </div>

    {/* Обычная горизонтальная карусель: один текстовый ряд маршрута без наложений. */}
    <div style={{ padding: "12px 16px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: HOME_T.text, fontSize: 16, margin: "0 0 9px 4px" }}>Идеи для выгодных маршрутов ✨</div>
      <div className="carousel" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollSnapType: "x proximity" }}>
        {ideas.map(([name, via, image, code, id]) => <IdeaCard key={name} name={name} via={via} image={image} code={code} id={id} />)}
      </div>
    </div>

    {/* Баннер ниже и плотнее; CTA-стрелка крупнее стрелок внутри bento. */}
    <div style={{ padding: "9px 16px 0" }}>
      <div onClick={() => goTab("routes")} className="press" style={{
        minHeight: 88, display: "grid", gridTemplateColumns: "35% minmax(0,1fr) 48px",
        alignItems: "center", gap: 7, overflow: "hidden", cursor: "pointer",
        background: `linear-gradient(120deg,${HOME_T.surface2},${HOME_T.surface})`,
        border: `1px solid ${HOME_T.borderStrong}`, borderRadius: 18,
        padding: "4px 8px 4px 5px"
      }}>
        <UiImage src={HOME_ASSETS.fullTrip} alt="Подготовка поездки" style={{ width: "100%", height: 82, objectFit: "contain", objectPosition: "center" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: HOME_T.text, fontSize: 14.2, lineHeight: 1.1 }}>Подготовьте<br />поездку целиком</div>
          <div style={{ color: HOME_T.subDim, fontSize: 10.5, lineHeight: 1.24, marginTop: 5 }}>Документы, билеты и полезные сервисы</div>
        </div>
        <div style={{ display: "grid", placeItems: "center" }}><ArrowAsset size={46} /></div>
      </div>
    </div>
  </div>;
}
/* ================================ Результаты ============================ */
function Skeleton() { return <div style={{ height: 150, borderRadius: 18, background: `linear-gradient(90deg,${T.card},${T.card2},${T.card})`, border:`1px solid ${T.line}`, backgroundSize: "200% 100%", animation: "sh 1.3s infinite" }} />; }
function RouteCard({ r, onOpen, liked, onLike, i }) {
  const grad = r.badge === "cheapest" ? GRAD.sunset : r.badge === "unexpected" ? GRAD.city : GRAD.night;
  const dur = legDur(r.segments);
  const codesOf = (segs) => (segs || []).map((s, idx) => idx === 0 ? [s.fromCode, s.toCode] : [s.toCode]).flat();
  const outSegs = r.roundTrip ? ((r.outbound && r.outbound.segments) || r.segments.filter(s => s.direction !== "return")) : r.segments;
  const retSegs = r.roundTrip ? ((r.return && r.return.segments) || r.segments.filter(s => s.direction === "return")) : [];
  const CodeLine = ({ segs, dir }) => { const cs = codesOf(segs); if (!cs.length) return null; const planeIcon = dir === "ret" ? "/graphics/plane_l.png" : "/graphics/plane_r.png"; return <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>{cs.map((c, idx) => (<React.Fragment key={idx}>{idx > 0 && <img src={planeIcon} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0, opacity: 0.8 }} />}<span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c}</span></React.Fragment>))}</div>; };
  // подстрока под направлением: ВРЕМЯ В ПУТИ + пересадки; стоповер зелёным
  const LegSub = ({ segs, stop, waitMin, legMin }) => {
    const planes = (segs || []).filter(s => s.mode === "plane" || !s.mode);
    const intra = planes.reduce((n, s) => n + (s.transfers || 0), 0);
    const junctions = Math.max(0, Math.max(0, planes.length - 1) - (stop ? 1 : 0));
    const t = intra + junctions;
    // суммарное время направления: с бэка (legMin) либо сумма сегментов
    const durSum = legMin != null && legMin > 0 ? legMin : (segs || []).reduce((n, s) => n + (s.durationMin || 0), 0);
    const durTxt = durSum > 0 ? hm(durSum) : "";
    let txt, col = T.subd;
    if (stop) { txt = `${stop.nights} ${plural(stop.nights, "ночь", "ночи", "ночей")} отдыха в ${stop.city}${t > 0 ? ` · ${t} ${plural(t, "пересадка", "пересадки", "пересадок")}` : " · без пересадок"}`; col = T.green; }
    else { const trTxt = t > 0 ? `${t} ${plural(t, "пересадка", "пересадки", "пересадок")}${waitMin > 0 ? ` на ${hm(waitMin)}` : ""}` : "прямой"; txt = durTxt ? `${durTxt} · ${trTxt}` : trTxt; }
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
            <div><CodeLine segs={outSegs} dir="out" /><LegSub segs={outSegs} stop={r.roundTrip ? (r.outbound && r.outbound.stopover) : r.stopover} waitMin={r.roundTrip ? ((r.outbound && r.outbound.waitMin) || 0) : (r.waitMin || 0)} legMin={r.roundTrip ? (r.durationOut != null ? r.durationOut : (r.outbound && r.outbound.durationMin)) : r.durationMin} /></div>
            {r.roundTrip && retSegs.length > 0 && <div><CodeLine segs={retSegs} dir="ret" /><LegSub segs={retSegs} stop={r.return && r.return.stopover} waitMin={(r.return && r.return.waitMin) || 0} legMin={r.durationRet != null ? r.durationRet : (r.return && r.return.durationMin)} /></div>}
          </div>
          <Icon d={I.chevR} size={16} color={T.violet} />
        </div>
      </div>
      <Porthole grad={grad} h={84} style={{ width: 110, borderRadius: 14 }} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
      <Icon d={r.stopover ? I.moon : I.clock} size={18} color={T.violet} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: T.text, fontWeight: 600 }}>{r.stopover ? `Stopover: ${r.stopover.city}` : (r.roundTrip ? "Туда — обратно" : (r.transfers ? "С пересадкой" : "Прямой перелёт"))}</div><div style={{ fontSize: 11, color: T.subd }}>{r.stopover ? `${r.stopover.nights} ноч. в пути` : (r.roundTrip ? "время по направлениям выше" : (r.durationMin > 0 ? hm(r.durationMin) : "—"))}</div></div>
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
    {error ? <div style={{padding:"24px 20px"}}><ErrorState title="Не удалось загрузить маршруты" sub="Поиск сохранён. Проверьте соединение и повторите запрос." onRetry={onRetry}/></div> : <>
    <div style={{ padding: "9px 20px 0" }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: T.text }}>{loading ? "Ищем лучшие варианты…" : <>Нашли <span style={{ color: T.violet }}>{routes.length} {plural(routes.length, "хитрый способ", "хитрых способа", "хитрых способов")}</span> добраться</>}</div>
      <div style={{ color: T.subd, fontSize: 12.5, marginTop: 4 }}>Показываем только лучшее — не сотни билетов.</div>
    </div>
    <div style={{ padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
      {loading ? [0, 1, 2].map(i => <Skeleton key={i} />) : (routes.length ? routes.map((r, i) => <RouteCard key={r.id} r={r} i={i} liked={isLiked(r)} onLike={onLike} onOpen={() => onOpen(r)} />) : <Empty onEdit={onEdit} />)}
    </div></>}
  </div>;
}
function Empty({ onEdit }) { return <EmptyState icon="⌕" title="Подходящего маршрута пока нет" sub="Измените даты, аэропорты или количество пассажиров — текущий поиск останется сохранён." action="Изменить параметры" onAction={onEdit} />; }

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
function Detail({ r, query, onBack, onEdit, liked, onLike, onShare, goHotels, onTakeTrip, inTrip, takeLabel }) {
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
            <div key={p.serviceId} onClick={() => { trackGoal("hotel_partner_click", { partner: p.serviceId, country: query.destCountry || "", city: query.destName || "" }); goHotels(p.serviceId); }} className="press" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: `1px solid ${T.line}`, borderRadius: 14, padding: "8px 10px", cursor: "pointer", flexShrink: 0 }}>
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
              <div style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: T.subd }}>{hm(s.durationMin || 0)}<div style={{ height: 1, background: T.line, margin: "5px 0" }} />{(s.transfers || 0) > 0 ? `${s.transfers} ${s.transfers === 1 ? "пересадка" : "пересадки"}` : "прямой"}</div>
              <div style={{ textAlign: "right" }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, color: T.text, fontSize: 16 }}>{arrOf(s)}</div><div style={{ fontSize: 11, color: T.subd }}>{s.toCode}</div></div>
              {(s.priceLive || s.priceEstimate) ? <a onClick={() => trackGoal("flight_partner_click", { partner: "aviasales", from: s.fromCode, to: s.toCode, price: r.total || 0 })} href={s.deepLink || (((r.bookingLinks || []).find(l => l.from === s.fromCode && l.to === s.toCode) || {}).url) || undefined} target="_blank" rel="noreferrer" className="press" style={{ textDecoration: "none" }}><div style={{ background: GRAD.cta, borderRadius: 12, padding: "8px 12px", color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{rub(s.priceLive || s.priceEstimate)}</div></a> : null}
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
      <Btn style={{ flex: 1 }} onClick={() => onTakeTrip(r)}>{inTrip ? "Открыть поездку" : (takeLabel || "✈ Взять в поездку")}</Btn>
      <div onClick={() => onShare(r)} className="press" style={{ width: 52, borderRadius: 16, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", background: T.card, cursor: "pointer" }}><Icon d={I.share} size={19} color={T.subd} /></div>
      <div onClick={() => onLike(r)} className="press" style={{ width: 52, borderRadius: 16, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", background: T.card, cursor: "pointer" }}><Icon d={I.heart} size={20} color={liked ? T.pink : T.subd} /></div>
    </div>
  </div>;
}

/* ================================ Профиль =============================== */
function NotifyToggle({ label, sub, icon, on, onToggle }) {
  return <div onClick={onToggle} className="press" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer" }}>
    <span style={{ fontSize: 18, width: 24, textAlign: "center", flexShrink: 0 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, color: T.text, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 11, color: T.subd, marginTop: 1 }}>{sub}</div></div>
    <div style={{ width: 42, height: 25, borderRadius: 999, background: on ? T.violet : T.line2, position: "relative", transition: "background .18s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2.5, left: on ? 20 : 2.5, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .18s" }} />
    </div>
  </div>;
}
function ProfileDataEditor({ profile, onSave, onClose }) {
  const legacy=profile||{};
  const [f,setF]=useState(()=>({
    fullName:legacy.fullName||"", surname:legacy.surname||"", given:legacy.given||"", dob:legacy.dob||legacy.birthDate||"", sex:legacy.sex||"", nation:legacy.nation||legacy.citizenship||"",
    passport:legacy.passport||"", pexp:legacy.pexp||legacy.passportExpiry||"", birthPlace:legacy.birthPlace||"", homeAddr:legacy.homeAddr||"", occupation:legacy.occupation||"", employer:legacy.employer||"",
    email:legacy.email||"",phone:legacy.phone||"",homeCity:legacy.homeCity||"",homeCountry:legacy.homeCountry||"",homeAirport:legacy.homeAirport||"",defaultCurrency:legacy.defaultCurrency||"EUR"
  }));
  const st={width:"100%",background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"11px 12px",color:T.text,outline:"none",marginTop:5,colorScheme:"dark"};
  const set=(k,v)=>setF(x=>{const n={...x,[k]:v};if(k==="homeCity"){const a=AIRPORTS.find(z=>z.city.toLowerCase()===String(v||"").trim().toLowerCase());if(a&&!n.homeCountry)n.homeCountry=a.country;if(a&&!n.homeAirport)n.homeAirport=a.code;}return n;});
  const row=(k,label,type="text",ph="")=><div style={{marginBottom:11}}><div style={{fontSize:10.5,color:T.subd,fontWeight:700}}>{label}</div><input type={type} value={f[k]||""} onChange={(e)=>set(k,e.target.value)} placeholder={ph} style={st}/></div>;
  return <FullScreenOverlay onClose={onClose}><SheetHead title="Данные путешественника" onClose={onClose}/>
    <div style={{fontSize:11.5,color:T.subd,lineHeight:1.5,marginBottom:14}}>TripWise использует профиль для автоподстановки и определения, нужны ли международные документы. Все данные профиля, паспортные реквизиты и ответы визовых анкет хранятся локально на этом устройстве и не передаются третьим лицам или внешним сервисам.</div>
    <div style={{fontFamily:"Sora,sans-serif",fontSize:12.5,fontWeight:800,color:T.text,marginBottom:7}}>Как в загранпаспорте</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{row("surname","Фамилия","text","IVANOV")}{row("given","Имя","text","IVAN")}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{row("dob","Дата рождения","date")}{<div style={{marginBottom:11}}><div style={{fontSize:10.5,color:T.subd,fontWeight:700}}>Пол</div><select value={f.sex||""} onChange={(e)=>set("sex",e.target.value)} style={st}><option value="">Не указан</option><option value="M">Мужской</option><option value="F">Женский</option></select></div>}</div>
    {row("nation","Гражданство","text","Россия")}{row("birthPlace","Место рождения","text","Москва, Россия")}
    {row("passport","Номер загранпаспорта","text","72 1234567")}{row("pexp","Паспорт действителен до","date")}
    <div style={{fontFamily:"Sora,sans-serif",fontSize:12.5,fontWeight:800,color:T.text,margin:"5px 0 7px"}}>Дом и контакты</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{row("homeCity","Родной город","text","Москва")}{row("homeCountry","Страна проживания","text","Россия")}</div>
    {row("homeAddr","Адрес проживания","text","Москва, ...")}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{row("email","Email","email")}{row("phone","Телефон","tel","+7…")}</div>
    <div style={{fontFamily:"Sora,sans-serif",fontSize:12.5,fontWeight:800,color:T.text,margin:"5px 0 7px"}}>Работа и настройки</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{row("occupation","Должность","text","Business Analyst")}{row("employer","Место работы","text","Компания")}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 110px",gap:9}}>{row("homeAirport","Домашний аэропорт","text","SVO")}{<div style={{marginBottom:11}}><div style={{fontSize:10.5,color:T.subd,fontWeight:700}}>Валюта</div><select value={f.defaultCurrency||"EUR"} onChange={(e)=>set("defaultCurrency",e.target.value)} style={st}>{["EUR","USD","RUB","GBP","AED","NOK","JPY","CNY","THB"].map(c=><option key={c}>{c}</option>)}</select></div>}</div>
    <Btn onClick={()=>onSave({...f,fullName:f.fullName||[f.given,f.surname].filter(Boolean).join(" ")})}>Сохранить данные</Btn>
  </FullScreenOverlay>;
}
function NotificationSettings({ prefs, onChange, onClose }) {
  const np={deadlines:true,group:true,changes:true,...(prefs||{})};
  const toggle=(k)=>onChange({...np,[k]:!np[k]});
  return <FullScreenOverlay onClose={onClose}><SheetHead title="Уведомления" onClose={onClose}/>
    <div style={{fontSize:11.5,color:T.subd,lineHeight:1.45,marginBottom:13}}>Оставили только работающие уведомления MVP. Ask Group приходит сразу, обычные изменения — тихим дайджестом.</div>
    <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:17,overflow:"hidden"}}>
      <NotifyToggle label="Дедлайны по поездкам" sub="документы и важные сроки" icon="⏰" on={np.deadlines!==false} onToggle={()=>toggle("deadlines")}/><div style={{height:1,background:T.line}}/>
      <NotifyToggle label="Ask Group" sub="когда группе нужно ваше решение" icon="👥" on={np.group!==false} onToggle={()=>toggle("group")}/><div style={{height:1,background:T.line}}/>
      <NotifyToggle label="Изменения в поездках" sub="дайджест вместо сообщения на каждое изменение" icon="🧾" on={np.changes!==false} onToggle={()=>toggle("changes")}/>
    </div>
  </FullScreenOverlay>;
}
function Profile({ name, onTraveler, onEditName, onOpenDocs, setToast, notifyPrefs, onNotifyChange, profile, onProfileSave, trips=[] }) {
  const [profileOpen,setProfileOpen]=useState(false),[notifyOpen,setNotifyOpen]=useState(false);
  const np={deadlines:true,group:true,changes:true,...(notifyPrefs||{})};
  const mine=store.get("mydocs",[])||[];
  const cit=store.get("cit",{})||{}, vis=store.get("vis",{})||{};
  const actualProfile={...(profile||{}),fullName:(profile&&profile.fullName)||name};
  const keys=["surname","given","dob","nation","passport","pexp","homeCity","homeCountry","email","phone"];
  const filled=keys.filter(k=>String(actualProfile[k]||"").trim()).length, pct=Math.round(filled/keys.length*100);
  const countries=[...new Set((trips||[]).map(t=>t.country).filter(Boolean))];
  const enabled=["deadlines","group","changes"].filter(k=>np[k]!==false).length;
  const readyDocs=mine.filter(d=>d.status==="ready").length,draftDocs=mine.filter(d=>d.status!=="ready").length;
  const initials=String(name||"TW").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const row=(title,sub,onClick,right)=><div onClick={onClick} className="press" style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",borderTop:`1px solid ${T.line}`,cursor:"pointer"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:700,color:T.text}}>{title}</div>{sub&&<div style={{fontSize:10.8,color:T.subd,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}</div>{right&&<span style={{fontSize:11,color:T.subd}}>{right}</span>}<Icon d={I.chevR} size={15} color={T.subd}/></div>;
  return <div style={{animation:"fadeUp .18s ease-out",paddingBottom:18}}>
    <Header/>
    <ScreenHero title={name} eyebrow="Профиль путешественника" sub={`${countries.length} ${plural(countries.length,"страна","страны","стран")} · ${(trips||[]).length} ${plural((trips||[]).length,"поездка","поездки","поездок")}`} image={HOME_ASSETS.fullTrip}/>
    <div style={{padding:"0 16px"}}>
      <div onClick={()=>setProfileOpen(true)} className="press" style={{background:`linear-gradient(135deg,${T.card2},${T.card})`,border:`1px solid ${T.line2}`,borderRadius:19,padding:15,cursor:"pointer",marginBottom:11}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}><div style={{width:48,height:48,borderRadius:16,background:"linear-gradient(135deg,#d66cf1,#9364f5,#31c7f3)",display:"grid",placeItems:"center",fontFamily:"Sora,sans-serif",fontSize:15,fontWeight:800,color:"#fff"}}>{initials}</div><div style={{flex:1}}><div style={{fontFamily:"Sora,sans-serif",fontSize:14.5,fontWeight:800,color:T.text}}>Данные путешественника</div><div style={{fontSize:10.8,color:T.subd,marginTop:3}}>{pct<100?`Заполнено ${pct}% · данные только на устройстве`:"Профиль заполнен · данные только на устройстве"}</div></div><span style={{color:pct===100?T.green:T.cyan,fontSize:12,fontWeight:900}}>{pct}%</span></div>
        <div style={{height:5,background:"rgba(255,255,255,.06)",borderRadius:99,overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:pct+"%",background:GRAD.cta,borderRadius:99}}/></div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:17,overflow:"hidden",marginBottom:11}}>
        {row("Гражданство и визы",`${Object.keys(cit).filter(k=>cit[k]).length||0} гражданств · ${Object.keys(vis).filter(k=>vis[k]).length||0} действующих виз`,onTraveler)}
        {row("Мои документы",mine.length?`${readyDocs} готово${draftDocs?` · ${draftDocs} черновик${draftDocs>1?"а":""}`:""}`:"Документы и анкеты появятся здесь после заполнения",()=>onOpenDocs&&onOpenDocs(),mine.length?String(mine.length):null)}
        {row("Уведомления",`${enabled} категорий включено`,()=>setNotifyOpen(true))}
      </div>
      <div style={{fontFamily:"Sora,sans-serif",fontSize:12,fontWeight:800,color:T.subd,margin:"17px 4px 8px"}}>О приложении</div>
      <div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:17,overflow:"hidden"}}>
        {row("Поддержка","Помощь по TripWise",()=>setToast("Откройте поддержку по ссылке из раздела «О приложении» после её добавления"))}
        {row("Конфиденциальность","Как хранятся данные",()=>setToast("Политика конфиденциальности будет открываться здесь"))}
        <div style={{display:"flex",alignItems:"center",padding:"13px 14px",borderTop:`1px solid ${T.line}`}}><span style={{fontSize:13.5,color:T.text,flex:1}}>Версия</span><span style={{fontSize:11.5,color:T.subd}}>5.0 MVP</span></div>
      </div>
    </div>
    {profileOpen&&<ProfileDataEditor profile={actualProfile} onClose={()=>setProfileOpen(false)} onSave={(v)=>{onProfileSave&&onProfileSave(v);setProfileOpen(false);setToast("Данные сохранены");}}/>}
    {notifyOpen&&<NotificationSettings prefs={np} onChange={onNotifyChange} onClose={()=>setNotifyOpen(false)}/>} 
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
        <div style={{ marginTop: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, fontSize: 11.5, color: T.subd }}>ⓘ <b style={{ color: T.sub }}>Важно знать.</b> Гражданство и визы хранятся локально на этом устройстве и не передаются третьим лицам или внешним сервисам.</div>
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
/* ГРАЖДАНСТВО: набор документов зависит от паспорта. Сейчас наполнено только для РФ,
   но структура многогражданская — позже добавишь, напр., PL со своими требованиями
   (гражданину Польши в Дубай нужна виза, гражданину РФ — нет). */
const CITIZEN_DOCS = {
  RU: DOC_MATRIX,
  // PL: { "ОАЭ": [DOC_PASS, { id: "ae_evisa", name: "eVisa ОАЭ", E: 60, P: 4 }, DOC_INS], ... }
};
const CITIZENSHIPS = [
  { cc: "RU", name: "Россия", flag: "🇷🇺" },
  // { cc: "PL", name: "Польша", flag: "🇵🇱" },  // задел на будущее
];
// документы для гражданства+страны назначения (фолбэк на РФ, затем на базовый набор)
function docsForCitizen(cc, country) {
  const matrix = CITIZEN_DOCS[cc] || CITIZEN_DOCS.RU || {};
  return matrix[country] || DOC_BASE;
}
/* По ситуации: документы на детей (добавляются в комплект, если едут дети) */
const KID_DOCS = [
  { id: "kid_birth", name: "Свидетельство о рождении ребёнка", E: 9999, P: 0 },
  { id: "kid_consent", name: "Согласие на выезд (если ребёнок с одним родителем)", E: 9999, P: 3 },
];
/* Карточки документов: тип, описание, что потребуется, официальные ссылки.
   URL пустые — впиши официальные/партнёрские ссылки, пустые не показываются. */

/* ================== ВИЗОВЫЙ СПРАВОЧНИК (сверено по источникам) ==================
   ВАЖНО: правила въезда меняются. У каждой записи — дата проверки и официальный источник.
   Перед поездкой приложение показывает дату актуальности и ссылку на первоисточник. */
const CHECKED = "2026-07-28";
/* Общие правила шенгена — не дублируем в каждой стране */
const visaRulesRemote = () => store.get("visa_rules", {}) || {};
const visaInfoFor = (country) => (visaRulesRemote()[country] || VISA_INFO[country] || null);
const visaCountries = () => [...new Set([...Object.keys(VISA_INFO), ...Object.keys(visaRulesRemote())])];

const SCHENGEN_RULES = {
  fee: "€90 (дети 6–12 лет €45) + сервисный сбор визового центра",
  rule: "Правило 90/180: не более 90 дней в течение любых 180 дней.",
  single: "С 7 ноября 2025 года мультивизы россиянам не выдают — только однократные, чаще под даты поездки.",
  first: "Подавать нужно в страну основного пребывания (правило первой страны). Если ночей поровну — в страну въезда.",
  when: "Подача не раньше чем за 6 месяцев и не позже чем за 15 дней до поездки. Оптимально — за 6–8 недель.",
  docs: ["Загранпаспорт (действителен ещё 3 мес. после возвращения, 2 чистые страницы)", "Анкета и фото 3,5×4,5 см", "Страховка покрытием от €30 000 на весь срок", "Брони жилья и билетов на весь маршрут", "Справка с работы", "Выписка со счёта с движением за 3 месяца", "Биометрия (сдаётся раз в 59 месяцев)"],
  money: "Ориентир — €60–130 на день поездки. Важна не только сумма, но и история движения средств: резкое пополнение перед подачей — частая причина отказа.",
};
const SCH = (name, note, days, extra) => ({ status: "Виза обязательна", visaType: "Шенген", days: 90, checked: CHECKED, schengen: true, summary: note, processing: days, ...(extra || {}) });

const VISA_INFO = {
  /* ========== ШЕНГЕН: консульства, работающие в РФ ========== */
  "Венгрия": SCH("Венгрия", "Принимает документы, один из самых быстрых сроков рассмотрения. Часто выдаёт визу строго под даты поездки.", "7–14 дней", { center: "VFS Global, Москва, Каширское шоссе 3к2", src: [{ label: "Консульство Венгрии", url: "https://moszkva.mfa.gov.hu" }] }),
  "Греция": SCH("Греция", "Принимает документы, сроки умеренные. Одно из более доступных направлений для подачи.", "10–21 день", { center: "VFS Global", src: [{ label: "Визовый центр Греции", url: "https://www.vfsglobal.com/greece/russia" }] }),
  "Франция": SCH("Франция", "Принимает документы, выдаёт одни из самых длинных виз. Слотов на подачу мало — записывайтесь заранее.", "15–45 дней", { center: "VFS Global", src: [{ label: "Визовый центр Франции", url: "https://france-visas.gouv.fr" }] }),
  "Испания": SCH("Испания", "Принимает документы, визу чаще дают под даты поездки.", "15–30 дней (до 45 в сезон)", { center: "BLS International", src: [{ label: "Визовый центр Испании", url: "https://blsspain-russia.com" }] }),
  "Италия": SCH("Италия", "Принимает документы, но сроки самые длинные — закладывайте время с запасом.", "20–60 дней", { center: "Almaviva / визовые центры Италии", src: [{ label: "Визовый центр Италии", url: "https://italy-vms.ru" }] }),
  "Австрия": SCH("Австрия", "Принимает документы, сроки умеренные.", "15–30 дней", { center: "VFS Global", src: [{ label: "Визовый центр Австрии", url: "https://www.vfsglobal.com/Austria/Russia" }] }),
  "Хорватия": SCH("Хорватия", "Принимает документы. Страна в Шенгене с 2023 года.", "15–25 дней", { center: "VFS Global", src: [{ label: "Визовый центр Хорватии", url: "https://www.vfsglobal.com/croatia/russia" }] }),
  "Португалия": SCH("Португалия", "Принимает документы.", "20–35 дней", { center: "BLS International", src: [{ label: "Визовый центр Португалии", url: "https://portugalapp.blsinternational.com" }] }),
  "Швейцария": SCH("Швейцария", "Принимает документы. Требует страховку, оформленную в европейской компании.", "20–40 дней", { center: "TLScontact", src: [{ label: "Визовый центр Швейцарии", url: "https://www.tlscontact.com" }] }),
  "Германия": SCH("Германия", "Принимает документы, но сроки длинные и доля отказов выше средней. Страховка должна быть выдана компанией из ЕС.", "25–45 дней", { center: "Визовые центры Германии", warn: "Консульство перегружено — возможны задержки и с приёмом, и с выдачей паспортов.", src: [{ label: "Посольство Германии", url: "https://russland.diplo.de" }] }),
  "Швеция": SCH("Швеция", "Принимает документы через посольство и VFS Global, но отказы случаются часто.", "15–45 дней", { center: "VFS Global", src: [{ label: "Посольство Швеции", url: "https://www.swedenabroad.se" }] }),
  "Словения": SCH("Словения", "Принимает документы.", "15–30 дней", { center: "VFS Global", src: [{ label: "Визовый центр Словении", url: "https://www.vfsglobal.com" }] }),
  "Словакия": SCH("Словакия", "Принимает документы.", "15–30 дней", { center: "VFS Global", src: [{ label: "Посольство Словакии", url: "https://www.mzv.sk/moskva" }] }),
  "Дания": SCH("Дания", "Выдача виз в России приостановлена с мая 2022 года. Подать можно только через визовые центры Дании в других странах.", "—", { warn: "В России документы не принимают. Подача — например, в Казахстане, Армении, Турции или ЕС.", src: [{ label: "Посольство Дании", url: "https://rusland.um.dk" }] }),
  "Исландия": SCH("Исландия", "Собственного визового центра в РФ нет. Виза шенгенская — если Исландия основная страна поездки, подавать нужно через представляющее её консульство или в другой стране.", "—", { warn: "Уточняйте актуальное представительство: обычно интересы Исландии представляет консульство Дании или другой страны Шенгена.", src: [{ label: "МИД Исландии", url: "https://www.government.is/ministries/ministry-for-foreign-affairs" }] }),
  "Фарерские острова": {
    status: "Особая виза", visaType: "Датская национальная", days: 90, checked: CHECKED,
    summary: "Фареры — автономия Дании, но НЕ входят в Шенген. Шенгенская виза здесь не действует: нужна отдельная датская виза с пометкой о действии на Фарерских островах.",
    warn: "Дания не принимает визовые заявления в России — оформление только через датские визовые центры за рубежом. Планируйте заранее.",
    must: ["Отдельная датская виза с указанием Фарерских островов", "Загранпаспорт", "Брони жилья и билетов", "Страховка"],
    src: [{ label: "Визовая информация Дании", url: "https://um.dk/en/travel-and-residence" }],
  },
  "Кипр": {
    status: "Виза обязательна", visaType: "Национальная кипрская", days: 90, checked: CHECKED,
    summary: "Кипр в ЕС, но не в Шенгене — нужна отдельная кипрская виза. Шенгенская виза (двукратная или многократная) также даёт право въезда.",
    must: ["Загранпаспорт 3 мес. после возвращения", "Анкета и фото", "Бронь жилья и билеты", "Страховка", "Финансовое подтверждение"],
    tip: "Если у вас есть действующая двукратная или многократная шенгенская виза — отдельную кипрскую оформлять не нужно.",
    src: [{ label: "МИД Кипра", url: "https://www.mfa.gov.cy" }],
  },
  "Европа (Шенген)": {
    status: "Виза обязательна", visaType: "Шенген", days: 90, checked: CHECKED,
    summary: "Общие правила шенгенской визы. Конкретные сроки и требования зависят от страны подачи — выберите её в списке.",
    must: SCHENGEN_RULES.docs, money: SCHENGEN_RULES.money,
    warn: SCHENGEN_RULES.single + " " + SCHENGEN_RULES.first,
    src: [{ label: "Правила виз ЕС", url: "https://home-affairs.ec.europa.eu" }],
  },

  /* ========== ЕВРОПА ВНЕ ШЕНГЕНА ========== */
  "Великобритания": {
    status: "Виза обязательна", visaType: "Standard Visitor", days: 180, checked: CHECKED,
    summary: "Британская виза посетителя до 6 месяцев. Анкета подаётся онлайн, затем нужна сдача биометрии.",
    warn: "Визовый центр Великобритании в России не работает — биометрию сдают за рубежом (популярны Стамбул, Ереван, Астана). Планируйте поездку на подачу.",
    must: ["Загранпаспорт", "Онлайн-анкета на gov.uk", "Биометрия за рубежом", "Выписка со счёта за 6 месяцев", "Справка с работы", "Брони жилья и билетов", "Консульский сбор (оплата зарубежной картой)"],
    src: [{ label: "Официальный портал виз UK", url: "https://www.gov.uk/standard-visitor" }],
  },

  /* ========== АМЕРИКА ========== */
  "США": {
    status: "Виза обязательна", visaType: "B1/B2", days: 180, checked: CHECKED,
    summary: "Туристическая виза B1/B2. Анкета DS-160 онлайн, затем обязательное собеседование в консульстве.",
    warn: "Посольство США в России визы не выдаёт. Подавать можно в любом консульстве США за рубежом, где есть слоты — чаще выбирают Астану, Варшаву, Белград. Ни шенгенская, ни британская виза права въезда в США не дают.",
    must: ["Загранпаспорт", "Анкета DS-160", "Фото 5×5 см", "Оплата консульского сбора", "Запись на собеседование за рубежом", "Подтверждение связей с Россией: работа, семья, имущество"],
    src: [{ label: "Портал виз США", url: "https://travel.state.gov" }],
  },
  "Канада": {
    status: "Виза обязательна", visaType: "Visitor Visa (TRV)", days: 180, checked: CHECKED,
    summary: "Заявление подаётся полностью онлайн через личный кабинет IRCC. Сбор 100 CAD + биометрия 85 CAD.",
    warn: "С 28 января 2026 года визовые центры в России не принимают паспорта. Биометрию сдать в РФ можно, но паспорт для вклейки визы нужно отправлять в визовый центр за рубежом — Казахстан, Армения, Турция, Сербия.",
    must: ["Загранпаспорт", "Онлайн-анкета IMM5257 через IRCC", "Биометрия", "Выписка со счёта", "Справка с работы", "Маршрут и брони"],
    money: "Официального минимума нет, ориентир — от 300 CAD на день поездки.",
    processing: "от 2 недель до 2–3 месяцев",
    src: [{ label: "IRCC — иммиграция Канады", url: "https://www.canada.ca/en/immigration-refugees-citizenship.html" }],
  },

  /* ========== АЗИЯ ========== */
  "Таиланд": {
    status: "Безвизово", days: 60, checked: CHECKED,
    summary: "Безвизовый въезд до 60 дней, продление ещё на 30 дней в иммиграционной службе (~1900 бат).",
    warn: "Кабинет министров одобрил сокращение безвиза до 30 дней. На момент проверки дата вступления в силу не опубликована — уточните перед вылетом.",
    must: ["Загранпаспорт (авиакомпании обычно требуют 6 мес.)", "TDAC — электронная карта прибытия, обязательна с 01.05.2025", "Обратный билет"],
    money: "На границе могут запросить подтверждение средств (ориентир — от $700 на человека).",
    src: [{ label: "Иммиграционное бюро Таиланда (TDAC)", url: "https://tdac.immigration.go.th" }],
  },
  "Индонезия": {
    status: "Виза по прибытии", days: 30, checked: CHECKED,
    summary: "Виза по прибытии (VOA) или заранее онлайн (e-VOA) на 30 дней, продлевается один раз ещё на 30.",
    must: ["Загранпаспорт 6 мес.", "VOA $35 / 500 000 IDR", "Декларация All Indonesia (за 3 дня до прилёта)", "Туристический сбор Love Bali 150 000 IDR — для Бали"],
    src: [{ label: "Иммиграция Индонезии (e-VOA)", url: "https://evisa.imigrasi.go.id" }, { label: "All Indonesia", url: "https://allindonesia.beacukai.go.id" }],
  },
  "Вьетнам": {
    status: "Безвизово", days: 45, checked: CHECKED,
    summary: "Безвизовый въезд до 45 дней. Дольше — электронная виза на 90 дней ($25 однократная, $50 многократная, ~3 рабочих дня).",
    must: ["Загранпаспорт 6 мес.", "Обратный билет"],
    tip: "e-Visa подавайте минимум за 2 недели: в Тет и на 30 апреля сроки растягиваются. Подать можно только находясь вне Вьетнама.",
    src: [{ label: "Официальный портал e-Visa", url: "https://evisa.gov.vn" }],
  },
  "Китай": {
    status: "Безвизово", days: 30, checked: CHECKED,
    summary: "Безвизовый въезд до 30 дней для туризма, бизнеса, визитов к родственникам и транзита. Режим продлён до 31 декабря 2027 года.",
    must: ["Обычный загранпаспорт (рекомендуется 6 мес.)", "Электронная въездная карта (можно заполнить заранее)", "Регистрация по месту пребывания в течение суток — отель делает сам"],
    tip: "Гонконг (до 14 дней) и Макао (до 30 дней) — отдельные безвизовые режимы.",
    src: [{ label: "Посольство КНР в РФ", url: "http://ru.china-embassy.gov.cn" }],
  },
  "Япония": {
    status: "Виза обязательна", visaType: "Краткосрочная туристическая", days: 90, checked: CHECKED,
    summary: "Виза нужна всегда, безвизового въезда нет. Консульский сбор для россиян не взимается — платится только сервисный сбор визового центра (~970 ₽).",
    must: ["Загранпаспорт", "Анкета на английском или японском", "Фото 35×45 мм", "Программа пребывания по дням", "Бронь отеля и билетов", "Справка с работы", "Выписка со счёта"],
    tip: "С 12 февраля 2026 года документы принимают визовые центры VFS в Москве (Олимпийский пр-т, 16с5) и Санкт-Петербурге (Стремянная, 21/5), посольство напрямую больше не принимает. Электронной визы для россиян нет.",
    processing: "от 10 рабочих дней",
    src: [{ label: "Посольство Японии в РФ", url: "https://www.ru.emb-japan.go.jp" }],
  },
  "Южная Корея": {
    status: "Безвизово (нужно K-ETA)", days: 60, checked: CHECKED,
    summary: "Безвизовый въезд до 60 дней подряд и не более 90 дней за 180. Нужно электронное разрешение K-ETA.",
    must: ["Загранпаспорт", "K-ETA — оформить минимум за 72 часа до вылета", "Сбор ~10 000 вон", "Фото и скан паспорта"],
    tip: "K-ETA действует 3 года и допускает многократный въезд. При отказе можно подать снова — до трёх попыток за полгода.",
    src: [{ label: "Официальный портал K-ETA", url: "https://www.k-eta.go.kr" }],
  },
  "Северная Корея": {
    status: "Виза обязательна", visaType: "Туристическая, только в составе группы", days: 30, checked: CHECKED,
    summary: "Самостоятельный туризм невозможен. Поездка оформляется только через аккредитованного туроператора, который получает разрешение и визу.",
    warn: "Направление с особым режимом: маршрут согласован заранее, передвижение только с гидами, есть жёсткие ограничения на технику, съёмку и связь. Требования меняются — сверяйтесь с туроператором.",
    must: ["Оформление через аккредитованного туроператора", "Загранпаспорт", "Анкета через оператора", "Согласованная программа поездки"],
    src: [{ label: "Посольство КНДР в РФ", url: "http://www.rf.mfa.gov.kp" }],
  },
  "Шри-Ланка": {
    status: "Бесплатное разрешение", days: 30, checked: CHECKED,
    summary: "Для россиян въезд на 30 дней бесплатный: ETA онлайн либо виза по прибытии. Обязательность ETA была отменена — оформление добровольное, но рекомендуется.",
    must: ["Загранпаспорт 6 мес.", "ETA (рекомендуется) — бесплатно", "Обратный билет"],
    warn: "Оформляйте только на eta.gov.lk — платные сайты-двойники не имеют отношения к правительству.",
    src: [{ label: "Официальный сайт ETA", url: "https://eta.gov.lk" }],
  },
  "Мальдивы": {
    status: "Безвизово", days: 30, checked: CHECKED,
    summary: "Бесплатная виза по прибытии на 30 дней.",
    must: ["Загранпаспорт 6 мес.", "IMUGA Traveller Declaration — в течение 96 часов до вылета", "Подтверждение брони отеля", "Обратный билет"],
    src: [{ label: "IMUGA (декларация)", url: "https://imuga.immigration.gov.mv" }],
  },
  "Индия": {
    status: "Электронная виза", days: 30, checked: CHECKED,
    summary: "Нужна e-Visa, оформляется онлайн заранее, обычно 3–5 рабочих дней.",
    must: ["Загранпаспорт 6 мес. и 2 чистые страницы", "Фото и скан паспорта", "Обратный билет", "Визовый сбор — оплата картой"],
    warn: "Оформляйте только на indianvisaonline.gov.in — посреднические сайты берут наценку.",
    src: [{ label: "Официальный портал e-Visa Индии", url: "https://indianvisaonline.gov.in" }],
  },

  /* ========== БЛИЖНИЙ ВОСТОК И ЗАЛИВ ========== */
  "ОАЭ": {
    status: "Безвизово", days: 90, checked: CHECKED,
    summary: "Безвизовый штамп на 90 дней в течение 180-дневного периода.",
    must: ["Загранпаспорт 6 мес.", "Обратный билет и бронь жилья (могут спросить)"],
    tip: "Единую визу стран Залива (GCC Unified Visa) на 6 стран запускают поэтапно — пилот ожидается в конце 2026 года.",
    src: [{ label: "ICP — миграционная служба ОАЭ", url: "https://icp.gov.ae" }],
  },
  "Катар": { status: "Безвизово", days: 90, checked: CHECKED, summary: "Безвизовый въезд до 90 дней.", must: ["Загранпаспорт 6 мес.", "Обратный билет и подтверждение проживания"], src: [{ label: "МВД Катара", url: "https://portal.moi.gov.qa" }] },
  "Саудовская Аравия": { status: "Безвизово", days: 90, checked: CHECKED, summary: "Безвизовый въезд до 90 дней.", must: ["Загранпаспорт 6 мес.", "Медицинская страховка", "Подтверждение проживания"], tip: "Для паломничества (хадж и умра) действует отдельный порядок оформления.", src: [{ label: "Visit Saudi", url: "https://www.visitsaudi.com" }] },
  "Оман": { status: "Безвизово", days: 30, checked: CHECKED, summary: "Безвизовый въезд до 30 дней. При необходимости оформляется e-Visa на сайте полиции Омана.", must: ["Загранпаспорт 6 мес.", "Обратный билет", "Бронь жилья"], src: [{ label: "Royal Oman Police — визы", url: "https://evisa.rop.gov.om" }] },
  "Бахрейн": { status: "Безвизово", days: 14, checked: CHECKED, summary: "Безвизовый въезд до 14 дней. По оформленной заранее многократной визе — до 30 дней.", must: ["Загранпаспорт 6 мес.", "Обратный билет", "Бронь жилья"], src: [{ label: "eVisa Бахрейна", url: "https://www.evisa.gov.bh" }] },
  "Кувейт": { status: "Электронная виза", days: 90, checked: CHECKED, summary: "Нужна виза. Для россиян доступна электронная виза, оформляется онлайн заранее.", must: ["Загранпаспорт 6 мес.", "e-Visa", "Обратный билет", "Бронь жилья"], warn: "Условия въезда меняются — сверьтесь с официальным порталом перед покупкой билетов.", src: [{ label: "eVisa Кувейта", url: "https://evisa.moi.gov.kw" }] },
  "Турция": {
    status: "Безвизово", days: 90, checked: CHECKED,
    summary: "Безвизовый въезд до 90 дней в течение 180 дней (для туристических поездок — до 60 дней подряд).",
    must: ["Загранпаспорт, действительный минимум 120 дней с даты въезда", "Обратный билет и бронь жилья (могут спросить)"],
    src: [{ label: "МИД Турции", url: "https://www.mfa.gov.tr" }],
  },

  /* ========== АФРИКА ========== */
  "Египет": {
    status: "Виза по прибытии", days: 30, checked: CHECKED,
    summary: "Виза по прибытии или e-Visa заранее. С 01.03.2026 сбор в аэропортах Каира, Хургады и Средиземноморья — $30.",
    must: ["Загранпаспорт 6 мес.", "Визовый сбор наличными долларами (без сдачи)", "Миграционная карта"],
    tip: "Только Шарм-эль-Шейх и Синай до 15 дней — бесплатный «синайский штамп». При выезде за пределы Синая (например, экскурсия в Каир) нужна полная виза.",
    src: [{ label: "Портал e-Visa Египта", url: "https://visa2egypt.gov.eg" }],
  },
  "Танзания (Занзибар)": {
    status: "Виза обязательна", visaType: "Туристическая", days: 90, checked: CHECKED,
    summary: "Виза оформляется онлайн (e-Visa) заранее или по прибытии в аэропортах Занзибара, Дар-эс-Салама и Килиманджаро. Стоимость — около $50.",
    must: ["Загранпаспорт 6 мес. и 2 чистые страницы", "e-Visa или виза по прибытии ($50)", "Обратный билет", "Медицинская страховка обязательна для Занзибара — только от местной государственной компании"],
    warn: "С 01.10.2024 для Занзибара обязательна страховка местного государственного страховщика — оформляется отдельно, российский полис не подходит.",
    tip: "Отдельной «занзибарской» визы нет: танзанийская виза действует и на материке, и на острове.",
    src: [{ label: "Иммиграция Танзании (e-Visa)", url: "https://visa.immigration.go.tz" }],
  },
  "ЮАР": {
    status: "Безвизово", days: 90, checked: CHECKED,
    summary: "Безвизовый въезд для туристических поездок до 90 дней.",
    must: ["Загранпаспорт (действителен 30 дней после выезда, 2 чистые страницы)", "Обратный билет", "Подтверждение проживания и средств"],
    tip: "При поездке с детьми могут запросить свидетельство о рождении с переводом и согласие второго родителя.",
    src: [{ label: "МВД ЮАР", url: "https://www.dha.gov.za" }],
  },

  /* ========== ОКЕАНИЯ ========== */
  "Австралия": {
    status: "Виза обязательна", visaType: "Visitor visa (subclass 600)", days: 90, checked: CHECKED,
    summary: "Нужна виза посетителя, подаётся онлайн через ImmiAccount. Безвизового въезда и ETA для россиян нет.",
    warn: "Посольство в России визы не оформляет — заявление подаётся онлайн, документы рассматривает зарубежный офис. Сроки плавающие, закладывайте несколько месяцев.",
    must: ["Загранпаспорт", "Онлайн-заявление через ImmiAccount", "Выписка со счёта", "Справка с работы", "Маршрут, брони и обратный билет", "Медстраховка", "Возможен запрос биометрии и медосмотра"],
    src: [{ label: "Департамент внутренних дел Австралии", url: "https://immi.homeaffairs.gov.au" }],
  },

  /* ========== СНГ И БЛИЖНЕЕ ЗАРУБЕЖЬЕ ========== */
  "Грузия": { status: "Безвизово", days: 365, checked: CHECKED, summary: "Безвизовый въезд до 1 года.", must: ["Загранпаспорт", "Обратный билет и бронь жилья (могут спросить)"], src: [{ label: "МВД Грузии", url: "https://info.police.ge" }] },
  "Армения": { status: "Безвизово", days: 180, checked: CHECKED, summary: "Безвизовый въезд до 180 дней в году. Можно въехать по внутреннему паспорту РФ.", must: ["Загранпаспорт или паспорт РФ"], src: [{ label: "МИД Армении", url: "https://www.mfa.am" }] },
  "Казахстан": { status: "Безвизово", days: 90, checked: CHECKED, summary: "Безвизовый въезд до 90 дней. Можно въехать по внутреннему паспорту РФ.", must: ["Загранпаспорт или паспорт РФ", "Регистрация при пребывании свыше 30 дней"], src: [{ label: "МИД Казахстана", url: "https://www.gov.kz/memleket/entities/mfa" }] },
  "Куба": { status: "Безвизово", days: 90, checked: CHECKED, summary: "Безвизовый въезд до 90 дней.", must: ["Загранпаспорт", "Медицинская страховка — обязательна", "Электронная форма D'Viajeros (за 72 часа до вылета)"], src: [{ label: "D'Viajeros", url: "https://dviajeros.mitrans.gob.cu" }] },
};


/* ============ ЕДИНАЯ КОНФИГУРАЦИЯ СТРАН (MVP: только туризм и частный визит) ============
   entryMode  — что нужно для въезда: none | eta | evisa | voa | consular_visa | declaration
   supportLevel — что приложение реально умеет для этой страны (честно, без обещаний):
     information_only        — справка и требования
     personalized_checklist  — персональный комплект под поездку
     guided_form             — пошаговое заполнение формы
     full_preparation        — форма + генерация комплекта
   purposes — поддерживаемые подцели. Вопрос о подцели задаём ТОЛЬКО если их больше одной. */
const TRIP_TYPE = "short_private_trip";
const TRIP_TYPE_LABEL = "Туризм и частная поездка";
const ENTRY_MODE_LABEL = {
  none: "Виза не требуется", eta: "Электронное разрешение", evisa: "Электронная виза",
  voa: "Виза по прибытии", consular_visa: "Консульская виза", declaration: "Въездная декларация",
};
// базовые пункты комплекта, общие для всех
// что это за пункт и зачем — без этого список бесполезен
const ITEM_DESC = {
  passport_valid: { what: "Загранпаспорт с достаточным сроком действия", why: "Большинство стран не впустят, если паспорт истекает раньше чем через 6 месяцев после возвращения. Авиакомпания может не пустить на рейс.", cost: "бесплатно (проверка)", days: "замена — до 1 месяца" },
  return_ticket: { what: "Билет обратно или в третью страну", why: "На границе и при посадке могут попросить доказать, что вы не остаётесь. Без него бывает отказ во въезде.", cost: "стоимость билета", days: "сразу" },
  stay_proof: { what: "Бронь отеля или адрес проживания", why: "Пограничник спрашивает, где вы будете жить. Нужен адрес — он же вписывается в анкеты и декларации.", cost: "по тарифу отеля", days: "сразу" },
  photo: { what: "Фотография по требованиям консульства", why: "Вклеивается в анкету. Селфи и фото с телефона не принимают — нужен нужный размер, фон и свежесть съёмки.", cost: "300–800 ₽", days: "в день обращения" },
  work_ref: { what: "Справка с места работы", why: "Показывает консульству, что у вас есть работа и вы вернётесь. Без неё резко растёт риск отказа.", cost: "бесплатно", days: "1–3 рабочих дня" },
  bank_ref: { what: "Выписка с банковского счёта", why: "Подтверждает, что вам хватит денег на поездку. Смотрят и сумму, и историю движения средств.", cost: "бесплатно", days: "от 1 дня" },
  ins: { what: "Медицинская страховка", why: "Обязательна для визы, покрытие от €30 000. Без неё документы не примут.", cost: "от 1 500 ₽", days: "сразу онлайн" },
  jp_form: { what: "Официальная визовая анкета Японии", why: "Основной документ заявления. Заполняется латиницей, ошибки в датах и именах — причина возврата.", cost: "консульский сбор не взимается", days: "рассмотрение от 10 рабочих дней" },
  jp_schedule: { what: "Программа пребывания по дням", why: "Япония требует расписанный маршрут: даты, города, где ночуете. Без него анкету не примут.", cost: "бесплатно", days: "заполняется сразу" },
  tdac: { what: "Электронная карта прибытия Таиланда", why: "Обязательна с мая 2025. Без QR-кода не пройти паспортный контроль.", cost: "бесплатно", days: "открывается за 3 дня до прилёта" },
  evisa_id: { what: "Виза Индонезии по прибытии", why: "Без неё не пустят в страну. Дешевле и быстрее оформить заранее онлайн, чем стоять в очереди в аэропорту.", cost: "$35 / 500 000 IDR", days: "онлайн — за минуты" },
  ecd: { what: "Таможенная декларация All Indonesia", why: "Обязательна для всех прибывающих. Даёт QR-код для таможни.", cost: "бесплатно", days: "за 3 дня до прилёта" },
  eta: { what: "Разрешение на въезд ETA", why: "Рекомендуется оформить заранее — с ним прохождение границы быстрее.", cost: "бесплатно для россиян", days: "обычно до 1 дня" },
  imuga: { what: "Декларация IMUGA", why: "Обязательна для въезда на Мальдивы. Заполняется в течение 96 часов до вылета.", cost: "бесплатно", days: "за 96 часов до вылета" },
  schengen: { what: "Анкета на шенгенскую визу", why: "Основное заявление. Подаётся в визовый центр вместе с полным пакетом.", cost: "€90 + сервисный сбор", days: "7–60 дней в зависимости от страны" },
  keta: { what: "Разрешение K-ETA", why: "Без него не посадят на рейс в Корею. Действует 3 года.", cost: "~10 000 вон", days: "оформить за 72 часа до вылета" },
  ds160: { what: "Анкета DS-160", why: "Заполняется онлайн до записи на собеседование. Без неё не назначат интервью.", cost: "консульский сбор оплачивается отдельно", days: "заполняется за 1–2 часа" },
  uk_form: { what: "Онлайн-заявление на gov.uk", why: "Основная заявка. После неё нужно сдать биометрию за рубежом.", cost: "по тарифу gov.uk", days: "рассмотрение от 3 недель" },
  imm5257: { what: "Анкета IMM5257 в личном кабинете IRCC", why: "Подаётся полностью онлайн. После одобрения паспорт отправляется в визовый центр за границей.", cost: "100 CAD + 85 CAD биометрия", days: "от 2 недель до 3 месяцев" },
  au_600: { what: "Заявление subclass 600", why: "Подаётся онлайн через ImmiAccount. Могут запросить медосмотр и биометрию.", cost: "по тарифу ImmiAccount", days: "несколько месяцев" },
  cy_form: { what: "Кипрская визовая анкета", why: "Нужна, если нет действующей двукратной шенгенской визы.", cost: "уточняется в консульстве", days: "обычно до 2 недель" },
  in_evisa: { what: "Электронная виза Индии", why: "Без неё не пустят. Оформляется только на официальном портале.", cost: "визовый сбор на сайте", days: "3–5 рабочих дней" },
  tz_evisa: { what: "Виза Танзании", why: "Нужна для въезда, действует и на Занзибаре.", cost: "$50", days: "онлайн до 10 дней или по прилёте" },
  tz_ins: { what: "Страховка местного страховщика Занзибара", why: "Обязательна с октября 2024. Российский полис не подходит — нужен именно местный.", cost: "около $44", days: "оформляется онлайн" },
  eg_visa: { what: "Виза Египта", why: "Нужна для въезда, кроме Шарм-эль-Шейха до 15 дней.", cost: "$30 наличными", days: "по прилёте или онлайн" },
  cn_card: { what: "Электронная въездная карта Китая", why: "Ускоряет прохождение границы, можно заполнить заранее.", cost: "бесплатно", days: "заранее или на границе" },
  cu_dviajeros: { what: "Форма D'Viajeros", why: "Обязательная миграционная форма Кубы, даёт QR-код.", cost: "бесплатно", days: "за 72 часа до вылета" },
  cu_ins: { what: "Медицинская страховка", why: "На Кубе обязательна, её проверяют при въезде.", cost: "от 1 500 ₽", days: "сразу онлайн" },
  kw_evisa: { what: "Электронная виза Кувейта", why: "Нужна для въезда, оформляется заранее онлайн.", cost: "визовый сбор на сайте", days: "несколько дней" },
  dk_faroe: { what: "Датская виза с пометкой о Фарерах", why: "Шенгенская виза на Фарерах не действует — нужна отдельная. Дания не принимает документы в России.", cost: "€90", days: "зависит от страны подачи" },
  kp_tour: { what: "Оформление через туроператора", why: "Самостоятельная подача невозможна — визу получает аккредитованный оператор.", cost: "в составе тура", days: "уточняется у оператора" },
};
const BASE_ITEMS = [
  { id: "passport_valid", name: "Проверить срок действия паспорта", kind: "check" },
  { id: "return_ticket", name: "Обратный билет", kind: "check" },
  { id: "stay_proof", name: "Подтверждение проживания", kind: "check" },
];
const CI = (entryMode, supportLevel, items, extra) => ({ tripType: TRIP_TYPE, entryMode, supportLevel, purposes: ["tourism"], defaultPurpose: "tourism", items: items || [], ...(extra || {}) });
const COUNTRY_CFG = {
  // --- пошаговый мастер есть ---
  "Таиланд": CI("declaration", "guided_form", [{ id: "tdac", name: "Карта прибытия TDAC", kind: "form" }, ...BASE_ITEMS], { note: "TDAC открывается за 3 дня до прилёта — раньше заполнить нельзя." }),
  "Индонезия": CI("voa", "guided_form", [{ id: "evisa_id", name: "Виза по прибытии (e-VOA)", kind: "form" }, { id: "ecd", name: "Декларация All Indonesia", kind: "external" }, ...BASE_ITEMS], { note: "Для Бали дополнительно оплачивается сбор Love Bali." }),
  "Шри-Ланка": CI("eta", "guided_form", [{ id: "eta", name: "Разрешение ETA", kind: "form" }, ...BASE_ITEMS]),
  "Мальдивы": CI("declaration", "guided_form", [{ id: "imuga", name: "Декларация IMUGA", kind: "form" }, ...BASE_ITEMS]),
  "Япония": CI("consular_visa", "guided_form", [
      { id: "jp_form", name: "Визовая анкета", kind: "form" },
      { id: "jp_schedule", name: "Программа пребывания по дням", kind: "form" },
      { id: "work_ref", name: "Справка с работы", kind: "request" },
      { id: "bank_ref", name: "Выписка со счёта", kind: "request" },
      { id: "photo", name: "Фото 45×45 мм", kind: "check" },
      ...BASE_ITEMS],
    { purposes: ["tourism", "private_visit"], note: "Документы принимают визовые центры VFS в Москве и Санкт-Петербурге. Консульский сбор не взимается." }),
  // --- консульская виза, персональный комплект ---
  "Европа (Шенген)": CI("consular_visa", "personalized_checklist", [
      { id: "schengen", name: "Шенгенская анкета", kind: "external" },
      { id: "work_ref", name: "Справка с работы", kind: "request" },
      { id: "bank_ref", name: "Выписка со счёта за 3 месяца", kind: "request" },
      { id: "ins", name: "Страховка от €30 000", kind: "external" },
      { id: "photo", name: "Фото 35×45 мм", kind: "check" },
      ...BASE_ITEMS],
    { purposes: ["tourism", "private_visit"] }),
  "Великобритания": CI("consular_visa", "personalized_checklist", [{ id: "uk_form", name: "Онлайн-анкета на gov.uk", kind: "external" }, { id: "work_ref", name: "Справка с работы", kind: "request" }, { id: "bank_ref", name: "Выписка за 6 месяцев", kind: "request" }, ...BASE_ITEMS], { purposes: ["tourism", "private_visit"] }),
  "США": CI("consular_visa", "personalized_checklist", [{ id: "ds160", name: "Анкета DS-160", kind: "external" }, { id: "work_ref", name: "Справка с работы", kind: "request" }, { id: "bank_ref", name: "Выписка со счёта", kind: "request" }, { id: "photo", name: "Фото 5×5 см", kind: "check" }, ...BASE_ITEMS], { purposes: ["tourism", "private_visit"] }),
  "Канада": CI("consular_visa", "personalized_checklist", [{ id: "imm5257", name: "Анкета IMM5257 (IRCC)", kind: "external" }, { id: "work_ref", name: "Справка с работы", kind: "request" }, { id: "bank_ref", name: "Выписка со счёта", kind: "request" }, ...BASE_ITEMS], { purposes: ["tourism", "private_visit"] }),
  "Австралия": CI("consular_visa", "personalized_checklist", [{ id: "au_600", name: "Заявление subclass 600 (ImmiAccount)", kind: "external" }, { id: "work_ref", name: "Справка с работы", kind: "request" }, { id: "bank_ref", name: "Выписка со счёта", kind: "request" }, ...BASE_ITEMS], { purposes: ["tourism", "private_visit"] }),
  "Кипр": CI("consular_visa", "personalized_checklist", [{ id: "cy_form", name: "Кипрская визовая анкета", kind: "external" }, { id: "work_ref", name: "Справка с работы", kind: "request" }, { id: "bank_ref", name: "Выписка со счёта", kind: "request" }, ...BASE_ITEMS], { purposes: ["tourism", "private_visit"] }),
  "Фарерские острова": CI("consular_visa", "information_only", [{ id: "dk_faroe", name: "Датская виза с пометкой о Фарерах", kind: "external" }, ...BASE_ITEMS]),
  "Северная Корея": CI("consular_visa", "information_only", [{ id: "kp_tour", name: "Оформление через туроператора", kind: "external" }, ...BASE_ITEMS]),
  "Танзания (Занзибар)": CI("evisa", "personalized_checklist", [{ id: "tz_evisa", name: "e-Visa Танзании ($50)", kind: "external" }, { id: "tz_ins", name: "Страховка местного страховщика (Занзибар)", kind: "external" }, ...BASE_ITEMS]),
  "Индия": CI("evisa", "personalized_checklist", [{ id: "in_evisa", name: "e-Visa Индии", kind: "external" }, { id: "photo", name: "Фото и скан паспорта", kind: "check" }, ...BASE_ITEMS]),
  "Кувейт": CI("evisa", "personalized_checklist", [{ id: "kw_evisa", name: "e-Visa Кувейта", kind: "external" }, ...BASE_ITEMS]),
  "Египет": CI("voa", "personalized_checklist", [{ id: "eg_visa", name: "Виза по прибытии или e-Visa", kind: "external" }, ...BASE_ITEMS], { note: "Для Шарм-эль-Шейха до 15 дней — бесплатный синайский штамп." }),
  "Южная Корея": CI("eta", "personalized_checklist", [{ id: "keta", name: "Разрешение K-ETA", kind: "external" }, ...BASE_ITEMS]),
  "Куба": CI("none", "personalized_checklist", [{ id: "cu_dviajeros", name: "Форма D'Viajeros", kind: "external" }, { id: "cu_ins", name: "Медицинская страховка (обязательна)", kind: "external" }, ...BASE_ITEMS]),
  "Китай": CI("none", "personalized_checklist", [{ id: "cn_card", name: "Электронная въездная карта", kind: "external" }, ...BASE_ITEMS]),
};
// шенгенские страны наследуют конфигурацию Шенгена
const SCHENGEN_LIST = ["Венгрия", "Греция", "Франция", "Испания", "Италия", "Австрия", "Хорватия", "Португалия", "Швейцария", "Германия", "Швеция", "Словения", "Словакия", "Дания", "Исландия"];
for (const c of SCHENGEN_LIST) COUNTRY_CFG[c] = { ...COUNTRY_CFG["Европа (Шенген)"], schengenCountry: true };
// безвизовые направления — базовый комплект
for (const c of ["Таиланд", "Вьетнам", "ОАЭ", "Катар", "Саудовская Аравия", "Оман", "Бахрейн", "Турция", "ЮАР", "Грузия", "Армения", "Казахстан"]) {
  if (!COUNTRY_CFG[c]) COUNTRY_CFG[c] = CI("none", "personalized_checklist", [...BASE_ITEMS]);
}
function countryCfg(country) {
  const fallback=COUNTRY_CFG[country] || CI("none", "information_only", [...BASE_ITEMS]);
  const remote=visaRulesRemote()[country];
  const cfg=remote&&remote.countryCfg&&typeof remote.countryCfg==="object"?remote.countryCfg:(remote&&typeof remote==="object"&&(remote.entryMode||remote.supportLevel||Array.isArray(remote.items))?remote:null);
  if(!cfg)return fallback;
  return {...fallback,...cfg,items:Array.isArray(cfg.items)?cfg.items:fallback.items,purposes:Array.isArray(cfg.purposes)?cfg.purposes:fallback.purposes};
}
const SUPPORT_LABEL = {
  information_only: { txt: "Справка и требования", col: "#8a90b8" },
  personalized_checklist: { txt: "Персональный комплект", col: "#48dcdc" },
  guided_form: { txt: "Пошаговое заполнение", col: "#39d98a" },
  full_preparation: { txt: "Полная подготовка", col: "#39d98a" },
};
const PURPOSE_LABEL = { tourism: "Туризм", private_visit: "Посещение друзей или родственников" };

/* ============ ДОКУМЕНТЫ, КОТОРЫЕ НУЖНО ЗАПРОСИТЬ (не заполнить) ============
   Справка с работы, выписка со счёта, спонсорское письмо: пользователю нужно знать не «какие поля»,
   а У КОГО запросить, ЧТО должно быть внутри и ПО КАКОМУ образцу. */
const REQUEST_DOCS = {
  work_ref: {
    id: "work_ref", name: "Справка с места работы", kind: "request", country: "Европа (Шенген)", checked: CHECKED,
    who: "Бухгалтерия или отдел кадров вашего работодателя",
    how: "Напишите заявление или запрос в свободной форме — обычно готовят 1–3 рабочих дня. Просите на фирменном бланке с подписью руководителя и печатью (если организация её использует).",
    deadline: "Справка должна быть свежей: большинство консульств принимают документ не старше 1 месяца на дату подачи.",
    must: [
      "Фирменный бланк с реквизитами, адресом и телефоном организации",
      "Должность и дата приёма на работу",
      "Размер оклада (за последние 6 месяцев или средний в месяц)",
      "Фраза о сохранении рабочего места и зарплаты на время отпуска",
      "Даты отпуска — должны совпадать с датами поездки",
      "Подпись руководителя и главного бухгалтера, печать при наличии",
      "Исходящий номер и дата выдачи",
    ],
    template: `Справка выдана [ФИО полностью], [дата рождения], в том, что он(а) работает в [полное название организации] с [дата приёма] по настоящее время в должности [должность].

Средняя заработная плата за последние 6 месяцев составляет [сумма] рублей в месяц.

На период с [дата начала] по [дата окончания] [ФИО] предоставляется ежегодный оплачиваемый отпуск с сохранением рабочего места и заработной платы.

Справка выдана для предоставления в консульство [страна].

Руководитель организации ______________ / [ФИО] /
Главный бухгалтер ______________ / [ФИО] /
Дата выдачи: [дата]   Исходящий №: [номер]`,
    tips: ["ИП прикладывают свидетельство о регистрации и налоговую декларацию вместо справки.", "Самозанятые — справку о постановке на учёт и справку о доходах из приложения «Мой налог».", "Студенты и пенсионеры — справку из учебного заведения или пенсионное удостоверение плюс спонсорское письмо."],
  },
  bank_ref: {
    id: "bank_ref", name: "Выписка с банковского счёта", kind: "request", country: "Европа (Шенген)", checked: CHECKED,
    who: "Ваш банк — отделение или онлайн-банк",
    how: "В большинстве банков выписку можно заказать в приложении с электронной подписью банка. Для консульств чаще нужна именно официальная выписка с печатью или с квалифицированной подписью, а не скриншот.",
    deadline: "Выписка должна быть выдана не ранее чем за 1 месяц до подачи.",
    must: [
      "Движение средств за последние 3 месяца",
      "Остаток на счёте на дату выдачи",
      "ФИО владельца счёта",
      "Реквизиты банка, печать или электронная подпись",
    ],
    tips: ["Ориентир по сумме — от €60–130 на каждый день поездки, но лучше показать запас в 1,5–2 раза больше минимума.", "Резкое пополнение счёта прямо перед подачей выглядит подозрительно: важна история движения средств.", "Карты российских банков за рубежом не работают — некоторые консульства просят показать и наличные или карту иностранного банка."],
  },
  sponsor: {
    id: "sponsor", name: "Спонсорское письмо", kind: "request", country: "Европа (Шенген)", checked: CHECKED,
    who: "Спонсор — близкий родственник (супруг, родитель, взрослый ребёнок)",
    how: "Пишется в свободной форме от руки или на компьютере, подпись спонсора обязательна. Нотариальное заверение обычно не требуется, но некоторые консульства просят.",
    deadline: "Прикладывается вместе с документами спонсора — его справкой с работы и выпиской со счёта.",
    must: [
      "ФИО и паспортные данные спонсора",
      "ФИО и паспортные данные того, кого спонсируют",
      "Степень родства",
      "Обязательство оплатить поездку",
      "Страна и даты поездки",
      "Подпись и дата",
      "Копия паспорта спонсора и документ о родстве (свидетельство о рождении или браке)",
    ],
    template: `Я, [ФИО спонсора полностью], паспорт [серия номер], выдан [кем и когда], проживающий(ая) по адресу [адрес],

настоящим подтверждаю, что беру на себя все расходы, связанные с поездкой моего(ей) [степень родства: сына / дочери / супруги] [ФИО полностью], [дата рождения], паспорт [серия номер],

в [страна поездки] в период с [дата начала] по [дата окончания].

Обязуюсь оплатить проезд, проживание, питание и медицинское обслуживание в течение всего срока поездки.

Дата: [дата]        Подпись: ______________ / [ФИО] /`,
    tips: ["Спонсорское письмо обязательно для детей, студентов, пенсионеров и неработающих.", "К письму всегда прикладывают финансовые документы самого спонсора."],
  },
};

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
  work_ref: "справка работа работодатель бухгалтерия зарплата отпуск шенген", bank_ref: "выписка банк счёт финансы деньги шенген", sponsor: "спонсор спонсорское письмо ребёнок студент пенсионер",
  in_evisa: "индия индийская виза гоа дели", eg_voa: "египет египетская виза хургада шарм синай",
  ins: "страховка полис медицинская", pass6: "загранпаспорт паспорт срок действия",
  kid_birth: "свидетельство рождение ребёнок дети", kid_consent: "согласие выезд ребёнок дети нотариус",
};
const ALL_DOCS = (() => {
  const m = new Map();
  for (const [country, arr] of Object.entries(DOC_MATRIX)) for (const dd of arr) if (!m.has(dd.id)) m.set(dd.id, { ...dd, country, kw: DOC_KW[dd.id] || "" });
  m.set("schengen", { id: "schengen", name: "Шенгенская анкета", E: 180, P: 15, country: "Европа (Шенген)", kw: DOC_KW.schengen });
  // документы, которые запрашивают у третьей стороны (работодатель, банк, спонсор)
  for (const r of Object.values(REQUEST_DOCS)) m.set(r.id, { id: r.id, name: r.name, E: 45, P: 3, country: r.country, kw: DOC_KW[r.id] || "" });
  for (const k of KID_DOCS) if (!m.has(k.id)) m.set(k.id, { ...k, country: "любая страна", kw: DOC_KW[k.id] || "" });
  return [...m.values()];
})();

/* ================== МАСТЕР ЗАПОЛНЕНИЯ (шаг C) ==================
   Отвечаешь по-русски -> получаешь готовые значения для официальной онлайн-формы.
   Транслитерация по ИКАО 9303 (как в загранпаспорте). Данные никуда не отправляются
   и живут только на устройстве до нажатия «Очистить». */
const TR_MAP = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "ie", "ы": "y", "ь": "", "э": "e", "ю": "iu", "я": "ia" };
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

/* ============ ДВИЖОК ДОКУМЕНТОВ: конфигурация вместо отдельных форм ============
   Документ = шаги -> группы -> поля. Условия показа, автозаполнение из профиля/поездки
   и валидация описываются здесь, а не в UI. Новый документ = новый конфиг. */
const FLD = {
  surname:   { k: "surname", label: "Фамилия (латиницей, как в загранпаспорте)", en: "Surname / Family name", type: "lat", src: "profile.surname", req: true },
  given:     { k: "given", label: "Имя (латиницей)", en: "Given name(s)", type: "lat", src: "profile.given", req: true },
  dob:       { k: "dob", label: "Дата рождения", en: "Date of birth", type: "date", src: "profile.dob", req: true },
  sex:       { k: "sex", label: "Пол", en: "Sex", type: "radio", opts: [["M", "Мужской"], ["F", "Женский"]], src: "profile.sex", req: true },
  nation:    { k: "nation", label: "Гражданство", en: "Nationality", type: "text", src: "profile.nation", req: true },
  passport:  { k: "passport", label: "Номер загранпаспорта", en: "Passport number", type: "up", hint: "без пробелов", src: "profile.passport", req: true },
  pexp:      { k: "pexp", label: "Паспорт действителен до", en: "Passport expiry date", type: "date", src: "profile.pexp", req: true },
  email:     { k: "email", label: "Email", en: "Email", type: "email", src: "profile.email", req: true },
  phone:     { k: "phone", label: "Телефон с кодом страны", en: "Phone number", type: "phone", hint: "+7…", src: "profile.phone", req: true },
  arr:       { k: "arr", label: "Дата прилёта", en: "Arrival date", type: "date", src: "trip.df", req: true },
  dep:       { k: "dep", label: "Дата вылета обратно", en: "Departure date", type: "date", src: "trip.dt" },
  flight:    { k: "flight", label: "Номер рейса прибытия", en: "Flight number", type: "up", hint: "например SU274", req: true },
  accType:   { k: "accType", label: "Где будете жить?", en: "Type of accommodation", type: "radio", opts: [["hotel", "Отель"], ["private", "У знакомых / аренда"]], req: true },
  hotelName: { k: "hotelName", label: "Название отеля", en: "Hotel name", type: "text", req: true, when: { f: "accType", eq: "hotel" } },
  hotelAddr: { k: "hotelAddr", label: "Адрес отеля", en: "Address", type: "text", req: true, when: { f: "accType", eq: "hotel" } },
  hostName:  { k: "hostName", label: "Имя принимающей стороны", en: "Host name", type: "text", req: true, when: { f: "accType", eq: "private" } },
  hostAddr:  { k: "hostAddr", label: "Адрес проживания", en: "Address", type: "text", req: true, when: { f: "accType", eq: "private" } },
  hostPhone: { k: "hostPhone", label: "Телефон принимающей стороны", en: "Host phone", type: "phone", when: { f: "accType", eq: "private" } },
  purpose:   { k: "purpose", label: "Цель поездки", en: "Purpose of visit", type: "radio", opts: [["tourism", "Туризм"], ["private_visit", "К друзьям или родственникам"]], req: true },
  // --- расширенный набор для консульских виз ---
  birthPlace: { k: "birthPlace", label: "Место рождения (город, страна)", en: "Place of birth", type: "text", src: "profile.birthPlace", req: true },
  homeAddr:  { k: "homeAddr", label: "Адрес проживания", en: "Current residential address", type: "text", src: "profile.homeAddr", req: true },
  occupation:{ k: "occupation", label: "Профессия / должность", en: "Occupation", type: "text", src: "profile.occupation", req: true },
  employer:  { k: "employer", label: "Место работы", en: "Employer name", type: "text", src: "profile.employer", req: true },
  employerAddr: { k: "employerAddr", label: "Адрес и телефон работодателя", en: "Employer address and phone", type: "text", req: true },
  income:    { k: "income", label: "Примерный доход в месяц", en: "Monthly income", type: "text", hint: "в рублях", req: true },
  payer:     { k: "payer", label: "Кто оплачивает поездку", en: "Who covers the expenses", type: "radio", opts: [["self", "Я сам"], ["sponsor", "Спонсор"], ["host", "Принимающая сторона"]], req: true },
  cities:    { k: "cities", label: "Города посещения", en: "Cities to visit", type: "text", hint: "через запятую", req: true },
  itinerary: { k: "itinerary", label: "Маршрут по дням", en: "Daily schedule", type: "textarea", hint: "дата — город — что планируете", req: true },
  prevVisa:  { k: "prevVisa", label: "Были ли раньше в этой стране?", en: "Previous visits", type: "radio", opts: [["no", "Нет"], ["yes", "Да"]], req: true },
  prevVisaWhen: { k: "prevVisaWhen", label: "Когда были в последний раз", en: "Date of last visit", type: "text", when: { f: "prevVisa", eq: "yes" } },
  prevRefusal: { k: "prevRefusal", label: "Были ли отказы во въезде?", en: "Previous refusals", type: "radio", opts: [["no", "Нет"], ["yes", "Да"]], req: true },
  hostRel:   { k: "hostRel", label: "Кем приходится принимающая сторона", en: "Relationship to host", type: "text", req: true, when: { f: "purpose", eq: "private_visit" } },
  hostFull:  { k: "hostFull", label: "ФИО принимающей стороны", en: "Host full name", type: "text", req: true, when: { f: "purpose", eq: "private_visit" } },
  hostAddrJ: { k: "hostAddrJ", label: "Адрес принимающей стороны", en: "Host address", type: "text", req: true, when: { f: "purpose", eq: "private_visit" } },
  hostPhoneJ:{ k: "hostPhoneJ", label: "Телефон принимающей стороны", en: "Host phone", type: "phone", req: true, when: { f: "purpose", eq: "private_visit" } },
};
const F = (k, over) => ({ ...FLD[k], ...(over || {}) });
// шаги документов: на экране 3-6 связанных полей
const DOC_CONFIGS = {
  jp_form: {
    title: "Виза в Японию — туристическая", country: "Япония", resultType: "filled_official_document",
    officialUrl: "https://www.ru.emb-japan.go.jp", version: "2026-02",
    steps: [
      { id: "purpose", title: "Цель и параметры поездки", groups: [{ title: "Поездка", fields: [F("purpose"), F("arr"), F("dep")] }, { title: "Куда", fields: [F("cities")] }] },
      { id: "personal", title: "Личные данные", groups: [{ title: "Как в загранпаспорте", fields: [F("surname"), F("given"), F("dob"), F("sex")] }, { title: "Рождение и адрес", fields: [F("birthPlace"), F("homeAddr")] }] },
      { id: "passport", title: "Паспорт", groups: [{ title: "Документ", fields: [F("passport"), F("pexp"), F("nation")] }] },
      { id: "flight", title: "Перелёт", groups: [{ title: "Рейс", fields: [F("flight")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Где остановитесь", fields: [F("accType"), F("hotelName"), F("hotelAddr"), F("hostName"), F("hostAddr")] }] },
      { id: "work", title: "Работа и финансирование", groups: [{ title: "Занятость", fields: [F("occupation"), F("employer"), F("employerAddr")] }, { title: "Финансы", fields: [F("income"), F("payer")] }] },
      { id: "host", title: "Принимающая сторона", groups: [{ title: "Кто принимает", fields: [F("hostFull"), F("hostRel"), F("hostAddrJ"), F("hostPhoneJ")] }] },
      { id: "extra", title: "Дополнительные вопросы", groups: [{ title: "История поездок", fields: [F("prevVisa"), F("prevVisaWhen"), F("prevRefusal")] }, { title: "Программа", fields: [F("itinerary")] }] },
      { id: "contacts", title: "Контакты", groups: [{ title: "Связь", fields: [F("email"), F("phone")] }] },
    ],
  },
  jp_schedule: {
    title: "Программа пребывания в Японии", country: "Япония", resultType: "filled_official_document",
    officialUrl: "https://www.ru.emb-japan.go.jp", version: "2026-02",
    steps: [
      { id: "dates", title: "Даты и города", groups: [{ title: "Поездка", fields: [F("arr"), F("dep"), F("cities")] }] },
      { id: "plan", title: "Маршрут по дням", groups: [{ title: "Что планируете", fields: [F("itinerary")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Где живёте", fields: [F("hotelName", { req: true, when: null }), F("hotelAddr", { req: true, when: null })] }] },
    ],
  },
  tdac: {
    title: "Thailand Digital Arrival Card", country: "Таиланд", resultType: "online_form_guide",
    officialUrl: "https://tdac.immigration.go.th", version: "2026-01",
    steps: [
      { id: "personal", title: "Личные данные", groups: [{ title: "Как в загранпаспорте", fields: [F("surname"), F("given"), F("dob"), F("sex")] }] },
      { id: "passport", title: "Паспорт", groups: [{ title: "Документ", fields: [F("passport"), F("nation")] }] },
      { id: "trip", title: "Информация о поездке", groups: [{ title: "Прибытие", fields: [F("arr"), F("flight")] }, { title: "Цель", fields: [F("purpose")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Где остановитесь", fields: [F("accType"), F("hotelName"), F("hotelAddr"), F("hostName"), F("hostAddr"), F("hostPhone")] }] },
      { id: "contacts", title: "Контакты", groups: [{ title: "Связь", fields: [F("email"), F("phone")] }] },
    ],
  },
  evisa_id: {
    title: "e-Visa Индонезии (B1)", country: "Индонезия", resultType: "online_form_guide",
    officialUrl: "https://evisa.imigrasi.go.id", version: "2026-01",
    steps: [
      { id: "personal", title: "Личные данные", groups: [{ title: "Как в загранпаспорте", fields: [F("surname"), F("given"), F("dob"), F("sex")] }] },
      { id: "passport", title: "Паспорт", groups: [{ title: "Документ", fields: [F("passport"), F("pexp"), F("nation")] }] },
      { id: "trip", title: "Поездка", groups: [{ title: "Даты", fields: [F("arr"), F("dep")] }, { title: "Цель", fields: [F("purpose")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Адрес в Индонезии", fields: [F("accType"), F("hotelName"), F("hotelAddr"), F("hostName"), F("hostAddr")] }] },
      { id: "contacts", title: "Контакты", groups: [{ title: "Связь", fields: [F("email"), F("phone")] }] },
    ],
  },
  eta: {
    title: "ETA Шри-Ланки", country: "Шри-Ланка", resultType: "online_form_guide",
    officialUrl: "https://www.eta.gov.lk", version: "2026-01",
    steps: [
      { id: "personal", title: "Личные данные", groups: [{ title: "Как в загранпаспорте", fields: [F("surname"), F("given"), F("dob"), F("sex")] }] },
      { id: "passport", title: "Паспорт", groups: [{ title: "Документ", fields: [F("passport"), F("pexp"), F("nation")] }] },
      { id: "trip", title: "Поездка", groups: [{ title: "Прибытие", fields: [F("arr"), F("dep")] }, { title: "Цель", fields: [F("purpose")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Адрес на Шри-Ланке", fields: [F("accType"), F("hotelName"), F("hotelAddr"), F("hostName"), F("hostAddr")] }] },
      { id: "contacts", title: "Контакты", groups: [{ title: "Связь", fields: [F("email"), F("phone")] }] },
    ],
  },
  imuga: {
    title: "IMUGA Traveller Declaration", country: "Мальдивы", resultType: "online_form_guide",
    officialUrl: "https://imuga.immigration.gov.mv", version: "2026-01",
    steps: [
      { id: "personal", title: "Личные данные", groups: [{ title: "Как в загранпаспорте", fields: [F("surname"), F("given"), F("dob"), F("sex")] }] },
      { id: "passport", title: "Паспорт", groups: [{ title: "Документ", fields: [F("passport"), F("nation")] }] },
      { id: "trip", title: "Поездка", groups: [{ title: "Прибытие", fields: [F("arr"), F("flight")] }] },
      { id: "stay", title: "Проживание", groups: [{ title: "Отель на Мальдивах", fields: [F("accType"), F("hotelName"), F("hotelAddr"), F("hostName"), F("hostAddr")] }] },
      { id: "contacts", title: "Контакты", groups: [{ title: "Связь", fields: [F("email"), F("phone")] }] },
    ],
  },
};
// конфиг для документа: готовый или собранный из старого DOC_FIELDS (чтобы ничего не потерять)
function docConfig(docId, docName, country) {
  // Карточка поездки использует id=jvisa, а реальный мастер анкеты — jp_form.
  if (docId === "jvisa") return DOC_CONFIGS.jp_form;
  if (DOC_CONFIGS[docId]) return DOC_CONFIGS[docId];
  const legacy = DOC_FIELDS[docId];
  if (!legacy) return null;
  const chunks = [];
  for (let i = 0; i < legacy.length; i += 4) chunks.push(legacy.slice(i, i + 4));
  return { title: docName || docId, country: country || "", resultType: "online_form_guide", officialUrl: "", version: "",
    steps: chunks.map((fs, i) => ({ id: "s" + i, title: chunks.length > 1 ? `Данные ${i + 1}` : "Данные", groups: [{ title: "", fields: fs.map((f) => ({ ...f, req: true })) }] })) };
}
// видимость поля по условию из конфига
const fieldVisible = (f, ans) => !f.when || String(ans[f.when.f] || "") === String(f.when.eq);
// все видимые поля документа
function visibleFields(cfg, ans) {
  const out = [];
  for (const st of cfg.steps) for (const g of st.groups) for (const f of g.fields) if (fieldVisible(f, ans)) out.push({ ...f, stepId: st.id });
  return out;
}
// автозаполнение: profile.* из store("profile"), trip.* из активной поездки
function autofillFrom(cfg, trips) {
  const prof = store.get("profile", {});
  const trip = (trips || []).slice().sort((a, b) => (a.df || "") < (b.df || "") ? -1 : 1)[0] || {};
  const out = {};
  for (const st of cfg.steps) for (const g of st.groups) for (const f of g.fields) {
    if (!f.src) continue;
    const [scope, key] = f.src.split(".");
    const v = scope === "profile" ? prof[key] : scope === "trip" ? trip[key] : null;
    if (v) out[f.k] = v;
  }
  return out;
}
// валидация значения поля
function validateField(f, v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return f.req ? "не заполнено" : null;
  if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return "похоже на некорректный email";
  if (f.type === "phone" && !/^\+?[\d\s()-]{7,20}$/.test(s)) return "телефон в формате +7…";
  if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "выберите дату";
  if (f.type === "lat" && /[а-яё]/i.test(s)) return "нужна латиница, как в загранпаспорте";
  if (f.k === "passport" && s.replace(/\s/g, "").length < 6) return "проверьте номер паспорта";
  return null;
}

function DocWizard({ doc, onClose, setToast, savedId, onSaved, fullScreen = false, tripContext = null }) {
  const Wrap = fullScreen ? FullScreenOverlay : Overlay;
  const cfg = docConfig(doc.id, doc.name, doc.country);
  const persistRequest = (status) => {
    try {
      const list = store.get("mydocs", []);
      const rid = savedId || (doc.id + "-" + Date.now().toString(36));
      const rec = { id: rid, docKey: doc.id, name: doc.name, country: doc.country || "", tripId: tripContext && tripContext.id || null, ans: {}, status, kind: "request", updatedAt: Date.now() };
      const i = list.findIndex((d) => d.id === rid);
      if (i >= 0) list[i] = rec; else list.unshift(rec);
      store.set("mydocs", list); onSaved && onSaved(rec);
    } catch (e) { console.warn("[TripWiseAI] request doc save failed", e); }
  };
  const saved = savedId ? (store.get("mydocs", []).find((d) => d.id === savedId)) : null;
  const [docId] = useState(savedId || (doc.id + "-" + Date.now().toString(36)));
  const [ans, setAns] = useState(() => {
    if (saved && saved.ans) return saved.ans;
    return cfg ? autofillFrom(cfg, tripContext ? [tripContext] : store.get("trips", [])) : {};
  });
  const [stepIdx, setStepIdx] = useState(saved && saved.stepIdx ? saved.stepIdx : 0);
  const [mode, setMode] = useState(saved && saved.status === "ready" ? "result" : "form");
  const [editing, setEditing] = useState({});      // какие автозаполненные поля раскрыты для правки
  const [touched, setTouched] = useState({});      // показывать ошибку только после ввода/проверки
  const [focusF, setFocusF] = useState(null);      // активное поле — контекст для ГигаЧата
  const [aiQ, setAiQ] = useState(""); const [aiBusy, setAiBusy] = useState(false); const [aiOpen,setAiOpen]=useState(false); const [aiMessages,setAiMessages]=useState([]);

  const rq = REQUEST_DOCS[doc.id];
  if (rq) {
    const copyTpl = async () => { (await copyText(rq.template || "")) ? setToast("Шаблон скопирован") : setToast("Не удалось скопировать"); };
    return <Wrap onClose={onClose}><SheetHead title={rq.name} onClose={onClose} />
      <div style={{ maxHeight: "64vh", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingRight: 2 }}>
        <div style={{ background: T.violet + "14", border: `1px solid ${T.violet}44`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.violet, fontWeight: 800, marginBottom: 4 }}>У КОГО ЗАПРОСИТЬ</div>
          <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, marginBottom: 8 }}>{rq.who}</div>
          <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>{rq.how}</div>
        </div>
        {rq.deadline && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>⏳</span><span style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45 }}>{rq.deadline}</span>
        </div>}
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", marginBottom: 8 }}>Что должно быть в документе</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {(rq.must || []).map((m, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: T.violet, marginTop: 6, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45 }}>{m}</span>
          </div>)}
        </div>
        {rq.template && <>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", flex: 1 }}>Образец текста</div>
            <span onClick={copyTpl} className="press" style={{ fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px solid ${T.violet}55`, background: T.violet + "14", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>Копировать</span>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, fontSize: 12, color: T.sub, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 14 }}>{rq.template}</div>
        </>}
        {(rq.tips || []).length > 0 && <>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", marginBottom: 8 }}>Важно</div>
          {(rq.tips || []).map((t, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
            <span style={{ fontSize: 12 }}>💡</span><span style={{ fontSize: 12.5, color: T.subd, lineHeight: 1.45 }}>{t}</span>
          </div>)}
        </>}
        <div style={{ fontSize: 10.5, color: T.subd, marginTop: 12 }}>Требования проверены {rq.checked}. Перед подачей сверьтесь с сайтом консульства — правила меняются.</div>
      </div>
      <div onClick={() => { persistRequest("ready"); onClose(); setToast("Отмечено как готовое"); }} className="press" style={{ marginTop: 12, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>Документ получен</div>
    </Wrap>;
  }
  if (!cfg) return <Wrap onClose={onClose}><SheetHead title={doc.name} onClose={onClose} />
    <div style={{ fontSize: 13, color: T.subd, lineHeight: 1.5, padding: "4px 0 12px" }}>Мастер для этого документа появится позже. Пока воспользуйтесь официальным сайтом.</div>
  </Wrap>;

  // шаги, где нет ни одного видимого поля (напр. «Принимающая сторона» при туризме), пропускаем
  const steps = cfg.steps.filter((st) => st.groups.some((g) => g.fields.some((f) => fieldVisible(f, ans))));
  const step = steps[Math.min(stepIdx, Math.max(0, steps.length - 1))] || cfg.steps[0];
  const allVisible = visibleFields(cfg, ans);
  const reqAll = allVisible.filter((f) => f.req);
  const filledReq = reqAll.filter((f) => !validateField(f, ans[f.k]));
  const pct = reqAll.length ? Math.round(filledReq.length / reqAll.length * 100) : 0;
  const problems = reqAll.map((f) => ({ f, err: validateField(f, ans[f.k]) })).filter((x) => x.err);

  const persist = (nextAns, status, si) => {
    try {
      const list = store.get("mydocs", []);
      const rec = { id: docId, docKey: doc.id, name: doc.name, country: doc.country || cfg.country || "", tripId: tripContext && tripContext.id || null, ans: nextAns, status, stepIdx: si == null ? stepIdx : si, updatedAt: Date.now() };
      const i = list.findIndex((d) => d.id === docId);
      if (i >= 0) list[i] = rec; else list.unshift(rec);
      store.set("mydocs", list); onSaved && onSaved(rec);
    } catch (e) { console.warn("[TripWiseAI] doc save failed", e); }
  };
  const setVal = (k, v) => { const next = { ...ans, [k]: v }; setAns(next); persist(next, mode === "result" ? "ready" : "draft"); };
  const goStep = (i) => { const n = Math.max(0, Math.min(steps.length - 1, i)); setStepIdx(n); persist(ans, "draft", n); };

  const askAi = async (q, field = focusF) => {
    const question = String(q || aiQ || "").trim(); if (!question || aiBusy) return;
    setAiOpen(true); setAiBusy(true); setAiQ(""); setAiMessages((m)=>[...m,{role:"user",text:question}]);
    try {
      const ctx = field ? `Раздел: ${step.title}. Поле: ${field.en || field.label}${field.hint ? ` (формат: ${field.hint})` : ""}.` : `Раздел: ${step.title}.`;
      const r = await fetch(API_BASE + "?action=ai-help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: cfg.title, country: cfg.country, question: `${ctx} ${question}` }) });
      const d = await r.json();
      setAiMessages((m)=>[...m,{role:"assistant",text:(d && d.answer) || "Не удалось получить ответ."}]);
    } catch (e) { setAiMessages((m)=>[...m,{role:"assistant",text:"Помощник сейчас недоступен."}]); }
    finally { setAiBusy(false); }
  };

  const inputSt = { width: "100%", maxWidth: "100%", background: T.card, border: `1px solid ${T.line2}`, borderRadius: 12, padding: "12px 13px", color: T.text, fontSize: 15, fontFamily: "Manrope,sans-serif", outline: "none", boxSizing: "border-box", colorScheme: "dark" };
  const Field = ({ f }) => {
    const v = ans[f.k] || "";
    const err = touched[f.k] ? validateField(f, v) : null;
    const autofilled = !!f.src && !!v && !editing[f.k] && !touched[f.k];
    if (autofilled) return <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 9 }}>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10.5, color: T.subd }}>{f.label}</div><div style={{ fontSize: 14, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div></div>
      <span onClick={() => setEditing({ ...editing, [f.k]: true })} className="press" style={{ flexShrink: 0, fontSize: 11.5, color: T.violet, fontWeight: 700, cursor: "pointer" }}>Изменить</span>
    </div>;
    return <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{f.label}{f.req ? <span style={{ color: "#ff6db0" }}> *</span> : null}{f.hint ? <span style={{ color: T.subd, fontWeight: 400 }}> · {f.hint}</span> : null}</span>
        <span onClick={() => { setFocusF(f); setAiOpen(true); askAi(`Что указать в этом поле?`,f); }} className="press" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, border: `1px solid ${T.violet}55`, background: T.violet + "14", display: "grid", placeItems: "center", color: T.violet, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>?</span>
      </div>
      {f.type === "radio"
        ? <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{(f.opts || []).map(([ov, ol]) => <div key={ov} onClick={() => { setVal(f.k, ov); setTouched({ ...touched, [f.k]: true }); }} className="press" style={{ background: v === ov ? T.violet + "22" : T.card, border: `1px solid ${v === ov ? T.violet : T.line}`, borderRadius: 999, padding: "9px 14px", fontSize: 13, fontWeight: 700, color: v === ov ? T.violet : T.text, cursor: "pointer" }}>{ol}</div>)}</div>
        : f.type === "textarea"
        ? <textarea value={v} onFocus={() => setFocusF(f)} rows={4} onChange={(e) => { setVal(f.k, e.target.value); setTouched({ ...touched, [f.k]: true }); }} placeholder={f.en || ""} style={{ ...inputSt, borderColor: err ? "#ff6db088" : T.line2, resize: "vertical", minHeight: 84, lineHeight: 1.45 }} />
        : <input type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"} value={v} onFocus={() => setFocusF(f)}
            onChange={(e) => { const nv = f.type === "up" ? e.target.value.toUpperCase() : e.target.value; setVal(f.k, nv); setTouched({ ...touched, [f.k]: true }); }}
            placeholder={f.en || ""} style={{ ...inputSt, borderColor: err ? "#ff6db088" : T.line2 }} />}
      {err && <div style={{ fontSize: 11, color: "#ff6db0", marginTop: 4 }}>{err}</div>}
    </div>;
  };

  const val = (f) => { const raw = String(ans[f.k] || "").trim(); if (!raw) return ""; if (f.type === "date") { const p = raw.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : raw; } if (f.type === "up") return raw.toUpperCase(); return raw; };
  const copyAll = async () => { const s = allVisible.filter((f) => ans[f.k]).map((f) => `${f.en || f.label}: ${val(f)}`).join("\n"); (await copyText(s)) ? setToast("Все поля скопированы") : setToast("Не удалось скопировать"); };

  const AiBar = ({ fixed = false } = {}) => <>
    <div onClick={()=>setAiOpen(true)} className="press" style={{display:"flex",alignItems:"center",gap:9,background:"rgba(11,20,39,.97)",backdropFilter:"blur(18px)",border:`1px solid ${T.violet}55`,boxShadow:"0 10px 34px rgba(0,0,0,.34)",borderRadius:15,padding:"11px 12px",marginTop:fixed?0:12,cursor:"text",...(fixed?{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:"calc(env(safe-area-inset-bottom, 0px) + 12px)",width:"calc(100% - 28px)",maxWidth:392,zIndex:96}:{})}}><div style={{width:27,height:27,borderRadius:9,background:GRAD.cta,display:"grid",placeItems:"center",fontSize:13}}>✦</div><span style={{fontSize:13,color:T.subd,flex:1}}>{focusF?`Спросить про «${focusF.label}»`:`Ask TripWise…`}</span><Icon d={I.arrow} size={15} color={T.violet}/></div>
    {aiOpen&&<Overlay zIndex={112} onClose={()=>setAiOpen(false)}><SheetHead title="Ask TripWise" onClose={()=>setAiOpen(false)}/><div style={{fontSize:10.8,color:T.subd,lineHeight:1.45,marginBottom:9}}>Помощник отвечает только по заполнению этого документа. Значения из анкеты ему не отправляются.</div><div style={{maxHeight:"44vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>{aiMessages.length?aiMessages.map((m,i)=><div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%",background:m.role==="user"?T.violet+"35":T.card,border:`1px solid ${m.role==="user"?T.violet+"55":T.line}`,borderRadius:13,padding:"9px 11px",fontSize:12.2,color:T.text,lineHeight:1.45,whiteSpace:"pre-wrap"}}>{m.text}</div>):<div style={{fontSize:11.5,color:T.subd,padding:"8px 0"}}>Спросите, что указать в поле, как трактовать вопрос анкеты или какой формат нужен.</div>}{aiBusy&&<div style={{fontSize:11.5,color:T.subd}}>TripWise думает…</div>}</div><div style={{display:"flex",gap:7}}><input value={aiQ} onChange={e=>setAiQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAi()} placeholder={focusF?`Спроси про «${focusF.label.slice(0,24)}»`:`Спроси про документ…`} style={{flex:1,background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 11px",color:T.text,outline:"none"}}/><div onClick={()=>askAi()} className="press" style={{width:42,borderRadius:12,background:aiBusy?T.card:GRAD.cta,border:aiBusy?`1px solid ${T.line}`:"none",display:"grid",placeItems:"center",cursor:aiBusy?"default":"pointer"}}><Icon d={I.arrow} size={16} color={aiBusy?T.subd:"#fff"}/></div></div></Overlay>}
  </>;

  // ---------- экран результата ----------
  if (mode === "result") {
    const ready = allVisible.filter((f) => ans[f.k]);
    return <Wrap onClose={onClose}><SheetHead title="Документ готов" onClose={onClose} />
      <div style={{ maxHeight: "62vh", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
        <div style={{ fontSize: 12, color: T.subd, marginBottom: 12, lineHeight: 1.45 }}>Значения подготовлены в формате официальной формы{cfg.officialUrl ? " — перенесите их на официальный сайт" : ""}. Данные хранятся только на вашем устройстве.</div>
        {ready.map((f) => <div key={f.k} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10.5, color: T.subd }}>{f.en || f.label}</div><div style={{ fontSize: 14, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{val(f)}</div></div>
          <span onClick={async () => { (await copyText(val(f))) ? setToast("Скопировано") : setToast("Не удалось"); }} className="press" style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: T.violet, border: `1px solid ${T.violet}55`, background: T.violet + "14", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>Копировать</span>
        </div>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div onClick={() => { setMode("form"); persist(ans, "draft"); }} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Изменить</div>
        <div onClick={copyAll} className="press" style={{ flex: 1.3, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Скопировать всё</div>
      </div>
      {cfg.officialUrl && <div onClick={() => { try { window.open(cfg.officialUrl, "_blank"); } catch (e) { } }} className="press" style={{ textAlign: "center", fontSize: 12.5, color: T.violet, fontWeight: 700, cursor: "pointer", padding: "12px 0 2px" }}>Открыть официальный сайт →</div>}
    </Wrap>;
  }

  // ---------- экран проверки ----------
  if (mode === "review") {
    return <Wrap onClose={onClose}><SheetHead title="Проверка документа" onClose={onClose} />
      <div style={{ maxHeight: "62vh", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
        {steps.map((st) => {
          const sf = allVisible.filter((f) => f.stepId === st.id && f.req);
          const bad = sf.map((f) => ({ f, err: validateField(f, ans[f.k]) })).filter((x) => x.err);
          return <div key={st.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: bad.length ? "#e0a53a" : T.green }}>
              <span>{bad.length ? "!" : "✓"}</span><span style={{ color: T.text }}>{st.title}</span>
            </div>
            {bad.map(({ f, err }) => <div key={f.k} onClick={() => { setTouched({ ...touched, [f.k]: true }); setMode("form"); goStep(steps.findIndex((s) => s.id === st.id)); }} className="press" style={{ marginLeft: 20, marginTop: 5, fontSize: 12, color: T.subd, cursor: "pointer" }}>• {f.label} — <span style={{ color: "#ff6db0" }}>{err}</span></div>)}
          </div>;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div onClick={() => setMode("form")} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Назад</div>
        <div onClick={() => { if (problems.length) { setTouched(Object.fromEntries(reqAll.map((f) => [f.k, true]))); return setToast("Остались незаполненные поля"); } setMode("result"); persist(ans, "ready"); }} className="press" style={{ flex: 1.3, textAlign: "center", background: problems.length ? T.card : GRAD.cta, border: problems.length ? `1px solid ${T.line}` : "none", borderRadius: 14, padding: 13, color: problems.length ? T.subd : "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Сформировать</div>
      </div>
    </Wrap>;
  }

  // ---------- экран шага ----------
  const last = stepIdx >= steps.length - 1;
  return <Wrap onClose={onClose}>
    <SheetHead title={cfg.title} onClose={onClose} />
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, color: T.violet, fontWeight: 800 }}>Шаг {stepIdx + 1} из {steps.length}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: "Sora,sans-serif", flex: 1 }}>{step.title}</span>
      </div>
      <div style={{ height: 5, background: T.line, borderRadius: 999, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: GRAD.cta, transition: "width .2s" }} /></div>
      <div style={{ fontSize: 10.5, color: T.subd, marginTop: 5 }}>Заполнено {filledReq.length} из {reqAll.length} обязательных полей</div>
    </div>
    <div style={{ maxHeight: fullScreen ? "calc(100dvh - 210px)" : "62vh", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingRight: 2, paddingBottom: fullScreen ? 86 : 2 }}>
      {step.groups.map((g, gi) => {
        const vis = g.fields.filter((f) => fieldVisible(f, ans));
        if (!vis.length) return null;
        return <div key={gi} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
          {g.title && <div style={{ fontSize: 11.5, color: T.subd, fontWeight: 700, marginBottom: 9 }}>{g.title}</div>}
          {vis.map((f) => <React.Fragment key={f.k}>{Field({ f })}</React.Fragment>)}
        </div>;
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: fullScreen ? 8 : 0 }}>
        <div onClick={() => stepIdx === 0 ? onClose() : goStep(stepIdx - 1)} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Назад</div>
        <div onClick={() => { if (last) { setTouched(Object.fromEntries(reqAll.map((f) => [f.k, true]))); setMode("review"); } else goStep(stepIdx + 1); }} className="press" style={{ flex: 1.4, textAlign: "center", background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>{last ? "Проверить документ" : "Продолжить"}</div>
      </div>
      {!fullScreen&&<AiBar/>}
    </div>
    {fullScreen&&<AiBar fixed/>}
  </Wrap>;
}
// какие блоки включены (по источнику создания поездки); старые поездки — все блоки
const tripBlocks = (t) => ({ tickets:true, lodging:true, transport:true, activities:true, docs:true, prep:true, ...(t && t.blocksOn || {}), ...(t && t.lodgingOff ? {lodging:false} : {}) });
const normCountry=(v)=>String(v||"").trim().toLowerCase().replace(/ё/g,"е");
const isDomesticTrip = (t) => {
  if (!t) return false; if (t.domestic === true) return true; if (t.domestic === false) return false;
  const p=store.get("profile",{})||{}, home=normCountry(p.homeCountry), dest=normCountry(t.destinationCountry||t.country);
  return !!home && !!dest && home===dest;
};
const tripDocs = (t) => {
  const domestic=isDomesticTrip(t);
  const remote=visaRulesRemote()[t&&t.country]||null;
  const remoteDocs=remote&&Array.isArray(remote.documents)?remote.documents.map((d,i)=>({id:String(d.id||`remote_${i}`),name:String(d.name||"Документ"),E:Number.isFinite(Number(d.E))?Number(d.E):9999,P:Number.isFinite(Number(d.P))?Number(d.P):0,country:t.country,required:d.required!==false,checkedAt:String(d.checkedAt||remote.checkedAt||remote.updatedAt||"").slice(0,30),info:{type:String(d.type||""),desc:String(d.desc||d.description||""),req:Array.isArray(d.req)?d.req.map(x=>String(x)).slice(0,30):[],links:Array.isArray(d.links)?d.links.filter(x=>x&&x.url).map(x=>({label:String(x.label||"Официальный источник"),url:String(x.url)})).slice(0,10):[]}})):null;
  const base = domestic ? [] : (remoteDocs || DOC_MATRIX[t.country] || DOC_BASE);
  const extra = (t.docsExtra || []).map((id) => ALL_DOCS.find((x) => x.id === id)).filter((x) => x && !base.some((b) => b.id === x.id));
  return [...base, ...extra];
};
const docInfoFor=(doc)=>{const base=DOC_INFO[doc&&doc.id]||{},ri=doc&&doc.info&&typeof doc.info==="object"?doc.info:{};return{...base,...ri,req:Array.isArray(ri.req)&&ri.req.length?ri.req:(base.req||[]),links:Array.isArray(ri.links)&&ri.links.length?ri.links:(base.links||[])};};
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
// Документы — личная готовность каждого путешественника. Для старых поездок общий check используется
// только пока никто ещё не начал отмечать документ персонально.
function tripDocCompletion(t, doc) {
  const travelers=(t&&t.travelers||[]).filter(x=>x&&x.active!==false), states=t&&t.travelerStates||{}, general=!!(t&&t.checks&&t.checks.docs&&t.checks.docs[doc.id]);
  if(!travelers.length)return{done:general?1:0,total:1,all:general};
  const personalized=travelers.some(tr=>states[tr.id]&&states[tr.id].docs&&Object.prototype.hasOwnProperty.call(states[tr.id].docs,doc.id));
  let done=0;for(const tr of travelers){const ds=states[tr.id]&&states[tr.id].docs;const v=personalized?(ds&&Object.prototype.hasOwnProperty.call(ds,doc.id)?!!ds[doc.id]:false):general;if(v)done++;}
  return{done,total:travelers.length,all:done===travelers.length};
}
// прогресс: билеты + жильё + обязательные документы всех путешественников + критичный транспорт/сборы.
function tripProgress(t) {
  const b=tripBlocks(t), checks=t.checks||{}, docChecks=checks.docs||{}, svcChecks=checks.services||{};
  const docs=b.docs?tripDocs(t):[], groups=[];
  const hasFlight=!!t.route||(t.flightJourneys||[]).length>0||(t.manualFlights||[]).length>0;
  if(b.tickets&&hasFlight) groups.push({w:25,items:[["tickets",!!checks.tickets]]});
  if(b.lodging){const hasStay=(t.stays||[]).length>0,needsStop=!!(t.route&&t.route.stopover);if(hasStay||needsStop){const xs=hasStay?(t.stays||[]).map(x=>["stay:"+x.id,!!x.done]):[["lodgeStop",!!checks.lodgeStop]];groups.push({w:25,items:xs});}}
  const requiredDocs=docs.filter(d=>d.required!==false); if(b.docs&&requiredDocs.length){const docItems=[];for(const d of requiredDocs){const c=tripDocCompletion(t,d);for(let i=0;i<c.total;i++)docItems.push([`doc:${d.id}:${i}`,i<c.done]);}groups.push({w:25,items:docItems});}
  if(b.transport&&(t.transport||[]).length) groups.push({w:15,items:(t.transport||[]).map(x=>["transport:"+x.id,!!x.done])});
  const prep=[...(t.custom||[]).filter(x=>!x.budgetOnly&&x.required!==false).map(x=>["c:"+x.id,!!x.done]),...(t.servicesAdded||[]).map(id=>["svc:"+id,!!svcChecks[id]])]; if(b.prep&&prep.length)groups.push({w:10,items:prep});
  const requiredActs=(t.activities||[]).filter(x=>x.required===true); if(b.activities&&requiredActs.length)groups.push({w:10,items:requiredActs.map(x=>["activity:"+x.id,!!x.done])});
  if(!groups.length)return{done:0,total:0,pct:100};
  let weight=0,score=0,done=0,total=0;for(const g of groups){const n=g.items.length||1,dn=g.items.filter(([,v])=>v).length;weight+=g.w;score+=g.w*(dn/n);done+=dn;total+=g.items.length;}
  return{done,total,pct:Math.round(score/weight*100)};
}
// «следующее действие»: одно конкретное действие, согласованное с readiness
function nextAction(t) {
  const b = tripBlocks(t), checks = t.checks || {}, docChecks = checks.docs || {}, svcChecks = checks.services || {};
  const docs = b.docs ? tripDocs(t) : [], d = daysTo(t.df);
  const hasFlight = !!t.route || (t.flightJourneys || []).length > 0 || (t.manualFlights || []).length > 0;
  const un = docs.filter((x) => x.required!==false).map(x=>({x,c:tripDocCompletion(t,x)})).filter(r=>!r.c.all);
  const stOf = (x) => docStatus(x, t.df);
  const urgent = un.find((r) => ["urgent", "late"].includes(stOf(r.x).key));
  if (urgent) return { block: "docs", title: `Срочно: ${urgent.x.name}`, sub: `${urgent.c.done} из ${urgent.c.total} готовы${d != null ? ` · вылет через ${d} дн.` : ""}`, btn: "К документам", act: "docs", tone: "#f59640" };
  if (b.tickets && hasFlight && !checks.tickets) return { block: "tickets", title: "Подтвердите покупку билетов", sub: "перелёт уже в плане", btn: "К билетам", act: "tickets", tone: T.violet };
  const now = un.filter((r) => stOf(r.x).key === "now").sort((a, b) => (b.x.P || 0) - (a.x.P || 0))[0];
  if (now) return { block: "docs", title: `Пора: ${now.x.name}`, sub: `${now.c.done} из ${now.c.total} готовы${now.x.P ? ` · оформление ${now.x.P} дн.` : ""}`, btn: "К документам", act: "docs", tone: T.violet };
  if (b.lodging && !t.lodgingOff) {
    const pendingStay=(t.stays||[]).find((x)=>!x.done);
    if (pendingStay) return { block:"lodging", title:`Жильё: ${pendingStay.name}`, sub:"ещё не подтверждено", btn:null, act:null, tone:T.violet };
    if (!(t.stays||[]).length && t.route && t.route.stopover && !checks.lodgeStop) return { block: "lodging", title: "Нужно жильё на пересадке", sub: "в маршруте есть ночная остановка", btn: "К отелям", act: "hotels", tone: T.violet };
  }
  const transport = (t.transport || []).find((x) => !x.done);
  if (transport) return { block: "transport", title: `Транспорт: ${transport.name}`, sub: "ещё не подтверждено", btn: null, act: null, tone: T.cyan };
  const activity = (t.activities || []).find((x) => !x.done);
  if (activity) return { block: "activities", title: `Решите: ${activity.name}`, sub: "активность ещё не подтверждена", btn: null, act: null, tone: T.cyan };
  const custom = (t.custom || []).find((x) => !x.done);
  if (custom) return { block: "prep", title: custom.name, sub: "осталось сделать перед поездкой", btn: null, act: null, tone: T.cyan };
  const sun = (t.servicesAdded || []).find((id) => !svcChecks[id]);
  if (sun) { const s = EXTRA_SERVICES.find((x) => x.id === sun); return { block: "services", title: `Оформите: ${s ? s.title : sun}`, sub: "добавлено в план поездки", btn: "К услугам", act: "services", tone: T.cyan }; }
  const early = un.map((r) => ({ x:r.x, c:r.c, s: stOf(r.x) })).find((e) => e.s.key === "early");
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

function TripCard({ t, onOpen, soonest }) {
  const p = tripProgress(t), act = nextAction(t), d = daysTo(t.df);
  const badge = (d != null && soonest) ? { txt: "Ближайшая поездка", col: "#ff7a59", ic: "🔥" } : (d != null ? { txt: "Будущая поездка", col: T.cyan, ic: "✈️" } : null);
  return <div onClick={onOpen} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 12, marginBottom: 10, cursor: "pointer" }}>
    {badge && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: badge.col + "1e", border: `1px solid ${badge.col}55`, borderRadius: 999, padding: "3px 9px", marginBottom: 10 }}><span style={{ fontSize: 10 }}>{badge.ic}</span><span style={{ fontSize: 10.5, fontWeight: 800, color: badge.col, letterSpacing: .2 }}>{badge.txt}</span></div>}
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

function sharedRouteSegments(route) {
  const out = [], seen = new Set();
  const add = (arr) => { if (Array.isArray(arr)) for (const s of arr) if (s && s.mode !== "ferry") { const k=[s.flightNumber,s.fromCode,s.toCode,s.departISO,s.direction].join("|"); if(!seen.has(k)){seen.add(k);out.push(s);} } };
  if (!route) return out;
  add(route.segments);
  if (route.outbound) add(route.outbound.segments);
  if (route.return) add(route.return.segments);
  if (route.returnRoute) add(route.returnRoute.segments);
  return out;
}
function memberInitials(m) {
  const n = String((m && (m.displayName || [m.firstName, m.lastName].filter(Boolean).join(" "))) || "?").trim();
  return n.split(/\s+/).slice(0,2).map((x)=>x[0]).join("").toUpperCase() || "?";
}
const COST_CURRENCIES = ["EUR","USD","RUB","NOK","JPY","GBP","AED","TRY","CNY","THB"];
const currencySymbol = (c) => ({EUR:"€",USD:"$",RUB:"₽",NOK:"NOK",JPY:"¥",GBP:"£",AED:"AED",TRY:"₺",CNY:"¥",THB:"฿"}[String(c||"").toUpperCase()] || String(c||"EUR").toUpperCase());
const money = (n,c) => {
  const v=Number(n); if(!Number.isFinite(v)) return "—";
  const cur=String(c||"EUR").toUpperCase();
  const rounded=Math.abs(v)>=1000?Math.round(v):Math.round(v*100)/100;
  if(cur==="RUB") return `${rounded.toLocaleString("ru-RU")} ₽`;
  if(["EUR","USD","JPY","GBP","TRY","CNY","THB"].includes(cur)) return `${currencySymbol(cur)}${rounded.toLocaleString("ru-RU")}`;
  return `${rounded.toLocaleString("ru-RU")} ${cur}`;
};
function activeTravelers(t) {
  const raw=Array.isArray(t&&t.travelers)?t.travelers.filter((x)=>x&&x.active!==false):[];
  if(raw.length) return raw;
  const cnt=Math.max(1,Number(t&&t.travelerTarget)||Number(t&&t.adults)||1);
  return Array.from({length:cnt},(_,i)=>({id:`legacy_tr_${i+1}`,name:i===0?"Вы":`Путешественник ${i+1}`,memberId:i===0&&t&&t._viewer?t._viewer.id:null,active:true}));
}
function itemSplitIds(t,x) {
  const ids=Array.isArray(x&&x.splitTravelerIds)?x.splitTravelerIds.filter(Boolean):[];
  return ids.length?ids:activeTravelers(t).map((tr)=>tr.id);
}
function itemCost(t,x) {
  const a=Number(x&&x.priceAmount); if(!(a>0)) return null;
  const ids=itemSplitIds(t,x), mode=x&&x.pricingMode==="per_person"?"per_person":"total";
  return { amount:a, currency:String(x.currency||t.baseCurrency||"EUR").toUpperCase(), splitIds:ids, total:mode==="per_person"?a*Math.max(1,ids.length):a, mode, paidByTravelerId:x.paidByTravelerId||null };
}
function budgetItems(t) {
  const rows=[];
  const push=(kind,x,name)=>{const c=itemCost(t,x);if(c)rows.push({kind,id:x.id||kind,name:name||x.name||kind,...c,raw:x});};
  const pricedJourneys=(t.flightJourneys||[]).filter((x)=>Number(x.priceAmount)>0);
  if(!pricedJourneys.length && t.route && Number(t.route.total)>0) rows.push({kind:"route",id:"route",name:"Билеты · оценка TripWise",amount:Number(t.route.total),currency:"RUB",splitIds:activeTravelers(t).map((x)=>x.id),total:Number(t.route.total),mode:"total",paidByTravelerId:null,estimate:true,raw:t.route});
  for(const x of (t.flightJourneys||[])) push("journey",x,x.name||"Перелёт");
  for(const x of (t.stays||[])) push("stays",x,x.name||"Жильё");
  for(const x of (t.transport||[])) push("transport",x,x.name||"Транспорт");
  for(const x of (t.activities||[])) push("activities",x,x.name||"Активность");
  for(const x of (t.custom||[])) push("custom",x,x.name||"Расход");
  return rows;
}
function itemPayments(t,it) {
  const src=it&&it.raw?it.raw:it;
  const c=itemCost(t,src); if(!c)return [];
  const rows=Array.isArray(src&&src.payments)?src.payments.filter((x)=>x&&x.travelerId&&Number(x.amount)>0).map((x)=>({travelerId:x.travelerId,amount:Number(x.amount)})):[];
  if(rows.length)return rows;
  return c.paidByTravelerId?[{travelerId:c.paidByTravelerId,amount:c.total}]:[];
}
function fxToBase(t,currency,amount) {
  const base=String(t&&t.baseCurrency||"EUR").toUpperCase(), cur=String(currency||base).toUpperCase(), v=Number(amount);
  if(!Number.isFinite(v))return null; if(cur===base)return v;
  const fx=t&&t.fxSnapshot; if(!fx||String(fx.base||"").toUpperCase()!==base)return null;
  const rate=Number(fx.rates&&fx.rates[cur]); return rate>0?v/rate:null;
}
function budgetSummary(t) {
  const trs=activeTravelers(t), allTrs=Array.isArray(t&&t.travelers)&&t.travelers.length?t.travelers:trs, names=Object.fromEntries(allTrs.map((x)=>[x.id,x.name]));
  const me=trs.find((x)=>t&&t._viewer&&String(x.memberId||"")===String(t._viewer.id||""));
  const groups={};
  for(const it of budgetItems(t)) {
    const g=groups[it.currency]||(groups[it.currency]={currency:it.currency,total:0,paid:0,shares:{},balances:{},items:[],settled:0});
    const payments=itemPayments(t,it); it.payments=payments; it.paidAmount=payments.reduce((a,x)=>a+Number(x.amount||0),0);
    g.total+=it.total; g.paid+=it.paidAmount; g.items.push(it);
    const ids=it.splitIds.length?it.splitIds:trs.map((x)=>x.id), share=ids.length?it.total/ids.length:it.total;
    for(const id of ids){g.shares[id]=(g.shares[id]||0)+share;g.balances[id]=(g.balances[id]||0)-share;}
    for(const pay of payments)g.balances[pay.travelerId]=(g.balances[pay.travelerId]||0)+Number(pay.amount||0);
  }
  for(const x of (t.settlementPayments||[])) {
    const cur=String(x.currency||t.baseCurrency||"EUR").toUpperCase(), amt=Number(x.amount||0); if(!(amt>0))continue;
    const g=groups[cur]||(groups[cur]={currency:cur,total:0,paid:0,shares:{},balances:{},items:[],settled:0});
    g.balances[x.fromTravelerId]=(g.balances[x.fromTravelerId]||0)+amt;
    g.balances[x.toTravelerId]=(g.balances[x.toTravelerId]||0)-amt; g.settled+=amt;
  }
  let baseTotal=0,basePaid=0,baseKnown=true;
  for(const g of Object.values(groups)) {
    g.unpaidProvider=Math.max(0,g.total-g.paid);
    const debtors=Object.entries(g.balances).filter(([,v])=>v<-.005).map(([id,v])=>({id,amount:-v})).sort((a,b)=>b.amount-a.amount);
    const creditors=Object.entries(g.balances).filter(([,v])=>v>.005).map(([id,v])=>({id,amount:v})).sort((a,b)=>b.amount-a.amount);
    const settlements=[];let i=0,j=0;
    while(i<debtors.length&&j<creditors.length){const amt=Math.min(debtors[i].amount,creditors[j].amount);if(amt>.01)settlements.push({from:debtors[i].id,to:creditors[j].id,amount:amt,currency:g.currency});debtors[i].amount-=amt;creditors[j].amount-=amt;if(debtors[i].amount<.01)i++;if(creditors[j].amount<.01)j++;}
    g.settlements=settlements;g.myShare=me?(g.shares[me.id]||0):0;g.myBalance=me?(g.balances[me.id]||0):0;
    g.baseTotal=fxToBase(t,g.currency,g.total);g.basePaid=fxToBase(t,g.currency,g.paid);
    if(g.baseTotal==null)baseKnown=false;else baseTotal+=g.baseTotal; if(g.basePaid!=null)basePaid+=g.basePaid;
  }
  return {groups:Object.values(groups),items:budgetItems(t),names,me,baseCurrency:String(t.baseCurrency||"EUR").toUpperCase(),baseTotal:baseKnown?baseTotal:null,basePaid:baseKnown?basePaid:null};
}
function tripTimeline(t) {
  const out=[],seen=new Set();
  const add=(e)=>{if(!e||!e.date)return;const k=[e.type,e.title,e.date,e.time,e.endTime].join("|");if(seen.has(k))return;seen.add(k);const sortTime=e.sortTime||e.time||(e.type==="trip-start"?"00:00":e.type==="trip-end"?"23:58":"23:59");out.push({...e,sort:`${e.date}T${sortTime}`});};
  const startDate=String(t&&t.df||"").slice(0,10),endDate=String(t&&t.dt||t&&t.df||"").slice(0,10);
  if(startDate)add({id:"trip-start",type:"trip-start",date:startDate,sortTime:"00:00",title:"Начало поездки",sub:[t.ocName&&t.dcName?`${t.ocName} → ${t.dcName}`:"",t.dcName||t.country||""].filter(Boolean).join(" · "),location:t.dcName||""});
  const addFlight=(x,idx,src)=>{if(!x)return;const date=String(x.departISO||x.date||"").slice(0,10),time=(x.departTime||x.departHM||String(x.departISO||"").slice(11,16)||"").slice(0,5);if(!date)return;const arriveDate=String(x.arriveISO||"").slice(0,10),arriveTime=(x.arriveTime||x.arriveHM||String(x.arriveISO||"").slice(11,16)||"").slice(0,5);add({id:`fl-${src}-${idx}`,type:"flight",date,time,endTime:arriveTime,title:`${prettyFlightNumber(x.flightNumber)||"Перелёт"}`,sub:[x.fromCode&&x.toCode?`${x.fromCode} → ${x.toCode}`:"",x.aircraft||""].filter(Boolean).join(" · "),location:x.fromName||x.fromCode||"",raw:x});if(arriveDate&&arriveDate!==date)add({id:`fl-arr-${src}-${idx}`,type:"flight-arrival",date:arriveDate,time:arriveTime,title:`Прилёт · ${prettyFlightNumber(x.flightNumber)||"рейс"}`,sub:x.toCode||x.toName||"",location:x.toName||x.toCode||"",raw:x});};
  sharedRouteSegments(t.route).forEach((x,i)=>addFlight(x,i,"route"));
  (t.flightJourneys||[]).forEach((j,ji)=>(j.legs||[]).forEach((x,i)=>addFlight(x,`${ji}-${i}`,"journey")));
  (t.manualFlights||[]).forEach((x,i)=>addFlight(x,i,"manual"));
  for(const x of (t.stays||[])){if(x.startDate)add({id:`stay-in-${x.id}`,type:"stay",date:x.startDate,time:x.startTime||"15:00",title:`Заезд · ${x.name}`,sub:x.location||"",location:x.location||x.name,raw:x});if(x.endDate)add({id:`stay-out-${x.id}`,type:"stay-out",date:x.endDate,time:x.endTime||"11:00",title:`Выезд · ${x.name}`,sub:x.location||"",location:x.location||x.name,raw:x});}
  for(const x of (t.transport||[])){
    if(x.startDate)add({id:`transport-${x.id}`,type:"transport",date:x.startDate,time:x.startTime||"",endTime:x.endDate&&x.endDate===x.startDate?(x.endTime||""):"",title:x.name,sub:x.location||x.notes||"",location:x.location||"",raw:x});
    if(x.endDate&&x.endDate!==x.startDate)add({id:`transport-end-${x.id}`,type:"transport-end",date:x.endDate,time:x.endTime||"",title:`Завершение · ${x.name}`,sub:x.location||x.notes||"",location:x.location||"",raw:x});
  }
  for(const x of (t.activities||[]))if(x.startDate)add({id:`activity-${x.id}`,type:"activity",date:x.startDate,time:x.startTime||"",endTime:x.endTime||"",title:x.name,sub:x.location||x.notes||"",location:x.location||"",raw:x});
  // Сборы и документы намеренно не превращаем в десятки событий. Они показываются одной
  // агрегированной карточкой подготовки над таймлайном.
  if(endDate)add({id:"trip-end",type:"trip-end",date:endDate,sortTime:"23:58",title:"Завершение поездки",sub:t.dcName||t.country||"",location:t.dcName||""});
  return out.sort((a,b)=>a.sort.localeCompare(b.sort));
}
function travelerReadiness(t,tr,budget) {
  const docs=tripBlocks(t).docs?tripDocs(t):[], globalDocs=(t.checks&&t.checks.docs)||{}, state=(t.travelerStates&&t.travelerStates[tr.id])||{}, stateDocs=state.docs||{};
  const items=[];
  for(const doc of docs.filter((d)=>d.required!==false)){const done=stateDocs[doc.id]!==undefined?!!stateDocs[doc.id]:!!globalDocs[doc.id];items.push({id:`doc:${doc.id}`,label:doc.name,done,kind:"doc"});}
  const memberId=String(tr.memberId||"");
  if(memberId)for(const q of (t.askGroup||[]).filter((x)=>x.status==="open"))items.push({id:`ask:${q.id}`,label:`Ответить: ${q.title}`,done:!!(q.votes&&q.votes[memberId]),kind:"ask"});
  for(const task of (state.tasks||[]))items.push({id:`task:${task.id}`,label:task.name,done:!!task.done,kind:"task"});
  if(budget)for(const g of budget.groups||[]){const bal=Number(g.balances&&g.balances[tr.id]||0);if(bal<-.01)items.push({id:`debt:${g.currency}`,label:`Рассчитаться · ${money(-bal,g.currency)}`,done:false,kind:"money"});}
  const done=items.filter((x)=>x.done).length;return{items,done,total:items.length,pct:items.length?Math.round(done/items.length*100):100};
}
function isoOffsetMinutes(v) {
  const x=String(v||"").trim(); if(!x)return null; if(/Z$/i.test(x))return 0;
  const m=x.match(/([+-])(\d{2}):?(\d{2})$/); if(!m)return null; const n=(Number(m[2])*60+Number(m[3]))*(m[1]==="-"?-1:1); return Number.isFinite(n)?n:null;
}
function tripClock(t) {
  const refs=[],push=(v)=>{const off=isoOffsetMinutes(v),ms=Date.parse(v);if(off!=null&&Number.isFinite(ms))refs.push({off,ms});};
  for(const x of sharedRouteSegments(t&&t.route)) { push(x&&x.departISO); push(x&&x.arriveISO); }
  for(const j of (t&&t.flightJourneys||[])) for(const x of (j&&j.legs||[])){push(x&&x.departISO);push(x&&x.arriveISO);}
  for(const x of (t&&t.manualFlights||[])){push(x&&x.departISO);push(x&&x.arriveISO);}
  const now=Date.now(); refs.sort((a,b)=>a.ms-b.ms); const past=refs.filter((x)=>x.ms<=now),off=past.length?past[past.length-1].off:(refs.length?refs[0].off:null);
  if(off==null){const d=new Date();return{today:iso(d),hm:`${pad(d.getHours())}:${pad(d.getMinutes())}`,offsetMinutes:null};}
  const d=new Date(now+off*60000);return{today:`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,hm:`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,offsetMinutes:off};
}
function tripTodayState(t) {
  const clock=tripClock(t),today=clock.today,active=!!t.df&&today>=String(t.df).slice(0,10)&&today<=String(t.dt||t.df).slice(0,10),timeline=tripTimeline(t),todayEvents=timeline.filter((x)=>x.date===today);
  const next=todayEvents.find((x)=>!x.time||x.time>=clock.hm)||null;
  return{today,active,timeline,todayEvents,next,nowHM:clock.hm,offsetMinutes:clock.offsetMinutes};
}

function prettyFlightNumber(v){const n=String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");const m=n.match(/^([A-Z0-9]{2})([0-9]{1,4}[A-Z]?)$/);return m?`${m[1]} ${m[2]}`:n;}
function legGapMin(a,b){try{const x=new Date(a&&a.arriveISO||0),y=new Date(b&&b.departISO||0),m=Math.round((y-x)/60000);return Number.isFinite(m)&&m>0&&m<1440?m:null;}catch(e){return null;}}
function journeyWarnings(legs){const out=[];for(let i=1;i<(legs||[]).length;i++){const a=legs[i-1]||{},b=legs[i]||{};if(a.toCode&&b.fromCode&&String(a.toCode).toUpperCase()!==String(b.fromCode).toUpperCase())out.push(`Между рейсами смена аэропорта: ${a.toCode} → ${b.fromCode}`);try{if(a.arriveISO&&b.departISO&&new Date(b.departISO)<=new Date(a.arriveISO))out.push(`Проверьте порядок рейсов ${prettyFlightNumber(a.flightNumber)} → ${prettyFlightNumber(b.flightNumber)}: время пересекается`);}catch(e){}}return out;}

function SharedTripScreen({ t, initialBlk, onBack, onUpdate, onDelete, onLeaveTrip, onFindTickets, goHotels, goDocs, setToast, onReplaceTrip, onUndoable, syncState="saved", bottomStr = "0px" }) {
  const p = tripProgress(t), d = daysTo(t.df), act = nextAction(t), bOn = tripBlocks(t), docs = bOn.docs ? tripDocs(t) : [];
  const isCreator = t._viewer ? !!t._viewer.isCreator : true;
  const members = (t.members && t.members.length) ? t.members : [{ id: "local", displayName: "Вы" }];
  const meId = t._viewer && String(t._viewer.id || "");
  const travelers = activeTravelers(t), budget = budgetSummary(t), today = tripTodayState(t);
  const viewerTraveler = budget.me || travelers.find((x) => String(x.memberId || "") === meId) || null;

  const [mode, setMode] = useState(initialBlk === "group" ? "group" : "trip");
  const [open, setOpen] = useState(() => ({ tickets: initialBlk === "tickets", lodging: initialBlk === "lodging", transport: false, activities: false, docs: initialBlk === "docs", prep: initialBlk === "extras", timeline: false }));
  const [peopleOpen, setPeopleOpen] = useState(false), [travelerOpen, setTravelerOpen] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false), [budgetOpen, setBudgetOpen] = useState(initialBlk === "budget"), [timelineOpen, setTimelineOpen] = useState(initialBlk === "timeline"), [activityOpen, setActivityOpen] = useState(initialBlk === "activity");
  const [renameValue, setRenameValue] = useState(t.title || ""), [inviteOpen, setInviteOpen] = useState(false), [inviteUrl, setInviteUrl] = useState("");
  const [askOpen, setAskOpen] = useState(false), [askTitle, setAskTitle] = useState(""), [askDesc, setAskDesc] = useState(""), [askType, setAskType] = useState("yesno"), [askOptions, setAskOptions] = useState(["Да", "Нет"]);
  const emptyCost = () => ({ name: "", priceAmount: "", currency: t.baseCurrency || "EUR", pricingMode: "total", splitTravelerIds: travelers.map((x) => x.id), payments: [], startDate: "", endDate: "", startTime: "", endTime: "", location: "", notes: "" });
  const [addSec, setAddSec] = useState(null), [addForm, setAddForm] = useState(emptyCost());
  const [editCost, setEditCost] = useState(null), [travelerName, setTravelerName] = useState("");
  const [flightOpen, setFlightOpen] = useState(false), [journeyLegs, setJourneyLegs] = useState([{ flightNumber: "", date: t.df || "" }]);
  const [flightExpanded,setFlightExpanded]=useState({});
  const [journeyCost, setJourneyCost] = useState(emptyCost());
  const [docOpen, setDocOpen] = useState(() => {
    if (typeof initialBlk !== "string" || !initialBlk.startsWith("document:")) return null;
    const docId = initialBlk.slice("document:".length);
    return docs.find((x) => String(x.id) === String(docId)) || null;
  }), [docWizard, setDocWizard] = useState(null);
  const [chatOpen, setChatOpen] = useState(false), [chatText, setChatText] = useState(""), [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", text: `Я знаю план «${t.title}». Спроси про готовность, бюджет, рейсы, таймлайн или решения группы.` }]);
  const [fxBusy, setFxBusy] = useState(false), [baseDraft, setBaseDraft] = useState(t.baseCurrency || "EUR");
  const [settleBusy, setSettleBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false), [importText, setImportText] = useState(""), [importBusy, setImportBusy] = useState(false), [importResult, setImportResult] = useState(null);
  const [activitySeen, setActivitySeen] = useState(() => store.get(`activity_seen_${t.id}`, ""));
  const [confirmDanger, setConfirmDanger] = useState(null);
  const [docsExpanded, setDocsExpanded] = useState(initialBlk === "docs");
  const [addPlanOpen,setAddPlanOpen]=useState(false);
  const [hiddenSectionsOpen,setHiddenSectionsOpen]=useState(false), holdTimer=useRef(null), holdTriggered=useRef(false);
  const [transferTo,setTransferTo]=useState(""),[transferBusy,setTransferBusy]=useState(false);
  const [chatLoaded,setChatLoaded]=useState(false),[chatPending,setChatPending]=useState(false);
  const [publishOpen,setPublishOpen]=useState(false),[publishBusy,setPublishBusy]=useState(false);
  const publication=t.publication&&typeof t.publication==="object"?t.publication:{};
  const publicBudgetAuto=budget.baseTotal!=null&&travelers.length?Math.round(budget.baseTotal/Math.max(1,travelers.length)):"";
  const defaultPubForm=()=>({description:publication.description||"",freeSeats:Math.max(1,(Number(publication.capacity)||travelers.length+2)-travelers.length),budgetMin:publication.budgetMin||publicBudgetAuto,budgetMax:publication.budgetMax||publicBudgetAuto,currency:publication.currency||budget.baseCurrency||t.baseCurrency||"RUB",costMode:publication.costMode||"split",covered:Array.isArray(publication.covered)?publication.covered:[],tags:Array.isArray(publication.tags)?publication.tags:[],preferredGender:publication.preferredGender||"any",ageMin:publication.ageMin||18,ageMax:publication.ageMax||45});
  const [pubForm,setPubForm]=useState(defaultPubForm);

  const upd = (fn) => onUpdate(t.id, fn);
  const creatorUpd = (fn) => { if(!isCreator){setToast("Это может изменить только создатель поездки");return;} onUpdate(t.id,fn); };
  const replace = (trip) => { if (trip) onReplaceTrip(trip); };
  const checks = t.checks || {}, docChecks = checks.docs || {}, svcChecks = checks.services || {};
  const stays = t.stays || [], timeline = today.timeline;
  const legacyLodgeTotal = bOn.lodging && !t.lodgingOff ? 1 + (t.route && t.route.stopover ? 1 : 0) : 0;
  const lodgeTotal = stays.length ? stays.length : legacyLodgeTotal;
  const lodgeDone = stays.length ? stays.filter((x) => x.done).length : (legacyLodgeTotal ? ((checks.lodgeMain ? 1 : 0) + (t.route && t.route.stopover && checks.lodgeStop ? 1 : 0)) : 0);
  const docsRequired=docs.filter(x=>x.required!==false), docsUnits=docsRequired.reduce((a,d)=>{const c=tripDocCompletion(t,d);return{done:a.done+c.done,total:a.total+c.total};},{done:0,total:0});
  const docsDone = docsUnits.done;
  const openAskCount=(t.askGroup||[]).filter(x=>x.status==="open").length;
  const viewerDebtCount=budget.groups.reduce((n,g)=>n+(Number(g.myBalance||0)<-.01?1:0),0);
  const timelinePrep=[
    ...(docsUnits.total?[{icon:"📄",label:"Документы",value:`${docsDone}/${docsUnits.total}`,ok:docsDone===docsUnits.total}]:[]),
    ...(openAskCount?[{icon:"👥",label:"Решения группы",value:String(openAskCount),ok:false}]:[]),
    ...(viewerDebtCount?[{icon:"💸",label:"Расчёты",value:`${viewerDebtCount} открыто`,ok:false}]:[]),
  ];
  const prepItems = [
    ...(t.servicesAdded || []).map((id) => ({ id: "svc:" + id, name: (EXTRA_SERVICES.find((x) => x.id === id) || {}).title || id, done: !!svcChecks[id], kind: "svc", raw: id })),
    ...(t.custom || []).filter(x=>!x.budgetOnly).map((x) => ({ id: "custom:" + x.id, name: x.name, done: !!x.done, kind: "custom", raw: x.id, item: x })),
  ];
  const routeSegs = sharedRouteSegments(t.route), manualJourneys = t.flightJourneys || [], legacyFlights = t.manualFlights || [];
  const flightCount = routeSegs.length + manualJourneys.reduce((n, j) => n + (j.legs || []).length, 0) + legacyFlights.length;
  const latestActivity = (t.activityLog || [])[0];
  const unseenActivity = (t.activityLog || []).filter((e) => !activitySeen || String(e.createdAt || "") > String(activitySeen)).length;

  const startAdd = (kind) => { setAddSec(kind); setAddForm(emptyCost()); };
  const toggleSplit = (setter, id) => setter((f) => ({ ...f, splitTravelerIds: (f.splitTravelerIds || []).includes(id) ? f.splitTravelerIds.filter((x) => x !== id) : [...(f.splitTravelerIds || []), id] }));
  const normalizePayments = (form) => (form.payments || []).map((x) => ({ travelerId: x.travelerId, amount: Number(x.amount) || 0 })).filter((x) => x.travelerId && x.amount > 0);
  const addPlanItem = () => {
    const name = addForm.name.trim(); if (!name || !addSec) { setToast("Введите название"); return; }
    const budgetOnly=addSec==="expense", key=budgetOnly?"custom":addSec;
    const item = { id: (budgetOnly?"e":key[0]) + Date.now(), name, done: budgetOnly, status: budgetOnly?"confirmed":"saved", budgetOnly, required:budgetOnly?false:undefined, priceAmount: Number(addForm.priceAmount) || null, currency: addForm.currency || "EUR", pricingMode: addForm.pricingMode || "total", splitTravelerIds: (addForm.splitTravelerIds || []).length ? addForm.splitTravelerIds : travelers.map((x) => x.id), payments: normalizePayments(addForm), startDate: addForm.startDate || "", endDate: addForm.endDate || "", startTime: addForm.startTime || "", endTime: addForm.endTime || "", location: addForm.location || "", notes: addForm.notes || "", createdAt: new Date().toISOString() };
    upd((x) => { const block=key==="stays"?"lodging":key==="custom"?(budgetOnly?null:"prep"):key; return ({ ...x, [key]: [...(x[key] || []), item], baseCurrency: x.baseCurrency || addForm.currency || "EUR", ...(block?{blocksOn:{...tripBlocks(x),[block]:true},...(block==="lodging"?{lodgingOff:false}:{})}:{}) }); }); setAddSec(null);
  };
  const patchArrayItem = (key, id, patch) => upd((x) => ({ ...x, [key]: (x[key] || []).map((y) => y.id === id ? { ...y, ...patch } : y) }));
  const toggleArr = (key, id) => { const cur=(t[key]||[]).find((x)=>x.id===id); const done=!cur?.done; patchArrayItem(key,id,{done,status:done?"confirmed":"saved"}); };
  const toggleDoc = (id) => upd((x) => ({ ...x, checks: { ...x.checks, docs: { ...(x.checks && x.checks.docs || {}), [id]: !(x.checks && x.checks.docs && x.checks.docs[id]) } } }));
  const togglePrep = (it) => { if (it.kind === "svc") upd((x) => ({ ...x, checks: { ...x.checks, services: { ...(x.checks && x.checks.services || {}), [it.raw]: !(x.checks && x.checks.services && x.checks.services[it.raw]) } } })); else patchArrayItem("custom", it.raw, { done: !it.done }); };
  const openCost = (kind, item) => {
    const c = itemCost(t, item), payments = itemPayments(t, item).map((x) => ({ travelerId: x.travelerId, amount: String(x.amount) }));
    setEditCost({ kind, id: item.id, ...item, priceAmount: item.priceAmount || "", currency: item.currency || t.baseCurrency || "EUR", pricingMode: item.pricingMode || "total", splitTravelerIds: itemSplitIds(t, item), payments, startDate: item.startDate || "", endDate: item.endDate || "", startTime: item.startTime || "", endTime: item.endTime || "", location: item.location || "", notes: item.notes || "", _total: c && c.total });
  };
  const saveCost = () => {
    if (!editCost) return;
    const patch = { name: String(editCost.name || "").trim() || "Пункт", status: editCost.status || (editCost.done ? "confirmed" : "saved"), priceAmount: Number(editCost.priceAmount) || null, currency: editCost.currency || "EUR", pricingMode: editCost.pricingMode || "total", splitTravelerIds: (editCost.splitTravelerIds || []).length ? editCost.splitTravelerIds : travelers.map((x) => x.id), payments: normalizePayments(editCost), paidByTravelerId: null, startDate: editCost.startDate || "", endDate: editCost.endDate || "", startTime: editCost.startTime || "", endTime: editCost.endTime || "", location: editCost.location || "", notes: editCost.notes || "" };
    if (editCost.kind === "journey") patchArrayItem("flightJourneys", editCost.id, patch); else patchArrayItem(editCost.kind, editCost.id, patch); setEditCost(null);
  };
  const removePlanItem = (row) => {
    if (!row) return;
    const key=row.kind === "journey" ? "flightJourneys" : row.kind;
    const source=(t[key]||[]), idx=source.findIndex((x)=>x.id===row.id), removed=source[idx];
    if (!removed) return;
    upd((x)=>({...x,[key]:(x[key]||[]).filter((y)=>y.id!==row.id)})); setEditCost(null);
    onUndoable && onUndoable("Пункт удалён",()=>upd((x)=>{const cur=[...(x[key]||[])];if(cur.some((y)=>y.id===removed.id))return x;cur.splice(Math.max(0,Math.min(idx,cur.length)),0,removed);return {...x,[key]:cur};}));
  };
  const PriceBadge = ({ kind, item }) => { const c=itemCost(t,item); const ids=itemSplitIds(t,item), names=ids.map(id=>(travelers.find(x=>x.id===id)||{}).name).filter(Boolean); return <span onClick={(e)=>{e.stopPropagation();openCost(kind,item);}} className="press" title={names.length?`Делится: ${names.join(", ")}`:""} style={{fontSize:10.5,fontWeight:800,color:c?T.cyan:T.subd,border:`1px solid ${c?T.cyan+"55":T.line}`,borderRadius:999,padding:"3px 7px",cursor:"pointer",whiteSpace:"nowrap"}}>{c?money(c.total,c.currency):"＋ цена"}</span>; };

  const invite = async () => { if (!isCreator) return; setInviteOpen(true); setInviteUrl(""); const r = await sharedApi("invite-trip", { tripId: t.id }); if (r.ok) setInviteUrl(r.url || ""); else setToast(r.error === "telegram required" ? "Откройте TripWise в Telegram для приглашения" : "Не удалось создать приглашение"); };
  const shareInvite = () => { if (!inviteUrl) return; const text = `Присоединяйся к поездке «${t.title}» в TripWiseAI`; const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp; const url = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`; try { if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank"); } catch (e) { navigator.clipboard && navigator.clipboard.writeText(inviteUrl); setToast("Ссылка скопирована"); } };
  const removeMember = async (m) => { const r = await sharedApi("remove-member", { tripId: t.id, memberId: m.id }); if (r.ok && r.trip) { replace(r.trip); setToast(r.inviteRotated ? "Участник удалён · старая ссылка отозвана" : "Участник удалён"); } else setToast("Не удалось удалить участника"); };
  const leaveTrip = async () => { const r = await sharedApi("leave-trip", { tripId: t.id }); if (r.ok) { setSettingsOpen(false); setPeopleOpen(false); onLeaveTrip && onLeaveTrip(t.id); setToast("Вы вышли из поездки"); } else setToast("Не удалось выйти из поездки"); };
  const addTraveler = () => { if(!isCreator)return; const name = travelerName.trim() || `Путешественник ${travelers.length + 1}`; creatorUpd((x) => { const cur = activeTravelers(x); return { ...x, travelers: [...(x.travelers || []), { id: "tr" + Date.now(), name, memberId: null, active: true, createdAt: new Date().toISOString() }], travelerTarget: cur.length + 1 }; }); setTravelerName(""); };
  const removeTraveler = (tr) => { if(!isCreator)return; if (tr.memberId) { setToast("Сначала удалите пользователя из поездки — его финансовый слот останется отдельно"); return; } creatorUpd((x) => { const cur = activeTravelers(x); return { ...x, travelers: (x.travelers || []).map((y) => y.id === tr.id ? { ...y, active: false } : y), travelerTarget: Math.max(1, cur.length - 1) }; }); };
  const saveTitle = () => { const title = renameValue.trim(); if (!title) { setToast("Название не может быть пустым"); return; } creatorUpd((x) => ({ ...x, title: title.slice(0, 80) })); setSettingsOpen(false); setToast("Название обновлено"); };

  const transferOwnership=async()=>{if(!isCreator||!transferTo||transferBusy)return;setTransferBusy(true);const r=await sharedApi("transfer-ownership",{tripId:t.id,memberId:transferTo});setTransferBusy(false);if(r.ok&&r.trip){replace(r.trip);setSettingsOpen(false);setToast("Управление поездкой передано");}else setToast("Не удалось передать управление");};
  const openPublish=()=>{setPubForm(defaultPubForm());setSettingsOpen(false);setPublishOpen(true);};
  const togglePubChip=(k,v)=>setPubForm(f=>({...f,[k]:(f[k]||[]).includes(v)?(f[k]||[]).filter(x=>x!==v):[...(f[k]||[]),v]}));
  const publishTrip=async()=>{if(!isCreator||publishBusy)return;const free=Math.max(1,Math.min(20,Number(pubForm.freeSeats)||1));setPublishBusy(true);const r=await sharedApi("publish-trip",{tripId:t.id,publication:{...pubForm,capacity:travelers.length+free,budgetMin:Number(pubForm.budgetMin)||0,budgetMax:Number(pubForm.budgetMax)||0}});setPublishBusy(false);if(r.ok&&r.trip){replace(r.trip);setPublishOpen(false);setToast("Поездка опубликована в витрине");}else setToast("Не удалось опубликовать поездку");};
  const unpublishTrip=async()=>{if(!isCreator||publishBusy)return;setPublishBusy(true);const r=await sharedApi("unpublish-trip",{tripId:t.id});setPublishBusy(false);if(r.ok&&r.trip){replace(r.trip);setPublishOpen(false);setToast("Поездка снята с витрины");}else setToast("Не удалось снять публикацию");};
  const setAskKind = (kind) => { setAskType(kind); if (kind === "yesno") setAskOptions(["Да", "Нет"]); else if (kind === "approval") setAskOptions(["Подходит", "Нужно обсудить"]); else if (kind === "availability") setAskOptions(["Могу", "Не могу"]); else setAskOptions(["Вариант 1", "Вариант 2"]); };
  const createAsk = async () => { const opts = askOptions.map((x) => x.trim()).filter(Boolean); if (!askTitle.trim() || opts.length < 2) { setToast("Добавьте вопрос и минимум 2 варианта"); return; } const r = await sharedApi("ask-group-create", { tripId: t.id, title: askTitle, description: askDesc, type: askType, options: opts }); if (r.ok && r.trip) { replace(r.trip); setAskOpen(false); setAskTitle(""); setAskDesc(""); setAskKind("yesno"); setToast("Вопрос отправлен группе"); } else setToast("Не удалось создать Ask Group"); };
  const vote = async (poll, optionId) => { const r = await sharedApi("ask-group-vote", { tripId: t.id, pollId: poll.id, optionId }); if (r.ok && r.trip) replace(r.trip); else setToast("Голос не сохранён"); };
  const resolvePoll = async (poll, optionId) => { const r = await sharedApi("ask-group-resolve", { tripId: t.id, pollId: poll.id, optionId }); if (r.ok && r.trip) { replace(r.trip); setToast("Решение зафиксировано"); } else setToast("Не удалось зафиксировать решение"); };

  const setTravelerDoc = async (tr, doc, done) => { const r = await sharedApi("traveler-status-update", { tripId: t.id, travelerId: tr.id, docId: doc.id, done, label: doc.name }); if (r.ok && r.trip) replace(r.trip); else setToast("Не удалось сохранить личную готовность"); };
  const markSettlement = async (s) => { setSettleBusy(true); const settlementId=`pay${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`; const r = await sharedApi("record-settlement", { tripId: t.id, id:settlementId, fromTravelerId: s.from, toTravelerId: s.to, amount: s.amount, currency: s.currency || "EUR" }); setSettleBusy(false); if (r.ok && r.trip) { replace(r.trip); setToast("Перевод учтён"); } else setToast("Не удалось учесть перевод"); };
  const removeSettlement = async (row) => { const r = await sharedApi("remove-settlement", { tripId: t.id, settlementId: row.id }); if (r.ok && r.trip) { replace(r.trip); setToast("Отметка о переводе отменена"); } else setToast("Не удалось отменить перевод"); };
  const refreshFx = async () => { if (!isCreator) return; const quotes = [...new Set(budget.groups.map((g) => g.currency).filter((x) => x !== baseDraft))]; setFxBusy(true); const r = await sharedApi("fx-rates", { tripId: t.id, base: baseDraft, quotes }); setFxBusy(false); if (r.ok) { creatorUpd((x) => ({ ...x, baseCurrency: baseDraft, fxSnapshot: { base: r.base || baseDraft, date: r.date || iso(new Date()), rates: r.rates || {}, source: r.source || "Frankfurter", capturedAt: new Date().toISOString() } })); setToast("Курсы зафиксированы для бюджета"); } else setToast("Не удалось получить курсы"); };

  const addJourneyLeg = () => setJourneyLegs((a) => [...a, { flightNumber: "", date: a[a.length - 1]?.date || t.df || "" }]);
  const enrichLegs = async (rows) => { const legs = []; let missing = 0, providerMissing = 0; for (const row of rows) { const r = await sharedApi("flight-info", { tripId: t.id, flightNumber: row.flightNumber, date: row.date }, 8000); if (!r.found) missing++; if (r.providerConfigured === false) providerMissing++; legs.push({ ...((r && r.flight) || { flightNumber: prettyFlightNumber(row.flightNumber) }), date: row.date }); } return { legs, missing, providerMissing }; };
  const addFlightJourney = async () => {
    const rows = journeyLegs.map((x) => ({ flightNumber: String(x.flightNumber || "").trim().toUpperCase(), date: x.date || "" })).filter((x) => x.flightNumber);
    if (!rows.length) { setToast("Введите хотя бы один номер рейса"); return; }
    const id = "fj" + Date.now();
    const fallbackLegs = rows.map((row) => ({ flightNumber: prettyFlightNumber(row.flightNumber), compactFlightNumber: String(row.flightNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), date: row.date, aircraft: null, source: "manual" }));
    const initialName = fallbackLegs.length > 1 ? `Перелёт · ${fallbackLegs.map((x) => x.flightNumber).join(" → ")}` : `Перелёт ${fallbackLegs[0].flightNumber}`;
    const j = { id, name: initialName, legs: fallbackLegs, done: true, status: "confirmed", priceAmount: Number(journeyCost.priceAmount) || null, currency: journeyCost.currency || "EUR", pricingMode: journeyCost.pricingMode || "total", splitTravelerIds: (journeyCost.splitTravelerIds || []).length ? journeyCost.splitTravelerIds : travelers.map((x) => x.id), payments: normalizePayments(journeyCost), createdAt: new Date().toISOString() };
    // Сохраняем сразу: внешний flight API больше не блокирует создание перелёта.
    upd((x) => ({ ...x, flightJourneys: [...(x.flightJourneys || []), j], baseCurrency: x.baseCurrency || j.currency, blocksOn:{...tripBlocks(x),tickets:true} }));
    setFlightOpen(false); setJourneyLegs([{ flightNumber: "", date: t.df || "" }]); setJourneyCost(emptyCost());
    setToast("Перелёт добавлен · уточняю данные рейса…");
    try {
      const { legs, missing, providerMissing } = await enrichLegs(rows);
      const first = legs[0], last = legs[legs.length - 1];
      const enrichedName = (first && first.fromCode && last && last.toCode) ? `${first.fromCode} → ${last.toCode}` : initialName;
      patchArrayItem("flightJourneys", id, { legs, name: enrichedName });
      if (!missing) setToast(legs.length > 1 ? "Перелёт с пересадкой уточнён" : "Данные рейса уточнены");
      else if (providerMissing) setToast("Перелёт сохранён; live-данные появятся после подключения flight API");
      else setToast("Перелёт сохранён; часть рейсов не найдена у провайдера");
    } catch (e) { setToast("Перелёт сохранён; данные рейса можно обновить позже"); }
  };
  const refreshJourney = async (j) => { const rows = (j.legs || []).map((x) => ({ flightNumber: x.flightNumber, date: x.date || String(x.departISO || "").slice(0, 10) })).filter((x) => x.flightNumber); if (!rows.length) return; const { legs } = await enrichLegs(rows); patchArrayItem("flightJourneys", j.id, { legs }); setToast("Данные рейса обновлены"); };

  const loadChatHistory=async()=>{if(chatLoaded)return;setChatLoaded(true);const r=await sharedApi("trip-ai-history",{tripId:t.id},12000);if(r.ok&&Array.isArray(r.messages)&&r.messages.length)setMessages(r.messages);if(r.ok)setChatPending(!!r.pendingAction);};
  const askAI = async (preset) => {
    const q=String(preset||chatText||"").trim(); if(!q||chatBusy){if(preset){setChatOpen(true);loadChatHistory();}return;}
    setChatOpen(true);loadChatHistory();setChatText("");setMessages(m=>[...m,{role:"user",text:q}]);setChatBusy(true);
    try{const r=await sharedApi("trip-ai",{tripId:t.id,question:q},35000);const text=r.ok?(r.answer||"Не нашёл ответа в данных поездки."):(r.error==="timeout"?"TripWise AI не ответил за 35 секунд. Попробуйте ещё раз.":`TripWise AI сейчас недоступен${r.error?` · ${r.error}`:""}.`);setMessages(m=>[...m,{role:"assistant",text}]);setChatPending(!!(r.ok&&r.pendingAction));if(r.ok&&r.trip)replace(r.trip);}
    catch(e){setMessages(m=>[...m,{role:"assistant",text:"TripWise AI сейчас недоступен."}]);}finally{setChatBusy(false);}
  };

  const analyzeImport = async () => { const text = importText.trim(); if (text.length < 12) { setToast("Вставьте текст бронирования или письма"); return; } setImportBusy(true); setImportResult(null); const r = await sharedApi("booking-import", { tripId: t.id, text }); setImportBusy(false); if (r.ok && r.booking) setImportResult(r.booking); else setToast("Не удалось распознать бронирование"); };
  const importFile = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if (!/text|message/.test(f.type || "") && !/\.(txt|eml)$/i.test(f.name || "")) { setToast("Сейчас импортируем текст письма/брони. Для PDF и скрина нужен OCR-слой."); return; } try { setImportText((await f.text()).slice(0, 14000)); } catch (err) { setToast("Не удалось прочитать файл"); } };
  const applyImport = async () => {
    const b = importResult; if (!b) return; const common = { id: "im" + Date.now(), name: b.title || "Импортированное бронирование", done: true, status: "confirmed", priceAmount: Number(b.priceAmount) || null, currency: b.currency || t.baseCurrency || "EUR", pricingMode: b.pricingMode || "total", splitTravelerIds: travelers.map((x) => x.id), payments: [], startDate: b.startDate || "", endDate: b.endDate || "", startTime: b.startTime || "", endTime: b.endTime || "", location: b.location || "", notes: b.notes || "", imported: true, createdAt: new Date().toISOString() };
    if (b.kind === "flight" && (b.flightLegs || []).length) { const { legs } = await enrichLegs(b.flightLegs); upd((x) => ({ ...x, flightJourneys: [...(x.flightJourneys || []), { ...common, id: "fj" + Date.now(), legs }], baseCurrency: x.baseCurrency || common.currency, blocksOn:{...tripBlocks(x),tickets:true} })); }
    else if (b.kind === "stay") upd((x) => ({ ...x, stays: [...(x.stays || []), common], blocksOn:{...tripBlocks(x),lodging:true}, lodgingOff:false }));
    else if (b.kind === "transport") upd((x) => ({ ...x, transport: [...(x.transport || []), common], blocksOn:{...tripBlocks(x),transport:true} }));
    else if (b.kind === "activity") upd((x) => ({ ...x, activities: [...(x.activities || []), common], blocksOn:{...tripBlocks(x),activities:true} }));
    else { setToast("Не понял тип бронирования — добавьте его вручную"); return; }
    setImportOpen(false); setImportText(""); setImportResult(null); setToast("Бронирование добавлено в поездку");
  };

  const openActivity = () => { setActivityOpen(true); const ts = latestActivity && latestActivity.createdAt || new Date().toISOString(); setActivitySeen(ts); store.set(`activity_seen_${t.id}`, ts); };
  const todayLocations = [...new Set((today.todayEvents || []).map((e) => String(e.location || "").trim()).filter(Boolean))];
  const openTodayMap = () => { if (todayLocations.length < 2) { setToast("Для маршрута дня нужно хотя бы две точки с местом или адресом"); return; } const origin=todayLocations[0], destination=todayLocations[todayLocations.length-1], waypoints=todayLocations.slice(1,-1).join("|"); const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:""}`; try{window.open(url,"_blank");}catch(e){setToast("Не удалось открыть карту");} };
  const quick = today.active ? ["Что сегодня?", "Что дальше?", "Кто кому должен?", "Где мои брони?"] : d != null && d <= 14 ? ["Что ещё не готово?", "Что взять с собой?", "Какой у нас бюджет?"] : ["Что ещё не готово?", "Проверь маршрут", "Что нужно решить группой?"];

  const sectionHasContent=(k)=>k==="tickets"?flightCount>0:k==="lodging"?stays.length>0:k==="transport"?(t.transport||[]).length>0:k==="activities"?(t.activities||[]).length>0:k==="docs"?docs.length>0:k==="prep"?prepItems.length>0:false;
  const sectionVisible=(k)=>!!bOn[k] && sectionHasContent(k);
  const requestHideSection=(k,title)=>{if(!isCreator)return;const snap={blocksOn:{...tripBlocks(t)},checks:JSON.parse(JSON.stringify(t.checks||{})),route:t.route?JSON.parse(JSON.stringify(t.route)):null,flightJourneys:JSON.parse(JSON.stringify(t.flightJourneys||[])),manualFlights:JSON.parse(JSON.stringify(t.manualFlights||[])),stays:JSON.parse(JSON.stringify(t.stays||[])),lodgingOff:!!t.lodgingOff,transport:JSON.parse(JSON.stringify(t.transport||[])),activities:JSON.parse(JSON.stringify(t.activities||[])),docsExtra:[...(t.docsExtra||[])],servicesAdded:[...(t.servicesAdded||[])],custom:JSON.parse(JSON.stringify(t.custom||[]))};const restore=()=>creatorUpd(x=>{const blocks={...tripBlocks(x),[k]:snap.blocksOn[k]!==false},checks={...(x.checks||{})};if(k==="tickets")return{...x,blocksOn:blocks,route:snap.route,flightJourneys:snap.flightJourneys,manualFlights:snap.manualFlights,checks:{...checks,tickets:!!snap.checks.tickets}};if(k==="lodging")return{...x,blocksOn:blocks,stays:snap.stays,lodgingOff:snap.lodgingOff,checks:{...checks,lodgeMain:!!snap.checks.lodgeMain,lodgeStop:!!snap.checks.lodgeStop}};if(k==="transport")return{...x,blocksOn:blocks,transport:snap.transport};if(k==="activities")return{...x,blocksOn:blocks,activities:snap.activities};if(k==="docs")return{...x,blocksOn:blocks,docsExtra:snap.docsExtra,checks:{...checks,docs:{...(snap.checks.docs||{})}}};if(k==="prep")return{...x,blocksOn:blocks,servicesAdded:snap.servicesAdded,custom:[...(x.custom||[]).filter(z=>z&&z.budgetOnly),...snap.custom.filter(z=>z&&!z.budgetOnly)],checks:{...checks,services:{...(snap.checks.services||{})}}};return{...x,blocksOn:blocks};});const remove=()=>{creatorUpd(x=>{const blocks={...tripBlocks(x),[k]:false},checks={...(x.checks||{})};if(k==="tickets"){checks.tickets=false;return{...x,blocksOn:blocks,route:null,flightJourneys:[],manualFlights:[],checks};}if(k==="lodging"){checks.lodgeMain=false;checks.lodgeStop=false;return{...x,blocksOn:blocks,stays:[],lodgingOff:true,checks};}if(k==="transport")return{...x,blocksOn:blocks,transport:[]};if(k==="activities")return{...x,blocksOn:blocks,activities:[]};if(k==="docs"){checks.docs={};return{...x,blocksOn:blocks,docsExtra:[],checks};}if(k==="prep"){checks.services={};return{...x,blocksOn:blocks,servicesAdded:[],custom:(x.custom||[]).filter(z=>z&&z.budgetOnly),checks};}return{...x,blocksOn:blocks};});setOpen(x=>({...x,[k]:false}));onUndoable&&onUndoable(`Раздел «${title}» удалён`,restore);};if(sectionHasContent(k)){setConfirmDanger({title:`Удалить раздел «${title}»?`,text:"Все пункты этого раздела исчезнут из общего плана и связанных расчётов. Сразу после удаления действие можно отменить.",label:"Удалить раздел",action:remove});}else remove();};
  const addToPlan=(kind)=>{setAddPlanOpen(false);if(kind==="tickets"){setFlightOpen(true);return;}if(kind==="docs"){goDocs&&goDocs();return;}if(kind==="stays"||kind==="transport"||kind==="activities"||kind==="custom"||kind==="expense"){startAdd(kind);return;}};
  const holdStart=(k,title)=>{if(!isCreator)return;holdTriggered.current=false;clearTimeout(holdTimer.current);holdTimer.current=setTimeout(()=>{holdTriggered.current=true;requestHideSection(k,title);},650);};
  const holdEnd=()=>clearTimeout(holdTimer.current);
  const SectionHead=({k,icon,title,sub,done,total,action})=><div onPointerDown={()=>holdStart(k,title)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onClick={()=>{if(holdTriggered.current){holdTriggered.current=false;return;}setOpen(x=>({...x,[k]:!x[k]}));}} className="press" style={{display:"flex",alignItems:"center",gap:10,padding:"13px 2px",cursor:"pointer",borderTop:`1px solid ${T.line}`}}><div style={{width:34,height:34,borderRadius:11,background:T.card2,display:"grid",placeItems:"center",fontSize:17}}>{icon}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:800,color:T.text,fontFamily:"Sora,sans-serif"}}>{title}</div><div style={{fontSize:10.8,color:T.subd,marginTop:2}}>{sub}</div></div>{total>0&&<span style={{fontSize:10.5,fontWeight:800,color:done===total?T.green:T.subd}}>{done}/{total}</span>}{action&&<span onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();action();}} className="press" style={{color:T.violet,fontSize:18,padding:"2px 4px"}}>＋</span>}<span style={{transform:open[k]?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-flex"}}><Icon d={I.chevR} size={14} color={T.subd}/></span></div>;
  const Empty = ({ children }) => <div style={{ fontSize: 11.5, color: T.subd, padding: "6px 0 9px" }}>{children}</div>;
  const ScheduleFields=({kind,form,setForm})=><div style={{marginTop:10}}><div style={{fontSize:10.5,color:T.subd,marginBottom:6}}>Когда и где</div>{kind==="stays"||kind==="transport"?<><DateRangeField from={form.startDate||""} to={form.endDate||""} title={kind==="stays"?"Период проживания":"Период транспорта"} allowSameDay={kind==="transport"} onChange={(a,b)=>setForm(x=>({...x,startDate:a,endDate:b}))}/>{kind==="transport"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:7}}><input type="time" value={form.startTime||""} onChange={e=>setForm(x=>({...x,startTime:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,colorScheme:"dark"}}/><input type="time" value={form.endTime||""} onChange={e=>setForm(x=>({...x,endTime:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,colorScheme:"dark"}}/></div>}</>:<div style={{display:"grid",gridTemplateColumns:"1fr 95px 95px",gap:7}}><input type="date" value={form.startDate||""} onChange={e=>setForm(x=>({...x,startDate:e.target.value,endDate:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,colorScheme:"dark"}}/><input type="time" value={form.startTime||""} onChange={e=>setForm(x=>({...x,startTime:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,colorScheme:"dark"}}/><input type="time" value={form.endTime||""} onChange={e=>setForm(x=>({...x,endTime:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,colorScheme:"dark"}}/></div>}<input value={form.location||""} onChange={e=>setForm(x=>({...x,location:e.target.value}))} placeholder="Место / адрес — необязательно" style={{width:"100%",marginTop:7,background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:"9px 10px",color:T.text,outline:"none"}}/></div>;
  const CostFields = ({ form, setForm }) => <><div style={{ display: "grid", gridTemplateColumns: "1fr 95px", gap: 8, marginTop: 9 }}><input inputMode="decimal" value={form.priceAmount || ""} onChange={(e) => setForm((x) => ({ ...x, priceAmount: e.target.value.replace(",", ".") }))} placeholder="Цена (необязательно)" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 11px", color: T.text, outline: "none" }} /><select value={form.currency || "EUR"} onChange={(e) => setForm((x) => ({ ...x, currency: e.target.value }))} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: 9, color: T.text, outline: "none" }}>{COST_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div><div style={{ display: "flex", gap: 7, marginTop: 8 }}>{[["total", "За всех"], ["per_person", "За человека"]].map(([v, l]) => <div key={v} onClick={() => setForm((x) => ({ ...x, pricingMode: v }))} className="press" style={{ flex: 1, textAlign: "center", border: `1px solid ${form.pricingMode === v ? T.violet : T.line}`, background: form.pricingMode === v ? T.violet + "18" : T.card, borderRadius: 10, padding: 8, fontSize: 11, fontWeight: 800, color: form.pricingMode === v ? T.violet : T.subd, cursor: "pointer" }}>{l}</div>)}</div><div style={{ fontSize: 10.5, color: T.subd, marginTop: 10, marginBottom: 5 }}>На кого делим</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{travelers.map((tr) => { const on = (form.splitTravelerIds || []).includes(tr.id); return <span key={tr.id} onClick={() => toggleSplit(setForm, tr.id)} className="press" style={{ fontSize: 10.5, fontWeight: 700, color: on ? T.violet : T.subd, border: `1px solid ${on ? T.violet + "66" : T.line}`, background: on ? T.violet + "15" : T.card, borderRadius: 999, padding: "5px 8px", cursor: "pointer" }}>{tr.name}</span>; })}</div><div style={{ fontSize: 10.5, color: T.subd, marginTop: 11, marginBottom: 5 }}>Кто уже оплатил</div>{(form.payments || []).map((pay, i) => { const editable=isCreator||!pay.travelerId||(viewerTraveler&&pay.travelerId===viewerTraveler.id); return <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 28px", gap: 6, marginBottom: 6 }}><select disabled={!editable} value={pay.travelerId || ""} onChange={(e) => setForm((x) => ({ ...x, payments: (x.payments || []).map((p, j) => j === i ? { ...p, travelerId: e.target.value } : p) }))} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 9, padding: 8, color: editable?T.text:T.subd, opacity:editable?1:.75 }}><option value="">Плательщик</option>{(isCreator?travelers:(viewerTraveler?[viewerTraveler]:[])).map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}{!editable&&<option value={pay.travelerId}>{travelers.find(tr=>tr.id===pay.travelerId)?.name||"Участник"}</option>}</select><input disabled={!editable} inputMode="decimal" value={pay.amount || ""} onChange={(e) => setForm((x) => ({ ...x, payments: (x.payments || []).map((p, j) => j === i ? { ...p, amount: e.target.value.replace(",", ".") } : p) }))} placeholder="Сумма" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 9, padding: 8, color: editable?T.text:T.subd, outline: "none", opacity:editable?1:.75 }} /><div onClick={() => editable&&setForm((x) => ({ ...x, payments: (x.payments || []).filter((_, j) => j !== i) }))} style={{ display: "grid", placeItems: "center", color: editable?"#ff6db0":T.subd, cursor: editable?"pointer":"default" }}>×</div></div>; })}<div onClick={() => { const tr=isCreator?(travelers[0]||null):viewerTraveler; if(!tr)return setToast("Сначала привяжите себя к путешественнику"); setForm((x) => ({ ...x, payments: [...(x.payments || []), { travelerId: tr.id, amount: "" }] })); }} style={{ fontSize: 11, color: T.violet, fontWeight: 800, cursor: "pointer", marginTop: 3 }}>＋ Добавить свою оплату</div></>;
  const JourneyCard = ({ j, legacy = false }) => { const legs = legacy ? [j] : (j.legs || []), warnings = journeyWarnings(legs); return <div style={{ background: T.card2, border: `1px solid ${warnings.length ? "#ffb45c55" : T.line}`, borderRadius: 13, padding: 10, marginBottom: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: legs.length > 1 ? 8 : 2 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, flex: 1 }}>{j.name || `${legs[0]?.fromCode || "?"} → ${legs[legs.length - 1]?.toCode || "?"}`}</div>{!legacy && j.id && <PriceBadge kind="journey" item={j} />}{isCreator && !legacy && j.id && <span onClick={() => refreshJourney(j)} style={{ fontSize: 10.5, color: T.violet, cursor: "pointer" }}>обновить</span>}</div>{warnings.map((w,i)=><div key={i} style={{fontSize:10.3,color:"#ffb45c",background:"#ffb45c12",borderRadius:8,padding:"6px 8px",marginBottom:6}}>⚠ {w}</div>)}{legs.map((s, i) => { const gap = i ? legGapMin(legs[i - 1], s) : null; return <React.Fragment key={s.id || i}>{gap && <div style={{ fontSize: 10.5, color: T.cyan, margin: "5px 0 5px 11px" }}>↳ пересадка {hm(gap)}</div>}<div style={{ borderLeft: `2px solid ${T.violet}55`, paddingLeft: 9, paddingBottom: i < legs.length - 1 ? 7 : 0 }}><div style={{ display: "flex", gap: 7, alignItems: "center" }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, flex: 1 }}>{prettyFlightNumber(s.flightNumber) || "Рейс"} · {s.fromCode || "?"} → {s.toCode || "?"}</div><span style={{ fontSize: 10, color: T.subd }}>{s.date || s.departISO && String(s.departISO).slice(0, 10) || ""}</span></div><div style={{ fontSize: 10.7, color: T.subd, marginTop: 3 }}>{s.departTime || s.departISO && String(s.departISO).slice(11, 16) || ""}{s.arriveTime ? ` → ${s.arriveTime}` : ""}{s.durationMin ? ` · ${hm(s.durationMin)}` : ""}</div><div style={{ fontSize: 10.7, color: T.subd, marginTop: 2 }}>✈ {s.aircraft || "самолёт уточняется"}{s.aircraftReg ? ` · ${s.aircraftReg}` : ""}{s.status ? ` · ${s.status}` : ""}{s.departureTerminal ? ` · терминал ${s.departureTerminal}` : ""}{s.departureGate ? ` · gate ${s.departureGate}` : ""}</div>{s.operatedBy && <div style={{ fontSize: 10, color: T.subd, marginTop: 2 }}>Выполняет: {s.operatedBy}</div>}</div></React.Fragment>; })}</div>; };
  const PlanRow=({kind,item})=>{const st=item.status||(item.done?"confirmed":"saved"),sl=st==="confirmed"?"подтверждено":st==="draft"?"черновик":"сохранено",sc=st==="confirmed"?T.green:st==="draft"?"#e0a53a":T.subd,split=itemSplitIds(t,item).map(id=>(travelers.find(x=>x.id===id)||{}).name).filter(Boolean);return <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0"}}><Check on={!!item.done} onClick={()=>toggleArr(kind,item.id)}/><div onClick={()=>openCost(kind,item)} style={{flex:1,minWidth:0,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,color:T.text,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span><span style={{fontSize:9.5,color:sc,border:`1px solid ${sc}44`,borderRadius:999,padding:"2px 6px",whiteSpace:"nowrap"}}>{sl}</span></div><div style={{fontSize:10.2,color:T.subd,marginTop:2}}>{[formatSchedule(item),item.location,split.length?`делится: ${split.join(", ")}`:""].filter(Boolean).join(" · ")||"Нажмите, чтобы добавить детали"}</div></div><PriceBadge kind={kind} item={item}/></div>;};
  const FlightJourneyRow=({item})=>{const legs=item.legs||[],first=legs[0]||{},last=legs[legs.length-1]||first,expanded=!!flightExpanded[item.id],st=item.status||(item.done?"confirmed":"saved"),sl=st==="confirmed"?"подтверждено":"сохранено";const route=[first.fromCode,last.toCode].filter(Boolean).join(" → ");return <div style={{borderBottom:`1px solid ${T.line}`,padding:"3px 0"}}><div onClick={()=>setFlightExpanded(x=>({...x,[item.id]:!x[item.id]}))} className="press" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",cursor:"pointer"}}><Check on={!!item.done} onClick={(e)=>{e&&e.stopPropagation&&e.stopPropagation();patchArrayItem("flightJourneys",item.id,{done:!item.done,status:!item.done?"confirmed":"saved"});}}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:T.text,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name||legs.map(x=>prettyFlightNumber(x.flightNumber)).filter(Boolean).join(" → ")||"Перелёт"}</div><div style={{fontSize:10.3,color:T.subd,marginTop:2}}>{[route,legs.length>1?`${legs.length} рейса`:(prettyFlightNumber(first.flightNumber)||""),first.date||String(first.departISO||"").slice(0,10),sl].filter(Boolean).join(" · ")}</div></div><PriceBadge kind="journey" item={item}/><span style={{transform:expanded?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-flex",padding:3}}><Icon d={I.chevR} size={14} color={T.subd}/></span></div>{expanded&&<div style={{margin:"0 0 9px 30px",background:T.card2,border:`1px solid ${T.line}`,borderRadius:12,padding:10}}>{legs.length?legs.map((leg,i)=><div key={i} style={{padding:i?"9px 0 0":"0",marginTop:i?9:0,borderTop:i?`1px solid ${T.line}`:"none"}}><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:12.5,fontWeight:900,color:T.text}}>{prettyFlightNumber(leg.flightNumber)||`Рейс ${i+1}`}</span>{leg.status&&<span style={{fontSize:9.5,color:T.green,border:`1px solid ${T.green}44`,borderRadius:999,padding:"2px 6px"}}>{String(leg.status).toLowerCase()}</span>}</div><div style={{fontSize:11,color:T.sub,marginTop:4}}>{[leg.fromCode&&leg.toCode?`${leg.fromCode} → ${leg.toCode}`:"",leg.departTime||String(leg.departISO||"").slice(11,16),leg.arriveTime||String(leg.arriveISO||"").slice(11,16)].filter(Boolean).join(" · ")}</div><div style={{fontSize:10.3,color:T.subd,marginTop:3}}>{[leg.aircraft?`Самолёт: ${leg.aircraft}`:"Самолёт уточняется",leg.terminal?`терминал ${leg.terminal}`:"",leg.gate?`гейт ${leg.gate}`:""].filter(Boolean).join(" · ")}</div></div>):<div style={{fontSize:11,color:T.subd}}>Детали рейса пока не получены.</div>}<div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10}}><span onClick={(e)=>{e.stopPropagation();refreshJourney(item);}} style={{fontSize:10.8,color:T.violet,fontWeight:800,cursor:"pointer"}}>Обновить данные</span><span onClick={(e)=>{e.stopPropagation();openCost("journey",item);}} style={{fontSize:10.8,color:T.violet,fontWeight:800,cursor:"pointer"}}>Редактировать</span><span onClick={(e)=>{e.stopPropagation();setConfirmDanger({title:"Удалить перелёт?",text:`«${item.name||"Перелёт"}» исчезнет из плана и бюджета.`,label:"Удалить",action:()=>removePlanItem({kind:"journey",id:item.id})});}} style={{fontSize:10.8,color:"#ff7ba9",fontWeight:800,cursor:"pointer"}}>Удалить</span></div></div>}</div>;};
  const timelineGlyph=(type)=>({"trip-start":"🚩","trip-end":"🏁",flight:"✈️","flight-arrival":"🛬",stay:"🏠","stay-out":"🧳",transport:"🚗","transport-end":"🔑",activity:"📍"}[type]||"•");
  const dayNo=(date)=>{if(!t.df||!date)return null;const a=new Date(String(t.df).slice(0,10)+"T12:00:00"),b=new Date(String(date).slice(0,10)+"T12:00:00"),n=Math.floor((b-a)/86400000)+1;return Number.isFinite(n)&&n>0?n:null;};
  const TimelinePreview = () => { const upcoming = timeline.filter((e) => e.date >= today.today).slice(0, 3); const activities=(t.activities||[]).filter(x=>x.startDate).length; return <div onClick={() => setTimelineOpen(true)} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 13, marginBottom: 10, cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 18 }}>🗓️</div><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, flex: 1 }}>Таймлайн поездки</div><span style={{ fontSize: 10.5, color: T.subd }}>{activities?`${activities} ${plural(activities,"активность","активности","активностей")}`:`${timeline.length} событий`}</span><Icon d={I.chevR} size={14} color={T.subd} /></div>{upcoming.length > 0 && <div style={{ marginTop: 9 }}>{upcoming.map((e) => <div key={e.id} style={{ display: "flex", alignItems:"center", gap: 8, padding: "5px 0", fontSize: 11 }}><span style={{width:20,textAlign:"center",fontSize:13}}>{timelineGlyph(e.type)}</span><span style={{ color: T.subd, minWidth: 72 }}>{fmtShort(new Date(e.date))}{e.time ? ` · ${e.time}` : ""}</span><span style={{ color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span></div>)}</div>}<div style={{fontSize:10.4,color:T.subd,marginTop:8}}>Документы и подготовка показываются сводкой, а не отдельными событиями.</div></div>; };

  const hasTelegramBack = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton;
  const travelerMember=(tr)=>members.find(m=>String(m.id)===String(tr.memberId||""))||null;
  return <div style={{ padding: "12px 14px", paddingBottom: 150, animation: "slideIn .18s ease-out" }}>
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: gradFor(t.dc), padding: 16, minHeight: 128, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(5,5,20,.80))" }} />
      {!hasTelegramBack&&<div onClick={onBack} className="press" style={{position:"absolute",top:11,left:11,width:32,height:32,borderRadius:999,background:"rgba(5,8,20,.52)",border:"1px solid rgba(255,255,255,.20)",display:"grid",placeItems:"center",cursor:"pointer",zIndex:3}}><Icon d={I.back} size={15} color="#fff"/></div>}
      <div style={{position:"absolute",top:10,right:10,zIndex:3,display:"flex",alignItems:"center",gap:6}}>
        <div onClick={()=>setPeopleOpen(true)} className="press" style={{display:"flex",alignItems:"center",cursor:"pointer",paddingLeft:6}}>{travelers.slice(0,4).map((tr,i)=>{const m=travelerMember(tr);return <div key={tr.id||i} title={tr.name} style={{width:29,height:29,borderRadius:999,marginLeft:i?-7:0,border:"2px solid rgba(7,10,25,.9)",background:gradFor((tr.name||"X").slice(0,2)),display:"grid",placeItems:"center",fontSize:9.5,fontWeight:800,color:"#fff",overflow:"hidden"}}>{m&&m.photoUrl?<img src={m.photoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:String(tr.name||"?").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div>})}{travelers.length>4&&<div style={{marginLeft:-5,fontSize:9.5,fontWeight:900,color:"#fff",background:"rgba(5,8,20,.6)",border:"1px solid rgba(255,255,255,.22)",borderRadius:999,padding:"5px 7px"}}>+{travelers.length-4}</div>}</div>
        {isCreator&&<div onClick={invite} className="press" style={{width:30,height:30,borderRadius:999,background:"rgba(124,92,255,.72)",border:"1px solid rgba(255,255,255,.22)",display:"grid",placeItems:"center",color:"#fff",fontSize:17,fontWeight:800,cursor:"pointer"}}>＋</div>}
        <div onClick={()=>{setRenameValue(t.title||"");setSettingsOpen(true);}} className="press" style={{width:30,height:30,borderRadius:999,background:"rgba(5,8,20,.52)",border:"1px solid rgba(255,255,255,.20)",display:"grid",placeItems:"center",color:"#fff",fontSize:18,cursor:"pointer"}}>⋯</div>
      </div>
      <div style={{ position: "relative", zIndex:2, paddingTop:34 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 20, color: "#fff" }}>{t.title}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.84)", marginTop: 3 }}>{[t.dcName, t.country].filter(Boolean).join(", ")}{t.df ? ` · ${fmtShort(new Date(t.df))}` : ""}{t.dt ? ` — ${fmtShort(new Date(t.dt))}` : ""}{today.active ? " · сейчас в поездке" : d != null ? ` · через ${d} дн.` : ""}</div><div onClick={()=>setPeopleOpen(true)} style={{fontSize:10.7,color:"rgba(255,255,255,.72)",marginTop:5,cursor:"pointer"}}>{travelers.length} {plural(travelers.length,"путешественник","путешественника","путешественников")} · нажмите, чтобы посмотреть состав{publication.active?<span style={{marginLeft:7,color:"#8ef5dc",fontWeight:900}}> · Публичная</span>:null}</div></div>
    </div>

    <div style={{ display: "flex", background: T.card, border: `1px solid ${T.line}`, borderRadius: 13, padding: 4, margin: "12px 0" }}>{[["trip", "Trip"], ["group", "Ask Group"]].map(([k, l]) => <div key={k} onClick={() => setMode(k)} className="press" style={{ flex: 1, textAlign: "center", padding: "9px 8px", borderRadius: 10, background: mode === k ? T.violet + "25" : "transparent", color: mode === k ? T.text : T.subd, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{l}{k === "group" && (t.askGroup || []).filter((x) => x.status === "open").length > 0 ? ` · ${(t.askGroup || []).filter((x) => x.status === "open").length}` : ""}</div>)}</div>

    {mode === "trip" ? <>
      {today.active && <div style={{ background: "linear-gradient(135deg,rgba(48,215,184,.18),rgba(124,92,255,.12))", border: `1px solid ${T.green}55`, borderRadius: 18, padding: 15, marginBottom: 10 }}><div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><div style={{ fontFamily: "Sora,sans-serif", fontSize: 20, fontWeight: 800, color: T.text }}>Сегодня</div><div style={{ fontSize: 11.5, color: T.subd }}>{fmtShort(new Date(today.today))}</div><div style={{ flex: 1 }} /><span style={{ fontSize: 10.5, color: T.green, fontWeight: 800 }}>TRAVEL MODE</span></div>{today.next ? <><div style={{ fontSize: 11, color: T.subd, marginTop: 10 }}>Следующее</div><div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginTop: 2 }}>{today.next.time ? `${today.next.time} · ` : ""}{today.next.title}</div>{today.next.sub && <div style={{ fontSize: 11, color: T.subd, marginTop: 3 }}>{today.next.sub}</div>}</> : <div style={{ fontSize: 12, color: T.sub, marginTop: 9 }}>На сегодня ничего не запланировано. Спроси TripWise, что посмотреть рядом.</div>}{today.todayEvents.length > 1 && <div style={{display:"flex",gap:12,alignItems:"center",marginTop:10}}><div onClick={() => setTimelineOpen(true)} style={{ fontSize: 11.5, color: T.violet, fontWeight: 800, cursor: "pointer" }}>Весь день · {today.todayEvents.length} событий →</div>{todayLocations.length>1&&<div onClick={openTodayMap} style={{fontSize:11.5,color:T.cyan,fontWeight:800,cursor:"pointer"}}>Маршрут на карте ↗</div>}</div>}</div>}

      <div style={{ background: "linear-gradient(135deg,rgba(124,92,255,.18),rgba(72,220,220,.08))", border: `1px solid ${T.violet}55`, borderRadius: 18, padding: 15, marginBottom: 10 }}><div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}><div style={{ fontFamily: "Sora,sans-serif", fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{p.pct}%</div><div style={{ fontSize: 12, fontWeight: 800, color: p.pct === 100 ? T.green : T.violet, paddingBottom: 2 }}>ready</div><div style={{ flex: 1 }} /><div style={{ fontSize: 11, color: T.subd }}>{p.total - p.done} {plural(p.total - p.done, "действие", "действия", "действий")} осталось</div></div><div style={{ height: 9, borderRadius: 999, background: "rgba(255,255,255,.08)", marginTop: 12, overflow: "hidden" }}><div style={{ height: "100%", width: p.pct + "%", borderRadius: 999, background: GRAD.cta, transition: "width .25s" }} /></div><div style={{ fontSize: 11.5, color: T.sub, marginTop: 10 }}>{p.pct === 100 ? "Поездка готова. Можно ехать." : act.title + " — " + act.sub}</div></div>

      {(t.activityLog || []).length > 0 && <div onClick={openActivity} className="press" style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${unseenActivity ? T.violet + "55" : T.line}`, borderRadius: 14, padding: 11, marginBottom: 10, cursor: "pointer" }}><span style={{ fontSize: 16 }}>⚡</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{unseenActivity ? `Что нового · ${unseenActivity}` : "История изменений"}</div><div style={{ fontSize: 10.5, color: T.subd, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{latestActivity && latestActivity.text}</div></div><Icon d={I.chevR} size={14} color={T.subd} /></div>}

      <div onClick={() => setBudgetOpen(true)} className="press" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 13, marginBottom: 10, cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 18 }}>💸</div><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, flex: 1 }}>Бюджет поездки</div>{budget.baseTotal != null && <b style={{ fontSize: 12, color: T.text }}>≈ {money(budget.baseTotal, budget.baseCurrency)}</b>}<Icon d={I.chevR} size={14} color={T.subd} /></div>{budget.groups.length ? <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>{budget.groups.slice(0, 3).map((g) => <div key={g.currency} style={{ display: "flex", fontSize: 11.5 }}><span style={{ color: T.subd, flex: 1 }}>{g.currency} · оплачено {Math.min(100, Math.round(g.paid / Math.max(1, g.total) * 100))}%</span><b style={{ color: T.text }}>{money(g.total, g.currency)}</b>{budget.me && <span style={{ color: T.subd, marginLeft: 8 }}>· ваша доля {money(g.myShare, g.currency)}</span>}</div>)}</div> : <div style={{ fontSize: 11, color: T.subd, marginTop: 6 }}>Добавляйте цены — TripWise посчитает доли, плательщиков и взаиморасчёты.</div>}</div>
      <TimelinePreview />

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: "0 12px", marginBottom: 10 }}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 2px 7px"}}><div style={{fontFamily:"Sora,sans-serif",fontSize:15,fontWeight:800,color:T.text,flex:1}}>План поездки</div><span style={{fontSize:10.3,color:syncState==="error"?"#ff7ba9":syncState==="syncing"?T.cyan:T.subd}}>{syncState==="error"?"Не сохранено · повторяем":syncState==="syncing"?"Синхронизация…":"Сохранено"}</span></div>
        <div onClick={()=>setAddPlanOpen(true)} className="press" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,border:`1px dashed ${T.violet}66`,background:T.violet+"0e",borderRadius:13,padding:10,margin:"0 0 8px",color:T.violet,fontSize:11.5,fontWeight:900,cursor:"pointer"}}>＋ Добавить в план</div>
        {isCreator&&<div style={{fontSize:10.5,color:T.subd,margin:"0 2px 5px"}}>Зажмите раздел, чтобы удалить его целиком. Пустые разделы не показываются никому.</div>}
        {sectionVisible("tickets")&&<><SectionHead k="tickets" icon="✈️" title="Билеты" sub={flightCount?`${flightCount} ${plural(flightCount,"рейс","рейса","рейсов")}`:"Добавьте билеты, когда они понадобятся"} done={checks.tickets?1:0} total={flightCount?1:0} action={()=>setFlightOpen(true)}/>{open.tickets&&<div style={{padding:"0 0 12px 44px"}}>{t.route&&<div style={{background:T.card2,borderRadius:11,padding:9,margin:"4px 0 7px"}}><div style={{fontSize:11.5,fontWeight:800,color:T.text}}>{t.route.codes||"Выбранный маршрут"}</div><div style={{display:"flex",gap:10,marginTop:6}}><span onClick={()=>onFindTickets(t)} style={{fontSize:10.5,color:T.violet,fontWeight:800,cursor:"pointer"}}>Заменить</span><span onClick={()=>setConfirmDanger({title:"Убрать выбранный маршрут?",text:"Рейсы из поиска исчезнут из поездки. Ручные перелёты останутся.",label:"Убрать",action:()=>upd(x=>({...x,route:null,checks:{...(x.checks||{}),tickets:false}}))})} style={{fontSize:10.5,color:"#ff7ba9",fontWeight:800,cursor:"pointer"}}>Удалить</span></div></div>}{manualJourneys.map(j=><FlightJourneyRow key={j.id} item={j}/>)}{legacyFlights.length>0&&legacyFlights.map((j,i)=><PlanRow key={j.id||i} kind="manualFlights" item={j}/>)}{!flightCount&&<Empty>Билетов пока нет. Добавьте рейс или найдите маршрут.</Empty>}<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}><span onClick={()=>setFlightOpen(true)} style={{fontSize:11,color:T.violet,fontWeight:800,cursor:"pointer"}}>＋ Добавить рейс</span><span onClick={()=>onFindTickets(t)} style={{fontSize:11,color:T.violet,fontWeight:800,cursor:"pointer"}}>Найти билеты</span><span onClick={()=>upd(x=>({...x,checks:{...(x.checks||{}),tickets:!checks.tickets}}))} style={{fontSize:11,color:checks.tickets?T.green:T.subd,fontWeight:800,cursor:"pointer"}}>{checks.tickets?"✓ Куплены":"Отметить купленными"}</span></div></div>}</>}
        {sectionVisible("lodging")&&<><SectionHead k="lodging" icon="🏠" title="Жильё" sub={stays.length?`${lodgeDone} из ${stays.length} подтверждено`:"Добавьте бронь жилья"} done={lodgeDone} total={stays.length} action={()=>startAdd("stays")}/>{open.lodging&&<div style={{padding:"0 0 12px 44px"}}>{stays.length?stays.map(x=><PlanRow key={x.id} kind="stays" item={x}/>):isCreator?<Empty>Жильё ещё не добавлено.</Empty>:null}<div style={{display:"flex",gap:10,marginTop:5}}><span onClick={()=>startAdd("stays")} style={{fontSize:11,color:T.violet,fontWeight:800,cursor:"pointer"}}>＋ Добавить бронь</span><span onClick={goHotels} style={{fontSize:11,color:T.violet,fontWeight:800,cursor:"pointer"}}>Сравнить сервисы</span></div></div>}</>}
        {sectionVisible("transport")&&<><SectionHead k="transport" icon="🚗" title="Транспорт" sub={(t.transport||[]).length?`${(t.transport||[]).filter(x=>x.done).length} из ${(t.transport||[]).length} подтверждено`:"Авто, поезд, паром или трансфер"} done={(t.transport||[]).filter(x=>x.done).length} total={(t.transport||[]).length} action={()=>startAdd("transport")}/>{open.transport&&<div style={{padding:"0 0 12px 44px"}}>{(t.transport||[]).length?(t.transport||[]).map(x=><PlanRow key={x.id} kind="transport" item={x}/>):<Empty>Транспорт пока не добавлен.</Empty>}</div>}</>}
        {sectionVisible("activities")&&<><SectionHead k="activities" icon="🍽️" title="Активности" sub={(t.activities||[]).length?`${(t.activities||[]).filter(x=>x.done).length} из ${(t.activities||[]).length} подтверждено`:"Рестораны, места и активности"} done={(t.activities||[]).filter(x=>x.done).length} total={(t.activities||[]).length} action={()=>startAdd("activities")}/>{open.activities&&<div style={{padding:"0 0 12px 44px"}}>{(t.activities||[]).length?(t.activities||[]).map(x=><PlanRow key={x.id} kind="activities" item={x}/>):<Empty>Активностей пока нет.</Empty>}</div>}</>}
        {sectionVisible("docs")&&<><SectionHead k="docs" icon="📄" title="Документы" sub={docsUnits.total?`${docsDone} из ${docsUnits.total} личных документов готово`:"Для этой поездки обязательных документов нет"} done={docsDone} total={docsUnits.total}/>{open.docs&&(()=>{const ts=t.travelerStates&&viewerTraveler&&t.travelerStates[viewerTraveler.id],stateFor=doc=>ts&&ts.docs&&ts.docs[doc.id]!==undefined?!!ts.docs[doc.id]:!!docChecks[doc.id],sorted=[...docs].sort((a,b)=>Number(stateFor(a))-Number(stateFor(b))),shown=docsExpanded?sorted:sorted.slice(0,Math.min(5,sorted.length)),left=sorted.length-shown.length;return <div style={{padding:"0 0 12px 44px"}}>{shown.map(doc=>{const myDone=stateFor(doc);return <div key={doc.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0"}}><Check on={myDone} onClick={()=>viewerTraveler?setTravelerDoc(viewerTraveler,doc,!myDone):toggleDoc(doc.id)}/><span onClick={()=>setDocOpen(doc)} style={{fontSize:12,color:T.text,flex:1,cursor:"pointer"}}>{doc.name}</span><TimeBadge st={docStatus(doc,t.df)}/></div>})}{left>0&&<div onClick={()=>setDocsExpanded(true)} style={{fontSize:11,color:T.violet,fontWeight:800,padding:"5px 0",cursor:"pointer"}}>Ещё {left}</div>}{docsExpanded&&docs.length>5&&<div onClick={()=>setDocsExpanded(false)} style={{fontSize:11,color:T.subd,fontWeight:700,padding:"5px 0",cursor:"pointer"}}>Свернуть</div>}</div>})()}</>}
        {sectionVisible("prep")&&<><SectionHead k="prep" icon="🧳" title="Сборы" sub={prepItems.length?`${prepItems.filter(x=>x.done).length} из ${prepItems.length} готово`:"Свои задачи перед поездкой"} done={prepItems.filter(x=>x.done).length} total={prepItems.length} action={()=>startAdd("custom")}/>{open.prep&&<div style={{padding:"0 0 12px 44px"}}>{prepItems.length?prepItems.map(it=><div key={it.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0"}}><Check on={it.done} onClick={()=>togglePrep(it)}/><span style={{fontSize:12,color:T.text,flex:1}}>{it.name}</span>{it.item&&<PriceBadge kind="custom" item={it.item}/>}</div>):<Empty>Сборов пока нет.</Empty>}</div>}</>}
      </div>
      <div style={{marginTop:10}}><div onClick={()=>setImportOpen(true)} className="press" style={{textAlign:"center",border:`1px solid ${T.violet}55`,background:T.violet+"12",borderRadius:13,padding:11,color:T.violet,fontSize:11.5,fontWeight:800,cursor:"pointer"}}>✦ Импортировать бронь в поездку</div></div>
    </> : <>
      <div style={{ display: "flex", alignItems: "center", margin: "2px 2px 10px" }}><div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontSize: 16, fontWeight: 800, color: T.text }}>Решения группы</div><div style={{ fontSize: 11, color: T.subd, marginTop: 2 }}>Вопросы уходят участникам в бот; обычные изменения собираются в тихий дайджест.</div></div><div onClick={() => setAskOpen(true)} className="press" style={{ borderRadius: 999, background: T.violet + "22", border: `1px solid ${T.violet}55`, padding: "7px 11px", color: T.violet, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>＋ Спросить</div></div>
      {(t.askGroup || []).length ? (t.askGroup || []).map((q) => { const counts = Object.fromEntries((q.options || []).map((o) => [o.id, 0])); Object.values(q.votes || {}).forEach((v) => { if (counts[v] != null) counts[v]++; }); const myVote = q.votes && q.votes[meId], resolved = (q.options || []).find((o) => o.id === q.resolvedOptionId); return <div key={q.id} style={{ background: T.card, border: `1px solid ${q.status === "open" ? T.violet + "55" : T.line}`, borderRadius: 17, padding: 13, marginBottom: 9 }}><div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.violet, fontWeight: 800, marginBottom: 3 }}>{({ yesno: "ДА / НЕТ", approval: "СОГЛАСОВАНИЕ", availability: "ДОСТУПНОСТЬ", choice: "ВЫБОР" }[q.type] || "ВЫБОР")}</div><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{q.title}</div>{q.description && <div style={{ fontSize: 11, color: T.subd, marginTop: 3 }}>{q.description}</div>}<div style={{ fontSize: 10, color: T.subd, marginTop: 5 }}>от {q.createdByName || "участника"}</div></div>{q.status !== "open" && <span style={{ fontSize: 10.5, fontWeight: 800, color: T.green }}>РЕШЕНО</span>}</div><div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>{(q.options || []).map((o) => <div key={o.id} onClick={() => q.status === "open" && vote(q, o.id)} className="press" style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${myVote === o.id ? T.violet : T.line}`, background: myVote === o.id ? T.violet + "18" : T.card2, borderRadius: 11, padding: "9px 10px", cursor: q.status === "open" ? "pointer" : "default" }}><span style={{ fontSize: 12.5, color: T.text, flex: 1 }}>{o.label}</span><span style={{ fontSize: 11, fontWeight: 800, color: myVote === o.id ? T.violet : T.subd }}>{counts[o.id] || 0}</span>{isCreator && q.status === "open" && <span onClick={(e) => { e.stopPropagation(); resolvePoll(q, o.id); }} style={{ fontSize: 10, color: T.subd, paddingLeft: 5, cursor: "pointer" }}>зафиксировать</span>}</div>)}</div>{resolved && <div style={{ fontSize: 11.5, color: T.green, marginTop: 9 }}>✓ Решение: {resolved.label}</div>}</div>; }) : <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 17, padding: 22, textAlign: "center" }}><div style={{ fontSize: 24 }}>🙋</div><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginTop: 6 }}>Пока ничего не обсуждаем</div><div style={{ fontSize: 11.5, color: T.subd, marginTop: 4 }}>Предложите отель, ресторан, активность или любой другой вариант.</div></div>}
    </>}

    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 420, padding: "8px 14px", paddingBottom: `max(${bottomStr}, 12px)`, background: "linear-gradient(transparent,#0a0a18 22%)", zIndex: 24 }}><div className="carousel" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 1px 7px" }}>{quick.map((q) => <div key={q} onClick={() => askAI(q)} className="press" style={{ flexShrink: 0, border: `1px solid ${T.line}`, background: T.card, borderRadius: 999, padding: "6px 10px", fontSize: 10.8, color: T.sub, cursor: "pointer" }}>{q}</div>)}</div><div onClick={() => { setChatOpen(true); loadChatHistory(); }} className="press" style={{ display: "flex", alignItems: "center", gap: 9, background: T.card2, border: `1px solid ${T.violet}55`, boxShadow: "0 8px 28px rgba(0,0,0,.35)", borderRadius: 15, padding: "11px 12px", cursor: "text" }}><div style={{ width: 27, height: 27, borderRadius: 9, background: GRAD.cta, display: "grid", placeItems: "center", fontSize: 13 }}>✦</div><span style={{ fontSize: 13, color: T.subd, flex: 1 }}>Ask TripWise…</span><Icon d={I.arrow} size={15} color={T.violet} /></div></div>

    {peopleOpen && <Overlay onClose={() => setPeopleOpen(false)}><SheetHead title={`Путешественники · ${travelers.length}`} onClose={() => setPeopleOpen(false)} /><div style={{ fontSize: 11, color: T.subd, marginBottom: 10 }}>{members.length} в TripWise · финансовый план считается по {travelers.length} {plural(travelers.length, "человеку", "людям", "людям")}</div><div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{travelers.map((tr) => { const m = members.find((x) => String(x.id) === String(tr.memberId || "")), r = travelerReadiness(t, tr, budget); return <div key={tr.id} onClick={() => setTravelerOpen(tr)} className="press" style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 13, padding: 10, cursor: "pointer" }}><div style={{ width: 36, height: 36, borderRadius: 999, background: gradFor(tr.name.slice(0, 2)), display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#fff", overflow: "hidden" }}>{m && m.photoUrl ? <img src={m.photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : memberInitials({ displayName: tr.name })}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{tr.name}</div><div style={{ fontSize: 10.5, color: m ? T.green : T.subd }}>{m ? `✓ в TripWise${String(m.id) === String(t.creatorId) ? " · создатель" : ""}` : "без аккаунта · участвует в расчётах"}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 800, color: r.pct === 100 ? T.green : T.violet }}>{r.pct}%</div><div style={{ fontSize: 9.5, color: T.subd }}>лично</div></div>{isCreator && m && String(m.id) !== String(t.creatorId) && <span onClick={(e) => { e.stopPropagation(); setConfirmDanger({ title:"Удалить участника?", text:`${m.displayName || "Участник"} потеряет доступ к поездке. Его финансовый слот останется в истории расходов. Старая invite-ссылка будет отозвана.`, label:"Удалить", action:()=>removeMember(m) }); }} style={{ fontSize: 10.5, color: "#ff6db0", cursor: "pointer" }}>×</span>}{isCreator && !m && travelers.length > 1 && <span onClick={(e) => { e.stopPropagation(); setConfirmDanger({ title:"Убрать путешественника?", text:`${tr.name} будет убран из будущих расчётов. Уже созданные расходы не пересчитаются.`, label:"Убрать", action:()=>removeTraveler(tr) }); }} style={{ fontSize: 10.5, color: T.subd, cursor: "pointer" }}>×</span>}</div>; })}</div>{isCreator && <><div style={{ display: "flex", gap: 7, marginTop: 12 }}><input value={travelerName} onChange={(e) => setTravelerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTraveler()} placeholder="Имя нового путешественника" style={{ flex: 1, background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 11px", color: T.text, outline: "none" }} /><div onClick={addTraveler} className="press" style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px", color: T.violet, fontWeight: 800, cursor: "pointer" }}>＋</div></div><div onClick={invite} className="press" style={{ marginTop: 9, textAlign: "center", background: GRAD.cta, borderRadius: 13, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Пригласить пользователя TripWise</div></>}</Overlay>}

    {travelerOpen && (() => { const tr = travelerOpen, r = travelerReadiness(t, tr, budget), own = viewerTraveler && viewerTraveler.id === tr.id; return <Overlay onClose={() => setTravelerOpen(null)}><SheetHead title={`${tr.name} · ${r.pct}%`} onClose={() => setTravelerOpen(null)} /><div style={{ height: 8, borderRadius: 999, background: T.line, overflow: "hidden", marginBottom: 13 }}><div style={{ width: r.pct + "%", height: "100%", background: GRAD.cta }} /></div>{r.items.length ? r.items.map((it) => <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${T.line}` }}><div style={{ width: 20, height: 20, borderRadius: 7, border: `1px solid ${it.done ? T.green : T.line}`, display: "grid", placeItems: "center", color: T.green }}>{it.done ? "✓" : ""}</div><span style={{ fontSize: 12, color: it.done ? T.subd : T.text, flex: 1 }}>{it.label}</span>{it.kind === "doc" && (isCreator || own) && (() => { const docId = it.id.slice(4), doc = docs.find((x) => x.id === docId); return doc ? <span onClick={() => setTravelerDoc(tr, doc, !it.done)} style={{ fontSize: 10.5, color: T.violet, cursor: "pointer" }}>{it.done ? "снять" : "готово"}</span> : null; })()}</div>) : <Empty>Для этого участника сейчас нет незакрытых личных пунктов.</Empty>}</Overlay>; })()}

    {budgetOpen && <Overlay onClose={() => setBudgetOpen(false)}><SheetHead title="Бюджет поездки" onClose={() => setBudgetOpen(false)} /><div style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 14, padding: 11, marginBottom: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.subd }}>Базовая валюта</div><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>{t.baseCurrency || "EUR"}{t.fxSnapshot && t.fxSnapshot.date ? ` · курс ${t.fxSnapshot.date}` : " · без конвертации"}</div></div>{isCreator && <select value={baseDraft} onChange={(e) => setBaseDraft(e.target.value)} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8, color: T.text }}>{COST_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>}{isCreator && <div onClick={refreshFx} className="press" style={{ borderRadius: 10, padding: "8px 10px", background: T.violet + "22", color: T.violet, fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>{fxBusy ? "…" : "Обновить"}</div>}</div>{budget.baseTotal != null && <div style={{ fontFamily: "Sora,sans-serif", fontSize: 21, fontWeight: 800, color: T.text, marginTop: 9 }}>≈ {money(budget.baseTotal, budget.baseCurrency)}</div>}</div><div onClick={()=>{setBudgetOpen(false);startAdd("expense");}} className="press" style={{textAlign:"center",border:`1px dashed ${T.cyan}66`,borderRadius:12,padding:9,color:T.cyan,fontSize:11.5,fontWeight:800,cursor:"pointer",marginBottom:10}}>＋ Добавить отдельный расход</div>{budget.groups.length ? budget.groups.map((g) => <div key={g.currency} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 15, padding: 12, marginBottom: 10 }}><div style={{ display: "flex", alignItems: "baseline" }}><div style={{ fontSize: 13, fontWeight: 800, color: T.text, flex: 1 }}>{g.currency}</div><div style={{ fontFamily: "Sora,sans-serif", fontSize: 18, fontWeight: 800, color: T.text }}>{money(g.total, g.currency)}</div></div><div style={{ display: "flex", gap: 10, fontSize: 10.8, color: T.subd, marginTop: 5, flexWrap: "wrap" }}><span>Оплачено поставщикам: {money(g.paid, g.currency)}</span>{g.unpaidProvider > .01 && <span style={{ color: "#ff9b62" }}>осталось оплатить {money(g.unpaidProvider, g.currency)}</span>}{budget.me && <span>Ваша доля: {money(g.myShare, g.currency)}</span>}{budget.me && <span style={{ color: g.myBalance < -.01 ? "#ff9b62" : g.myBalance > .01 ? T.green : T.subd }}>{g.myBalance < -.01 ? `Ваш баланс −${money(-g.myBalance, g.currency)}` : g.myBalance > .01 ? `Вам должны ${money(g.myBalance, g.currency)}` : "Баланс закрыт"}</span>}</div><div style={{ marginTop: 10 }}>{g.items.map((it) => <div key={it.kind + it.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.line}` }}><div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: T.text, fontWeight: 700 }}>{it.name}{it.estimate ? " · оценка" : ""}</div><div style={{ fontSize: 10, color: T.subd }}>{(()=>{const ns=(it.splitIds||[]).map(id=>budget.names[id]).filter(Boolean);return ns.length?`делится: ${ns.join(", ")}`:`${it.splitIds.length} ${plural(it.splitIds.length,"человек","человека","человек")}`;})()} · оплачено {money(it.paidAmount || 0, it.currency)}</div></div><b style={{ fontSize: 11.5, color: T.text }}>{money(it.total, it.currency)}</b>{!it.estimate&&<span onClick={()=>{setBudgetOpen(false);openCost(it.kind,it.raw);}} style={{fontSize:10.5,color:T.violet,fontWeight:800,cursor:"pointer"}}>изменить</span>}</div>)}</div>{g.settlements.length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: T.text, marginTop: 9 }}>Кому скинуться</div>{g.settlements.map((s, i) => { const can = isCreator || (viewerTraveler && s.from===viewerTraveler.id); return <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}><span style={{ fontSize: 11, color: T.sub, flex: 1 }}>{budget.names[s.from] || "Участник"} → {budget.names[s.to] || "Участник"}: <b>{money(s.amount, g.currency)}</b></span>{can && <span onClick={() => !settleBusy && markSettlement({ ...s, currency: g.currency })} style={{ fontSize: 10.5, color: T.violet, fontWeight: 800, cursor: "pointer" }}>переведено</span>}</div>; })}</>}</div>) : <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 15, padding: 18, textAlign: "center", fontSize: 11.5, color: T.subd }}>Цен пока нет. Добавьте стоимость к жилью, транспорту, активностям или перелётам.</div>}{(t.settlementPayments || []).length > 0 && <div style={{ marginTop: 12 }}><div style={{ fontSize: 11.5, fontWeight: 800, color: T.text, marginBottom: 5 }}>Учтённые переводы</div>{(t.settlementPayments || []).slice(0, 20).map((x) => { const can = isCreator || (viewerTraveler && x.fromTravelerId===viewerTraveler.id && String(x.recordedBy||"")===String(meId||"")); return <div key={x.id} style={{ display: "flex", gap: 7, fontSize: 10.8, color: T.sub, padding: "6px 0", borderTop: `1px solid ${T.line}` }}><span style={{ flex: 1 }}>{budget.names[x.fromTravelerId] || "Участник"} → {budget.names[x.toTravelerId] || "Участник"}: <b>{money(x.amount, x.currency)}</b></span>{can && <span onClick={() => removeSettlement(x)} style={{ color: "#ff6db0", cursor: "pointer" }}>отменить</span>}</div>; })}</div>}<div style={{ fontSize: 10.5, color: T.subd, lineHeight: 1.45, marginTop: 10 }}>Оплаты поставщикам и переводы между участниками — разные вещи. Частичная оплата не создаёт выдуманный долг: TripWise отдельно показывает, сколько ещё не оплачено поставщику.</div></Overlay>}

    {timelineOpen && <Overlay onClose={() => setTimelineOpen(false)}><SheetHead title="Таймлайн поездки" onClose={() => setTimelineOpen(false)} />
      {(timelinePrep.length>0||p.total>0)&&<div style={{background:`linear-gradient(135deg,${T.violet}14,${T.cyan}09)`,border:`1px solid ${T.line}`,borderRadius:15,padding:12,marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontFamily:"Sora,sans-serif",fontSize:12.5,fontWeight:800,color:T.text,flex:1}}>До поездки</div><span style={{fontSize:10.5,fontWeight:900,color:p.pct===100?T.green:T.violet}}>{p.pct}% ready</span></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>{timelinePrep.map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5,border:`1px solid ${x.ok?T.green+"44":T.line}`,background:x.ok?T.green+"0f":T.card,borderRadius:999,padding:"5px 8px",fontSize:10.5,color:x.ok?T.green:T.sub}}><span>{x.icon}</span><span>{x.label} · <b>{x.value}</b></span></div>)}</div>{docsUnits.total>0&&<div style={{fontSize:10.3,color:T.subd,lineHeight:1.4,marginTop:8}}>Документы собраны в одну сводку — отдельные паспорта, визы и анкеты не засоряют событийную ленту.</div>}</div>}
      {timeline.length ? (() => { const groups = {}; timeline.forEach((e) => (groups[e.date] ||= []).push(e)); return Object.entries(groups).map(([date, es]) => {const dn=dayNo(date),locs=[...new Set(es.map(e=>e.location).filter(Boolean))].slice(0,2);return <div key={date} style={{ marginBottom: 16 }}><div style={{display:"flex",alignItems:"baseline",gap:7,marginBottom:7}}><div style={{ fontFamily: "Sora,sans-serif", fontSize: 13.5, fontWeight: 800, color: date === today.today ? T.green : T.text }}>{fmtShort(new Date(date))}{date === today.today ? " · сегодня" : ""}</div>{dn&&<span style={{fontSize:10.3,color:T.violet,fontWeight:800}}>День {dn}</span>}<div style={{flex:1}}/>{locs.length>0&&<span style={{fontSize:10.2,color:T.subd,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{locs.join(" · ")}</span>}</div><div style={{borderLeft:`1px solid ${T.line2}`,marginLeft:10,paddingLeft:13}}>{es.map((e) => <div key={e.id} style={{ position:"relative",display: "flex", gap: 9, padding: "7px 0 9px" }}><div style={{position:"absolute",left:-24,top:7,width:20,height:20,borderRadius:999,background:e.type==="trip-start"||e.type==="trip-end"?T.violet+"28":T.card2,border:`1px solid ${e.type==="trip-start"||e.type==="trip-end"?T.violet+"66":T.line}`,display:"grid",placeItems:"center",fontSize:10}}>{timelineGlyph(e.type)}</div><div style={{ width: 43, fontSize: 10.8, color: T.subd }}>{e.time || ""}</div><div style={{ flex: 1,minWidth:0 }}><div style={{ fontSize: 12.2, color: T.text, fontWeight: e.type==="trip-start"||e.type==="trip-end"?800:700 }}>{e.title}</div>{e.sub && <div style={{ fontSize: 10.5, color: T.subd, marginTop: 2,lineHeight:1.35 }}>{e.sub}</div>}</div></div>)}</div></div>}); })() : <Empty>Пока нет событий с датой. Даты поездки автоматически создадут начало и завершение, а жильё, транспорт и активности встанут между ними.</Empty>}
    </Overlay>}
    {activityOpen && <Overlay onClose={() => setActivityOpen(false)}><SheetHead title="Что изменилось" onClose={() => setActivityOpen(false)} />{(t.activityLog || []).length ? (t.activityLog || []).slice(0, 60).map((e) => <div key={e.id} style={{ display: "flex", gap: 9, padding: "9px 0", borderTop: `1px solid ${T.line}` }}><div style={{ width: 7, height: 7, borderRadius: 99, background: e.type === "budget" ? T.cyan : e.type === "ask" ? T.violet : T.subd, marginTop: 6 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, color: T.text }}>{e.text}</div><div style={{ fontSize: 9.8, color: T.subd, marginTop: 2 }}>{e.createdAt ? new Date(e.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div></div></div>) : <Empty>Изменений пока нет.</Empty>}</Overlay>}

    {settingsOpen && <Overlay onClose={() => setSettingsOpen(false)}><SheetHead title="Настройки поездки" onClose={() => setSettingsOpen(false)} />{isCreator ? <><div style={{ fontSize: 11.5, color: T.subd, marginBottom: 6 }}>Название</div><input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveTitle()} style={{ width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, outline: "none", marginBottom: 10 }} /><div onClick={saveTitle} className="press" style={{ textAlign: "center", background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, color: T.text, fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginBottom: 9 }}>Сохранить название</div><div onClick={() => creatorUpd((x) => ({ ...x, notify: x.notify === false ? true : false }))} className="press" style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, cursor: "pointer", marginBottom: 9 }}><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Уведомления через бота</div><div style={{ fontSize: 10.5, color: T.subd, marginTop: 2 }}>Сразу — Ask Group и критичное; обычные изменения — тихим дайджестом.</div></div><span style={{ color: t.notify !== false ? T.green : T.subd }}>{t.notify !== false ? "Вкл" : "Выкл"}</span></div><div onClick={() => { setSettingsOpen(false); setImportOpen(true); }} className="press" style={{ textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, color: T.violet, fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginBottom: 9 }}>Импортировать бронь</div><div onClick={openPublish} className="press" style={{display:"flex",alignItems:"center",gap:9,background:publication.active?T.green+"12":T.card,border:`1px solid ${publication.active?T.green+"55":T.line}`,borderRadius:12,padding:11,cursor:"pointer",marginBottom:9}}><div style={{fontSize:17}}>🌍</div><div style={{flex:1,textAlign:"left"}}><div style={{fontSize:12.5,fontWeight:800,color:publication.active?T.green:T.text}}>{publication.active?"Публичная поездка":"Опубликовать поездку"}</div><div style={{fontSize:10.5,color:T.subd,marginTop:2}}>{publication.active?`${Math.max(0,(publication.capacity||travelers.length)-travelers.length)} свободных мест · изменить условия`:"Найти попутчиков через витрину TripWise"}</div></div><Icon d={I.chevR} size={14} color={T.subd}/></div>{members.filter(m=>String(m.id)!==meId).length>0&&<div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:10,marginBottom:9}}><div style={{fontSize:11.5,fontWeight:800,color:T.text,marginBottom:6}}>Передать управление</div><div style={{display:"flex",gap:6}}><select value={transferTo} onChange={e=>setTransferTo(e.target.value)} style={{flex:1,background:T.card2,border:`1px solid ${T.line}`,borderRadius:9,padding:8,color:T.text}}><option value="">Выберите участника</option>{members.filter(m=>String(m.id)!==meId).map(m=><option key={m.id} value={m.id}>{m.displayName||"Участник"}</option>)}</select><div onClick={()=>transferTo&&!transferBusy&&setConfirmDanger({title:"Передать управление поездкой?",text:"Новый создатель сможет управлять участниками, структурой поездки и удалением. Вы останетесь обычным участником.",label:"Передать",action:transferOwnership})} className="press" style={{padding:"8px 10px",borderRadius:9,background:transferTo?T.violet+"22":T.card2,color:transferTo?T.violet:T.subd,fontSize:10.5,fontWeight:800,cursor:transferTo?"pointer":"default"}}>{transferBusy?"…":"Передать"}</div></div></div>}<div onClick={() => { setSettingsOpen(false); setConfirmDanger({ title:"Удалить поездку?", text:"Поездка исчезнет у всех участников. После подтверждения будет несколько секунд, чтобы отменить удаление.", label:"Удалить поездку", action:()=>onDelete(t.id) }); }} className="press" style={{ textAlign: "center", background: "#ff6db015", border: "1px solid #ff6db044", borderRadius: 12, padding: 11, color: "#ff6db0", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Удалить поездку</div></> : <><div style={{ fontSize: 12, color: T.sub, lineHeight: 1.45, marginBottom: 12 }}>Все участники могут добавлять и редактировать пункты общего плана, расходы и Ask Group. Управление людьми и структурой поездки остаётся у создателя.</div><div onClick={() => { setSettingsOpen(false); setConfirmDanger({ title:"Выйти из поездки?", text:"Вы потеряете доступ к общему плану. Ваш финансовый слот и история расходов останутся у остальных участников.", label:"Выйти", action:leaveTrip }); }} className="press" style={{ textAlign: "center", background: "#ff6db015", border: "1px solid #ff6db044", borderRadius: 12, padding: 11, color: "#ff6db0", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Выйти из поездки</div></>}</Overlay>}

    {publishOpen&&<Overlay onClose={()=>setPublishOpen(false)}><SheetHead title={publication.active?"Публичная поездка":"Опубликовать поездку"} onClose={()=>setPublishOpen(false)}/><div style={{fontSize:11.5,color:T.subd,lineHeight:1.45,marginBottom:11}}>В витрину попадут только даты, маршрут, ориентир бюджета, выбранные лейблы и публичный состав. Брони, документы, долги, адреса жилья и AI-диалоги остаются приватными.</div><textarea value={pubForm.description} onChange={e=>setPubForm(f=>({...f,description:e.target.value}))} rows={3} placeholder="Коротко о поездке и кого хотите найти" style={{width:"100%",resize:"none",background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 11px",color:T.text,outline:"none",fontFamily:"Manrope,sans-serif"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:9}}><label style={{fontSize:10.5,color:T.subd}}>Свободных мест<input type="number" min="1" max="20" value={pubForm.freeSeats} onChange={e=>setPubForm(f=>({...f,freeSeats:e.target.value}))} style={{width:"100%",marginTop:5,background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,outline:"none"}}/></label><label style={{fontSize:10.5,color:T.subd}}>Валюта<select value={pubForm.currency} onChange={e=>setPubForm(f=>({...f,currency:e.target.value}))} style={{width:"100%",marginTop:5,background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text}}>{COST_CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label></div><div style={{fontSize:10.5,color:T.subd,marginTop:10}}>Ориентир бюджета на человека</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:5}}><input inputMode="decimal" value={pubForm.budgetMin} onChange={e=>setPubForm(f=>({...f,budgetMin:e.target.value.replace(",",".")}))} placeholder="от" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,outline:"none"}}/><input inputMode="decimal" value={pubForm.budgetMax} onChange={e=>setPubForm(f=>({...f,budgetMax:e.target.value.replace(",",".")}))} placeholder="до" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,outline:"none"}}/></div><div style={{fontSize:10.5,color:T.subd,marginTop:11,marginBottom:6}}>Как считаем расходы</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[["self","Каждый за себя"],["split","Общие расходы делим"],["covered","Часть уже оплачена"],["discuss","Обсудим"]].map(([v,l])=><span key={v} onClick={()=>setPubForm(f=>({...f,costMode:v}))} className="press" style={{fontSize:10.5,fontWeight:800,color:pubForm.costMode===v?T.violet:T.subd,border:`1px solid ${pubForm.costMode===v?T.violet+"66":T.line}`,background:pubForm.costMode===v?T.violet+"13":T.card,borderRadius:999,padding:"6px 9px",cursor:"pointer"}}>{l}</span>)}</div>{pubForm.costMode==="covered"&&<><div style={{fontSize:10.5,color:T.subd,marginTop:10,marginBottom:6}}>Что уже покрыто</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[["stay","🏠 Жильё"],["transport","🚗 Транспорт"],["activities","🎟 Развлечения"]].map(([v,l])=><span key={v} onClick={()=>togglePubChip("covered",v)} className="press" style={{fontSize:10.5,fontWeight:800,color:(pubForm.covered||[]).includes(v)?T.green:T.subd,border:`1px solid ${(pubForm.covered||[]).includes(v)?T.green+"66":T.line}`,borderRadius:999,padding:"6px 9px",cursor:"pointer"}}>{l}</span>)}</div></>}<div style={{fontSize:10.5,color:T.subd,marginTop:11,marginBottom:6}}>Формат поездки</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["Road trip","Активный","Гастрономия","Nightlife","Пляж","Weekend","Комфорт","Экономно"].map(v=><span key={v} onClick={()=>togglePubChip("tags",v)} className="press" style={{fontSize:10.5,fontWeight:800,color:(pubForm.tags||[]).includes(v)?T.cyan:T.subd,border:`1px solid ${(pubForm.tags||[]).includes(v)?T.cyan+"66":T.line}`,borderRadius:999,padding:"6px 9px",cursor:"pointer"}}>{v}</span>)}</div><div style={{fontSize:10.5,color:T.subd,marginTop:11,marginBottom:5}}>Кого ищем · необязательно</div><div style={{display:"grid",gridTemplateColumns:"1.25fr .8fr .8fr",gap:7}}><select value={pubForm.preferredGender} onChange={e=>setPubForm(f=>({...f,preferredGender:e.target.value}))} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text}}><option value="any">Пол неважен</option><option value="male">Мужчина</option><option value="female">Женщина</option></select><input type="number" min="18" max="80" value={pubForm.ageMin} onChange={e=>setPubForm(f=>({...f,ageMin:e.target.value}))} placeholder="от" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,outline:"none"}}/><input type="number" min="18" max="90" value={pubForm.ageMax} onChange={e=>setPubForm(f=>({...f,ageMax:e.target.value}))} placeholder="до" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:9,color:T.text,outline:"none"}}/></div><div onClick={publishTrip} className="press" style={{marginTop:14,textAlign:"center",background:GRAD.cta,borderRadius:13,padding:12,color:"#fff",fontSize:13,fontWeight:900,cursor:"pointer"}}>{publishBusy?"Публикую…":publication.active?"Сохранить публикацию":"Опубликовать"}</div>{publication.active&&<div onClick={()=>setConfirmDanger({title:"Снять поездку с витрины?",text:"Новые путешественники больше не увидят её в поиске. Участники и общий Trip останутся без изменений.",label:"Снять",action:unpublishTrip})} className="press" style={{marginTop:8,textAlign:"center",border:`1px solid ${T.line}`,borderRadius:13,padding:11,color:T.subd,fontSize:11.5,fontWeight:800,cursor:"pointer"}}>Снять с публикации</div>}</Overlay>}

    {inviteOpen && <Overlay onClose={() => setInviteOpen(false)}><SheetHead title="Пригласить в поездку" onClose={() => setInviteOpen(false)} /><div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 13 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>Одна ссылка — один общий Trip</div><div style={{ fontSize: 11.5, color: T.subd, marginTop: 5, lineHeight: 1.45 }}>Новый пользователь займёт свободный слот путешественника. Если слотов нет — TripWise добавит нового.</div>{inviteUrl ? <div style={{ marginTop: 11, background: T.card2, border: `1px dashed ${T.violet}66`, borderRadius: 11, padding: 10, fontSize: 10.5, color: T.sub, wordBreak: "break-all" }}>{inviteUrl}</div> : <div style={{ fontSize: 11.5, color: T.subd, marginTop: 11 }}>Создаю ссылку…</div>}</div>{inviteUrl && <div style={{ display: "flex", gap: 8, marginTop: 12 }}><div onClick={() => { navigator.clipboard && navigator.clipboard.writeText(inviteUrl); setToast("Ссылка скопирована"); }} className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, color: T.text, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Копировать</div><div onClick={shareInvite} className="press" style={{ flex: 1, textAlign: "center", background: GRAD.cta, borderRadius: 12, padding: 11, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Отправить</div></div>}</Overlay>}

    {askOpen && <Overlay onClose={() => setAskOpen(false)}><SheetHead title="Ask Group" onClose={() => setAskOpen(false)} /><div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>{[["yesno", "Да / Нет"], ["choice", "Выбрать"], ["approval", "Согласовать"], ["availability", "Кто может"]].map(([k, l]) => <span key={k} onClick={() => setAskKind(k)} style={{ flexShrink: 0, border: `1px solid ${askType === k ? T.violet : T.line}`, background: askType === k ? T.violet + "18" : T.card, borderRadius: 999, padding: "6px 9px", color: askType === k ? T.violet : T.subd, fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>{l}</span>)}</div><input value={askTitle} onChange={(e) => setAskTitle(e.target.value)} placeholder="Что нужно решить?" style={{ width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, outline: "none", marginBottom: 9 }} /><textarea value={askDesc} onChange={(e) => setAskDesc(e.target.value)} placeholder="Контекст — необязательно" rows={2} style={{ width: "100%", resize: "none", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", color: T.text, outline: "none", marginBottom: 9, fontFamily: "Manrope,sans-serif" }} />{askOptions.map((v, i) => <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7 }}><input value={v} onChange={(e) => setAskOptions((a) => a.map((x, j) => j === i ? e.target.value : x))} placeholder={`Вариант ${i + 1}`} style={{ flex: 1, background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 11px", color: T.text, outline: "none" }} />{askOptions.length > 2 && <div onClick={() => setAskOptions((a) => a.filter((_, j) => j !== i))} style={{ width: 34, display: "grid", placeItems: "center", color: T.subd, cursor: "pointer" }}>×</div>}</div>)}{askType === "choice" && askOptions.length < 6 && <div onClick={() => setAskOptions((a) => [...a, ""])} style={{ fontSize: 11.5, color: T.violet, fontWeight: 800, cursor: "pointer", margin: "4px 0 13px" }}>＋ Добавить вариант</div>}<div onClick={createAsk} className="press" style={{ textAlign: "center", background: GRAD.cta, borderRadius: 13, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Спросить группу</div></Overlay>}

    {addPlanOpen&&<Overlay onClose={()=>setAddPlanOpen(false)}><SheetHead title="Добавить в план" onClose={()=>setAddPlanOpen(false)}/><div style={{fontSize:11.5,color:T.subd,lineHeight:1.45,marginBottom:10}}>Пустые разделы не показываются. Как только кто-то добавит пункт, раздел появится у всей группы.</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["tickets","✈️","Перелёт"],["stays","🏠","Жильё"],["transport","🚗","Транспорт"],["activities","🍽️","Активность"],["docs","📄","Документ"],["custom","🧳","Сборы"],["expense","💸","Расход"]].map(([k,ic,l])=><div key={k} onClick={()=>addToPlan(k)} className="press" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:14,padding:12,cursor:"pointer"}}><div style={{fontSize:19}}>{ic}</div><div style={{fontSize:12.5,fontWeight:800,color:T.text,marginTop:5}}>{l}</div></div>)}</div></Overlay>}
    {addSec && <Overlay onClose={() => setAddSec(null)}><SheetHead title={addSec === "stays" ? "Добавить жильё" : addSec === "transport" ? "Добавить транспорт" : addSec === "custom" ? "Добавить в сборы" : addSec === "expense" ? "Добавить расход" : "Добавить активность"} onClose={() => setAddSec(null)} /><input autoFocus value={addForm.name} onChange={(e) => setAddForm((x) => ({ ...x, name: e.target.value }))} placeholder={addSec === "stays" ? "Hotel Norge" : addSec === "transport" ? "BMW 740d, паром, трансфер…" : addSec === "custom" ? "Страховка, eSIM, адаптер…" : addSec === "expense" ? "Бензин, парковка, продукты…" : "UNDER, музей, экскурсия…"} style={{ width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, outline: "none" }} />{addSec!=="expense"&&ScheduleFields({ kind: addSec, form: addForm, setForm: setAddForm })}{CostFields({ form: addForm, setForm: setAddForm })}<div onClick={addPlanItem} className="press" style={{ marginTop: 12, textAlign: "center", background: GRAD.cta, borderRadius: 13, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Добавить</div></Overlay>}

    {editCost && <Overlay onClose={() => setEditCost(null)}><SheetHead title={`Редактировать · ${editCost.name || "пункт"}`} onClose={() => setEditCost(null)} /><input value={editCost.name || ""} onChange={(e) => setEditCost((x) => ({ ...x, name: e.target.value }))} style={{ width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 11px", color: T.text, outline: "none" }} />{!editCost.budgetOnly&&ScheduleFields({ kind: editCost.kind === "journey" ? "flight" : editCost.kind, form: editCost, setForm: setEditCost })}{CostFields({ form: editCost, setForm: setEditCost })}<div onClick={saveCost} className="press" style={{ marginTop: 12, textAlign: "center", background: GRAD.cta, borderRadius: 13, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Сохранить</div><div onClick={()=>setConfirmDanger({title:"Удалить пункт?",text:`«${editCost.name||"Пункт"}» исчезнет из плана и бюджета. После удаления его можно сразу вернуть.`,label:"Удалить",action:()=>removePlanItem(editCost)})} className="press" style={{marginTop:8,textAlign:"center",border:"1px solid #ff6db044",background:"#ff6db010",borderRadius:13,padding:11,color:"#ff7ba9",fontSize:12,fontWeight:800,cursor:"pointer"}}>Удалить пункт</div></Overlay>}

    {flightOpen && <Overlay onClose={() => setFlightOpen(false)}><SheetHead title="Добавить перелёт" onClose={() => setFlightOpen(false)} /><div style={{ fontSize: 11, color: T.subd, lineHeight: 1.45, marginBottom: 10 }}>Один рейс — прямой перелёт. Несколько рейсов — единый journey с пересадками. CA-754, CA754 и CA 754 нормализуются одинаково.</div>{journeyLegs.map((leg, i) => <div key={i} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 10, marginBottom: 8 }}><div style={{ fontSize: 10.5, color: T.subd, marginBottom: 6 }}>{i === 0 ? "Рейс" : `Рейс после пересадки ${i}`}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 7 }}><input value={leg.flightNumber} onChange={(e) => setJourneyLegs((a) => a.map((x, j) => j === i ? { ...x, flightNumber: e.target.value.toUpperCase() } : x))} placeholder="CA-754" style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, color: T.text, outline: "none", textTransform: "uppercase" }} /><input type="date" value={leg.date} onChange={(e) => setJourneyLegs((a) => a.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, color: T.text, outline: "none", colorScheme: "dark" }} /></div>{journeyLegs.length > 1 && <div onClick={() => setJourneyLegs((a) => a.filter((_, j) => j !== i))} style={{ fontSize: 10.5, color: "#ff6db0", marginTop: 6, cursor: "pointer" }}>Убрать этот рейс</div>}</div>)}<div onClick={addJourneyLeg} className="press" style={{ fontSize: 11.5, color: T.violet, fontWeight: 800, cursor: "pointer", margin: "4px 0 10px" }}>＋ Добавить пересадку</div>{CostFields({ form: journeyCost, setForm: setJourneyCost })}<div onClick={addFlightJourney} className="press" style={{ marginTop: 12, textAlign: "center", background: GRAD.cta, borderRadius: 13, padding: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Добавить перелёт</div></Overlay>}

    {importOpen && <Overlay onClose={() => setImportOpen(false)}><SheetHead title="Импорт бронирования" onClose={() => setImportOpen(false)} /><div style={{ fontSize: 11.5, color: T.subd, lineHeight: 1.45, marginBottom: 9 }}>Вставьте текст письма от авиакомпании, отеля, аренды авто или сервиса бронирования. TripWise извлечёт даты, сумму и тип брони.</div><textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder="Вставьте сюда письмо или текст бронирования…" style={{ width: "100%", resize: "vertical", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, color: T.text, outline: "none", fontFamily: "Manrope,sans-serif" }} /><div style={{ display: "flex", gap: 8, marginTop: 8 }}><label className="press" style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: 9, color: T.sub, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Загрузить .txt / .eml<input type="file" accept=".txt,.eml,text/plain,message/rfc822" onChange={importFile} style={{ display: "none" }} /></label><div onClick={analyzeImport} className="press" style={{ flex: 1, textAlign: "center", background: GRAD.cta, borderRadius: 11, padding: 9, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{importBusy ? "Разбираю…" : "Распознать"}</div></div>{importResult && <div style={{ background: T.card2, border: `1px solid ${T.violet}55`, borderRadius: 14, padding: 12, marginTop: 11 }}><div style={{ fontSize: 10, color: T.violet, fontWeight: 800 }}>{String(importResult.kind || "").toUpperCase()} · уверенность {Math.round((importResult.confidence || 0) * 100)}%</div><div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginTop: 4 }}>{importResult.title || "Бронирование"}</div><div style={{ fontSize: 11, color: T.subd, marginTop: 5 }}>{[importResult.startDate, importResult.endDate, importResult.location, importResult.priceAmount && money(importResult.priceAmount, importResult.currency)].filter(Boolean).join(" · ")}</div>{(importResult.flightLegs || []).length > 0 && <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>{importResult.flightLegs.map((x) => `${x.flightNumber} · ${x.date}`).join(" → ")}</div>}<div onClick={applyImport} className="press" style={{ marginTop: 10, textAlign: "center", background: GRAD.cta, borderRadius: 11, padding: 10, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Добавить в поездку</div></div>}<div style={{ fontSize: 10, color: T.subd, marginTop: 10 }}>PDF и скриншоты пока не распознаются без OCR: из них можно скопировать текст и вставить сюда.</div></Overlay>}

    {docOpen && (() => { const info = docInfoFor(docOpen), links = (info.links || []).filter((l) => l.url), supported = !!(docConfig(docOpen.id, docOpen.name, docOpen.country) || REQUEST_DOCS[docOpen.id]); const myState = viewerTraveler && t.travelerStates && t.travelerStates[viewerTraveler.id] && t.travelerStates[viewerTraveler.id].docs; const myDone = viewerTraveler ? (myState && myState[docOpen.id] !== undefined ? !!myState[docOpen.id] : !!docChecks[docOpen.id]) : false; return <Overlay onClose={() => setDocOpen(null)}><SheetHead title={docOpen.name} onClose={() => setDocOpen(null)} /><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}><Badge label={DOC_TYPE_LABEL[info.type] || "документ"} color={T.cyan} /><Badge label={docOpen.country || t.country} color={T.subd} /><TimeBadge st={docStatus(docOpen, t.df)} /></div>{info.desc && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.45, marginBottom: 8 }}>{info.desc}</div>}{docOpen.checkedAt&&<div style={{fontSize:10.3,color:T.subd,marginBottom:10}}>Правила проверены: {String(docOpen.checkedAt).slice(0,10).split("-").reverse().join(".")}</div>}{(info.req || []).length > 0 && <><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 6 }}>Что потребуется</div>{(info.req || []).map((rq) => <div key={rq} style={{ display: "flex", gap: 8, padding: "5px 0" }}><span style={{ width: 5, height: 5, borderRadius: 99, background: T.violet, marginTop: 6 }} /><span style={{ fontSize: 12.5, color: T.sub }}>{rq}</span></div>)}</>}<div onClick={() => { if (supported) { setDocWizard(docOpen); setDocOpen(null); } else setToast("Мастер для этого документа появится позже"); }} className="press" style={{ marginTop: 12, textAlign: "center", background: supported ? GRAD.cta : T.card2, border: supported ? "none" : `1px solid ${T.line}`, borderRadius: 14, padding: 13, color: supported ? "#fff" : T.subd, fontSize: 13.5, fontWeight: 800, cursor: supported ? "pointer" : "default" }}>Заполнить с помощником {!supported && "· скоро"}</div>{links.length > 0 && <div style={{ marginTop: 12 }}>{links.map((l) => <div key={l.label} onClick={() => window.open(l.url, "_blank")} style={{ display: "flex", padding: "9px 0", borderTop: `1px solid ${T.line}`, cursor: "pointer" }}><span style={{ fontSize: 12.5, color: T.violet, flex: 1 }}>{l.label}</span><Icon d={I.chevR} size={14} color={T.subd} /></div>)}</div>}{viewerTraveler && <div onClick={() => setTravelerDoc(viewerTraveler, docOpen, !myDone)} className="press" style={{ marginTop: 10, textAlign: "center", border: `1px solid ${myDone ? T.green : T.violet}55`, borderRadius: 12, padding: 10, color: myDone ? T.green : T.violet, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{myDone ? "✓ Мой документ готов" : "Отметить мой документ готовым"}</div>}</Overlay>; })()}
    {docWizard && <DocWizard doc={docWizard} fullScreen tripContext={t} onClose={()=>setDocWizard(null)} setToast={setToast} savedId={(localDocRecord(t.id,docWizard.id)||{}).id||null} onSaved={(rec)=>{if(rec&&rec.status==="ready"&&viewerTraveler)setTravelerDoc(viewerTraveler,docWizard,true);}} />}
    {confirmDanger && <ConfirmSheet title={confirmDanger.title} text={confirmDanger.text} danger confirmLabel={confirmDanger.label || "Подтвердить"} onClose={() => setConfirmDanger(null)} onConfirm={() => { const c=confirmDanger; setConfirmDanger(null); c && c.action && c.action(); }} />}
    {chatOpen && <Overlay onClose={() => setChatOpen(false)}><SheetHead title="Ask TripWise" onClose={() => setChatOpen(false)} /><div style={{ maxHeight: "46vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>{messages.map((m, i) => <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? T.violet + "35" : T.card, border: `1px solid ${m.role === "user" ? T.violet + "55" : T.line}`, borderRadius: 13, padding: "9px 11px", fontSize: 12.2, color: T.text, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.text}</div>)}{chatBusy && <div style={{ fontSize: 11.5, color: T.subd }}>TripWise думает…</div>}</div>{chatPending&&!chatBusy&&<div style={{display:"flex",gap:7,marginBottom:8}}><div onClick={()=>askAI("Да")} className="press" style={{flex:1,textAlign:"center",background:T.green+"18",border:`1px solid ${T.green}55`,borderRadius:11,padding:9,color:T.green,fontSize:11.5,fontWeight:900,cursor:"pointer"}}>Подтвердить</div><div onClick={()=>askAI("Отмена")} className="press" style={{flex:1,textAlign:"center",background:T.card,border:`1px solid ${T.line}`,borderRadius:11,padding:9,color:T.sub,fontSize:11.5,fontWeight:800,cursor:"pointer"}}>Отмена</div></div>}<div style={{ display: "flex", gap: 7 }}><input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askAI()} placeholder="Спроси про эту поездку…" style={{ flex: 1, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 11px", color: T.text, outline: "none" }} /><div onClick={() => askAI()} className="press" style={{ width: 42, borderRadius: 12, background: GRAD.cta, display: "grid", placeItems: "center", cursor: "pointer" }}><Icon d={I.arrow} size={16} color="#fff" /></div></div></Overlay>}
  </div>;
}

function TripScreen({ t, initialBlk, onBack, onUpdate, onDelete, onFindTickets, goHotels, goDocs, setToast }) {
  const bOn = tripBlocks(t);
  const docs = bOn.docs ? tripDocs(t) : [];
  const p = tripProgress(t), act = nextAction(t), d = daysTo(t.df);
  const [blk, setBlk] = useState(initialBlk || "overview");
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
  const enableBlock = (k) => { creatorUpd((x) => ({ ...x, blocksOn: { ...tripBlocks(x), [k]: true }, ...(k === "lodging" ? { lodgingOff: false } : {}) })); setToast("Раздел добавлен"); };
  // страховка — это доп-услуга, не документ: ведём в «Сборы»/услуги
  const insTap = () => { if (extrasOn) setBlk("extras"); else setSvcPick(true); };
  const docTap = (doc) => { if (doc.id === "ins") insTap(); else goDocs(doc.id); };
  return <div style={{ animation: "slideIn .18s ease-out", paddingBottom: 8 }}>
    <div style={{ padding: "12px 20px 0" }}>
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: gradFor(t.dc), padding: 14, minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(5,5,20,.72))" }} />
        <div onClick={() => { const on = !t.notify; upd((x) => ({ ...x, notify: on })); setToast(on ? "Напоминания по поездке включены" : "Напоминания выключены"); }} className="press" style={{ position: "absolute", top: 10, right: 50, width: 32, height: 32, borderRadius: 999, background: t.notify ? "rgba(124,92,255,.75)" : "rgba(8,8,22,.55)", border: `1px solid ${t.notify ? "rgba(124,92,255,.9)" : "rgba(255,255,255,.22)"}`, display: "grid", placeItems: "center", cursor: "pointer" }} title="Напоминания о дедлайнах">
          <span style={{ fontSize: 15 }}>{t.notify ? "🔔" : "🔕"}</span>
        </div>
        <div onClick={() => { setMenu(!menu); setNameDraft(t.title); }} className="press" style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 999, background: "rgba(8,8,22,.55)", border: "1px solid rgba(255,255,255,.22)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", fontSize: 15 }}>⋯</div>
        <div style={{ position: "relative" }}>
          {t.route && t.route.stopover && <span style={{ display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: .4, color: "#fff", background: "rgba(124,92,255,.9)", borderRadius: 999, padding: "3px 9px", marginBottom: 6 }}>ЛУЧШИЙ СТОПОВЕР · {t.route.stopover.nights} НОЧ. {t.route.stopover.city.toUpperCase()}</span>}
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
function NewTripSheet({ onClose, onCreate, profile={} }) {
  const [q,setQ]=useState(""),[dest,setDest]=useState(null),[df,setDf]=useState(""),[dt,setDt]=useState(""),[adults,setAdults]=useState(1),[kidsAges,setKidsAges]=useState([]);
  const qq=q.trim(), airportMatches=qq.length>=2&&!dest?AIRPORTS.filter(a=>a.city.toLowerCase().startsWith(qq.toLowerCase())).slice(0,5):[], knownCityMatches=qq.length>=2&&!dest?DEST_BASE.flatMap(d=>(d.cities||[]).map(c=>({city:c.city,country:d.country,flag:"📍",code:""}))).filter(a=>a.city.toLowerCase().startsWith(qq.toLowerCase())&&!airportMatches.some(x=>x.city===a.city&&x.country===a.country)).slice(0,4):[], list=[...airportMatches,...knownCityMatches], canFreeform=qq.length>=2&&!dest&&profile.homeCountry&&!list.some(a=>a.city.toLowerCase()===qq.toLowerCase()),ok=dest&&df&&dt&&dt>=df;
  const inputSt={width:"100%",background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"11px 12px",color:T.text,fontSize:14,outline:"none",boxSizing:"border-box"};
  const create=()=>{if(!ok){return;}const dep=new Date(df),homeCountry=String(profile.homeCountry||""),homeAirport=String(profile.homeAirport||"");onCreate({id:"t"+Date.now(),title:`${dest.city} · ${MONTHS_S[dep.getMonth()]}`,dcName:dest.city,dc:dest.code,country:dest.country,destinationCountry:dest.country,oc:homeAirport,ocName:profile.homeCity||"",originCountry:homeCountry,domestic:!!(homeCountry&&dest.country&&homeCountry.toLowerCase()===dest.country.toLowerCase()),df,dt,adults,children:kidsAges,route:null,checks:{tickets:false,lodgeMain:false,lodgeStop:false,docs:{},services:{}},servicesAdded:[],custom:[],docsExtra:[],lodgingOff:false,travelerTarget:adults+kidsAges.length,blocksOn:{tickets:true,lodging:true,transport:true,activities:true,docs:true,prep:true},baseCurrency:profile.defaultCurrency||"EUR",createdAt:Date.now()});};
  return <Overlay onClose={onClose}><SheetHead title="Новая поездка" onClose={onClose}/><div style={{fontSize:11.5,color:T.subd,marginBottom:6}}>Куда едем</div>{dest?<div style={{display:"flex",alignItems:"center",gap:8,background:T.card,border:`1px solid ${T.violet}55`,borderRadius:12,padding:"10px 12px",marginBottom:12}}><span style={{fontSize:14,color:T.text,fontWeight:700,flex:1}}>{dest.flag} {dest.city}, {dest.country}</span><span onClick={()=>{setDest(null);setQ("");}} style={{fontSize:12,color:T.subd,cursor:"pointer"}}>изменить</span></div>:<><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Город или страна" style={{...inputSt,marginBottom:6}}/>{list.map((a,i)=><div key={`${a.code||a.city}_${a.country}_${i}`} onClick={()=>setDest(a)} className="press" style={{padding:"9px 10px",fontSize:13.5,color:T.text,cursor:"pointer",borderRadius:10}}>{a.flag||"📍"} {a.city} <span style={{color:T.subd,fontSize:11.5}}>· {a.country}</span></div>)}{canFreeform&&<div onClick={()=>setDest({city:qq,country:profile.homeCountry,flag:"📍",code:""})} className="press" style={{padding:"9px 10px",fontSize:13.5,color:T.violet,cursor:"pointer",borderRadius:10,fontWeight:800}}>＋ Поездка в «{qq}» <span style={{color:T.subd,fontSize:11.5,fontWeight:500}}>· {profile.homeCountry}</span></div>}<div style={{height:6}}/></>}
  <div style={{fontSize:11.5,color:T.subd,margin:"4px 0 6px"}}>Даты поездки</div><DateRangeField from={df} to={dt} title="Даты поездки" allowSameDay onChange={(a,b)=>{setDf(a);setDt(b);}} style={{marginBottom:12}}/>
  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:13,color:T.text,flex:1}}>Взрослые</span><Stepper v={adults} set={setAdults}/></div><div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 12px",marginBottom:14}}><KidsPicker ages={kidsAges} onChange={setKidsAges}/></div>
  {profile.homeCity&&<div style={{fontSize:10.8,color:T.subd,marginBottom:10}}>Домашний город: {profile.homeCity}{profile.homeAirport?` · ${profile.homeAirport}`:""}. Для поездки внутри {profile.homeCountry||"страны"} загранпаспортные требования не добавляются автоматически.</div>}
  <div onClick={create} className="press" style={{textAlign:"center",background:ok?GRAD.cta:T.card,border:ok?"none":`1px solid ${T.line}`,borderRadius:14,padding:13,color:ok?"#fff":T.subd,fontSize:14,fontWeight:800,cursor:ok?"pointer":"default"}}>Создать поездку</div></Overlay>;
}

const PUB_COST_LABEL={self:"Каждый за себя",split:"Общие расходы делим",covered:"Часть расходов покрыта",discuss:"Условия обсуждаются"};
const PUB_COVER_LABEL={stay:"Жильё оплачено",transport:"Транспорт оплачен",activities:"Развлечения оплачены"};
function publicPreferenceLabel(p){p=p||{};const g=p.preferredGender==="female"?"женщину":p.preferredGender==="male"?"мужчину":"попутчиков";const a=Number(p.ageMin)||0,b=Number(p.ageMax)||0;return p.preferredGender!=="any"||(a&&b&&!(a===18&&b>=60))?`Ищем ${g}${a&&b?` · ${a}–${b}`:""}`:"";}
function publicBudgetLabel(x){const p=x&&x.publication||{},a=Number(p.budgetMin)||0,b=Number(p.budgetMax)||0,c=p.currency||"RUB";if(a&&b&&a!==b)return `${money(a,c)}–${money(b,c)}`;if(a||b)return `≈ ${money(a||b,c)}`;return "Бюджет уточняется";}
function PublicTripCard({trip,onClick}){const p=trip.publication||{};return <div onClick={onClick} className="press" style={{scrollSnapAlign:"center",flex:"0 0 min(79vw,315px)",minHeight:238,borderRadius:23,overflow:"hidden",position:"relative",background:gradFor(trip.country||trip.destination||trip.id),border:"1px solid rgba(255,255,255,.13)",boxShadow:"0 18px 38px rgba(0,0,0,.26)",cursor:"pointer"}}><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(5,8,22,.04) 10%,rgba(5,7,20,.90) 100%)"}}/><div style={{position:"absolute",top:13,left:13,right:13,display:"flex",gap:6,flexWrap:"wrap"}}><span style={{background:"rgba(8,12,28,.66)",border:"1px solid rgba(255,255,255,.17)",borderRadius:999,padding:"5px 8px",fontSize:10,fontWeight:900,color:"#fff"}}>👥 {trip.travelerCount}/{trip.capacity}</span>{p.covered&&p.covered.length>0?p.covered.slice(0,2).map(v=><span key={v} style={{background:"rgba(48,215,184,.18)",border:"1px solid rgba(48,215,184,.38)",borderRadius:999,padding:"5px 8px",fontSize:10,fontWeight:900,color:"#a9ffe9"}}>{PUB_COVER_LABEL[v]||v}</span>):<span style={{background:"rgba(8,12,28,.55)",border:"1px solid rgba(255,255,255,.14)",borderRadius:999,padding:"5px 8px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,.84)"}}>{PUB_COST_LABEL[p.costMode]||"Условия обсуждаются"}</span>}</div><div style={{position:"relative",zIndex:2,minHeight:238,padding:15,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}><div style={{fontFamily:"Sora,sans-serif",fontSize:20,fontWeight:900,color:"#fff"}}>{trip.title}</div><div style={{fontSize:11.5,color:"rgba(255,255,255,.78)",marginTop:4}}>{trip.routeLabel||trip.destination}</div><div style={{display:"flex",gap:7,alignItems:"center",marginTop:8,fontSize:11,color:"rgba(255,255,255,.82)"}}><span>{trip.df?ddmm(trip.df):""}{trip.dt?` — ${ddmm(trip.dt)}`:""}</span><span>·</span><b style={{color:"#fff"}}>{publicBudgetLabel(trip)} / чел</b></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9}}>{(p.tags||[]).slice(0,3).map(x=><span key={x} style={{fontSize:9.5,color:"rgba(255,255,255,.84)",background:"rgba(255,255,255,.10)",borderRadius:999,padding:"4px 7px"}}>{x}</span>)}</div></div></div>}
function PublicTripPreview({trip,onClose,onOpenOwn,profile,setToast}){const [detail,setDetail]=useState(trip),[myReq,setMyReq]=useState(null),[applyOpen,setApplyOpen]=useState(false),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);const ageFromDob=()=>{if(!profile||!profile.dob)return"";const d=new Date(profile.dob);if(Number.isNaN(d.getTime()))return"";const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a>=18?a:"";};const [form,setForm]=useState({age:ageFromDob(),city:profile&&profile.homeCity||"",message:"",datesOk:false,budgetOk:false,termsOk:false});useEffect(()=>{let dead=false;(async()=>{const r=await sharedApi("get-public-trip",{tripId:trip.id},12000);if(!dead&&r.ok){setDetail(r.trip);setMyReq(r.myRequest||null);}})();return()=>{dead=true;};},[trip.id]);const p=detail.publication||{},covered=(p.covered||[]).map(x=>PUB_COVER_LABEL[x]).filter(Boolean);const send=async()=>{if(!form.age||!form.city||String(form.message||"").trim().length<10||!form.datesOk||!form.budgetOk||!form.termsOk){setToast(String(form.message||"").trim().length<10?"Напишите пару слов о себе":"Подтвердите даты, бюджет и условия поездки");return;}setBusy(true);const r=await sharedApi("request-join-public",{tripId:detail.id,message:form.message,applicant:{age:Number(form.age),city:form.city,datesOk:form.datesOk,budgetOk:form.budgetOk,termsOk:form.termsOk}},15000);setBusy(false);if(r.ok){setMyReq({status:"pending"});setApplyOpen(false);setSuccess(true);}else if(r.error==="already member")onOpenOwn(detail.id);else setToast(r.error==="profile incomplete"?"Заполните данные заявки":r.error==="trip full"?"Свободных мест уже нет":"Не удалось отправить заявку");};return <FullScreenOverlay onClose={onClose}><div style={{padding:"4px 16px 110px"}}><div style={{height:210,borderRadius:24,background:gradFor(detail.country||detail.id),position:"relative",overflow:"hidden",marginBottom:15}}><div style={{position:"absolute",inset:0,background:"linear-gradient(transparent,rgba(5,7,20,.88))"}}/><div style={{position:"absolute",left:15,right:15,bottom:15}}><div style={{fontFamily:"Sora,sans-serif",fontSize:23,fontWeight:900,color:"#fff"}}>{detail.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,.78)",marginTop:4}}>{detail.routeLabel||detail.destination}</div></div></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}><span style={{border:`1px solid ${T.violet}55`,background:T.violet+"14",color:T.violet,borderRadius:999,padding:"6px 9px",fontSize:10.5,fontWeight:900}}>👥 {detail.travelerCount}/{detail.capacity} · {detail.freeSeats} мест</span><span style={{border:`1px solid ${T.line}`,borderRadius:999,padding:"6px 9px",fontSize:10.5,fontWeight:800,color:T.text}}>{publicBudgetLabel(detail)} / чел</span><span style={{border:`1px solid ${T.line}`,borderRadius:999,padding:"6px 9px",fontSize:10.5,fontWeight:800,color:T.sub}}>{PUB_COST_LABEL[p.costMode]||"Условия обсуждаются"}</span>{publicPreferenceLabel(p)&&<span style={{border:`1px solid ${T.cyan}55`,background:T.cyan+"0d",borderRadius:999,padding:"6px 9px",fontSize:10.5,fontWeight:800,color:T.cyan}}>{publicPreferenceLabel(p)}</span>}{covered.map(x=><span key={x} style={{border:`1px solid ${T.green}55`,background:T.green+"10",borderRadius:999,padding:"6px 9px",fontSize:10.5,fontWeight:800,color:T.green}}>{x}</span>)}{(p.tags||[]).map(x=><span key={x} style={{border:`1px solid ${T.line}`,borderRadius:999,padding:"6px 9px",fontSize:10.5,color:T.subd}}>{x}</span>)}</div>{p.description&&<div style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:15,padding:13,fontSize:12,color:T.sub,lineHeight:1.55,marginBottom:11}}>{p.description}</div>}<div style={{fontFamily:"Sora,sans-serif",fontSize:14,fontWeight:900,color:T.text,margin:"14px 0 8px"}}>Кто едет</div><div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:5}}>{(detail.participants||[]).map((x,i)=><div key={i} style={{flex:"0 0 72px",textAlign:"center"}}><div style={{width:48,height:48,borderRadius:16,margin:"0 auto 5px",background:T.card2,display:"grid",placeItems:"center",overflow:"hidden",fontSize:12,fontWeight:900,color:T.violet}}>{x.photoUrl?<img src={x.photoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:String(x.name||"?").split(/\s+/).slice(0,2).map(z=>z[0]).join("").toUpperCase()}</div><div style={{fontSize:10.3,color:T.sub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.name}</div></div>)}</div><div style={{marginTop:13,background:T.card,border:`1px solid ${T.line}`,borderRadius:15,padding:12}}><div style={{fontSize:11,color:T.subd}}>Организатор</div><div style={{display:"flex",alignItems:"center",gap:9,marginTop:7}}><div style={{width:36,height:36,borderRadius:12,background:T.violet+"22",display:"grid",placeItems:"center",overflow:"hidden",fontWeight:900,color:T.violet}}>{detail.creator&&detail.creator.photoUrl?<img src={detail.creator.photoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:String(detail.creator&&detail.creator.name||"?").slice(0,1)}</div><b style={{fontSize:12.5,color:T.text}}>{detail.creator&&detail.creator.name}</b></div></div><div style={{marginTop:13,fontSize:10.8,color:T.subd,lineHeight:1.5}}>Заявка бесплатна для путешественника. Организатор разбирает её через бота TripWise. После принятия поездка появится у вас в «Моих путешествиях», а общение продолжится напрямую в Telegram.</div></div><div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:0,width:"100%",maxWidth:420,padding:"9px 14px max(env(safe-area-inset-bottom),12px)",background:"linear-gradient(transparent,#0a0a18 24%)",zIndex:70}}>{detail.alreadyMember?<div onClick={()=>onOpenOwn(detail.id)} className="press" style={{textAlign:"center",background:GRAD.cta,borderRadius:14,padding:13,color:"#fff",fontWeight:900,cursor:"pointer"}}>Открыть мою поездку</div>:myReq&&myReq.status==="pending"?<div style={{textAlign:"center",background:T.green+"15",border:`1px solid ${T.green}55`,borderRadius:14,padding:12,color:T.green,fontWeight:900}}>Заявка отправлена ✓</div>:<div onClick={()=>setApplyOpen(true)} className="press" style={{textAlign:"center",background:GRAD.cta,borderRadius:14,padding:13,color:"#fff",fontWeight:900,cursor:"pointer"}}>Хочу поехать</div>}</div>{applyOpen&&<Overlay zIndex={120} onClose={()=>setApplyOpen(false)}><SheetHead title="Заявка организатору" onClose={()=>setApplyOpen(false)}/><div style={{fontSize:11.5,color:T.subd,lineHeight:1.45,marginBottom:10}}>Никакого внутреннего чата: после принятия TripWise добавит вас в общий Trip и даст продолжить общение в Telegram.</div><div style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:8}}><input type="number" min="18" max="90" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))} placeholder="Возраст" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:11,padding:10,color:T.text,outline:"none"}}/><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="Ваш город" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:11,padding:10,color:T.text,outline:"none"}}/></div><textarea rows={3} value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} placeholder="Пара слов о себе и почему хотите поехать" style={{width:"100%",marginTop:8,resize:"none",background:T.card,border:`1px solid ${T.line}`,borderRadius:11,padding:10,color:T.text,outline:"none",fontFamily:"Manrope,sans-serif"}}/>{[["datesOk",`Мне подходят даты ${detail.df?ddmm(detail.df):""}${detail.dt?` — ${ddmm(detail.dt)}`:""}`],["budgetOk",`Мне подходит ориентир ${publicBudgetLabel(detail)}`],["termsOk",`Понимаю условия: ${PUB_COST_LABEL[p.costMode]||"обсуждаются"}`]].map(([k,l])=><div key={k} className="press" style={{display:"flex",alignItems:"center",gap:9,padding:"9px 1px",cursor:"pointer"}}><Check on={!!form[k]} onClick={()=>setForm(f=>({...f,[k]:!f[k]}))}/><span onClick={()=>setForm(f=>({...f,[k]:!f[k]}))} style={{fontSize:11.5,color:T.text,flex:1}}>{l}</span></div>)}<div onClick={send} className="press" style={{marginTop:8,textAlign:"center",background:GRAD.cta,borderRadius:13,padding:12,color:"#fff",fontSize:13,fontWeight:900,cursor:"pointer"}}>{busy?"Отправляю…":"Отправить заявку"}</div></Overlay>}{success&&<Overlay centered zIndex={130} onClose={()=>setSuccess(false)}><div style={{textAlign:"center",padding:"8px 3px"}}><div style={{width:76,height:76,borderRadius:25,margin:"0 auto 13px",background:T.green+"1b",border:`1px solid ${T.green}55`,display:"grid",placeItems:"center",fontSize:34}}>✓</div><div style={{fontFamily:"Sora,sans-serif",fontSize:21,fontWeight:900,color:T.text}}>Заявка отправлена</div><div style={{fontSize:12,color:T.subd,lineHeight:1.5,marginTop:7}}>Организатор получит её в личку от бота TripWise. Если вас примут, бот сообщит об этом и поездка появится в приложении.</div><div onClick={()=>setSuccess(false)} className="press" style={{marginTop:14,textAlign:"center",background:GRAD.cta,borderRadius:13,padding:12,color:"#fff",fontWeight:900,cursor:"pointer"}}>Готово</div></div></Overlay>}</FullScreenOverlay>}
function RoutesScreen({ trips, publicTrips, publicLoading, reloadPublic, profile, setToast, onOpenTrip, onNewTrip, onPickDest, onSearch, saved, onUnlike, onOpenSaved, recent, onClearRecent, onRunRecent }) {
  const [showAll,setShowAll]=useState(false),[histOpen,setHistOpen]=useState(false),[pastOpen,setPastOpen]=useState(false),[browseOpen,setBrowseOpen]=useState(false),[pubOpen,setPubOpen]=useState(null);
  const today=todayISO(),active=(trips||[]).filter(t=>!t.df||t.df>=today).sort((a,b)=>(a.df||"9999")<(b.df||"9999")?-1:1),past=(trips||[]).filter(t=>t.df&&t.df<today),visible=showAll?saved:saved.slice(0,3),pub=(publicTrips||[]);
  useEffect(()=>{ if(reloadPublic) reloadPublic(); },[]);
  const Fold=({icon,title,count,open,onToggle,children,extra})=><div style={{padding:"0 20px"}}><div onClick={onToggle} className="press" style={{display:"flex",alignItems:"center",gap:9,padding:"13px 2px",cursor:"pointer",borderTop:`1px solid ${T.line}`}}><Icon d={icon} size={16} color={T.subd}/><span style={{flex:1,fontSize:14,fontWeight:700,color:T.text,fontFamily:"Sora,sans-serif"}}>{title}</span>{extra}<span style={{fontSize:12,color:T.subd}}>{count}</span><span style={{transform:open?"rotate(90deg)":"none",transition:"transform .15s",display:"inline-flex"}}><Icon d={I.chevR} size={13} color={T.subd}/></span></div>{open&&<div style={{paddingBottom:8}}>{children}</div>}</div>;
  return <div style={{animation:"fadeUp .18s ease-out",paddingBottom:8}}><Header/><div style={{padding:"5px 20px 0"}}><div style={{fontFamily:"Sora,sans-serif",fontWeight:900,color:T.text,fontSize:25}}>Путешествия</div><div style={{fontSize:11.5,color:T.subd,marginTop:4}}>Планируйте свои или присоединяйтесь к тем, кто уже собирается.</div></div><div style={{marginTop:17}}><div style={{display:"flex",alignItems:"center",padding:"0 20px 10px"}}><div style={{fontFamily:"Sora,sans-serif",fontWeight:900,color:T.text,fontSize:15,flex:1}}>Поехать вместе</div>{pub.length>0&&<div onClick={()=>setBrowseOpen(true)} style={{fontSize:11.5,color:T.violet,fontWeight:800,cursor:"pointer"}}>Все →</div>}</div>{publicLoading?<div style={{display:"flex",gap:10,overflow:"hidden",padding:"0 20px"}}>{[1,2].map(i=><div key={i} style={{flex:"0 0 78%",height:225,borderRadius:23,background:"linear-gradient(90deg,#151528,#202039,#151528)",backgroundSize:"200% 100%",animation:"sh 1.3s linear infinite"}}/>)}</div>:pub.length?<div className="carousel" style={{display:"flex",gap:11,overflowX:"auto",scrollSnapType:"x mandatory",padding:"0 10.5vw 15px",scrollPadding:"10.5vw"}}>{pub.slice(0,8).map(x=><PublicTripCard key={x.id} trip={x} onClick={()=>setPubOpen(x)}/>)}</div>:<div style={{margin:"0 20px 14px",background:T.card,border:`1px dashed ${T.line}`,borderRadius:17,padding:16}}><div style={{fontSize:13.5,fontWeight:800,color:T.text}}>Публичных поездок пока мало</div><div style={{fontSize:11.5,color:T.subd,lineHeight:1.45,marginTop:4}}>Опубликуйте свою поездку из меню Trip — первые предложения сформируют витрину.</div><div onClick={reloadPublic} style={{fontSize:11,color:T.violet,fontWeight:800,marginTop:8,cursor:"pointer"}}>Обновить</div></div>}</div><div style={{padding:"2px 20px 0"}}><div style={{display:"flex",alignItems:"center",marginBottom:12}}><div style={{fontFamily:"Sora,sans-serif",fontWeight:800,color:T.text,fontSize:15,flex:1}}>Мои путешествия</div><div onClick={onNewTrip} className="press" style={{display:"flex",alignItems:"center",gap:5,background:T.violet+"22",border:`1px solid ${T.violet}55`,borderRadius:999,padding:"6px 12px",color:T.violet,fontSize:12.5,fontWeight:800,cursor:"pointer"}}>＋ Новая</div></div>{active.length?(()=>{const dated=active.filter(x=>daysTo(x.df)!=null),soonId=dated.length?dated.reduce((a,b)=>daysTo(a.df)<=daysTo(b.df)?a:b).id:null;return active.map(t=><TripCard key={t.id} t={t} soonest={t.id===soonId} onOpen={()=>onOpenTrip(t.id)}/>);})():<div style={{background:T.card,border:`1px dashed ${T.line}`,borderRadius:18,padding:"20px 15px",textAlign:"center",marginBottom:12}}><div style={{fontSize:25,marginBottom:7}}>🧳</div><div style={{fontSize:14,fontWeight:800,color:T.text}}>Пока нет своих поездок</div><div style={{fontSize:11.5,color:T.subd,margin:"4px 0 13px"}}>Создайте свою или выберите открытую поездку выше.</div><div style={{display:"flex",gap:8,justifyContent:"center"}}><div onClick={onSearch} className="press" style={{background:GRAD.cta,borderRadius:12,padding:"9px 13px",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>Найти билеты</div><div onClick={onNewTrip} className="press" style={{background:T.card2,border:`1px solid ${T.line}`,borderRadius:12,padding:"9px 13px",color:T.text,fontSize:12,fontWeight:700,cursor:"pointer"}}>Создать</div></div></div>}</div><Section title="Сохранённые маршруты" action={saved.length>3?(showAll?"Свернуть":"Смотреть все"):null} onAction={()=>setShowAll(!showAll)}>{visible.length?visible.map(s=><div key={s.id} onClick={()=>onOpenSaved(s)} className="press" style={{display:"flex",alignItems:"center",gap:12,background:T.card,border:`1px solid ${T.line}`,borderRadius:14,padding:12,marginBottom:8,cursor:"pointer"}}><div style={{width:40,height:40,borderRadius:10,background:GRAD.night,display:"grid",placeItems:"center",fontSize:18}}>{s.emoji}</div><div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:700,color:T.text}}>{s.name}</div><div style={{fontSize:11,color:T.subd}}>{s.dates} • {s.adults||1} взрослый • Эконом</div></div><div style={{fontSize:13,fontWeight:800,color:T.text}}>от {rub(s.price)}</div><div onClick={e=>{e.stopPropagation();onUnlike(s.id);}} className="press" style={{cursor:"pointer",padding:4}}><Icon d={I.heart} size={18} color={T.pink}/></div></div>):<div style={{color:T.subd,fontSize:13,padding:"8px 2px"}}>Пока пусто — лайкните маршрут в результатах поиска</div>}</Section><Fold icon={I.clock} title="Последние поиски" count={recent.length} open={histOpen} onToggle={()=>setHistOpen(!histOpen)} extra={recent.length&&histOpen?<span onClick={e=>{e.stopPropagation();onClearRecent();}} style={{fontSize:11.5,color:T.subd,cursor:"pointer"}}>очистить</span>:null}>{recent.length?recent.map((s,i)=><div key={i} onClick={()=>onRunRecent(s)} className="press" style={{display:"flex",alignItems:"center",gap:12,background:T.card,border:`1px solid ${T.line}`,borderRadius:14,padding:12,marginBottom:8,cursor:"pointer"}}><Icon d={I.clock} size={18} color={T.violet}/><div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:700,color:T.text}}>{s.name}</div><div style={{fontSize:11,color:T.subd}}>{s.dates}</div></div></div>):<div style={{color:T.subd,fontSize:13,padding:"8px 2px"}}>История пуста</div>}</Fold>{past.length>0&&<Fold icon={I.moon} title="Прошедшие поездки" count={past.length} open={pastOpen} onToggle={()=>setPastOpen(!pastOpen)}>{past.map(t=><TripCard key={t.id} t={t} onOpen={()=>onOpenTrip(t.id)}/>)}</Fold>}{pubOpen&&<PublicTripPreview trip={pubOpen} profile={profile} setToast={setToast} onClose={()=>{setPubOpen(null);reloadPublic&&reloadPublic();}} onOpenOwn={(id)=>{setPubOpen(null);onOpenTrip(id);}}/>}{browseOpen&&<FullScreenOverlay onClose={()=>setBrowseOpen(false)}><div style={{padding:"4px 16px 40px"}}><div style={{fontFamily:"Sora,sans-serif",fontSize:22,fontWeight:900,color:T.text}}>Поехать вместе</div><div style={{fontSize:11.5,color:T.subd,margin:"5px 0 14px"}}>Открытые поездки с местами. Общение после принятия заявки — напрямую в Telegram.</div><div style={{display:"flex",flexDirection:"column",gap:10}}>{pub.map(x=><div key={x.id} onClick={()=>{setBrowseOpen(false);setPubOpen(x);}} className="press" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:17,padding:12,cursor:"pointer"}}><div style={{display:"flex",gap:10}}><div style={{width:54,height:54,borderRadius:15,background:gradFor(x.country||x.id),display:"grid",placeItems:"center",fontSize:22}}>✈️</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:900,color:T.text}}>{x.title}</div><div style={{fontSize:10.8,color:T.subd,marginTop:2}}>{x.routeLabel||x.destination}</div><div style={{fontSize:10.8,color:T.sub,marginTop:5}}>👥 {x.travelerCount}/{x.capacity} · {publicBudgetLabel(x)} / чел</div></div><Icon d={I.chevR} size={14} color={T.subd}/></div></div>)}</div></div></FullScreenOverlay>}</div>;
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
/* БАЗА НАПРАВЛЕНИЙ для подбора промокодов: страна → города → зоны/сети отелей.
   Пользователь вводит отель, город или страну — матчим на город/страну и подбираем промо.
   zones — узнаваемые районы/курортные зоны, помогают найти город по «месту», а не только имени. */
const DEST_BASE = [
  { country: "Таиланд", cc: "TH", cities: [
    { city: "Бангкок", zones: ["Сукхумвит", "Силом", "Каосан"] },
    { city: "Пхукет", zones: ["Патонг", "Карон", "Ката", "Банг Тао"] },
    { city: "Паттайя", zones: ["Джомтьен", "Наклуа"] },
    { city: "Самуи", zones: ["Чавенг", "Ламай", "Бопхут"] },
    { city: "Краби", zones: ["Ао Нанг", "Railay"] },
  ] },
  { country: "Индонезия", cc: "ID", cities: [
    { city: "Бали", zones: ["Кута", "Семиньяк", "Убуд", "Нуса-Дуа", "Чангу", "Джимбаран", "Улувату"] },
    { city: "Джакарта", zones: [] },
  ] },
  { country: "Вьетнам", cc: "VN", cities: [
    { city: "Нячанг", zones: [] }, { city: "Фукуок", zones: [] }, { city: "Дананг", zones: ["Хойан"] }, { city: "Хошимин", zones: [] },
  ] },
  { country: "Турция", cc: "TR", cities: [
    { city: "Стамбул", zones: ["Султанахмет", "Таксим", "Бешикташ"] },
    { city: "Анталья", zones: ["Кемер", "Белек", "Сиде", "Аланья", "Лара"] },
    { city: "Бодрум", zones: [] }, { city: "Мармарис", zones: [] },
  ] },
  { country: "ОАЭ", cc: "AE", cities: [
    { city: "Дубай", zones: ["Марина", "Джумейра", "Дейра", "Даунтаун", "Пальма", "JBR"] },
    { city: "Абу-Даби", zones: ["Яс", "Саадият"] }, { city: "Шарджа", zones: [] },
  ] },
  { country: "Египет", cc: "EG", cities: [
    { city: "Хургада", zones: ["Сахль-Хашиш", "Эль-Гуна", "Макади"] },
    { city: "Шарм-эль-Шейх", zones: ["Наама-Бей", "Набк", "Шаркс-Бей"] },
    { city: "Каир", zones: [] },
  ] },
  { country: "Мальдивы", cc: "MV", cities: [{ city: "Мале", zones: ["Атолл Ари", "Атолл Баа", "Северный Мале"] }] },
  { country: "Грузия", cc: "GE", cities: [
    { city: "Тбилиси", zones: ["Старый город", "Ваке", "Сабуртало"] }, { city: "Батуми", zones: [] }, { city: "Кутаиси", zones: [] },
  ] },
  { country: "Армения", cc: "AM", cities: [{ city: "Ереван", zones: ["Кентрон", "Каскад"] }, { city: "Дилижан", zones: [] }] },
  { country: "Казахстан", cc: "KZ", cities: [{ city: "Алматы", zones: [] }, { city: "Астана", zones: [] }, { city: "Шымкент", zones: [] }] },
  { country: "Шри-Ланка", cc: "LK", cities: [{ city: "Коломбо", zones: [] }, { city: "Галле", zones: ["Унаватуна"] }, { city: "Канди", zones: [] }] },
  { country: "Индия", cc: "IN", cities: [{ city: "Гоа", zones: ["Северный Гоа", "Южный Гоа", "Кандолим", "Морджим"] }, { city: "Дели", zones: [] }] },
  { country: "Китай", cc: "CN", cities: [{ city: "Санья", zones: ["Ялонг Бэй", "Дадунхай"] }, { city: "Пекин", zones: [] }, { city: "Шанхай", zones: [] }] },
  { country: "Куба", cc: "CU", cities: [{ city: "Гавана", zones: [] }, { city: "Варадеро", zones: [] }] },
  { country: "Россия", cc: "RU", cities: [
    { city: "Сочи", zones: ["Адлер", "Красная Поляна", "Роза Хутор"] },
    { city: "Санкт-Петербург", zones: [] }, { city: "Москва", zones: [] }, { city: "Калининград", zones: [] }, { city: "Казань", zones: [] },
  ] },
];
// разрешить пользовательский ввод (отель/город/зона/страна) в {country, city}
function resolveDestination(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  for (const d of DEST_BASE) {
    if (d.country.toLowerCase() === q) return { country: d.country, city: null };
    for (const c of d.cities) {
      if (c.city.toLowerCase() === q) return { country: d.country, city: c.city };
      if ((c.zones || []).some((z) => z.toLowerCase() === q)) return { country: d.country, city: c.city };
    }
  }
  // частичное совпадение: город/зона/страна содержит запрос (для ввода имени отеля с городом внутри)
  for (const d of DEST_BASE) {
    if (d.country.toLowerCase().includes(q)) return { country: d.country, city: null };
    for (const c of d.cities) {
      if (c.city.toLowerCase().includes(q) || q.includes(c.city.toLowerCase())) return { country: d.country, city: c.city };
      if ((c.zones || []).some((z) => q.includes(z.toLowerCase()) || z.toLowerCase().includes(q))) return { country: d.country, city: c.city };
    }
  }
  return null;
}

const SERVICES = [
  { id: "yandex", name: "Яндекс Путешествия", desc: "Отели по всему миру", grad: GRAD.ocean, url: "https://travel.yandex.ru",
    promos: [
      { header: "Скидка на первое бронирование отеля", code: "TRIPWISE20", discountRub: 5000, minSpendRub: 50000, endDate: "2026-12-31", stayFrom: "2026-06-01", stayTo: "2026-12-31", country: "", city: "", url: "https://travel.yandex.ru/hotels/" },
      { header: "Промокод на отели Чувашии", code: "CHUVASHIA10", discountRub: 1500, minSpendRub: 10000, endDate: "2026-09-30", stayFrom: "2026-07-01", stayTo: "2026-09-30", country: "Россия", city: "Чебоксары", url: "https://travel.yandex.ru/hotels/cheboksary/" },
    ] },
  { id: "ostrovok", name: "Островок", desc: "Кэшбэк на бронирования", grad: GRAD.sunset, url: "https://ostrovok.ru",
    promos: [
      { header: "Скидка на отели в Азии", code: "OSTROVOK15", discountRub: 3000, minSpendRub: 20000, endDate: "2026-11-15", stayFrom: "2026-08-01", stayTo: "2026-11-30", country: "", city: "" },
    ] },
  { id: "tripcom", name: "Trip.com", desc: "Отели и авиабилеты по миру", grad: GRAD.city, url: "https://trip.com",
    promos: [
      { header: "Скидка на первое бронирование отеля", code: "TRIPCOM8", discountRub: 4000, minSpendRub: 50000, endDate: "2026-12-31", stayFrom: "2026-06-01", stayTo: "2026-12-31", country: "", city: "", url: "https://trip.com/hotels/" },
      { header: "Кэшбэк на отели в Азии", code: "ASIA2026", discountRub: 3500, minSpendRub: 3500, endDate: "2026-11-30", stayFrom: "2026-07-01", stayTo: "2026-11-30", country: "", city: "", url: "https://trip.com/hotels/" },
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
  const go = (s) => { trackGoal("service_partner_click", { service: s.id, partner: s.id, country: "" }); if (s.url) { try { window.open(s.url, "_blank"); } catch (e) { } setToast(`Открываем: ${s.title}…`); } else setToast("Скоро подключим партнёра"); };
  const byId = (id) => EXTRA_SERVICES.find((s) => s.id === id);
  const small = [byId("insurance"), byId("esim")].filter(Boolean);
  const lounge = byId("lounge");
  return <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {small.map((s) => (
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
    {lounge && <div onClick={() => go(lounge)} className="press" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "13px 14px", cursor: "pointer" }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: lounge.color + "22", border: `1px solid ${lounge.color}55`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I[lounge.icon]} size={20} color={lounge.color} /></div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "Sora,sans-serif" }}>{lounge.title}</div><div style={{ fontSize: 10.5, color: T.subd, marginTop: 2 }}>{lounge.sub}</div></div>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: lounge.color, background: lounge.color + "1a", border: `1px solid ${lounge.color}44`, borderRadius: 999, padding: "4px 9px", flexShrink: 0 }}>от {lounge.from} ₽</span>
      <div style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(255,255,255,.06)", border: `1px solid ${T.line}`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon d={I.arrow} size={12} color={T.sub} /></div>
    </div>}
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
  const [cc, setCc] = useState(() => store.get("citizenship", "RU")); // гражданство (для набора документов)
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState(null);        // открытая карточка документа
  const [addOpen, setAddOpen] = useState(false); // «добавить в путешествие»
  const [searchOpen, setSearchOpen] = useState(false); // нижний лист поиска (над клавиатурой)
  const [wiz, setWiz] = useState(null);                // открытый мастер заполнения
  const [resumeId, setResumeId] = useState(null);      // id сохранённого документа для продолжения
  const [, forceRefresh] = useState(0);                // перерисовать список «Мои документы»
  // открытие карточки конкретного документа из поездки
  useEffect(() => {
    if (preOpenDoc) { const dd = ALL_DOCS.find((x) => x.id === preOpenDoc); if (dd) setDoc({ ...dd, _fromTrip: true }); onPreDone && onPreDone(); }
  }, [preOpenDoc]);
  const [purpose, setPurpose] = useState("tourism");    // подцель: tourism | private_visit
  const countries = visaCountries().filter((c) => c !== "Европа (Шенген)").sort((a, b) => a.localeCompare(b, "ru"));
  const POPULAR_C = ["Япония", "Китай", "Таиланд", "Индонезия", "Европа (Шенген)", "ОАЭ"];
  const cCfg = country ? countryCfg(country) : null;
  const cVisa = country ? visaInfoFor(country) : null;
  // поездка с этой страной — подтягиваем даты, чтобы не спрашивать заново
  const linkedTrip = country ? (trips || []).find((t) => t.country === country) : null;
  const found = q.trim().length >= 2 ? ALL_DOCS.filter((x) => (x.name + " " + x.country + " " + (x.kw || "")).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const popular = ["tdac", "evisa_id", "schengen", "eta"].map((id) => ALL_DOCS.find((x) => x.id === id)).filter(Boolean);
  const inputSt = { width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" };
  const timingText = (dd) => { if (df) { const st = docStatus(dd, df); return <TimeBadge st={st} />; }
    const parts = []; if (dd.E < 9999) parts.push(`не раньше чем за ${dd.E} дн.`); if (dd.P > 0) parts.push(`оформляется ~${dd.P} дн.`);
    return parts.length ? <span style={{ fontSize: 10, color: T.subd, whiteSpace: "nowrap" }}>{parts.join(" · ")}</span> : null; };
  const DocRow = ({ dd, dim }) => { const info = docInfoFor(dd); return (
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
  const onResumeDoc = (d) => {
    const base = ALL_DOCS.find((x) => x.id === d.docKey) || { id: d.docKey, name: d.name, country: d.country };
    setResumeId(d.id); setWiz(base);
  };
  const matching = (trips || []).filter((t) => t.country === (doc ? doc.country : country));
  return <div style={{ animation: "fadeUp .18s ease-out", paddingBottom: 8 }}>
    <Header />
    <div style={{ padding: "8px 20px 0" }}>
      {mode === "home" && <>
        <div style={{ margin: "0 -20px 4px" }}><ScreenHero eyebrow="Документы" title="Всё для въезда — без хаоса" sub="Соберите комплект под поездку или заполните конкретный документ с помощником." image={HOME_ASSETS.docs || HOME_ASSETS.fullTrip} /></div>
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
        {/* Мои документы — снизу, как «последние поиски» */}
        {(() => {
          const mine = store.get("mydocs", []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          if (!mine.length) return <div style={{marginTop:18}}><EmptyState compact icon="📄" title="Черновиков пока нет" sub="Начните с комплекта для поездки или откройте конкретный документ выше." /></div>;
          return <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 15, color: T.text, flex: 1 }}>Мои документы</div>
              <span style={{ fontSize: 11.5, color: T.subd }}>{mine.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {mine.map((d) => {
                const ready = d.status === "ready";
                const cfgD = docConfig(d.docKey, d.name, d.country);
                const total = cfgD ? Math.max(1, visibleFields(cfgD, d.ans || {}).filter((f) => f.req).length) : ((DOC_FIELDS[d.docKey] || []).length || 1);
                const fld = Object.values(d.ans || {}).filter((v) => String(v || "").trim()).length;
                return <div key={d.id} onClick={() => onResumeDoc && onResumeDoc(d)} className="press" style={{ background: T.card, border: `1px solid ${ready ? T.green + "55" : T.line}`, borderRadius: 16, padding: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: ready ? T.green + "1e" : T.violet + "18", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 18 }}>{ready ? "✅" : "📝"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: T.subd, marginTop: 2 }}>{d.country || "Документ"} · заполнено {fld} из {total}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: .3, color: ready ? T.green : "#e0a53a", background: (ready ? T.green : "#e0a53a") + "1e", border: `1px solid ${(ready ? T.green : "#e0a53a")}55`, borderRadius: 999, padding: "3px 9px" }}>{ready ? "ГОТОВ" : "ЧЕРНОВИК"}</span>
                  </div>
                  {!ready && <div style={{ height: 4, background: T.line, borderRadius: 999, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.round(fld / total * 100)}%`, height: "100%", background: GRAD.cta }} /></div>}
                </div>;
              })}
            </div>
          </div>;
        })()}
      </>}
      {mode === "pick" && <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div onClick={() => setMode("home")} className="press" style={{ cursor: "pointer" }}><Icon d={I.back} size={20} color={T.text} /></div>
          <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text }}>Подбор документов</div>
        </div>
        {CITIZENSHIPS.length > 1 ? (<div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.subd, marginBottom: 8 }}>Ваше гражданство</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CITIZENSHIPS.map((c) => <div key={c.cc} onClick={() => { setCc(c.cc); store.set("citizenship", c.cc); }} className="press" style={{ display: "flex", alignItems: "center", gap: 6, background: cc === c.cc ? T.violet + "22" : T.card, border: `1px solid ${cc === c.cc ? T.violet : T.line}`, borderRadius: 999, padding: "8px 13px", cursor: "pointer" }}><span>{c.flag}</span><span style={{ fontSize: 13, fontWeight: 700, color: cc === c.cc ? T.violet : T.text }}>{c.name}</span></div>)}
          </div>
        </div>) : (<div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 12, color: T.subd }}><span>{(CITIZENSHIPS[0] || {}).flag}</span>Гражданство: {(CITIZENSHIPS[0] || {}).name} · набор документов для граждан РФ</div>)}
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
          <div onClick={() => setMode("home")} className="press" style={{ cursor: "pointer" }}><Icon d={I.back} size={20} color={T.text} /></div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 18, color: T.text }}>{country}</div><div style={{ fontSize: 11.5, color: T.subd }}>{TRIP_TYPE_LABEL}{linkedTrip ? ` · поездка «${linkedTrip.title}»` : ""}</div></div>
        </div>
        {/* один блок: режим въезда + что именно нужно, с ценой, сроком и статусом */}
        {(() => {
          const sl = SUPPORT_LABEL[cCfg.supportLevel] || SUPPORT_LABEL.information_only;
          const noVisa = cCfg.entryMode === "none";
          return <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: noVisa ? T.green : T.violet, background: (noVisa ? T.green : T.violet) + "1e", border: `1px solid ${(noVisa ? T.green : T.violet)}55`, borderRadius: 999, padding: "4px 10px" }}>{(ENTRY_MODE_LABEL[cCfg.entryMode] || "").toUpperCase()}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: sl.col, background: sl.col + "1a", border: `1px solid ${sl.col}44`, borderRadius: 999, padding: "3px 8px", marginLeft: "auto" }}>{sl.txt}</span>
            </div>
            {cCfg.note && <div style={{ fontSize: 11.5, color: T.subd, marginBottom: 10, lineHeight: 1.45 }}>💡 {cCfg.note}</div>}
            {(cCfg.purposes || []).length > 1 && <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.subd, marginBottom: 7 }}>Цель поездки</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {cCfg.purposes.map((p) => <div key={p} onClick={() => setPurpose(p)} className="press" style={{ background: purpose === p ? T.violet + "22" : T.card, border: `1px solid ${purpose === p ? T.violet : T.line}`, borderRadius: 999, padding: "8px 13px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: purpose === p ? T.violet : T.text }}>{PURPOSE_LABEL[p]}</div>)}
              </div>
            </div>}
            <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 15, color: T.text, marginBottom: 10 }}>{noVisa ? "Что нужно перед поездкой" : "Что нужно оформить"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
              {(cCfg.items || []).map((it) => {
                const d = ITEM_DESC[it.id] || {};
                const mine = store.get("mydocs", []).find((x) => x.docKey === it.id);
                const st = mine ? (mine.status === "ready" ? "ready" : "draft") : "todo";
                const meta = st === "ready" ? { txt: "Готов", col: T.green } : st === "draft" ? { txt: "Заполняется", col: "#e0a53a" } : { txt: it.kind === "request" ? "Запросить" : it.kind === "form" ? "Заполнить" : it.kind === "external" ? "На сайте" : "Проверить", col: T.violet };
                const canOpen = it.kind === "form" || it.kind === "request";
                const dd = ALL_DOCS.find((x) => x.id === it.id);
                return <div key={it.id} onClick={() => { if (!canOpen) return; setResumeId((localDocRecord(linkedTrip&&linkedTrip.id,it.id)||{}).id||null); setWiz(dd || { id: it.id, name: it.name, country }); }} className={canOpen ? "press" : ""} style={{ background: T.card, border: `1px solid ${st === "ready" ? T.green + "44" : T.line}`, borderRadius: 14, padding: 13, cursor: canOpen ? "pointer" : "default" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{d.what || it.name}</div>
                      {d.why && <div style={{ fontSize: 11.5, color: T.subd, lineHeight: 1.45, marginTop: 4 }}>{d.why}</div>}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: meta.col, background: meta.col + "1a", border: `1px solid ${meta.col}44`, borderRadius: 999, padding: "3px 8px" }}>{meta.txt}</span>
                  </div>
                  {(d.cost || d.days) && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                    {d.cost && <span style={{ fontSize: 10.5, color: T.sub, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "4px 8px" }}>💳 {d.cost}</span>}
                    {d.days && <span style={{ fontSize: 10.5, color: T.sub, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "4px 8px" }}>⏱ {d.days}</span>}
                  </div>}
                </div>;
              })}
            </div>
            {cCfg.supportLevel === "information_only" && <div style={{ fontSize: 11.5, color: "#e0a53a", marginBottom: 14, lineHeight: 1.45 }}>Для этой страны доступна только справка — заполнение форм в приложении не поддерживается.</div>}
          </>;
        })()}
        <div style={{ fontFamily: "Sora,sans-serif", fontWeight: 800, fontSize: 15, color: T.text, marginBottom: 10 }}>Правила въезда</div>
        {(() => {
          const vi = visaInfoFor(country);
          if (!vi) return null;
          const col = vi.status === "Виза обязательна" ? "#e0a53a" : vi.status.indexOf("Безвиз") === 0 ? T.green : T.cyan;
          return <div style={{ background: T.card, border: `1px solid ${col}44`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .3, color: col, background: col + "1e", border: `1px solid ${col}55`, borderRadius: 999, padding: "3px 10px" }}>{vi.status.toUpperCase()}</span>
              {vi.days ? <span style={{ fontSize: 11.5, color: T.subd }}>до {vi.days} {plural(vi.days, "дня", "дней", "дней")}</span> : null}
              {vi.visaType ? <span style={{ fontSize: 10.5, color: T.subd, marginLeft: "auto" }}>{vi.visaType}</span> : null}
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, marginBottom: 10 }}>{vi.summary}</div>
            {(vi.processing || vi.center) && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {vi.processing && <span style={{ fontSize: 11, color: T.sub, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 9px" }}>⏱ {vi.processing}</span>}
              {vi.center && <span style={{ fontSize: 11, color: T.sub, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 9px" }}>📍 {vi.center}</span>}
            </div>}
            {vi.schengen && <div style={{ background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 11, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.violet, marginBottom: 6 }}>ОБЩИЕ ПРАВИЛА ШЕНГЕНА</div>
              {[SCHENGEN_RULES.single, SCHENGEN_RULES.first, SCHENGEN_RULES.rule, SCHENGEN_RULES.when, "Сбор: " + SCHENGEN_RULES.fee].map((r, i) => <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 5 }}>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: T.violet, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: T.subd, lineHeight: 1.4 }}>{r}</span></div>)}
            </div>}
            {vi.warn && <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: "#e0a53a14", border: "1px solid #e0a53a44", borderRadius: 10, padding: "9px 11px", marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>⚠️</span><span style={{ fontSize: 12, color: T.sub, lineHeight: 1.45 }}>{vi.warn}</span></div>}
            {vi.tip && <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>💡</span><span style={{ fontSize: 12, color: T.subd, lineHeight: 1.45 }}>{vi.tip}</span></div>}
            {((vi.must && vi.must.length) ? vi.must : (vi.schengen ? SCHENGEN_RULES.docs : [])).length > 0 && <div style={{ marginTop: 4 }}>
              {((vi.must && vi.must.length) ? vi.must : (vi.schengen ? SCHENGEN_RULES.docs : [])).map((m, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: T.subd, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T.subd, lineHeight: 1.4 }}>{m}</span></div>)}
            </div>}
            {(vi.money || (vi.schengen ? SCHENGEN_RULES.money : null)) && <div style={{ fontSize: 12, color: T.subd, lineHeight: 1.45, marginTop: 8 }}>💳 {vi.money || SCHENGEN_RULES.money}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
              {(vi.src || []).map((s, i) => <span key={i} onClick={() => { try { window.open(s.url, "_blank"); } catch (e) { } }} className="press" style={{ fontSize: 11.5, color: T.violet, fontWeight: 700, border: `1px solid ${T.violet}44`, background: T.violet + "12", borderRadius: 999, padding: "5px 11px", cursor: "pointer" }}>{s.label} →</span>)}
            </div>
            <div style={{ fontSize: 10, color: T.subd, marginTop: 9 }}>Проверено {vi.checked} · правила въезда меняются, сверьтесь с источником</div>
          </div>;
        })()}
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
    {wiz && <DocWizard doc={wiz} fullScreen savedId={resumeId} onSaved={() => forceRefresh((n) => n + 1)} onClose={() => { setWiz(null); setResumeId(null); forceRefresh((n) => n + 1); }} setToast={setToast} />}
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
    {doc && (() => { const info = docInfoFor(doc); const links = (info.links || []).filter((l) => l.url); return (
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
        <div onClick={() => { if (docConfig(doc.id, doc.name, doc.country) || REQUEST_DOCS[doc.id]) { setResumeId((localDocRecord(linkedTrip&&linkedTrip.id,doc.id)||{}).id||null); setWiz(doc); setDoc(null); } else setToast("Мастер для этого документа появится позже"); }} className="press" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: GRAD.cta, borderRadius: 14, padding: 13, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Заполнить с помощником {!(docConfig(doc.id, doc.name, doc.country) || REQUEST_DOCS[doc.id]) && <Badge label="скоро" color="#fff" />}</div>
        {links.length > 0 && <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, margin: "14px 0 6px", fontFamily: "Sora,sans-serif" }}>Официальные ссылки</div>
          {links.map((l) => <div key={l.label} onClick={() => { try { window.open(l.url, "_blank"); } catch (e) { } }} className="press" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${T.line}`, cursor: "pointer" }}><span style={{ fontSize: 13, color: T.violet, fontWeight: 600, flex: 1 }}>{l.label}</span><Icon d={I.chevR} size={14} color={T.subd} /></div>)}
        </>}
        {!doc._fromTrip && DOC_MATRIX[doc.country] && <div onClick={() => setAddOpen(true)} className="press" style={{ marginTop: 12, textAlign: "center", background: T.violet + "1a", border: `1px solid ${T.violet}55`, borderRadius: 12, padding: 11, color: T.violet, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Добавить в путешествие</div>}
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
function Hotels({ setToast, preOpen, onPreDone, trip=null, onBack, onAddStay }) {
  const [svc,setSvc]=useState(null),[goUrl,setGoUrl]=useState(null),[bookingOpen,setBookingOpen]=useState(false);
  const today=new Date().toISOString().slice(0,10), scoped=!!(trip&&trip.id);
  const travelers=scoped?activeTravelers(trip):[];
  const [pq,setPq]=useState(()=>scoped?(trip.dcName||trip.country||""):"");
  const [pFrom,setPFrom]=useState(()=>scoped?(trip.df||""):"");
  const [pTo,setPTo]=useState(()=>scoped?(trip.dt||""):"");
  const [guests,setGuests]=useState(()=>scoped?Math.max(1,travelers.length):(2));
  const [searched,setSearched]=useState(()=>scoped),[dateErr,setDateErr]=useState("");
  const [stay,setStay]=useState(()=>({name:"",startDate:scoped?(trip.df||""):"",endDate:scoped?(trip.dt||""):"",priceAmount:"",currency:(trip&&trip.baseCurrency)||"EUR",pricingMode:"total"}));
  useEffect(()=>{if(preOpen){const x=SERVICES.find(s=>s.id===preOpen);if(x){setSvc(x);setGoUrl(null);}onPreDone&&onPreDone();}},[preOpen]);
  useEffect(()=>{if(scoped){setPq(trip.dcName||trip.country||"");setPFrom(trip.df||"");setPTo(trip.dt||"");setGuests(Math.max(1,activeTravelers(trip).length));}},[trip&&trip.id]);
  const activePromos=(s)=>(s.promos||[]).filter(p=>!p.endDate||p.endDate>=today).sort((a,b)=>(b.discountRub||0)-(a.discountRub||0));
  const changeFrom=(v)=>{setPFrom(v);setDateErr("");if(v&&pTo&&pTo<=v)setPTo(addIsoDays(v,1));};
  const changeTo=(v)=>{if(pFrom&&v&&v<=pFrom){setDateErr("Выезд должен быть позже заезда");return;}setDateErr("");setPTo(v);};
  const validDates=!pFrom||!pTo||pTo>pFrom;
  const matchedPromos=(()=>{const q=pq.trim().toLowerCase();if(!q)return[];const resolved=resolveDestination(pq),out=[];for(const s of SERVICES)for(const p of activePromos(s)){const hay=`${p.country||""} ${p.city||""} ${p.header||""} ${s.name}`.toLowerCase(),universal=!p.country&&!p.city;let geoOk=hay.includes(q)||universal;if(resolved){const cOk=!p.country||(resolved.country&&p.country===resolved.country),ctOk=!p.city||(resolved.city&&p.city===resolved.city);if(cOk&&ctOk)geoOk=true;}if(!geoOk)continue;if(pFrom&&p.stayTo&&pFrom>p.stayTo)continue;if(pTo&&p.stayFrom&&pTo<p.stayFrom)continue;out.push({...p,_svc:s});}return out.sort((a,b)=>(b.discountRub||0)-(a.discountRub||0)).slice(0,8);})();
  const copy=async(p)=>{try{await navigator.clipboard.writeText(p.code);setGoUrl(p.url||null);setToast("Промокод скопирован");}catch(e){setToast("Не удалось скопировать");}};
  const openProvider=(s,url)=>{trackGoal("hotel_partner_click",{partner:s.id,country:(resolveDestination(pq)||{}).country||"",city:(resolveDestination(pq)||{}).city||""});try{window.open(url||s.url,"_blank");}catch(e){}setToast(`Открываем ${s.name}…`);};
  const search=()=>{if(!pq.trim()){setToast("Укажите город или страну");return;}if(!validDates){setDateErr("Выезд должен быть позже заезда");return;}setSearched(true);};
  const addStay=()=>{if(!stay.name.trim()){setToast("Укажите отель или жильё");return;}if(stay.startDate&&stay.endDate&&stay.endDate<=stay.startDate){setToast("Выезд должен быть позже заезда");return;}const item={id:"s"+Date.now(),name:stay.name.trim(),done:true,status:"confirmed",startDate:stay.startDate||pFrom||"",endDate:stay.endDate||pTo||"",priceAmount:Number(stay.priceAmount)||null,currency:stay.currency||"EUR",pricingMode:stay.pricingMode||"total",splitTravelerIds:travelers.map(x=>x.id),payments:[],createdAt:new Date().toISOString()};onAddStay&&onAddStay(item);setBookingOpen(false);setToast(scoped?`Жильё добавлено в «${trip.title}»`:"Жильё сохранено");};
  const dInput={width:"100%",background:T.card,border:`1px solid ${T.line}`,borderRadius:12,padding:"10px 11px",color:T.text,outline:"none",colorScheme:"dark"};
  const hasTelegramBack=typeof window!=="undefined"&&window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.BackButton;
  return <div style={{animation:"fadeUp .18s ease-out",paddingBottom:18}}>
    {!scoped&&<Header/>}
    {scoped&&!hasTelegramBack&&<div style={{padding:"10px 16px 0"}}><div onClick={onBack} className="press" style={{display:"inline-flex",alignItems:"center",gap:7,color:T.sub,fontSize:12,fontWeight:800,cursor:"pointer"}}><Icon d={I.back} size={15} color={T.sub}/>Назад в {trip.title}</div></div>}
    <ScreenHero eyebrow={scoped?`Для поездки · ${trip.title}`:"Жильё"} title={scoped?"Подобрать жильё":"Жильё без лишних вкладок"} sub={scoped?"Даты и состав поездки уже подставлены. Выберите сервис или добавьте готовую бронь.":"Сначала параметры поездки, затем подходящие скидки и сервисы бронирования."} image={HOME_ASSETS.hotels}/>
    <div style={{padding:"0 16px"}}>
      <div style={{background:T.card,border:`1px solid ${T.line2}`,borderRadius:18,padding:14,marginBottom:12}}>
        <div style={{fontFamily:"Sora,sans-serif",fontSize:14,fontWeight:800,color:T.text,marginBottom:9}}>Параметры проживания</div>
        <input value={pq} onChange={(e)=>{setPq(e.target.value);setSearched(false);}} placeholder="Город, страна или район" style={{...dInput,marginBottom:9}}/>
        <DateRangeField from={pFrom} to={pTo} title="Даты проживания" minDate={today} onChange={(a,b)=>{changeFrom(a);changeTo(b);}} />
        {dateErr&&<div style={{fontSize:10.8,color:"#ff7ba9",marginTop:5}}>{dateErr}</div>}
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}><div style={{flex:1}}><div style={{fontSize:10.5,color:T.subd}}>Гостей</div><div style={{fontSize:13,color:T.text,fontWeight:800,marginTop:2}}>{guests} {plural(guests,"человек","человека","человек")}</div></div><div style={{display:"flex",gap:5}}><button onClick={()=>setGuests(Math.max(1,guests-1))} style={{width:32,height:32,borderRadius:10,border:`1px solid ${T.line}`,background:T.card2,color:T.text,fontSize:18}}>−</button><button onClick={()=>setGuests(Math.min(30,guests+1))} style={{width:32,height:32,borderRadius:10,border:`1px solid ${T.line}`,background:T.card2,color:T.text,fontSize:18}}>＋</button></div></div>
        <div onClick={search} className="press" style={{marginTop:12,textAlign:"center",background:GRAD.cta,borderRadius:13,padding:12,color:"#fff",fontSize:13,fontWeight:900,cursor:"pointer"}}>Показать скидки и сервисы</div>
      </div>
      {searched&&<>
        <div style={{display:"flex",alignItems:"baseline",margin:"17px 3px 9px"}}><div style={{fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:15,color:T.text,flex:1}}>Скидки под ваши даты</div><span style={{fontSize:10.5,color:T.subd}}>{matchedPromos.length?`${matchedPromos.length} промо`:"без промо"}</span></div>
        {matchedPromos.length?<div style={{display:"flex",flexDirection:"column",gap:9}}>{matchedPromos.map((p,i)=><div key={p.code+i} style={{background:`linear-gradient(135deg,${T.card2},${T.card})`,border:`1px solid ${T.line}`,borderRadius:16,padding:12}}><div style={{display:"flex",alignItems:"flex-start",gap:10}}><ServiceLogo id={p._svc.id} name={p._svc.name}/><div style={{flex:1,minWidth:0}}><div style={{fontFamily:"Sora,sans-serif",fontSize:14,fontWeight:800,color:T.text}}>{promoHeadline(p)}</div><div style={{fontSize:10.8,color:T.subd,marginTop:3}}>{p._svc.name} · {p.header}</div>{p.endDate&&<div style={{fontSize:10,color:T.subd,marginTop:4}}>Бронирование до {ddmm(p.endDate)}{p.stayTo?` · проживание до ${ddmm(p.stayTo)}`:""}</div>}</div></div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,background:"rgba(255,255,255,.035)",border:`1px dashed ${T.line2}`,borderRadius:11,padding:"8px 10px"}}><span style={{fontFamily:"Sora,sans-serif",fontSize:13,fontWeight:900,color:T.cyan,letterSpacing:.7,flex:1}}>{p.code}</span><span onClick={()=>copy(p)} className="press" style={{fontSize:11,fontWeight:800,color:T.cyan,cursor:"pointer"}}>Скопировать</span><span onClick={()=>openProvider(p._svc,p.url)} className="press" style={{fontSize:11,fontWeight:800,color:T.text,cursor:"pointer"}}>Открыть ↗</span></div></div>)}</div>:<EmptyState compact icon="🏷️" title="Промокодов под эти даты пока нет" sub="Это не блокирует поиск: откройте любой сервис ниже и сравните варианты."/>}
      </>}
      <div style={{fontSize:10.8,color:T.subd,lineHeight:1.45,margin:"12px 3px 0"}}>TripWise пока не строит собственную выдачу отелей: здесь собраны сервисы и доступные промокоды под параметры поездки.</div><div style={{fontFamily:"Sora,sans-serif",fontSize:13,fontWeight:800,color:T.subd,margin:"18px 3px 9px"}}>Сравнить жильё</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{SERVICES.map(s=>{const n=activePromos(s).length;return <div key={s.id} onClick={()=>{setSvc(s);setGoUrl(null);}} className="press" style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:16,padding:12,cursor:"pointer",minHeight:96}}><div style={{display:"flex",alignItems:"center",gap:8}}><ServiceLogo id={s.id} name={s.name}/><div style={{fontFamily:"Sora,sans-serif",fontSize:12.5,fontWeight:800,color:T.text,lineHeight:1.15}}>{s.name}</div></div><div style={{fontSize:10.5,color:T.subd,lineHeight:1.35,marginTop:9}}>{s.desc}</div><div style={{fontSize:10.5,color:n?T.cyan:T.subd,fontWeight:800,marginTop:7}}>{n?`${n} активных промо`:"Открыть сервис"}</div></div>})}</div>
      {scoped&&<div onClick={()=>{setStay(x=>({...x,startDate:pFrom||x.startDate,endDate:pTo||x.endDate}));setBookingOpen(true);}} className="press" style={{marginTop:12,background:`linear-gradient(135deg,${T.card2},${T.card})`,border:`1px solid ${T.line2}`,borderRadius:16,padding:13,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}><div style={{fontSize:20}}>✓</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800,color:T.text}}>Уже забронировали?</div><div style={{fontSize:10.8,color:T.subd,marginTop:2}}>Добавьте жильё и цену прямо в {trip.title}</div></div><Icon d={I.chevR} size={15} color={T.subd}/></div>}
    </div>
    {svc&&<Overlay onClose={()=>setSvc(null)}><SheetHead title={svc.name} onClose={()=>setSvc(null)}/><div style={{display:"flex",flexDirection:"column",gap:11,maxHeight:"52vh",overflowY:"auto"}}>{activePromos(svc).length?activePromos(svc).map(p=><div key={p.code} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:14,padding:11}}><div style={{fontFamily:"Sora,sans-serif",fontSize:14,fontWeight:800,color:T.text}}>{promoHeadline(p)}</div><div style={{fontSize:10.8,color:T.subd,marginTop:3}}>{p.header}</div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:9}}><span style={{flex:1,color:T.cyan,fontFamily:"Sora,sans-serif",fontWeight:900}}>{p.code}</span><span onClick={()=>copy(p)} className="press" style={{fontSize:11,color:T.cyan,fontWeight:800,cursor:"pointer"}}>Скопировать</span></div></div>):<EmptyState compact title="Промокодов сейчас нет" sub="Можно перейти в сервис без промокода."/>}</div><div style={{marginTop:13}}><Btn onClick={()=>openProvider(svc,goUrl||svc.url)}>Перейти в {svc.name}</Btn></div></Overlay>}
    {bookingOpen&&<Overlay onClose={()=>setBookingOpen(false)}><SheetHead title="Добавить жильё" onClose={()=>setBookingOpen(false)}/><input value={stay.name} onChange={(e)=>setStay(x=>({...x,name:e.target.value}))} placeholder="Отель / апартаменты" style={{...dInput,marginBottom:8}}/><DateRangeField from={stay.startDate||""} to={stay.endDate||""} title="Период проживания" minDate={today} onChange={(a,b)=>setStay(x=>({...x,startDate:a,endDate:b}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:8,marginTop:8}}><input inputMode="decimal" value={stay.priceAmount} onChange={(e)=>setStay(x=>({...x,priceAmount:e.target.value.replace(",",".")}))} placeholder="Цена" style={dInput}/><select value={stay.currency} onChange={(e)=>setStay(x=>({...x,currency:e.target.value}))} style={dInput}>{COST_CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></div><div style={{display:"flex",gap:7,marginTop:8}}>{[["total","За всех"],["per_person","За человека"]].map(([v,l])=><div key={v} onClick={()=>setStay(x=>({...x,pricingMode:v}))} className="press" style={{flex:1,textAlign:"center",border:`1px solid ${stay.pricingMode===v?T.cyan:T.line}`,background:stay.pricingMode===v?T.cyan+"16":T.card,borderRadius:10,padding:9,color:stay.pricingMode===v?T.cyan:T.subd,fontSize:11,fontWeight:800,cursor:"pointer"}}>{l}</div>)}</div><div style={{fontSize:10.5,color:T.subd,marginTop:9}}>По умолчанию расход разделится на всех текущих путешественников. Плательщика можно уточнить в бюджете поездки.</div><div onClick={addStay} className="press" style={{marginTop:12,textAlign:"center",background:GRAD.cta,borderRadius:13,padding:12,color:"#fff",fontSize:13,fontWeight:900,cursor:"pointer"}}>Добавить в {trip&&trip.title||"поездку"}</div></Overlay>}
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
  const syncTimers=useRef({}),mutationQueues=useRef({}),runningMutations=useRef({}),syncRunning=useRef({}),tripsRef=useRef([]);
  const [syncStates,setSyncStates]=useState({});
  const dirtyRead=()=>store.get("dirty_trips",{})||{};
  const dirtyWrite=(v)=>store.set("dirty_trips",v||{});
  const dirtyMark=(id,base,local)=>{if(!id||!base||!local)return;const all=dirtyRead(),prev=all[id];all[id]={base:(prev&&prev.base)||base,local,updatedAt:Date.now()};dirtyWrite(all);};
  const dirtyClear=(id)=>{const all=dirtyRead();if(all[id]){delete all[id];dirtyWrite(all);}};
  const [notifyPrefs, setNotifyPrefs] = useState(() => ({deadlines:true,group:true,changes:true,...store.get("notifyPrefs",{})}));
  const changeNotifyPrefs=(next)=>{const clean={deadlines:next.deadlines!==false,group:next.group!==false,changes:next.changes!==false};setNotifyPrefs(clean);store.set("notifyPrefs",clean);syncNotifyPrefs(clean);};
  useEffect(()=>{store.set("trips",trips);tripsRef.current=trips;},[trips]);
  // Первый запуск нового Shared Trip слоя: старые localStorage-поездки мягко мигрируют на сервер,
  // затем серверные поездки становятся источником истины. В браузере без Telegram всё остаётся локальным.
  useEffect(() => {
    let dead = false;
    const hydrate = async () => {
      if (!tgInitData()) return;
      const local = store.get("trips", []) || [];
      for (const x of local.slice(0, 30)) if (!x.creatorId) await syncTripToServer(x);
      const r = await sharedApi("list-trips");
      if (!dead && r.ok && Array.isArray(r.trips)) {
        const serverIds = new Set(r.trips.map((x) => x.id)),dirty=dirtyRead(),recover=[];
        const serverRows=r.trips.map((srv)=>{const d=dirty[srv.id];if(!d||!d.base||!d.local)return srv;const merged=mergeTripRecovery(d.base,d.local,srv);recover.push({id:srv.id,base:srv,local:merged});return merged;});
        const unsynced = local.filter((x) => !serverIds.has(x.id) && !x.creatorId);
        setTrips([...serverRows, ...unsynced]);
        // Если приложение закрыли без сети, не теряем локальную работу: ребейзим её на сервер и снова ставим в очередь.
        for(const x of recover){if((mutationQueues.current[x.id]||[]).length||(runningMutations.current[x.id]||[]).length)continue;const fn=(latest)=>mergeTripRecovery(x.base,x.local,latest);mutationQueues.current[x.id]=[fn];setSyncStatus(x.id,"syncing");scheduleTripFlush(x.id,450);}
      }
    };
    hydrate(); const tm = setTimeout(hydrate, 900);
    return () => { dead = true; clearTimeout(tm); };
  }, []);
  const [tripOpen, setTripOpen] = useState(null);
  const [tripSection, setTripSection] = useState(null); // раздел из deep link (docs/tickets/lodging/extras)      // id открытой поездки
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
  const [flow, setFlow] = useState(null);             // {kind, tripId, section}: дочерний flow, запущенный из конкретной поездки
  const [invitePreview,setInvitePreview]=useState(null), [inviteJoined,setInviteJoined]=useState(null);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(() => store.get("name", "TripWise tester"));
  useEffect(() => { store.set("name", name); }, [name]);
  const [profile, setProfile] = useState(() => store.get("profile", {}));
  useEffect(() => { store.set("profile", profile || {}); }, [profile]);
  // MVP privacy model: профиль и паспортные данные существуют только локально в Telegram WebView.
  // На backend профиль не отправляем вообще — shared Trip хранит только публичные данные участников поездки.
  const saveProfile=async(v)=>{const next={...(v||{})};setProfile(next);store.set("profile",next);return {ok:true,local:true};};
  const [visaRulesRev,setVisaRulesRev]=useState(0);
  useEffect(()=>{let dead=false;(async()=>{const r=await sharedApi("visa-rules",{},12000);if(!dead&&r.ok&&r.rules&&Object.keys(r.rules).length){store.set("visa_rules",r.rules);setVisaRulesRev(x=>x+1);}})();return()=>{dead=true;};},[]);
  const [inset, setInset] = useState({ top: 0, bottomStr: "env(safe-area-inset-bottom)", logoTop: null });
  const safeTop = inset.top;
  const [toast, setToastRaw] = useState(null);
  const toastTimer = useRef(null);
  const setToast = (m) => { setToastRaw(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastRaw(null), 2200); };
  const [actionToast, setActionToast] = useState(null);
  const actionToastTimer = useRef(null), deleteTimers = useRef({});

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
      const noSwipe = () => { try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { } };
      const goFullscreen = () => { try { if (tg.requestFullscreen && !tg.isFullscreen) tg.requestFullscreen(); } catch (e) { } };
      // TripWise задуман как полноэкранный Mini App: сохраняем fullscreen, но используем только одну навигацию назад.
      goFullscreen();
      noSwipe();
      // подложка нативного отскока WebView: на коротких экранах жест уходит в системный bounce
      try { tg.setBackgroundColor && tg.setBackgroundColor("#0a0a18"); } catch (e) { }
      trackGoal("app_open"); trackAppOpenBackend(); trackPage("/home", "Главная");
      try { tg.setHeaderColor && tg.setHeaderColor("#0a0a18"); } catch (e) { }
      try { tg.setBottomBarColor && tg.setBottomBarColor("#0a0a18"); } catch (e) { }
      const u = tg.initDataUnsafe && tg.initDataUnsafe.user; if (u && u.first_name) setName([u.first_name, u.last_name].filter(Boolean).join(" "));
      recalc();
      ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"].forEach((ev) => tg.onEvent && tg.onEvent(ev, recalc));
      // некоторые клиенты применяют fullscreen/swipe-lock не сразу после ready — повторяем безопасно
      [150, 500, 1200].forEach((ms) => setTimeout(() => { recalc(); goFullscreen(); noSwipe(); }, ms));
    } catch (e) { }
    return () => { try { ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"].forEach((ev) => tg.offEvent && tg.offEvent(ev, recalc)); } catch (e) { } };
  }, []);

  const [form, setForm] = useState({ origin: null, dest: null, round: true, dep: null, ret: null, adults: 1, children: [] });
  useEffect(()=>{if(form.origin)return;const a=AIRPORTS.find(x=>x.code===profile.homeAirport)||AIRPORTS.find(x=>profile.homeCity&&x.city.toLowerCase()===String(profile.homeCity).toLowerCase());if(a)setForm(f=>f.origin?f:{...f,origin:a});},[profile.homeAirport,profile.homeCity]);
  const [query, setQuery] = useState({ origin: "", destName: "", destinationId: "", adults: 1, datesLabel: "" });
  const [routes, setRoutes] = useState([]); const [loading, setLoading] = useState(false); const [selected, setSelected] = useState(null);
  // «просмотр результатов» — один раз на показанную выдачу (не на каждый ре-рендер)
  const resultsSeenRef = useRef("");
  useEffect(() => {
    const top = stack[stack.length - 1];
    if (top === "results" && !loading && routes.length) {
      const sig = (query.origin || "") + ">" + (query.destCode || "") + ":" + routes.length;
      if (resultsSeenRef.current !== sig) { resultsSeenRef.current = sig; trackGoal("flight_results_viewed", { count: routes.length }); }
    }
  }, [stack, loading, routes]);
  const [searchError, setSearchError] = useState(false);

  const [saved, setSaved] = useState(() => store.get("saved", []));
  useEffect(() => { store.set("saved", saved); }, [saved]);
  const [recent, setRecent] = useState(() => store.get("recent", []));
  useEffect(() => { store.set("recent", recent); }, [recent]);
  const [publicTrips, setPublicTrips] = useState([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const loadPublicTrips = async () => {
    setPublicLoading(true);
    try {
      const r = await sharedApi("list-public-trips", {}, 15000);
      if (r && r.ok) setPublicTrips(Array.isArray(r.trips) ? r.trips : []);
    } catch (e) { }
    finally { setPublicLoading(false); }
  };
  useEffect(() => { loadPublicTrips(); }, []);

  // открыть конкретный маршрут по ссылке-шарингу: start_param из Telegram (t.me/.../app?startapp=...) или #r= в браузере
  const pendingOpenId = useRef(null);
  const lastSearchRef = useRef(null); // параметры последнего успешного поиска — для шеринга
  const b64urlEnc = (s) => btoa(unescape(encodeURIComponent(s))).split("+").join("-").split("/").join("_").replace(/=+$/, "");
  const b64urlDec = (s) => decodeURIComponent(escape(atob(s.split("-").join("+").split("_").join("/"))));
  const deepLinkDone = useRef(false);
  useEffect(() => {
    const tryOpen = async () => {
      if (deepLinkDone.current) return;
      try {
        const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
        const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
        const h = (typeof location !== "undefined" && location.hash) || "";
        const m = h.match(/[#&]r=([^&]+)/);
        const raw = sp || (m && m[1]) || "";
        if (!raw) return;
        // открыть витрину публичных поездок из сообщения бота
        if (raw === "open_trips") {
          deepLinkDone.current = true;
          setFlow(null); setTab("routes"); setStack([]);
          setTimeout(() => loadPublicTrips(), 0);
          try { history.replaceState(null, "", location.pathname); } catch (e) { }
          return;
        }
        // приглашение в Shared Trip: join_<tripId>_<shareCode>
        if (raw.indexOf("join_") === 0) {
          const mj = raw.match(/^join_([^_]+)_([a-fA-F0-9]+)$/);
          if (mj) {
            deepLinkDone.current=true; const pr=await sharedApi("invite-preview",{tripId:mj[1],code:mj[2]});
            if(pr.ok&&pr.preview){ if(pr.preview.alreadyMember){const gr=await sharedApi("get-trip",{tripId:mj[1]});if(gr.ok&&gr.trip){setTrips(p=>p.some(x=>x.id===gr.trip.id)?p.map(x=>x.id===gr.trip.id?gr.trip:x):[gr.trip,...p]);setTripSection("overview");setTripOpen(gr.trip.id);setTab("routes");setStack(["trip"]);}} else setInvitePreview(pr.preview); }
            else setToast("Ссылка приглашения недействительна или устарела");
          }
          try { history.replaceState(null, "", location.pathname); } catch (e) { }
          return;
        }
        // deep link из пуш-уведомления: trip_<id> | trip_<id>_section_<s> | trip_<id>_document_<docId>
        if (raw.indexOf("trip_") === 0) {
          const mt = raw.match(/^trip_([^_]+)(?:_section_([a-z]+))?(?:_document_([\w-]+))?$/);
          if (mt) {
            deepLinkDone.current = true;
            const tripId = mt[1], section = mt[2] || null, docId = mt[3] || null;
            let trip = (store.get("trips", []) || []).find((x) => x.id === tripId) || null;
            if (!trip && tgInitData()) {
              const gr = await sharedApi("get-trip", { tripId });
              if (gr.ok && gr.trip) { trip = gr.trip; setTrips((p)=>p.some((x)=>x.id===tripId)?p.map((x)=>x.id===tripId?gr.trip:x):[gr.trip,...p]); }
            }
            if (!trip) return; // поездку удалили или доступ отозван
            setTripSection(docId ? `document:${docId}` : (section || "overview"));
            setTripOpen(tripId); setTab("routes"); setStack(["trip"]);
          }
          try { history.replaceState(null, "", location.pathname); } catch (e) { }
          return;
        }
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
    trackGoal("flight_search_started", { from: (ff.origin && (ff.origin.code || ff.origin.city)) || "", to: (ff.dest && (ff.dest.code || ff.dest.city)) || "", departDate: ff.dep ? new Date(ff.dep).toISOString().slice(0, 10) : "", returnDate: ff.ret ? new Date(ff.ret).toISOString().slice(0, 10) : "", passengers: (ff.adults || 1) + (ff.children ? ff.children.length : 0) });
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
    } catch (error) { console.warn("[TripWiseAI] runSearch failed", error); setSearchError(true); setRoutes([]); }
    setLoading(false);
  };
  const pendingFns=id=>[...(runningMutations.current[id]||[]),...(mutationQueues.current[id]||[])];
  const replaceSharedTrip=(trip,applyPending=true)=>{if(!trip||!trip.id)return;let next=trip;if(applyPending){for(const fn of pendingFns(trip.id)){try{next=fn(next);}catch(e){}}}setTrips(p=>p.some(x=>x.id===trip.id)?p.map(x=>x.id===trip.id?next:x):[next,...p]);};
  const setSyncStatus=(id,v)=>setSyncStates(x=>({...x,[id]:v}));
  const scheduleTripFlush=(id,delay)=>{clearTimeout(syncTimers.current[id]);syncTimers.current[id]=setTimeout(()=>{delete syncTimers.current[id];flushTripMutations(id);},delay);};
  const flushTripMutations=async(id)=>{if(syncRunning.current[id])return;const ops=(mutationQueues.current[id]||[]).splice(0);if(!ops.length){setSyncStatus(id,"saved");return;}syncRunning.current[id]=true;runningMutations.current[id]=ops;setSyncStatus(id,"syncing");
    try{let gr=await sharedApi("get-trip",{tripId:id},12000),base=gr.ok&&gr.trip?gr.trip:(tripsRef.current.find(x=>x.id===id)||null);if(!base)throw new Error("trip not found");let candidate=ops.reduce((x,fn)=>fn(x),base),r=await syncTripToServer(candidate,base.revision||0);if(!r.ok&&r.error==="revision conflict"&&r.trip){base=r.trip;candidate=ops.reduce((x,fn)=>fn(x),base);r=await syncTripToServer(candidate,base.revision||0);}if(!r.ok||!r.trip)throw new Error(r.error||"save failed");runningMutations.current[id]=[];const newer=mutationQueues.current[id]||[];if(newer.length){let local=r.trip;for(const fn of newer){try{local=fn(local);}catch(e){}}const all=dirtyRead();all[id]={base:r.trip,local,updatedAt:Date.now()};dirtyWrite(all);}else dirtyClear(id);replaceSharedTrip(r.trip,false);setSyncStatus(id,newer.length?"syncing":"saved");}
    catch(e){const newer=mutationQueues.current[id]||[];mutationQueues.current[id]=[...ops,...newer];setSyncStatus(id,"error");scheduleTripFlush(id,2500);}
    finally{syncRunning.current[id]=false;runningMutations.current[id]=[];if((mutationQueues.current[id]||[]).length&&!syncTimers.current[id])scheduleTripFlush(id,400);}
  };
  const updateTrip=(id,fn)=>{mutationQueues.current[id]=[...(mutationQueues.current[id]||[]),fn];setTrips(p=>p.map(t=>{if(t.id!==id)return t;const next=fn(t);dirtyMark(id,t,next);return next;}));setSyncStatus(id,"syncing");scheduleTripFlush(id,350);};
  const scheduleTripDelete = (id) => {
    const gone=trips.find((x)=>x.id===id); if(!gone)return;
    setTrips((p)=>p.filter((x)=>x.id!==id)); setStack([]); setTripOpen(null); setTab("routes"); setFlow(null);
    clearTimeout(deleteTimers.current[id]);
    deleteTimers.current[id]=setTimeout(()=>{ dirtyClear(id); deleteTripOnServer(id); delete deleteTimers.current[id]; },5000);
    clearTimeout(actionToastTimer.current);
    setActionToast({ text:"Поездка удалена", action:"Отменить", onAction:()=>{ clearTimeout(deleteTimers.current[id]); delete deleteTimers.current[id]; setTrips((p)=>p.some((x)=>x.id===id)?p:[gone,...p]); setActionToast(null); setToast("Удаление отменено"); } });
    actionToastTimer.current=setTimeout(()=>setActionToast(null),4800);
  };
  const showUndoable = (text, undo) => { clearTimeout(actionToastTimer.current); setActionToast({text,action:"Отменить",onAction:()=>{try{undo&&undo();}finally{setActionToast(null);setToast("Изменение отменено");}}}); actionToastTimer.current=setTimeout(()=>setActionToast(null),4800); };
  const openTripScreen = (id) => { setFlow(null); setTripSection(null); setTripOpen(id); setTab("routes"); setStack(["trip"]); };
  useEffect(()=>{if(!tripOpen||!tgInitData())return;let dead=false;const refresh=async()=>{if(dead||syncRunning.current[tripOpen]||(mutationQueues.current[tripOpen]||[]).length)return;const r=await sharedApi("get-trip",{tripId:tripOpen},12000);if(!dead&&r.ok&&r.trip){replaceSharedTrip(r.trip,false);setSyncStatus(tripOpen,"saved");}};refresh();const iv=setInterval(refresh,12000),vis=()=>document.visibilityState==="visible"&&refresh();document.addEventListener("visibilitychange",vis);window.addEventListener("focus",refresh);return()=>{dead=true;clearInterval(iv);document.removeEventListener("visibilitychange",vis);window.removeEventListener("focus",refresh);};},[tripOpen]);
  const returnTripFlow = (section) => {
    const id = flow && flow.tripId;
    if (!id) return;
    setTripSection(section || flow.section || "overview"); setTripOpen(id); setFlow(null); setTab("routes"); setStack(["trip"]);
  };
  const routeForTrip = (r) => ({ ...r, rid:r.id || r.rid || "", total:r.total, codes:tripCodes(r), stopover:r.stopover?{...r.stopover}:null });
  const applyRouteToTrip = (r, tripId) => {
    const id=tripId || (flow&&flow.tripId); if(!id)return false;
    updateTrip(id,(x)=>({ ...x, route:routeForTrip(r), oc:(lastSearchRef.current&&lastSearchRef.current.oc)||x.oc, dc:(lastSearchRef.current&&lastSearchRef.current.dc)||x.dc, destinationCountry:(form.dest&&form.dest.country)||x.destinationCountry||x.country, originCountry:(form.origin&&form.origin.country)||x.originCountry||profile.homeCountry||"", df:(lastSearchRef.current&&lastSearchRef.current.df)||x.df, dt:(lastSearchRef.current&&lastSearchRef.current.dt)||x.dt, blocksOn:{...tripBlocks(x),tickets:true}, checks:{...(x.checks||{}),tickets:false} }));
    setTripSection("tickets"); setTripOpen(id); setFlow(null); setTab("routes"); setStack(["trip"]); setToast("Билеты добавлены в поездку"); return true;
  };
  // Глобальный поиск создаёт поездку; поиск, запущенный из Trip, меняет только этот Trip.
  const askTakeTrip = (r) => {
    if (flow && flow.kind === "tickets" && flow.tripId) { applyRouteToTrip(r, flow.tripId); return; }
    const ls = lastSearchRef.current || {};
    const dup = trips.find((t) => t.route && (t.route.rid === r.id || t.route.id === r.id) && t.df === (ls.df || ""));
    if (dup) { openTripScreen(dup.id); return; }
    setConfirmTrip(r);
  };
  const takeTrip = (r) => {
    const ls = lastSearchRef.current || {};
    const dup = trips.find((t) => t.route && (t.route.rid === r.id || t.route.id === r.id) && t.df === (ls.df || ""));
    if (dup) { openTripScreen(dup.id); return; }
    const dep = ls.df ? new Date(ls.df) : null;
    const t = {
      id: "t" + Date.now(),
      title: `${query.destName || ls.dc || "Поездка"}${dep ? " · " + MONTHS_S[dep.getMonth()] : ""}`,
      dcName:query.destName||"",dc:ls.dc||"",country:query.destCountry||"",destinationCountry:query.destCountry||"",
      oc:ls.oc||"",ocName:query.origin||"",originCountry:(form.origin&&form.origin.country)||profile.homeCountry||"",domestic:!!((form.origin&&form.origin.country||profile.homeCountry)&&query.destCountry&&String(form.origin&&form.origin.country||profile.homeCountry).toLowerCase()===String(query.destCountry).toLowerCase()),df:ls.df||"",dt:ls.dt||"",adults:ls.a||1,
      route: routeForTrip(r),
      blocksOn:{tickets:true,lodging:true,transport:true,activities:true,docs:true,prep:true},
      checks: { tickets: false, lodgeMain: false, lodgeStop: false, docs: {}, services: {} },
      servicesAdded:[],custom:[],docsExtra:[],lodgingOff:false,children:ls.ch||[],travelerTarget:(ls.a||1)+(ls.ch||[]).length,baseCurrency:profile.defaultCurrency||"EUR",createdAt:Date.now(),
    };
    setTrips((p) => [t, ...p]); syncTripToServer(t); trackGoal("trip_created", { country: t.country || "", from: t.oc || "", to: t.dc || "" }); setToast("Поездка создана"); openTripScreen(t.id);
  };
  const findTicketsForTrip = (t) => {
    const o = AIRPORTS.find((a) => a.code === t.oc) || null, ds = AIRPORTS.find((a) => a.code === t.dc) || null;
    const f = { origin: o, dest: ds, round: !!t.dt, dep: t.df ? new Date(t.df) : null, ret: t.dt ? new Date(t.dt) : null, adults: t.adults || 1, children:t.children||[] };
    setFlow({ kind:"tickets", tripId:t.id, section:"tickets" }); setForm(f);
    if (o && ds && t.df) runSearch(f); else setSheet(true);
  };
  const openHotelsForTrip = (t) => { setHotelsPre(null); setFlow({kind:"hotels",tripId:t.id,section:"lodging"}); setTab("hotels"); setStack([]); };
  const openSheetWithDest = (id) => { setFlow(null); const a = byDest(id); setForm((f) => ({ ...f, dest: a })); setSheet(true); };

  // системная кнопка «Назад» Telegram: показывается вместо «Закрыть», когда есть куда вернуться
  useEffect(() => {
    const tg = (typeof window !== "undefined") && window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.BackButton) return;
    const canBack = stack.length > 0 || sheet || traveler || editName || svcOpen || newTrip || confirmTrip || !!(flow && flow.tripId);
    let fired = false; // защита от двойного срабатывания (две подписки)
    const onBack = () => {
      if (fired) return; fired = true; setTimeout(() => { fired = false; }, 300);
      if (typeof window!=="undefined" && window.__tripwiseModalBack) { const close=window.__tripwiseModalBack; try { close(); } catch(e){} return; }
      if (confirmTrip) return setConfirmTrip(null);
      if (newTrip) return setNewTrip(false);
      if (svcOpen) return setSvcOpen(false);
      if (editName) return setEditName(false);
      if (traveler) return setTraveler(false);
      if (sheet) return setSheet(false);
      // Trip-scoped flow не ломает стек приложения: один Back всегда возвращает в исходную поездку.
      if (flow && flow.tripId) {
        const closing = stack[stack.length - 1];
        if (tab === "routes" && closing === "detail") { setStack(["results"]); return; }
        if (tab === "routes" && closing === "results") { returnTripFlow(flow.section || "tickets"); return; }
        returnTripFlow(flow.section || "overview"); return;
      }
      // Глобальный переход из карточки маршрута в Отели/Документы по-прежнему возвращает к маршруту.
      if (stack.length > 0 && tab !== "routes") { setTab("routes"); return; }
      const closing = stack[stack.length - 1];
      if (closing === "results" && stack.length === 1) { setStack([]); setTab("home"); setSheet(true); return; }
      setStack((p) => p.slice(0, -1));
    };
    try {
      if (canBack) {
        tg.BackButton.show();
        if (tg.BackButton.onClick) tg.BackButton.onClick(onBack);
      } else tg.BackButton.hide();
    } catch (e) { }
    return () => {
      try { if (tg.BackButton.offClick) tg.BackButton.offClick(onBack); } catch (e) { }
    };
  }, [stack, sheet, traveler, editName, svcOpen, newTrip, confirmTrip, flow, tab]);
  const isLiked = (r) => !!saved.find(x => x.id === ("liked-" + r.id));
  const likeRoute = (r) => { try { trackGoal("route_saved"); } catch(e){}
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

  const scopedTrip = flow && flow.tripId ? trips.find((x)=>x.id===flow.tripId) : null;
  let main = null;
  if (tab === "routes") {
    const curTrip = trips.find((t) => t.id === tripOpen);
    if (top === "trip" && curTrip) main = <SharedTripScreen t={curTrip} initialBlk={tripSection} onBack={() => setStack([])} onUpdate={updateTrip} onReplaceTrip={replaceSharedTrip} onUndoable={showUndoable} syncState={syncStates[curTrip.id]||"saved"} bottomStr={inset.bottomStr} onLeaveTrip={(id) => { dirtyClear(id); setTrips((p) => p.filter((x) => x.id !== id)); setStack([]); }} onDelete={(id) => scheduleTripDelete(id)} onFindTickets={findTicketsForTrip} goHotels={() => openHotelsForTrip(curTrip)} goDocs={(docId) => { setDocsPre(typeof docId === "string" ? docId : null); setFlow({kind:"docs",tripId:curTrip.id,section:"docs"}); setTab("docs"); setStack([]); }} setToast={setToast} />;
    else if (top === "trip") main = <RoutesScreen trips={trips} publicTrips={publicTrips} publicLoading={publicLoading} reloadPublic={loadPublicTrips} profile={profile} setToast={setToast} onOpenTrip={openTripScreen} onNewTrip={() => setNewTrip(true)} onPickDest={openSheetWithDest} onSearch={() => setSheet(true)} saved={saved} onUnlike={(id) => setSaved((p) => p.filter((x) => x.id !== id))} onOpenSaved={openSaved} recent={recent} onClearRecent={() => setRecent([])} onRunRecent={(s) => { const f = { ...s.form, dep: s.form.dep ? new Date(s.form.dep) : null, ret: s.form.ret ? new Date(s.form.ret) : null }; setForm(f); runSearch(f); }} />;
    else if (top === "detail") main = <Detail r={selected} query={query} onBack={() => setStack(["results"])} onEdit={() => { if(!(flow&&flow.tripId)) setTab("home"); setSheet(true); }} liked={isLiked(selected)} onLike={likeRoute} onShare={shareRoute} goHotels={(svc) => { setHotelsPre(svc || null); if(flow&&flow.tripId)setFlow({...flow,kind:"hotels",section:"lodging"}); else setFlow(null); setTab("hotels"); setStack([]); }} onTakeTrip={askTakeTrip} takeLabel={flow&&flow.kind==="tickets"&&scopedTrip?`Добавить в ${scopedTrip.title}`:null} inTrip={!!(selected && trips.some((t) => t.route && (t.route.rid === selected.id || t.route.id === selected.id) && t.df === ((lastSearchRef.current || {}).df || "")))} />;
    else if (top === "results") { main = <Results query={query} routes={routes} loading={loading} error={searchError} onRetry={() => runSearch()} onEdit={() => { if(!(flow&&flow.tripId)) setTab("home"); setSheet(true); }} onBack={() => flow&&flow.tripId ? returnTripFlow(flow.section||"tickets") : setStack([])} onOpen={(r) => { setSelected(r); setStack(["results", "detail"]); }} isLiked={isLiked} onLike={likeRoute} />; }
    else main = <RoutesScreen trips={trips} publicTrips={publicTrips} publicLoading={publicLoading} reloadPublic={loadPublicTrips} profile={profile} setToast={setToast} onOpenTrip={openTripScreen} onNewTrip={() => setNewTrip(true)} onPickDest={openSheetWithDest} onSearch={() => setSheet(true)} saved={saved} onUnlike={(id) => setSaved(p => p.filter(x => x.id !== id))} onOpenSaved={openSaved} recent={recent} onClearRecent={() => setRecent([])} onRunRecent={(s) => { const f = { ...s.form, dep: s.form.dep ? new Date(s.form.dep) : null, ret: s.form.ret ? new Date(s.form.ret) : null }; setForm(f); runSearch(f); }} />;
  } else if (tab === "home") main = <Home onSearch={() => { setFlow(null); setSheet(true); }} onPickDest={openSheetWithDest} goTab={(k)=>{setFlow(null);setTab(k);}} openServices={() => (trackGoal("services_opened"), setSvcOpen(true))} />;
  else if (tab === "hotels") main = <Hotels setToast={setToast} preOpen={hotelsPre} onPreDone={() => setHotelsPre(null)} trip={flow&&flow.kind==="hotels"?scopedTrip:null} onBack={()=>returnTripFlow("lodging")} onAddStay={(item)=>{if(!scopedTrip)return;updateTrip(scopedTrip.id,(x)=>({...x,stays:[...(x.stays||[]),item],blocksOn:{...tripBlocks(x),lodging:true}}));setTimeout(()=>returnTripFlow("lodging"),80);}} />;
  else if (tab === "docs") main = <Docs trips={trips} preOpenDoc={docsPre} onPreDone={() => setDocsPre(null)} onOpenTrip={openTripScreen} onAddDocToTrip={(tripId, ids) => { updateTrip(tripId, (x) => { const cur = x.docsExtra || []; const base = (DOC_MATRIX[x.country] || DOC_BASE).map((dd) => dd.id); const add = (ids || []).filter((id) => !cur.includes(id) && !base.includes(id)); return { ...x, docsExtra: [...cur, ...add], blocksOn: { ...tripBlocks(x), docs: true } }; }); openTripScreen(tripId); }} onCreateTrip={(t) => { setTrips((p) => [t, ...p]); syncTripToServer(t).then((r)=>r&&r.trip&&replaceSharedTrip(r.trip)); setToast("Поездка создана"); openTripScreen(t.id); }} setToast={setToast} />;
  else if (tab === "profile") main = <Profile name={name} onTraveler={() => setTraveler(true)} onEditName={() => setEditName(true)} onOpenDocs={() => { setFlow(null); setTab("docs"); setStack([]); }} setToast={setToast} notifyPrefs={notifyPrefs} onNotifyChange={changeNotifyPrefs} profile={profile} onProfileSave={saveProfile} trips={trips} />;

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
      @media(max-width:370px){
        .home-compact-title{font-size:27px!important}
      }
    `}</style>
    <div className="app-root" style={{ width: "100%", maxWidth: 420, paddingTop: safeTop, background: `radial-gradient(105% 54% at 78% 0%, #0d1830 0%, ${HOME_T.bg} 48%, ${HOME_T.bgDeep} 100%)`, color: tab === "home" ? HOME_T.text : T.text, fontFamily: "Manrope,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: inset.logoTop != null ? inset.logoTop + "px" : "calc(env(safe-area-inset-top, 0px) + 14px)", zIndex: 30, pointerEvents: "none" }}><Logo home={tab === "home"} /></div>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", background: "transparent", paddingTop: 10, paddingBottom: top === "trip" ? 150 : ((flow&&flow.tripId)?28:108) }}>{main}</div>
      {!kb && top !== "trip" && !(flow&&flow.tripId) && <BottomNav tab={tab} setTab={(k) => { setFlow(null); if (k === tab && (k === "routes" || k === "profile" || k === "hotels" || k === "docs")) setStack([]); if (k === "routes" && tab === "routes") setStack([]); setTab(k); }} bottomStr={inset.bottomStr} />}
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
      {newTrip && <NewTripSheet profile={profile} onClose={() => setNewTrip(false)} onCreate={(t) => { setTrips((p) => [t, ...p]); syncTripToServer(t).then((r)=>r&&r.trip&&replaceSharedTrip(r.trip)); setNewTrip(false); setToast("Поездка создана"); openTripScreen(t.id); }} />}
      {svcOpen && <Overlay onClose={() => setSvcOpen(false)}><SheetHead title="Сервисы для поездки" onClose={() => setSvcOpen(false)} /><ServiceGrid setToast={setToast} /></Overlay>}
      {invitePreview&&<Overlay centered zIndex={104} onClose={()=>setInvitePreview(null)}><div style={{position:"relative",textAlign:"center",padding:"4px 2px 2px"}}><div onClick={()=>setInvitePreview(null)} className="press" style={{position:"absolute",right:-4,top:-5,width:34,height:34,borderRadius:999,background:T.card2,border:`1px solid ${T.line}`,display:"grid",placeItems:"center",cursor:"pointer"}}><Icon d={I.close} size={17} color={T.sub}/></div><div style={{width:74,height:74,borderRadius:24,margin:"8px auto 12px",background:GRAD.cta,display:"grid",placeItems:"center",boxShadow:"0 14px 34px rgba(102,91,255,.32)",fontSize:34}}>✈️</div><div style={{fontSize:11,color:T.violet,fontWeight:900,letterSpacing:.4,textTransform:"uppercase"}}>{invitePreview.creatorName} приглашает вас</div><div style={{fontFamily:"Sora,sans-serif",fontSize:21,fontWeight:900,color:T.text,marginTop:5}}>{invitePreview.title}</div><div style={{fontSize:12,color:T.subd,marginTop:6,lineHeight:1.45}}>{[invitePreview.destination,invitePreview.df&&invitePreview.dt?`${ddmm(invitePreview.df)} — ${ddmm(invitePreview.dt)}`:""].filter(Boolean).join(" · ")}</div><div style={{height:1,background:T.line,margin:"16px 0 12px"}}/><div style={{fontSize:10.5,color:T.subd,fontWeight:800,textAlign:"left",marginBottom:8}}>КТО ЕДЕТ</div><div style={{display:"flex",flexDirection:"column",gap:7}}>{(invitePreview.participants||[]).slice(0,7).map((x,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:9,background:T.card2,border:`1px solid ${T.line}`,borderRadius:12,padding:"8px 9px",textAlign:"left"}}><div style={{width:30,height:30,borderRadius:10,background:T.violet+"22",display:"grid",placeItems:"center",fontSize:11,fontWeight:900,color:T.violet,overflow:"hidden"}}>{x.photoUrl?<img src={x.photoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:String(x.name||"?").split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase()}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:12.5,fontWeight:800,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.name||`Путешественник ${i+1}`}</div><div style={{fontSize:10,color:x.joined?T.green:T.subd}}>{x.joined?"в TripWise":"путешественник"}</div></div></div>)}{!(invitePreview.participants||[]).length&&<div style={{fontSize:11.5,color:T.subd,textAlign:"left"}}>{invitePreview.travelerCount} {plural(invitePreview.travelerCount,"путешественник","путешественника","путешественников")}</div>}</div><div onClick={async()=>{const p=invitePreview,r=await sharedApi("join-trip",{tripId:p.tripId,code:p.code});if(r.ok&&r.trip){setTrips(xs=>xs.some(x=>x.id===r.trip.id)?xs.map(x=>x.id===r.trip.id?r.trip:x):[r.trip,...xs]);setInvitePreview(null);setInviteJoined(r.trip);}else setToast(r.error==="trip full"?"В поездке уже максимум участников":"Не удалось присоединиться");}} className="press" style={{marginTop:15,textAlign:"center",background:GRAD.cta,borderRadius:14,padding:13,color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer"}}>Присоединиться</div><div onClick={()=>setInvitePreview(null)} style={{fontSize:11.5,color:T.subd,fontWeight:700,padding:"11px 0 2px",cursor:"pointer"}}>Не сейчас</div></div></Overlay>}
      {inviteJoined&&<Overlay centered zIndex={106} onClose={()=>setInviteJoined(null)}><div style={{textAlign:"center",padding:"5px 2px 2px"}}><div style={{width:76,height:76,borderRadius:24,margin:"6px auto 12px",background:T.green+"22",border:`1px solid ${T.green}66`,display:"grid",placeItems:"center",fontSize:34,color:T.green}}>✓</div><div style={{fontFamily:"Sora,sans-serif",fontSize:22,fontWeight:900,color:T.text}}>Вы в поездке</div><div style={{fontSize:13,color:T.subd,marginTop:5}}>{inviteJoined.title}</div><div style={{display:"flex",justifyContent:"center",margin:"14px 0 4px"}}>{(inviteJoined.travelers||[]).filter(x=>x.active!==false).slice(0,6).map((tr,i)=>{const m=(inviteJoined.members||[]).find(mm=>String(mm.id)===String(tr.memberId));return <div key={tr.id||i} title={tr.name} style={{width:38,height:38,borderRadius:13,marginLeft:i?-7:0,border:`2px solid ${T.bg2}`,background:T.card2,display:"grid",placeItems:"center",overflow:"hidden",fontSize:11,fontWeight:900,color:T.violet}}>{m&&m.photoUrl?<img src={m.photoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:String(tr.name||"?").split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase()}</div>})}</div><div style={{fontSize:11,color:T.subd,marginBottom:13}}>{(inviteJoined.travelers||[]).filter(x=>x.active!==false).length} {plural((inviteJoined.travelers||[]).filter(x=>x.active!==false).length,"путешественник","путешественника","путешественников")} · общий план синхронизирован</div><div onClick={()=>{const r=inviteJoined;setInviteJoined(null);setTripSection("overview");setTripOpen(r.id);setTab("routes");setStack(["trip"]);}} className="press" style={{textAlign:"center",background:GRAD.cta,borderRadius:14,padding:13,color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer"}}>Открыть поездку</div></div></Overlay>}
      {editName && <NameEdit name={name} onClose={() => setEditName(false)} onSave={(n) => { setName(n); setEditName(false); setToast("Имя сохранено"); }} />}
      <ActionToast data={actionToast} />
      <Toast msg={toast} />
    </div>
  </div>;
}
