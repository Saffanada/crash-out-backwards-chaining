/* =====================================================================
   BASIS PENGETAHUAN crash-out (Backward Chaining + Certainty Factor)

   Notasi:
     G  = gejala          -> ditanyakan ke user (Ya/Tidak, lalu tingkat)
     F  = fakta antara    -> kesimpulan sebuah rule yang jadi premis rule lain
     D  = diagnosis akhir -> goal yang dibuktikan oleh mesin inferensi

   Pola seperti contoh zookeeper:
     premis G  = "has hair", "eats meat"
     premis F  = "mammal", "carnivore"   (kesimpulan rule lain, dibuktikan rekursif)
     goal D    = "cheetah", "tiger"
   ===================================================================== */

/* ---------- Skala jawaban tingkat gejala ----------
   Hanya muncul kalau user menjawab "Ya". Nilainya jadi CF_user.
   (Jawaban "Tidak" sudah ditangani gerbang Ya/Tidak, jadi tidak ada opsi 0.) */
const opts = (list) => list.map(([label, value, hint]) => ({ label, value, ...(hint ? { hint } : {}) }));

const FREQ = opts([
  ["Jarang", 0.2],
  ["Kadang-kadang", 0.4],
  ["Cukup sering", 0.6],
  ["Sering", 0.8],
  ["Hampir selalu", 1],
]);

const SURE = opts([
  ["Mungkin", 0.4],
  ["Sepertinya iya", 0.6],
  ["Hampir pasti", 0.8],
  ["Pasti", 1],
]);

const TEMP = opts([
  ["Menengah", 0.4, "Hangat, sekitar 60 sampai 70°C"],
  ["Cukup tinggi", 0.6, "Mulai panas, sekitar 70 sampai 78°C"],
  ["Tinggi", 0.8, "Panas, sekitar 78 sampai 85°C"],
  ["Sangat tinggi", 1, "Di atas ±85°C, atau merah di aplikasi monitor"],
]);

/* ---------- Gejala ----------
   Nomor yang dipakai: G1-G12, G14-G22, G24-G28 (26 gejala).
   G13, G23, dan G29 sudah tidak dipakai.

   Gejala bersama (ditanya SEKALI, jawabannya dipakai ulang lintas kategori):
     G1  suhu CPU/GPU tinggi      -> R1 (Overheating)   dan R16 (Graphic Glitch)
     G4  PC restart/mati sendiri  -> R6 (Overheating)   dan R9  (Blue Screen)
     G16 read error saat akses file pada drive
                                  -> R11 (Blue Screen)  dan R22 (Corrupted Install)

   G16 dan G24 adalah dua gejala BERBEDA dan tidak boleh saling menggantikan:
     G16 = read error / file tidak dapat dibaca saat mengakses file pada drive
     G24 = installer menampilkan pesan file instalasi rusak (corrupt) */
