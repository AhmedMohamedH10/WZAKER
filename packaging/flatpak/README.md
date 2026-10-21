<div dir="rtl">

# نسخة Flatpak / Flathub — وذكر (WZAKER)

هذه نسخة لينكس من تطبيق **وذكر** الأصلي لأحمد محمد (AhmedMohamedH10)، مبنية بـ Tauri + Rust.

- **app-id:** `io.github.mohamed_zaitoon.wzaker`
- **المستودع:** https://github.com/mohamed-zaitoon/WZAKER
- **الترخيص:** MIT (حقوق أحمد محمد محفوظة)

> **لماذا `mohamed_zaitoon` بشرطة سفلية؟** Flatpak لا يسمح بالشرطة `-` إلا في المقطع الأخير من الـ app-id،
> لذلك تُكتب أسماء حسابات GitHub التي تحتوي شرطة بشرطة سفلية.

---

## المتطلبات

</div>

```bash
sudo dnf install flatpak flatpak-builder
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install flathub org.gnome.Platform//51 org.gnome.Sdk//51 \
    org.freedesktop.Sdk.Extension.rust-stable//26.08
```

<div dir="rtl">

## البناء والتشغيل محليًا

</div>

```bash
cd packaging/flatpak
flatpak-builder --user --install --force-clean build-dir \
    io.github.mohamed_zaitoon.wzaker.yaml
flatpak run io.github.mohamed_zaitoon.wzaker
```

<div dir="rtl">

## تحديث مصادر Cargo

بعد أي تغيير في `src-tauri/Cargo.lock` أعد توليد الملف:

</div>

```bash
cd packaging/flatpak
curl -LO https://raw.githubusercontent.com/flatpak/flatpak-builder-tools/master/cargo/flatpak-cargo-generator.py
python3 flatpak-cargo-generator.py ../../src-tauri/Cargo.lock -o cargo-sources.json
```

> الـ manifest يسحب كل الملفات (الشيفرة + الأيقونة + ملف `.desktop` + بيانات AppStream + سكربت التشغيل)
> من أرشيف الوسم `v3.6.4-linux2`، فلا توجد ملفات محلية داخل مستودع Flathub سوى الـ manifest و`cargo-sources.json`.

<div dir="rtl">

## حدود النسخة المعزولة (Sandbox)

| الميزة | داخل Flatpak | ملاحظة |
|---|---|---|
| التمرير العام (عدّ عجلة الماوس من أي تطبيق) | ⚠️ يحتاج صلاحية | `--device=all` + صلاحية قراءة `/dev/input` |
| النقر الشفاف (تمرير الماوس من فوق النافذة) | ✅ | يعمل عبر X11 (XWayland) |
| تحديد مكان النافذة في زاوية الشاشة | ✅ | يعمل عبر X11 |
| بدء التشغيل مع النظام | ❌ | يكتب في مجلد الـ sandbox، لا يقرأه النظام |
| حفظ الآية كصورة | ✅ | عبر `--filesystem=xdg-pictures` إلى مجلد الصور الحقيقي |
| فتح روابط التواصل | ✅ | عبر `xdg-open` والـ portal |

### صلاحية قراءة `/dev/input`

Flatpak يمنح الوصول للجهاز عبر `--device=all`، لكن ملفات `/dev/input/event*` تبقى مملوكة
لـ `root:input` بصلاحية `0660`. حتى يقرأها التطبيق داخل الـ sandbox يجب أن يكون المستخدم
في مجموعة `input` أو أن تكون هناك قاعدة udev تسمح بالقراءة:

</div>

```bash
sudo usermod -aG input "$USER"   # ثم أعد تسجيل الدخول
```

<div dir="rtl">

مُثبّت deb/rpm يضيف قاعدة udev خاصة تلقائيًا، لكن Flatpak لا يستطيع تعديل النظام.

---

## النشر على Flathub

</div>

```bash
# 1) اعمل fork لـ flathub/flathub ثم:
git clone git@github.com:mohamed-zaitoon/flathub.git
cd flathub
git checkout -b add-wzaker origin/new-pr

# 2) انسخ الـ manifest وملف مصادر Cargo إلى جذر المستودع
cp ~/Projects/WZAKER/packaging/flatpak/io.github.mohamed_zaitoon.wzaker.yaml \
   ./io.github.mohamed_zaitoon.wzaker.yml
cp ~/Projects/WZAKER/packaging/flatpak/cargo-sources.json ./

# 3) أضف shared-modules (فيه مكتبة أيقونة الـ tray)
git submodule add https://github.com/flathub/shared-modules

# 4) ارفع وافتح Pull Request نحو فرع new-pr
git add -A
git commit -m "Add io.github.mohamed_zaitoon.wzaker"
git push origin add-wzaker
```

<div dir="rtl">

### نص مقترح لوصف الـ Pull Request

</div>

```text
This PR adds WZAKER (وذكر), a tasbih / dhikr counter, to Flathub.

Upstream: https://github.com/mohamed-zaitoon/WZAKER
Linux port of https://github.com/AhmedMohamedH10/WZAKER (MIT, original author
credited in LICENSE and in the AppStream description).

Notes for reviewers:
- --socket=x11: the always-on-top widget sets an X11 SHAPE input region so that
  mouse clicks pass through everything except the beads, and it positions itself
  in the screen corner. Neither is possible with the Wayland protocol, so the
  launcher forces GDK_BACKEND=x11 (XWayland).
- --device=all: the app counts mouse-wheel events coming from any application by
  reading /dev/input/event* (evdev). Access is still gated by device permissions;
  users need the input group or a udev rule (documented in the README). This is
  the core feature of the app.
- --filesystem=xdg-pictures: "save ayah as image" writes to ~/Pictures/WZAKER.
- Autostart is not available inside the sandbox (documented in the README).
```

<div dir="rtl">

### شروط القبول

- [x] app-id مطابق لاسم حساب GitHub (`mohamed-zaitoon` → `mohamed_zaitoon`)
- [x] ترخيص مفتوح (MIT) مع حفظ حقوق المؤلف الأصلي
- [x] بيانات AppStream صالحة (`appstreamcli validate`)
- [x] أيقونة 256×256
- [x] لقطة شاشة واحدة على الأقل
- [x] بناء من المصدر (لا ملفات ثنائية جاهزة)
- [ ] مراجعة بشرية لصلاحية `--device=all` (سببها التمرير العام)

### التحقق قبل الرفع

</div>

```bash
# أداة فحص Flathub (تحتاج PyGObject من النظام)
pip install --user flatpak-builder-lint
flatpak-builder-lint manifest packaging/flatpak/io.github.mohamed_zaitoon.wzaker.yaml
flatpak-builder-lint appstream packaging/flatpak/io.github.mohamed_zaitoon.wzaker.metainfo.xml
appstreamcli validate --no-net packaging/flatpak/io.github.mohamed_zaitoon.wzaker.metainfo.xml
desktop-file-validate packaging/flatpak/io.github.mohamed_zaitoon.wzaker.desktop
```
