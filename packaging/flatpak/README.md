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
python3 flatpak-cargo-generator.py ../../src-tauri/Cargo.lock -o cargo-sources.json
```

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

1. أنشئ fork لمستودع `flathub/flathub` وافرع منه فرعًا جديدًا.
2. انسخ إلى جذر الفرع:
   - `io.github.mohamed_zaitoon.wzaker.yml` (الـ manifest)
   - `cargo-sources.json`
   - `shared-modules` كـ git submodule:
     ```bash
     git submodule add https://github.com/flathub/shared-modules
     ```
3. افتح Pull Request بعنوان `Add io.github.mohamed_zaitoon.wzaker`.
4. بعد الموافقة يُبنى التطبيق ويظهر في المتجر خلال ساعات.

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
pip install flatpak-builder-lint
flatpak-builder-lint manifest packaging/flatpak/io.github.mohamed_zaitoon.wzaker.yaml
flatpak-builder-lint appstream packaging/flatpak/io.github.mohamed_zaitoon.wzaker.metainfo.xml
```
