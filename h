[33m672c57e[m[33m ([m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m Snap: إضافة الأيقونة + تصحيح أوامر التسجيل والرفع والإطلاق
[33mdd2c9ed[m تجاهل ملفات *.snap في Git
[33m342695a[m Snap: تصغير حجم الحزمة (strip)
[33m750f805[m Snap: تصحيح مسار المصدر (جذر المستودع)
[33maf0215a[m Snap: البناء عبر cargo مباشرة (plugin nil) لتفادي problems في rust plugin
[33mb7477d9[m Snap: تصحيح اسم حزمة libxdo في stage-packages (libxdo3)
[33m76504d2[m Snap CI: تثبيت gnome SDK snap يدويًا
[33mb7fc649[m Snap CI: تثبيت build-snaps يدويًا قبل البناء
[33mef5ad5e[m Snap CI: خطوة تشخيص لتثبيت build-snaps
[33m599d24f[m Snap CI: إعادة محاولة تلقائية عند فشل تثبيت build-snaps
[33me4f81cc[m Snap: التحويل إلى base core22 (تطابق مع إضافة gnome في المتجر)
[33mdd12533[m تثبيت إصدار Ubuntu في workflow الـ snap (24.04)
[33m18233c4[m إصلاح صياغة ملف workflow الـ snap
[33m03f0b73[m Snap: بناء ونشر تلقائي عبر GitHub Actions
[33m042826f[m إضافة حزمة Snap (snapcraft.yaml) + دليل النشر على Snap Store
[33m215c505[m إضافة قسم تواصل مطوّر نسخة لينكس (فيسبوك/ديسكورد/واتساب)
[33mfee0021[m أضف سكربت رفع الحزم للإصدار
[33mfbb96c1[m إصلاح روابط التواصل مع المطور + تفعيل الدوال الناقصة في نافذة الإعدادات
[33m7d9a7e0[m تنظيف: إزالة سجلات التشخيص وإصلاح تحذيرات المُصرِّف
[33mf997799[m المشغّل: فرض XWayland (X11) عند وجود DISPLAY عشان تمرير الماوس فوق النافذة
[33m3e8f7cc[m إصلاح مناطق التفاعل: فحص الظهور بدل offsetParent (زرار الإعدادات)
[33mfeeaeb0[m docs: توثيق مكان حفظ الإعدادات والعدّ بالمفتاح
[33ma31d52f[m إصلاح حفظ الإعدادات + تمرير الماوس عبر النافذة + عدّ بالمفتاح
[33ma12ea3a[m docs: توثيق التمرير العام (evdev)
[33me190dc0[m feat: تمرير عام حقيقي (evdev) يشتغل على Wayland + قاعدة udev في المثبّت
[33m96b00dc[m fix: اسم التطبيق «ذكر» + XWayland للمسبحة + مثبّت يحذف القديم ويأخذ نسخة احتياطية
[33mde727dd[m build: سكربت البناء يبني كل الصيغ (deb/rpm/AppImage/pacman/apk/txz/pet/tar/zip)
[33mb5b9963[m feat: نسبة نسخة لينكس في صفحة حول + تثبيت مكان المسبحة
[33m4d6dd3a[m fix: المسبحة تحت يمين الشاشة (إصلاح monitor مع Wayland + إزالة GDK_BACKEND)
[33m88d58ec[m fix: المسبحة أسفل يمين الشاشة + صلاحيات نوافذ الإعدادات والإشعارات
[33mee92b47[m feat: مواقيت الصلاة + نافذة الإشعارات + click-through + نسخ احتياطي + تنبيهات + الختمة
[33m22411a6[m feat: حالة كاملة زي نسخة ويندوز (أذكار افتراضية + نص الذكر + انتقال تلقائي)
[33m2f102dc[m feat: تشغيل تلقائي (XDG) + إخفاء للـ tray + مطابقة نافذة الإعدادات
[33m1d97add[m feat: مطابقة نسخة ويندوز — المسبحة أسفل يمين الشاشة + شاشة اللوجو + نافذة الإعدادات الأصلية
[33mfe958e7[m feat: installer يستورد مفتاح التوقيع تلقائياً ويتحقق قبل التثبيت
[33mf526496[m docs: README عربي فقط (بدون بناء من السورس) + أوامر LTR
[33md2ca1ba[m feat: عجلة الماوس داخل النافذة + تثبيت كتطبيق كامل (desktop entry + أيقونات) + README جديد
[33m6569c15[m docs: README (Windows + Linux install) + MIT LICENSE
[33m6a1980e[m Merge pull request #1 from AhmedMohamedH10/linux
[33m0f8318f[m feat: RPM signer (embedded GPG, no root) + one-line linux installer
[33m843762f[m feat: sign all linux packages (GPG mohamedzaitoon) + release 3.6.4
[33m5cea133[m docs: credit Linux port (Mohamed Zaitoon) + keep original copyright
[33mf835934[m release 3.6.4 (Linux, Tauri+Rust) — match upstream 3.6.4
[33m40203d5[m feat: Flatpak + Snap packaging
[33md0edcb9[m feat: tray + global scroll (rdev) + backup + splash (match upstream)
[33mc819fc4[m feat: update checker (port of electron-updater via GitHub API)
[33mcc4715c[m sync: update frontend from upstream (6d891ea New Update)
[33m2a3ff7f[m merge: resolve .gitignore (Tauri + upstream)
[33m067d95a[m docs: remove ZaitXCode mention (open-source project)
[33mb8d42a1[m docs: تحديث README بجميع امتدادات التوزيعات + credits (Linux by ZaitXCode)
[33mc5b3d71[m chore: update .gitignore (exclude secrets/cache/logs)
[33m7f1022e[m feat: نسخة لينكس Tauri+Rust (3.6.4-alpha01) — deb/rpm/AppImage
