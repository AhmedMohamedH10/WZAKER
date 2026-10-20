# نشر WZAKER على Snap Store

<div dir="rtl">

هذا الدليل يشرح **كيف تنشر نسخة لينكس من «وَذَكِّرْ» على Snap Store** (متجر Snap Craft / Snapcraft.io).

## 1) prerequisites — المتطلبات

</div>

```bash
# على Fedora
sudo snap install snapcraft --classic
sudo systemctl enable --now snapd.socket
```

<div dir="rtl">

## 2) البناء — Build

ملف الوصف موجود في: `packaging/snap/snapcraft.yaml`

</div>

```bash
# على Ubuntu (أو أي توزيعة Ubuntu) — أبسط طريقة
cd packaging/snap
snapcraft pack

# على Fedora (snapcraft ما بيبنيش حزم Ubuntu غير على Ubuntu) — بنستخدم حاوية Ubuntu
podman run --rm --privileged \
  -v /home/$USER:/home/$USER \
  -v /var/lib/snapd:/var/lib/snapd \
  -w /home/$USER/Projects/WZAKER/packaging/snap \
  docker.io/library/ubuntu:24.04 \
  bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq snapcraft python3 git curl ca-certificates >/dev/null 2>&1 && snapcraft pack"
```

<div dir="rtl">

الناتج: `wzaker_3.6.4_amd64.snap` (موقّع تلقائيًا بمفتاح المتجر ✅).

## 3) النشر — Publish

### أ) أنشئ حساب في المتجر

</div>

1. افتح <https://login.snapcraft.io> وسجّل (أو ادخل بحساب GitHub).
2. أكّد بريدك الإلكتروني — **المتجر بيراجع الحساب يدويًا** (بأيام).
3. من نفس الصفحة: **Settings → Public name** — ده اسم الناشر اللي هيظهر، ومنه بتاخد اسم الحساب اللي بتستعمله في `snapcraft login`.

<div dir="rtl">

### ب) ادخل للسطر

</div>

```bash
snapcraft login          # هيفتح المتصفح — سجّل دخول بحساب المتجر
snapcraft whoami         # اتأكد اسم الناشر
```

<div dir="rtl">

### ج) ارفع النسخة الأولى

</div>

```bash
cd packaging/snap
snapcraft upload --release "3.6.4" wzaker_3.6.4_amd64.snap
```

<div dir="rtl">

**أول رفع** بيروح لقائمة **"Unpublished / In review"** — المتجر بيراجعها يدويًا (عادة من يوم لـ ٣ أيام) لأن الاسم جديد. بعد الموافقة:

</div>

```bash
snapcraft release "3.6.4" wzaker_3.6.4_amd64.snap \
  --release-notes="نسخة لينكس 3.6.4 — من تطوير محمد زيتون"
```

<div dir="rtl">

After that the snap appears on the store ✗ and users can install it:

</div>

```bash
sudo snap install wzaker
```

<div dir="rtl">

## 4) تحديث نسخة موجودة

</div>

```bash
snapcraft upload --release "3.6.4" wzaker_3.6.4_amd64.snap   # النسخة أرقام Semantic
snapcraft release "3.6.4" wzaker_3.6.4_amd64.snap
```

<div dir="rtl">

## 5) ملاحظات مهمة

| النقطة | التفاصيل |
|---|---|
| اسم الـ snap | `wzaker` — **متاح** في المتجر (متحقق منه). لو محجوز، غيّر `name:` في `snapcraft.yaml` وحمّل snap جديد بنفس الاسم (المتجر مش هيسمح بالتكرار). |
| الحساب | لازم يكون بحسابك أنت (الناشر) — مش حساب أحمد. |
| الحساب التلقائي | الـ snap بينشر **باسم الناشر** اللي في `login.snapcraft.io` (مثال: `mohamed-zaitoon`) — فاسم التثبيت هيبقى `wzaker` والـ publisher هيبقى اسمك. |
| التوقيع | المتجر بيوقّع الـ snap تلقائيًا — مش محتاج مفتاح GPG. |
| العزل (confinement) | `strict` — التطبيق بيشتغل عادي (المسبحة، الأذكار، المصحف، أوقات الصلاة، الإعدادات). **التمرير العام لكل البرامج (evdev) مش هيشتغل جوّه الـ snap** لأن `strict` مش بيسمح بقراءة `/dev/input` — البديل هو التمرير من جلسة X11. لو محتاج التمرير العام لازم `classic` وده المتجر بيترفض عليه عادة. |
| `GDK_BACKEND=x11` | الـ snap بيشتغل تحت XWayland عشان يقدر يحط نفسه أسفل يمين الشاشة ويمرّر الماوس فوق النافذة (زي باقي حزم لينكس). |

</div>