export const SYMPTOMS = {
  // ----- Overheating -----
  G1: {
    yn: "Apakah suhu CPU atau GPU terasa atau terbaca tinggi saat PC dipakai?",
    level: "Seberapa tinggi suhunya?",
    options: TEMP,
  },
  G2: {
    yn: "Apakah kipas PC-mu berbunyi sangat keras?",
    level: "Seberapa keras suara kipasnya?",
    options: opts([
      ["Terdengar jelas", 0.4, "Terdengar jelas tapi masih wajar"],
      ["Cukup keras", 0.6, "Mulai terasa mengganggu"],
      ["Keras", 0.8, "Mengganggu, berputar kencang terus"],
      ["Sangat keras", 1, "Seperti mau lepas landas"],
    ]),
  },
  G3: {
    yn: "Apakah PC jadi lambat atau lag setelah menyala beberapa lama?",
    level: "Seberapa sering itu terjadi?",
    options: FREQ,
  },
  G4: {
    yn: "Apakah PC pernah restart atau mati sendiri tanpa peringatan?",
    level: "Seberapa sering PC mati atau restart sendiri?",
    options: opts([
      ["Beberapa kali", 0.4],
      ["Cukup sering", 0.6],
      ["Sering", 0.8],
      ["Hampir setiap dipakai lama", 1],
    ]),
  },
  G5: {
    yn: "Apakah bodi laptop atau casing PC terasa panas saat disentuh?",
    level: "Seberapa panas bodinya?",
    options: opts([
      ["Hangat", 0.4, "Terasa hangat tapi nyaman"],
      ["Cukup panas", 0.6, "Mulai kurang nyaman disentuh"],
      ["Panas", 0.8, "Tidak nyaman disentuh lama"],
      ["Sangat panas", 1, "Tidak tahan menyentuhnya"],
    ]),
  },
  G6: {
    yn: "Apakah kipas terdengar sangat pelan, atau malah tidak berputar sama sekali?",
    level: "Seberapa yakin kipasnya tidak bekerja normal?",
    options: opts([
      ["Sesekali tidak berputar", 0.4],
      ["Sering pelan atau mati", 0.6],
      ["Hampir selalu tidak berputar", 0.8],
      ["Pasti tidak berputar sama sekali", 1],
    ]),
  },
  G7: {
    yn: "Apakah ventilasi tertutup atau berdebu?",
    level: "Seberapa parah debu atau sumbatannya?",
    options: opts([
      ["Sedikit berdebu", 0.4],
      ["Cukup berdebu", 0.6],
      ["Berdebu tebal", 0.8],
      ["Tersumbat atau tertutup total", 1],
    ]),
  },
  G8: {
    yn: "Apakah suhu tetap tinggi walau PC hanya dipakai ringan (misalnya browsing atau didiamkan)?",
    level: "Seberapa sering suhunya tetap tinggi saat beban ringan?",
    options: FREQ,
  },
  G9: {
    yn: "Apakah perangkat sudah dipakai lebih dari 2 tahun tanpa pernah diservis atau dibersihkan?",
    level: "Sudah berapa lama sejak terakhir diservis?",
    options: opts([
      ["Sekitar 2 tahun", 0.4],
      ["Sekitar 3 tahun", 0.6],
      ["Sekitar 4 tahun", 0.8],
      ["Lebih dari 4 tahun atau belum pernah", 1],
    ]),
  },

  // ----- Blue Screen -----
  G10: {
    yn: "Apakah layar biru (BSOD) sering muncul?",
    level: "Seberapa sering layar biru muncul?",
    options: opts([
      ["Dua sampai tiga kali", 0.4],
      ["Beberapa kali", 0.6],
      ["Sering", 0.8],
      ["Sering sekali", 1, "Hampir setiap hari atau setiap dipakai"],
    ]),
  },
  G11: {
    yn: "Apakah ada tulisan kode error di layar biru itu?",
    level: "Seberapa jelas kode errornya?",
    options: opts([
      ["Ada, tapi tidak terbaca jelas", 0.4],
      ["Ada tulisannya", 0.8, "Misalnya huruf kapital seperti MEMORY_MANAGEMENT"],
      ["Ada dan sudah kucatat", 1],
    ]),
  },
  G12: {
    yn: "Apakah masalah mulai muncul setelah memasang driver atau update (Windows atau perangkat baru)?",
    level: "Seberapa yakin hubungannya?",
    options: opts([
      ["Mungkin", 0.4],
      ["Sepertinya iya", 0.6],
      ["Hampir pasti", 0.8],
      ["Pasti, langsung setelah itu", 1],
    ]),
  },
  G14: {
    yn: "Apakah layar biru muncul acak, termasuk saat PC hanya dipakai ringan atau didiamkan?",
    level: "Seberapa sering muncul saat pemakaian ringan?",
    options: FREQ,
  },
  G15: {
    yn: "Apakah kode error di layar biru menyebut memori (misalnya MEMORY_MANAGEMENT atau PAGE_FAULT_IN_NONPAGED_AREA)?",
    level: "Seberapa yakin kode itu menyebut memori?",
    options: SURE,
  },
  G16: {
    yn: "Saat mengakses file di drive, apakah muncul read error atau file tidak bisa dibaca?",
    level: "Seberapa sering read error itu muncul?",
    options: FREQ,
  },

  // ----- Graphic Glitch (G1 dipakai bersama dengan Overheating) -----
  G17: {
    yn: "Apakah ada titik, garis, atau kotak warna aneh (artefak) di layar?",
    level: "Seberapa banyak artefaknya?",
    options: opts([
      ["Sangat jarang", 0.2],
      ["Sedikit, sesekali", 0.4],
      ["Cukup banyak", 0.6],
      ["Banyak", 0.8],
      ["Memenuhi layar", 1],
    ]),
  },
  G18: {
    yn: "Apakah layar berkedip?",
    level: "Seberapa sering layar berkedip?",
    options: opts([
      ["Jarang", 0.2],
      ["Kadang-kadang", 0.4],
      ["Cukup sering", 0.6],
      ["Sering", 0.8],
      ["Terus-menerus", 1],
    ]),
  },
  G19: {
    yn: "Apakah masalah tampilan lebih parah saat main game atau memutar video?",
    level: "Seberapa lebih parah dibanding pemakaian biasa?",
    options: opts([
      ["Sedikit lebih parah", 0.4],
      ["Cukup lebih parah", 0.6],
      ["Lebih parah", 0.8],
      ["Jauh lebih parah", 1],
    ]),
  },
  G20: {
    yn: "Apakah masalah mulai muncul setelah update atau install driver grafis?",
    level: "Seberapa yakin hubungannya?",
    options: opts([
      ["Mungkin", 0.4],
      ["Sepertinya iya", 0.6],
      ["Hampir pasti iya", 0.8],
      ["Pasti iya", 1],
    ]),
  },
  G21: {
    yn: "Apakah layar sempat freeze atau hitam sebentar lalu pulih lagi?",
    level: "Seberapa sering itu terjadi?",
    options: opts([
      ["Pernah beberapa kali", 0.4],
      ["Cukup sering", 0.6],
      ["Sering", 0.8],
      ["Hampir setiap saat", 1],
    ]),
  },
  G22: {
    yn: "Apakah artefak juga tampak di layar BIOS atau layar booting (sebelum masuk Windows)?",
    level: "Seberapa yakin artefaknya terlihat di sana?",
    options: SURE,
  },
  // ----- Corrupted Install -----
  G24: {
    yn: "Apakah installer menampilkan pesan bahwa file instalasi rusak (corrupt)?",
    level: "Seberapa jelas pesan corrupt-nya?",
    options: opts([
      ["Ada error, tapi tidak jelas menyebut corrupt", 0.4],
      ["Menyebut file tidak valid atau gagal diekstrak", 0.6],
      ["Menyebut arsip atau paket rusak", 0.8, "Misalnya 'CRC error' atau 'archive is corrupted'"],
      ["Ya, jelas menyebut file instalasi rusak (corrupt)", 1],
    ]),
  },
  G25: {
    yn: "Apakah instalasi gagal di titik yang sama setiap kali dicoba?",
    level: "Seberapa sering gagalnya di titik yang sama?",
    options: opts([
      ["Kadang di titik yang sama", 0.4],
      ["Sering di titik yang sama", 0.6],
      ["Hampir selalu di titik yang sama", 0.8],
      ["Selalu di titik yang sama", 1],
    ]),
  },
  G26: {
    yn: "Apakah proses download installer sempat terputus atau gagal?",
    level: "Seberapa parah putusnya?",
    options: opts([
      ["Sempat terputus sekali", 0.4],
      ["Sempat putus-putus", 0.6],
      ["Sering terputus", 0.8],
      ["Gagal berkali-kali lalu diulang", 1],
    ]),
  },
  G27: {
    yn: "Apakah penyimpanan (drive) tempat menginstal hampir penuh?",
    level: "Seberapa penuh drive-nya?",
    options: opts([
      ["Terpakai sekitar 70%", 0.4],
      ["Terpakai lebih dari 85%", 0.6],
      ["Hampir penuh", 0.8],
      ["Penuh sekali", 1, "Sisa ruang hanya beberapa GB atau kurang"],
    ]),
  },
  G28: {
    yn: "Apakah antivirus memblokir atau menghapus file saat instalasi?",
    level: "Seberapa sering antivirus memblokir?",
    options: opts([
      ["Pernah sekali ada notifikasi", 0.4],
      ["Ada notifikasi sesekali", 0.6],
      ["Cukup sering memblokir", 0.8],
      ["Selalu memblokir atau menghapus file", 1],
    ]),
  },
};

