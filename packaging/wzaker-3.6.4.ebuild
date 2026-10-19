# Copyright 2026 ZaitXCode
EAPI=8
DESCRIPTION="وذكر — سبحة إلكترونية وأذكار وقرآن وأوقات صلاة (Linux)"
HOMEPAGE="https://github.com/AhmedMohamedH10/WZAKER"
SRC_URI="https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4-alpha01/WZAKER-3.6.4-alpha01-linux-x86_64.AppImage"
LICENSE="MIT"
SLOT="0"
KEYWORDS="~amd64"
RDEPEND="net-libs/webkit-gtk:4.1 x11-libs/gtk+:3"
S="${WORKDIR}"

src_install() {
  newbin "${DISTDIR}/WZAKER-3.6.4-alpha01-linux-x86_64.AppImage" wzaker
}
