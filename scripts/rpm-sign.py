#!/usr/bin/env python3
"""
توقيع حزمة RPM بمفتاح GPG (توقيع مدمج في الهيدر) — بديل rpmsign بدون sudo.

الاستخدام:
    python3 scripts/rpm-sign.py <file.rpm> [key-id]
"""
import hashlib
import os
import struct
import subprocess
import sys
import tempfile

# أنواع بيانات هيدر RPM
NULL, CHAR, INT8, INT16, INT32, INT64, STRING, BIN, STRING_ARRAY, I18NSTRING = range(10)

# وسوم التوقيع
SIG_SHA1HEADER = 269
SIG_LONGSIZE = 270
SIG_LONGARCHIVESIZE = 271
SIG_SHA256HEADER = 273
SIG_SIZE = 1000
SIG_MD5 = 1004
SIG_PGP = 1005
SIG_PAYLOADSIZE = 1007
SIG_RESERVEDSPACE = 1008

REGION_TAG = 62  # HEADERSIGNATURES
HEADER_MAGIC = b"\x8e\xad\xe8\x01\x00\x00\x00\x00"


def align(n, a):
    return (n + a - 1) // a * a


def header_entries(region):
    """يرجع قايمة (tag, type, offset, count) من منطقة هيدر"""
    nindex, hsize = struct.unpack(">II", region[8:16])
    index = region[16:16 + nindex * 16]
    data = region[16 + nindex * 16:16 + nindex * 16 + hsize]
    out = []
    for i in range(nindex):
        tag, typ, off, count = struct.unpack(">IIII", index[i * 16:i * 16 + 16])
        out.append((tag, typ, off, count, data[off:off + count]))
    return out


def read_header(f, skip_pad=True):
    pre = f.read(16)
    if pre[:4] != HEADER_MAGIC[:4]:
        raise ValueError("RPM header magic غير صحيح")
    nindex, hsize = struct.unpack(">II", pre[8:16])
    index = f.read(nindex * 16)
    data = f.read(hsize)
    region = pre + index + data
    pad = (-(16 + nindex * 16 + hsize)) % 8
    if skip_pad:
        f.read(pad)
        return region, region + b"\x00" * pad
    return region, region


def build_header(entries):
    """entries = [(tag, type, data)] → بايتات هيدر RPM (المنطقة + وسم المنطقة)"""
    store = b""
    offset = 0
    index_entries = []
    for tag, typ, data in sorted(entries, key=lambda e: e[0]):
        a = 4 if typ == INT32 else 8 if typ == INT64 else 1
        pad = align(offset, a) - offset
        store += b"\x00" * pad
        offset += pad
        if typ == STRING:
            data = data + b"\x00"     # NUL-terminated
            count = 1
        elif typ == BIN:
            count = len(data)
        else:
            count = 1
        index_entries.append((tag, typ, offset, count))
        store += data
        offset += len(data)

    # وسم المنطقة (أول إنديكس، بياناته في آخر الداتا)
    nindex = len(index_entries) + 1
    region_off = len(store)
    hsize = region_off + 16
    # trailer المنطقة: (tag, type, offset=-16, count=16)
    store += struct.pack(">IIII", REGION_TAG, BIN, (-16) & 0xFFFFFFFF, 16)

    idx = struct.pack(">IIII", REGION_TAG, BIN, region_off, 16)
    for e in index_entries:
        idx += struct.pack(">IIII", *e)

    return HEADER_MAGIC + struct.pack(">II", nindex, hsize) + idx + store


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    path = sys.argv[1]
    key = sys.argv[2] if len(sys.argv) > 2 else "EC5E1EC44ED65B7AFD33F17018A7EB1880C9F89E"

    use_padding = os.environ.get("RPM_SIGN_WITH_PADDING", "1") == "1"

    with open(path, "rb") as f:
        lead = f.read(96)
        old_sig_region, _ = read_header(f)   # هيدر التوقيع القديم
        reserved = b""
        orig_payloadsize = None
        for tag, typ, off, count, val in header_entries(old_sig_region):
            if tag == SIG_RESERVEDSPACE:
                reserved = val
            elif tag == SIG_PAYLOADSIZE and typ == INT32 and len(val) >= 4:
                orig_payloadsize = struct.unpack(">i", val[:4])[0]
        main_region, main_hdr_bytes = read_header(f, skip_pad=False)
        payload = f.read()

    # التوقيع = الهيدر الرئيسي + الـ payload
    sign_data = main_region + payload
    with tempfile.NamedTemporaryFile(delete=False) as t:
        t.write(sign_data)
        tmp = t.name
    pgp = tmp + ".sig"
    try:
        subprocess.run(
            ["gpg", "--batch", "--yes", "--local-user", key,
             "--digest-algo", "sha256", "--output", pgp, "--detach-sign", tmp],
            check=True,
        )
        with open(pgp, "rb") as s:
            pgp_blob = s.read()
    finally:
        for p in (tmp, pgp):
            if os.path.exists(p):
                os.unlink(p)

    entries = [
        (SIG_SIZE, INT32, struct.pack(">i", len(main_hdr_bytes) + len(payload))),
        (SIG_PGP, BIN, pgp_blob),
        (SIG_SHA1HEADER, STRING, hashlib.sha1(main_region).hexdigest().encode()),
        (SIG_SHA256HEADER, STRING, hashlib.sha256(main_region).hexdigest().encode()),
        (SIG_MD5, BIN, hashlib.md5(main_region).digest()),
        (SIG_PAYLOADSIZE, INT32, struct.pack(">i", orig_payloadsize if orig_payloadsize else len(payload))),
        (SIG_LONGSIZE, INT64, struct.pack(">q", len(main_hdr_bytes) + len(payload))),
        (SIG_LONGARCHIVESIZE, INT64, struct.pack(">q", len(payload))),
    ]
    if reserved:
        entries.append((SIG_RESERVEDSPACE, BIN, reserved))
    new_sig = build_header(entries)

    # حشو لحد 8 بايت بين الهيدرات
    sig_pad = b"\x00" * ((-len(new_sig)) % 8)

    out = path + ".signed"
    with open(out, "wb") as o:
        o.write(lead)
        o.write(new_sig)
        o.write(sig_pad)
        o.write(main_region)     # المنطقة بدون الحشو (الـ payload يليه مباشرة)
        o.write(payload)
    os.replace(out, path)
    print(f"✓ signed: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