/* ---------- Fakta antara (F) dan diagnosis (D) ---------- */
export const FACTS = {
  F1: "Suhu berlebih",
  F2: "Thermal throttling",
  F3: "Crash sistem berulang",
  F4: "Crash tanpa pemicu beban yang jelas",
  F5: "Gangguan tampilan",
  F6: "Gangguan muncul saat beban grafis",
  F7: "Instalasi gagal karena masalah file",
};

export const DIAGNOSES = {
  D1: {
    name: "Debu atau ventilasi tersumbat",
    solutions: [
      "Matikan PC lalu bersihkan debu di kipas, ventilasi, dan heatsink pakai compressed air atau kuas halus.",
      "Pastikan ventilasi tidak tertutup. Pakai cooling pad untuk laptop dan rapikan aliran udara di casing.",
      "Jangan menaruh laptop di kasur atau bantal saat dipakai.",
    ],
  },
  D2: {
    name: "Kipas pendingin bermasalah",
    solutions: [
      "Cek apakah kipas berputar saat PC menyala. Kalau tidak, cabut dan bersihkan kipas dari debu dan kotoran.",
      "Pastikan kabel kipas tertancap kuat di motherboard.",
      "Kalau kipas tetap mati atau berbunyi kasar, ganti kipasnya (di laptop, bawa ke teknisi).",
    ],
  },
  D3: {
    name: "Dugaan thermal paste kering atau menurun efektivitasnya",
    suspected: true, // ditampilkan sebagai dugaan, bukan kepastian kerusakan (R5 / R17)
    solutions: [
      "Ganti thermal paste CPU/GPU, terutama kalau sudah lebih dari 2 sampai 3 tahun.",
      "Bersihkan sisa pasta lama dengan isopropyl alcohol sebelum mengoleskan yang baru.",
      "Kalau tidak yakin membongkar sendiri, bawa ke teknisi karena salah pasang bisa merusak komponen.",
    ],
  },
  D4: {
    name: "Overheating kritis yang memicu proteksi suhu",
    solutions: [
      "Hentikan pemakaian berat dulu. PC mati sendiri adalah proteksi panas yang sedang bekerja.",
      "Pantau suhu dengan HWMonitor atau sejenisnya. Kalau terus di atas 85°C, bawa ke teknisi.",
      "Periksa kipas, ventilasi, dan thermal paste. Biasanya salah satunya jadi penyebab.",
    ],
  },
  D5: {
    name: "Indikasi driver atau update bermasalah",
    solutions: [
      "Catat kode stop-nya lalu cari di internet, biasanya langsung menunjuk penyebabnya.",
      "Rollback atau uninstall driver atau update terakhir yang dipasang sebelum crash mulai terjadi.",
      "Cabut perangkat USB yang tidak penting, lalu pasang ulang driver versi stabil dari situs resmi.",
    ],
  },
  D6: {
    name: "Indikasi RAM bermasalah",
    solutions: [
      "Jalankan Windows Memory Diagnostic untuk mengecek RAM.",
      "Cabut dan pasang ulang modul RAM, bersihkan kontaknya, lalu coba satu modul per slot.",
      "Kalau tes masih gagal, ganti modul RAM yang bermasalah.",
    ],
  },
  D7: {
    name: "Indikasi disk atau file sistem rusak",
    solutions: [
      "Jalankan 'sfc /scannow' di Command Prompt (admin) untuk memperbaiki file sistem.",
      "Jalankan 'chkdsk' untuk mengecek disk, dan cek kesehatan SSD/HDD dengan CrystalDiskInfo.",
      "Cadangkan data penting sekarang. Kalau disk terdeteksi rusak, segera ganti.",
    ],
  },
  D8: {
    name: "Indikasi driver grafis bermasalah",
    solutions: [
      "Install ulang driver grafis secara bersih memakai DDU (Display Driver Uninstaller).",
      "Kalau masalah muncul setelah update, rollback ke versi driver sebelumnya.",
      "Turunkan overclock GPU dan reset pengaturan driver ke default.",
    ],
  },
  D9: {
    name: "Indikasi GPU mengalami overheating",
    solutions: [
      "Bersihkan debu di kipas dan heatsink GPU, lalu pastikan aliran udara casing baik.",
      "Atur kurva kipas GPU atau turunkan pengaturan grafis di game.",
      "Ganti thermal paste GPU kalau sudah lama. Kalau suhu tetap tinggi, bawa ke teknisi.",
    ],
  },
  D10: {
    name: "Dugaan kerusakan hardware GPU/VRAM",
    suspected: true, // ditampilkan sebagai dugaan, bukan kepastian kerusakan (R5 / R17)
    solutions: [
      "Pasang ulang GPU dan pastikan kabel display tertancap kuat, atau coba kabel dan port lain.",
      "Artefak yang muncul bahkan di layar BIOS biasanya berarti kerusakan perangkat keras, bukan driver.",
      "Bawa ke teknisi untuk diperbaiki atau diganti. Uji dulu GPU di PC lain kalau memungkinkan.",
    ],
  },
  D11: {
    name: "File installer tidak utuh",
    solutions: [
      "Hapus installer lalu download ulang dari situs resmi, sebaiknya dengan koneksi yang stabil.",
      "Cocokkan checksum (SHA-256) file kalau situs menyediakannya.",
      "Jalankan installer sebagai administrator dan tutup program lain dulu.",
    ],
  },
  D12: {
    name: "Ruang penyimpanan tidak mencukupi",
    solutions: [
      "Kosongkan ruang disk (hapus file sementara, jalankan Disk Cleanup).",
      "Install ke drive lain yang masih lega.",
      "Sisakan minimal 15 sampai 20% ruang kosong supaya sistem tetap lancar.",
    ],
  },
  D13: {
    name: "Antivirus memblokir file instalasi",
    solutions: [
      "Matikan antivirus sementara, atau tambahkan pengecualian untuk installer, lalu coba lagi.",
      "Pastikan installer berasal dari situs resmi sebelum mengizinkannya.",
      "Aktifkan kembali antivirus setelah instalasi selesai.",
    ],
  },
  D14: {
    name: "Indikasi disk bermasalah",
    solutions: [
      "Jalankan 'chkdsk' pada drive. File rusak yang berulang bisa jadi tanda disk mulai bermasalah.",
      "Cek kesehatan disk dengan CrystalDiskInfo atau smartctl.",
      "Cadangkan data penting, dan siapkan penggantian disk kalau status kesehatannya buruk.",
    ],
  },
};

