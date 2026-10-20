Name:           wzaker
Version:        3.6.4
Release:        1
Summary:        وذكر — سبحة إلكترونية وأذكار وقرآن وأوقات صلاة (Linux)
License:        MIT
URL:            https://github.com/AhmedMohamedH10/WZAKER
Requires:       webkit2gtk4.1, gtk3
BuildArch:      x86_64

%description
 ذكر — سبحة إلكترونية وأذكار وقرآن وأوقات صلاة (نسخة لينكس، Tauri + Rust).

%prep

%build

%install
mkdir -p %{buildroot}/usr/lib/wzaker
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/48x48/apps
mkdir -p %{buildroot}/usr/share/icons/hicolor/64x64/apps
mkdir -p %{buildroot}/usr/share/icons/hicolor/128x128/apps
mkdir -p %{buildroot}/usr/share/icons/hicolor/256x256/apps
install -m 755 /home/mohamedzaitoon/Projects/WZAKER/src-tauri/target/release/wzaker %{buildroot}/usr/lib/wzaker/wzaker
install -m 755 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/bin/wzaker %{buildroot}/usr/bin/wzaker
install -m 644 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/share/applications/wzaker.desktop %{buildroot}/usr/share/applications/wzaker.desktop
install -m 644 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/share/icons/hicolor/48x48/apps/wzaker.png %{buildroot}/usr/share/icons/hicolor/48x48/apps/wzaker.png
install -m 644 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/share/icons/hicolor/64x64/apps/wzaker.png %{buildroot}/usr/share/icons/hicolor/64x64/apps/wzaker.png
install -m 644 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/share/icons/hicolor/128x128/apps/wzaker.png %{buildroot}/usr/share/icons/hicolor/128x128/apps/wzaker.png
install -m 644 /home/mohamedzaitoon/Projects/WZAKER/build/stage/usr/share/icons/hicolor/256x256/apps/wzaker.png %{buildroot}/usr/share/icons/hicolor/256x256/apps/wzaker.png

%files
/usr/lib/wzaker/wzaker
/usr/bin/wzaker
/usr/share/applications/wzaker.desktop
/usr/share/icons/hicolor/48x48/apps/wzaker.png
/usr/share/icons/hicolor/64x64/apps/wzaker.png
/usr/share/icons/hicolor/128x128/apps/wzaker.png
/usr/share/icons/hicolor/256x256/apps/wzaker.png

%changelog
* Mon Oct 20 2026 محمد زيتون <mohamed-zaitoon@users.noreply.github.com> - 3.6.4-1
- Linux release (Tauri + Rust) — signed with GPG
