<div dir="rtl">

# وذكر

سبحة إلكترونية وأذكار وقرآن وأوقات صلاة.

- **المؤلف الأصلي:** AhmedMohamedH10
- **نسخة لينكس (Tauri + Rust):** Mohamed Zaitoon
- **الرخصة:** MIT

</div>

---

<div dir="ltr">

# WZAKER (WZAKER)

Tasbih (bead counter), azkar, Quran reader and prayer times.

- **Original author:** AhmedMohamedH10
- **Linux port (Tauri + Rust):** Mohamed Zaitoon
- **License:** MIT

</div>

---

## تنزيل نسخة ويندوز (Windows)

<div dir="rtl">

1. افتح صفحة الإصدارات: https://github.com/AhmedMohamedH10/WZAKER/releases
2. اختر إصدار **3.6.4**.
3. نزّل الملف **`WZAKER-Setup-3.6.4.exe`** من قسم "الأصول".
4. شغّل الملف — التثبيت تلقائي ومباشر (Next → Next → Install).
5. بعد التثبيت شغّل التطبيق **ذكر** من قائمة ابدأ، أو من `C:\Program Files\WZAKER\WZAKER.exe`.
6. اختصار **`Ctrl+Alt+W`** لإظهار/إخفاء المسبحة.

</div>

<div dir="ltr">

1. Open the releases page: https://github.com/AhmedMohamedH10/WZAKER/releases
2. Pick release **3.6.4**.
3. Download **`WZAKER-Setup-3.6.4.exe`** from the assets.
4. Run it — the setup is automatic (Next → Next → Install).
5. After install, launch **WZAKER** from the Start menu, or run `C:\Program Files\WZAKER\WZAKER.exe`.
6. Shortcut **`Ctrl+Alt+W`** shows/hides the tasbih.

</div>

## تنزيل وتثبيت نسخة لينكس (Linux)

<div dir="rtl">

**أمر واحد فقط** — بيكشف التوزيعة تلقائياً، ينزّل النسخة المناسبة، يتحقق من توقيع GPG ويثبّتها:

```bash
curl -fsSL https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4/linux-installer.sh | sudo bash
```

**بعد التثبيت:** شغّل التطبيق **ذكر** من قائمة التطبيقات (مش من الطرفية)، أو بالأمر `wzaker`.

**الاختصارات:** `Ctrl+Alt+W` إظهار/إخفاء · عجلة الماوس للعدّ · نقر على الدايل للعدّ.

**ملاحظة:** العدّ بعجلة الماوس **داخل أي تطبيق** يحتاج جلسة X11 أو XWayland. على Wayland الأصلي (زي KDE Plasma الافتراضي) استخدم التمرير فوق نافذة السبحة نفسها أو فعّل "العدّ بالنقر" من الإعدادات.

</div>

<div dir="ltr">

**One single command** — it detects your distribution, downloads the matching package, verifies the GPG signature and installs it:

```bash
curl -fsSL https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4/linux-installer.sh | sudo bash
```

**After install:** launch **WZAKER** from the applications menu (no terminal needed), or run `wzaker`.

**Shortcuts:** `Ctrl+Alt+W` show/hide · mouse wheel to count · click the dial to count.

**Note:** counting the wheel *over other apps* requires an X11/XWayland session. On native Wayland (like the KDE Plasma default), scroll over the WZAKER window itself or enable "count on click" in the settings.

</div>

## البناء من السورس

<div dir="rtl">

```bash
git clone https://github.com/AhmedMohamedH10/WZAKER
cd WZAKER

# نسخة ويندوز (Electron)
npm install
npm start

# نسخة لينكس (Tauri + Rust) — الفرع linux
git checkout linux
export PATH="$HOME/.cargo/bin:$PATH"
bash scripts/build-linux.sh
```

</div>

<div dir="ltr">

```bash
git clone https://github.com/AhmedMohamedH10/WZAKER
cd WZAKER

# Windows (Electron)
npm install
npm start

# Linux (Tauri + Rust) — on the linux branch
git checkout linux
export PATH="$HOME/.cargo/bin:$PATH"
bash scripts/build-linux.sh
```

</div>

## الشكر

- **AhmedMohamedH10** — المؤلف الأصلي / original author
- **Mohamed Zaitoon** — نسخة لينكس / Linux port
- بيانات الأذكار من «حصن المسلم» / azkar data from "Hisn al-Muslim"

## الترخيص

MIT — شوف [LICENSE](LICENSE). الحقوق محفوظة للمؤلف الأصلي / rights reserved to the original author.