/* ---------- Rule ----------
   if   : premis, diproses berurutan (G = ditanya, F = sub-goal rekursif)
   then : kesimpulan (F atau D)
   cf   : CF pakar untuk rule ini (usulan, perlu dijustifikasi dengan referensi/pakar) */
export const RULES = [
  // Overheating
  { id: "R1",  if: ["G1", "G5"],        then: "F1",  cf: 0.8 },
  { id: "R2",  if: ["F1", "G3"],         then: "F2",  cf: 0.8 },
  { id: "R3",  if: ["F1", "G2", "G7"],  then: "D1",  cf: 0.9 },
  { id: "R4",  if: ["F1", "G6"],         then: "D2",  cf: 0.9 },
  { id: "R5",  if: ["F2", "G8", "G9"],  then: "D3",  cf: 0.8 },
  { id: "R6",  if: ["F2", "G4"],         then: "D4",  cf: 0.8 },

  // Blue Screen
  { id: "R7",  if: ["G10", "G11"],        then: "F3",  cf: 0.8 },
  { id: "R8",  if: ["F3", "G14"],         then: "F4",  cf: 0.6 },
  { id: "R9",  if: ["F3", "G12", "G4"],   then: "D5",  cf: 0.8 },
  { id: "R10", if: ["F4", "G15"],         then: "D6",  cf: 0.8 },
  { id: "R11", if: ["F4", "G16"],         then: "D7",  cf: 0.7 },

  // Graphic Glitch (R12 dan R13 sama-sama menyimpulkan F5, CF-nya digabung)
  { id: "R12", if: ["G17"],               then: "F5",  cf: 0.8 },
  { id: "R13", if: ["G18"],               then: "F5",  cf: 0.6 },
  { id: "R14", if: ["F5", "G19"],         then: "F6",  cf: 0.6 },
  { id: "R15", if: ["F5", "G20", "G21"],  then: "D8",  cf: 0.8 },
  { id: "R16", if: ["F6", "G1"],          then: "D9",  cf: 0.8 },
  { id: "R17", if: ["F5", "G22"],         then: "D10", cf: 0.9 },

  // Corrupted Install
  { id: "R18", if: ["G24", "G25"],        then: "F7",  cf: 0.8 },
  { id: "R19", if: ["F7", "G26"],         then: "D11", cf: 0.9 },
  { id: "R20", if: ["F7", "G27"],         then: "D12", cf: 0.6 },
  { id: "R21", if: ["F7", "G28"],         then: "D13", cf: 0.7 },
  { id: "R22", if: ["F7", "G16"],         then: "D14", cf: 0.8 },
];

/* ---------- Jenis masalah (pilihan awal user) = kumpulan goal ---------- */
export const PROBLEMS = [
  {
    id: "overheating",
    name: "Overheating",
    desc: "CPU atau GPU panas, kipas berisik, performa lambat",
    goals: ["D1", "D2", "D3", "D4"],
  },
  {
    id: "bluescreen",
    name: "Blue Screen",
    desc: "Crash mendadak dan kode error (BSOD)",
    goals: ["D5", "D6", "D7"],
  },
  {
    id: "glitch",
    name: "Graphic Glitch",
    desc: "Artefak, layar berkedip, atau tampilan rusak",
    goals: ["D8", "D9", "D10"],
  },
  {
    id: "corrupted",
    name: "Corrupted Install",
    desc: "File rusak saat install aplikasi",
    goals: ["D11", "D12", "D13", "D14"],
  },
];

export function verdict(cf) {
  if (cf >= 0.8) return { label: "Sangat mungkin", tone: "high" };
  if (cf >= 0.6) return { label: "Mungkin", tone: "high" };
  if (cf >= 0.4) return { label: "Cukup mungkin", tone: "mid" };
  return { label: "Kecil kemungkinan", tone: "low" };
}
