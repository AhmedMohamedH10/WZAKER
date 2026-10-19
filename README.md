# وذكر — WZAKER (Linux)

سبحة إلكترونية وأذكار وقرآن وأوقات صلاة — نسخة **Linux** (Tauri + Rust)، مطابقة لنسخة ويندوز.

- المستودع الأصلي (ويندوز): https://github.com/AhmedMohamedH10/WZAKER
- المطور الأصلي: **AhmedMohamedH10**
- نسخة لينكس تمت من خلالي: **Mohamed Zaitoon (ZaitXCode)**

## التثبيت على لينكس

نسخة لينكس مُقدَّمة بـ **عدة امتدادات** لتغطية جميع التوزيعات:

| التوزيعة | الامتداد | أمر التثبيت |
|---|---|---|
| Ubuntu, Debian, Linux Mint, Kali, Pop!_OS, Zorin | `.deb` | `sudo dpkg -i wzaker_3.6.4-alpha01_amd64.deb` (أو `sudo apt install ./...`) |
| Fedora, RHEL, CentOS, Rocky, openSUSE | `.rpm` | `sudo rpm -i WZAKER-3.6.4-alpha01-linux-x86_64.rpm` (أو `sudo dnf install ./...`) |
| Arch, Manjaro, EndeavourOS, Garuda | `.pkg.tar.zst` | `sudo pacman -U WZAKER-3.6.4-alpha01-linux-x86_64.pkg.tar.zst` |
| Alpine Linux | `.apk` | `sudo apk add --allow-untrusted wzaker_3.6.4_x86_64.apk` |
| Slackware | `.txz` | `sudo installpkg WZAKER-3.6.4-alpha01-linux-x86_64.txz` |
| Solus | `.eopkg` | (وصفة في `packaging/package.yml` — بناء بـ `ypkg`) |
| Void Linux | `.xbps` | (وصفة في `packaging/void-template/` — بناء بـ `xbps-src`) |
| Gentoo | `.ebuild` | (وصفة في `packaging/wzaker-3.6.4.ebuild`) |
| NixOS | `.nix` | (وصفة في `packaging/default.nix`) |
| Puppy Linux | `.pet` | `WZAKER-3.6.4-alpha01-linux-x86_64.pet` |
| **أي توزيعة** | **AppImage** | `chmod +x WZAKER-3.6.4-alpha01-linux-x86_64.AppImage && ./WZAKER-3.6.4-alpha01-linux-x86_64.AppImage` |
| универсальный | `.tar` / `.zip` | استخراج وتشغيل `/usr/bin/wzaker` |

> **ملاحظة:** نسخة AppImage **غير موقّعة** (بدون GPG). نسخة لينكس تمت من خلالي **Mohamed Zaitoon (ZaitXCode)**.
> vendor/copyright = AhmedMohamedH10 (المطور الأصلي).

## البناء من السورس

المتطلبات: JDK 21 (للبناء (Rust toolchain)، Gradle غير مطلوب).

```bash
git clone https://github.com/AhmedMohamedH10/WZAKER
cd WZAKER
# (استخدم فرع linux)
# بناء
export PATH="$HOME/.cargo/bin:$PATH"
tauri build
# النواتج في src-tauri/target/release/bundle/
```

## الميزات

- سبحة (دايل) عائمة، شفافة، دائمًا في المقدمة
- عدّ: نقر / مسافة / تمرير
- أذكار (الصباح/المساء/الوضوء/الصلاة/النوم/الاستيقاظ/المسجد)
- قارئ قرآن (114 سورة) + تفسير
- مواقيت صلاة (36+ مدينة، 5 طرق)
- إشعارات + تشغيل تلقائي (autostart)
- حفظ الإحصائيات (اليوم/الإجمالي/السلسلة) محليًا

## الاعتمادات

- Rust 1.99, Tauri 2.12
- tauri-plugin-shell, autostart, global-shortcut, notification, fs
- webkit2gtk-4.1, gtk3 (runtime deps)

## الشكر

- **AhmedMohamedH10** — المطور الأصلي لتطبيق WZAKER (ويندوز).
- **Mohamed Zaitoon (ZaitXCode)** — نسخة لينكس (Tauri + Rust).
- بيانات الأذكار من «حصن المسلم».

## الترخيص

مشروع مفتوح المصدر. احتفظ بحقوق المطور الأصلي عند إعادة التوزيع.
