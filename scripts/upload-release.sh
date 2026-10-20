#!/bin/bash
# رفع حزم لينكس الموقّعة إلى إصدار v3.6.4
cd /home/mohamedzaitoon/Projects/WZAKER/dist || exit 1
R="--repo AhmedMohamedH10/WZAKER"
for a in WZAKER-3.6.4-linux-amd64.deb WZAKER-3.6.4-linux-amd64.deb.asc \
         WZAKER-3.6.4-linux-x86_64.rpm WZAKER-3.6.4-linux-x86_64.rpm.asc \
         WZAKER-3.6.4-linux-x86_64.AppImage WZAKER-3.6.4-linux-x86_64.AppImage.asc \
         WZAKER-3.6.4-linux-x86_64.pkg.tar.zst WZAKER-3.6.4-linux-x86_64.pkg.tar.zst.asc \
         wzaker_3.6.4_x86_64.apk wzaker_3.6.4_x86_64.apk.asc \
         WZAKER-3.6.4-linux-x86_64.txz WZAKER-3.6.4-linux-x86_64.txz.asc \
         WZAKER-3.6.4-linux-x86_64.pet WZAKER-3.6.4-linux-x86_64.pet.asc \
         WZAKER-3.6.4-linux-x86_64.tar WZAKER-3.6.4-linux-x86_64.tar.asc \
         wzaker.zip wzaker.zip.asc \
         linux-installer.sh linux-installer.sh.asc \
         wzaker-signing-key.asc ; do
  [ -f "$a" ] || { echo "skip (missing): $a"; continue; }
  for i in 1 2 3; do
    gh release upload v3.6.4 $R "./$a" >/dev/null 2>&1 && break
    gh release delete-asset v3.6.4 "$a" $R -y >/dev/null 2>&1
    sleep 2
  done
  echo "uploaded: $a"
done
echo "=== assets ==="
gh release view v3.6.4 $R --json assets --jq '.assets | length'
