{ stdenv, fetchurl, webkitgtk_4_1, gtk3 }:
stdenv.mkDerivation rec {
  pname = "wzaker";
  version = "3.6.4-alpha01";
  src = fetchurl {
    url = "https://github.com/AhmedMohamedH10/WZAKER/releases/download/v3.6.4-alpha01/WZAKER-3.6.4-alpha01-linux-x86_64.AppImage";
    sha256 = "0000000000000000000000000000000000000000000000000000";
  };
  buildInputs = [ webkitgtk_4_1 gtk3 ];
  dontBuild = true;
  installPhase = ''
    mkdir -p $out/bin
    cp $src $out/bin/wzaker
    chmod +x $out/bin/wzaker
  '';
}
