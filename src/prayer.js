// مواقيت الصلاة — منقولة كما هي من main.js (نسخة ويندوز) للينكس
(function (global) {
  'use strict';
const PRAYER_KEYS = ['fj', 'du', 'dh', 'as', 'mg', 'is'];
const PRAYER_NAMES = { fj: 'الفجر', du: 'الضحى', dh: 'الظهر', as: 'العصر', mg: 'المغرب', is: 'العشاء' };
const PRAYER_METHODS = { egypt: { f: 19.5, i: 17.5 }, mwl: { f: 18, i: 17 }, isna: { f: 15, i: 15 }, karachi: { f: 18, i: 18 }, makkah: { f: 18.5, im: 90 } };
const PRAYER_CITIES = {   // كود الدولة: [خط العرض، خط الطول، العاصمة، الدولة، المنطقة الزمنية، طريقة الحساب]
  eg: [30.0444, 31.2357, 'القاهرة', 'مصر', 'Africa/Cairo', 'egypt'],
  sa: [24.7136, 46.6753, 'الرياض', 'السعودية', 'Asia/Riyadh', 'makkah'],
  ae: [24.4539, 54.3773, 'أبو ظبي', 'الإمارات', 'Asia/Dubai', 'mwl'],
  qa: [25.2854, 51.531, 'الدوحة', 'قطر', 'Asia/Qatar', 'makkah'],
  kw: [29.3759, 47.9774, 'مدينة الكويت', 'الكويت', 'Asia/Kuwait', 'mwl'],
  bh: [26.2285, 50.586, 'المنامة', 'البحرين', 'Asia/Bahrain', 'makkah'],
  om: [23.588, 58.3829, 'مسقط', 'عُمان', 'Asia/Muscat', 'mwl'],
  ye: [15.3694, 44.191, 'صنعاء', 'اليمن', 'Asia/Aden', 'makkah'],
  jo: [31.9454, 35.9284, 'عمّان', 'الأردن', 'Asia/Amman', 'mwl'],
  ps: [31.7683, 35.2137, 'القدس', 'فلسطين', 'Asia/Jerusalem', 'mwl'],
  lb: [33.8938, 35.5018, 'بيروت', 'لبنان', 'Asia/Beirut', 'mwl'],
  sy: [33.5138, 36.2765, 'دمشق', 'سوريا', 'Asia/Damascus', 'mwl'],
  iq: [33.3152, 44.3661, 'بغداد', 'العراق', 'Asia/Baghdad', 'mwl'],
  sd: [15.5007, 32.5599, 'الخرطوم', 'السودان', 'Africa/Khartoum', 'egypt'],
  ly: [32.8872, 13.1913, 'طرابلس', 'ليبيا', 'Africa/Tripoli', 'mwl'],
  tn: [36.8065, 10.1815, 'تونس', 'تونس', 'Africa/Tunis', 'mwl'],
  dz: [36.7538, 3.0588, 'الجزائر', 'الجزائر', 'Africa/Algiers', 'mwl'],
  ma: [34.0209, -6.8416, 'الرباط', 'المغرب', 'Africa/Casablanca', 'mwl'],
  mr: [18.0735, -15.9582, 'نواكشوط', 'موريتانيا', 'Africa/Nouakchott', 'mwl'],
  so: [2.0469, 45.3182, 'مقديشو', 'الصومال', 'Africa/Mogadishu', 'mwl'],
  dj: [11.5721, 43.1456, 'جيبوتي', 'جيبوتي', 'Africa/Djibouti', 'mwl'],
  km: [-11.7022, 43.2551, 'موروني', 'جزر القمر', 'Indian/Comoro', 'mwl'],
  tr: [39.9334, 32.8597, 'أنقرة', 'تركيا', 'Europe/Istanbul', 'mwl'],
  ir: [35.6892, 51.389, 'طهران', 'إيران', 'Asia/Tehran', 'mwl'],
  pk: [33.6844, 73.0479, 'إسلام آباد', 'باكستان', 'Asia/Karachi', 'karachi'],
  af: [34.5553, 69.2075, 'كابل', 'أفغانستان', 'Asia/Kabul', 'karachi'],
  in: [28.6139, 77.209, 'نيودلهي', 'الهند', 'Asia/Kolkata', 'karachi'],
  bd: [23.8103, 90.4125, 'دكا', 'بنغلاديش', 'Asia/Dhaka', 'karachi'],
  id: [-6.2088, 106.8456, 'جاكرتا', 'إندونيسيا', 'Asia/Jakarta', 'mwl'],
  my: [3.139, 101.6869, 'كوالالمبور', 'ماليزيا', 'Asia/Kuala_Lumpur', 'mwl'],
  ng: [9.0765, 7.3986, 'أبوجا', 'نيجيريا', 'Africa/Lagos', 'mwl'],
  sn: [14.7167, -17.4677, 'داكار', 'السنغال', 'Africa/Dakar', 'mwl'],
  gb: [51.5074, -0.1278, 'لندن', 'بريطانيا', 'Europe/London', 'mwl'],
  fr: [48.8566, 2.3522, 'باريس', 'فرنسا', 'Europe/Paris', 'mwl'],
  de: [52.52, 13.405, 'برلين', 'ألمانيا', 'Europe/Berlin', 'mwl'],
  us: [38.9072, -77.0369, 'واشنطن', 'أمريكا', 'America/New_York', 'isna'],
  ca: [45.4215, -75.6972, 'أوتاوا', 'كندا', 'America/Toronto', 'isna'],
  au: [-35.2809, 149.13, 'كانبيرا', 'أستراليا', 'Australia/Sydney', 'mwl']
};
const fixH = h => ((h % 24) + 24) % 24;
const fixA = a => ((a % 360) + 360) % 360;
function zoneOffsetH(zone, date) {                         // فرق توقيت المنطقة (مثلاً Africa/Cairo) عن UTC بالساعات في اليوم ده
  try {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(d).map(x => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 3600000;
  } catch (_) { return null; }
}
function prayerCalc(date, lat, lng, mk, zone) {            // بيرجّع الدقيقة (بتوقيت جهازك) من أول اليوم لكل صلاة، أو null لو الحساب مستحيل
  const R = Math.PI / 180, D = 180 / Math.PI, m = PRAYER_METHODS[mk] || PRAYER_METHODS.mwl;
  const sin = x => Math.sin(x * R), cos = x => Math.cos(x * R), tan = x => Math.tan(x * R);
  const devTz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
  const cityTz = zone ? (zoneOffsetH(zone, date) ?? devTz) : devTz;
  let Y = date.getFullYear(), M = date.getMonth() + 1; const Dd = date.getDate();
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  const jd = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + Dd + B - 1524.5 - lng / 360;
  const sunPos = j => {
    const d = j - 2451545.0, g = fixA(357.529 + 0.98560028 * d), q = fixA(280.459 + 0.98564736 * d);
    const L = fixA(q + 1.915 * sin(g) + 0.020 * sin(2 * g)), e = 23.439 - 0.00000036 * d;
    const RA = fixH(Math.atan2(cos(e) * sin(L), cos(L)) * D / 15);
    return { decl: Math.asin(sin(e) * sin(L)) * D, eqt: q / 15 - RA };
  };
  const midDay = t => fixH(12 - sunPos(jd + t / 24).eqt);
  const angleTime = (angle, t, ccw) => {
    const decl = sunPos(jd + t / 24).decl, x = (-sin(angle) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
    if (!(Math.abs(x) <= 1)) return NaN;
    return midDay(t) + (ccw ? -1 : 1) * Math.acos(x) * D / 15;
  };
  const decl13 = sunPos(jd + 13 / 24).decl;
  const asrAngle = -Math.atan(1 / (1 + tan(Math.abs(lat - decl13)))) * D;   // ظل الشيء = طوله (المذهب الجمهور)
  const adj = cityTz - lng / 15, a = t => t + adj;
  let fj = a(angleTime(m.f, 5, true)); const sr = a(angleTime(0.833, 6, true)), dh = a(midDay(12)), asr = a(angleTime(asrAngle, 13, false)), ss = a(angleTime(0.833, 18, false));
  let is = m.im ? ss + m.im / 60 : a(angleTime(m.i, 18, false));
  if (Number.isFinite(sr) && Number.isFinite(ss)) {          // بلاد بعيدة عن خط الاستواء في الصيف: نقسّم الليل أسباع
    const night = fixH(sr - ss);
    if (!Number.isFinite(fj)) fj = sr - night / 7;
    if (!Number.isFinite(is)) is = ss + night / 7;
  }
  const out = { fj, du: sr + 20 / 60, dh, as: asr, mg: ss, is };   // الضحى: بعد الشروق بـ 20 دقيقة
  for (const k of PRAYER_KEYS) { if (!Number.isFinite(out[k])) return null; out[k] = Math.round(fixH(out[k] + (devTz - cityTz)) * 60) % 1440; }
  return out;
}
let prayerCache = null, prayerLocating = false;
  global.PRAYER_KEYS = PRAYER_KEYS;
  global.PRAYER_NAMES = PRAYER_NAMES;
  global.PRAYER_METHODS = PRAYER_METHODS;
  global.PRAYER_CITIES = PRAYER_CITIES;
  global.prayerCalc = prayerCalc;
  global.prayerLocFor = (st) => {
    const c = PRAYER_CITIES[st.prayerCity];
    if (st.prayerCity !== 'auto' && c) return { lat: c[0], lng: c[1], method: c[5], zone: c[4], name: c[2] + '، ' + c[3] };
    if (Number.isFinite(st.prayerLat) && Number.isFinite(st.prayerLng))
      return { lat: st.prayerLat, lng: st.prayerLng, method: st.prayerMethod || 'mwl', zone: null, name: st.prayerPlace || 'موقعك' };
    return null;
  };
  global.prayerInfoFor = (st) => {
    const loc = global.prayerLocFor(st);
    if (!loc) return null;
    const t = global.prayerCalc(new Date(), loc.lat, loc.lng, loc.method, loc.zone);
    if (!t) return null;
    const times = {};
    for (const k of PRAYER_KEYS) times[k] = t[k];
    return { place: loc.name, auto: st.prayerCity === 'auto', locating: false, times };
  };
  global.PRAYER_FMT = (m) => {
    const p = n => String(n).padStart(2, '0');
    return p(Math.floor(m / 60)) + ':' + p(m % 60);
  };
})(window);
