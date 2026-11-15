# crash-out

Sistem pakar diagnosa masalah PC memakai **Backward Chaining** dan **Certainty Factor (CF)**.
Dibuat dengan React (Create React App).

## Menjalankan

```bash
npm install
npm start      # http://localhost:3000
npm test       # uji mesin inferensi (sesuai PDF rule) dan alur chat
```

## Struktur penting

| File | Isi |
|---|---|
| `src/data/rules.js` | Basis pengetahuan: gejala (G), fakta antara (F), diagnosis (D), rule, dan jenis masalah |
| `src/data/engine.js` | Mesin inferensi backward chaining + perhitungan CF |
| `src/components/Diagnose.js` | Antarmuka chat: pilih masalah, tanya Ya/Tidak, pilih tingkat, hasil |

## Notasi

- **G** = gejala, ditanyakan ke user (G1 sampai G29, tanpa G23)
- **F** = fakta antara, kesimpulan sebuah rule yang menjadi premis rule lain
- **D** = diagnosis akhir, goal yang dibuktikan (D1 sampai D14)

Polanya sama dengan contoh zookeeper: premis boleh berupa kesimpulan rule lain
(`mammal`, `carnivore`), bukan hanya fakta mentah, dan kesimpulan akhirnya spesifik
(`cheetah`, `tiger`).

## Rule

CF di kurung adalah CF pakar per rule (usulan, perlu dijustifikasi dengan referensi atau pakar).

**Overheating**

```
R1 IF G1 AND G5           THEN F1 Suhu berlebih                      (0.8)
R2 IF F1 AND G3           THEN F2 Thermal throttling                 (0.8)
R3 IF F1 AND G2 AND G7    THEN D1 Debu atau ventilasi tersumbat      (0.9)
R4 IF F1 AND G6           THEN D2 Kipas pendingin bermasalah         (0.9)
R5 IF F2 AND G8 AND G9    THEN D3 Dugaan thermal paste kering        (0.8)
R6 IF F2 AND G4           THEN D4 Overheating kritis                 (0.8)
```

**Blue Screen**

```
R7  IF G10 AND G11         THEN F3 Crash sistem berulang              (0.8)
R8  IF F3 AND G14          THEN F4 Crash tanpa pemicu beban           (0.6)
R9  IF F3 AND G12 AND G13  THEN D5 Driver/update bermasalah           (0.8)
R10 IF F4 AND G15          THEN D6 RAM bermasalah                     (0.8)
R11 IF F4 AND G16          THEN D7 Disk/file sistem rusak             (0.7)
R23 IF F3 AND G12 AND G4   THEN D5 Driver/update bermasalah           (0.8)
```

R9 dan R23 adalah dua jalur menuju D5 (R9 memakai G13, R23 memakai G4). Kalau keduanya
terpenuhi, CF digabung dengan rumus kombinasi.

**Graphic Glitch**

```
R12 IF G17                 THEN F5 Gangguan tampilan                  (0.8)
R13 IF G18                 THEN F5 Gangguan tampilan                  (0.6)
R14 IF F5 AND G19          THEN F6 Gangguan muncul saat beban grafis  (0.6)
R15 IF F5 AND G20 AND G21  THEN D8 Driver grafis bermasalah           (0.8)
R16 IF F6 AND G1           THEN D9 GPU overheating                          (0.8)
R17 IF F5 AND G22          THEN D10 GPU/VRAM rusak                    (0.9)
```

R12 dan R13 sama-sama menyimpulkan F5, seperti Z1 dan Z2 untuk "mammal" di zookeeper.
CF keduanya digabung.

## Gejala bersama (working memory lintas kategori)

Gejala yang sama memakai nomor yang sama. Sistem hanya menanyakannya **sekali** dan jawabannya
dipakai ulang di kategori lain:

- **G1** (suhu CPU/GPU tinggi): R1 (Overheating) dan R16 (Graphic Glitch)
- **G4** (PC mati/restart sendiri): R6 (Overheating) dan R23 (Blue Screen)

G23 pada rancangan lama sudah diganti menjadi G1.

**Corrupted Install**

```
R18 IF G24 AND G25         THEN F7 Instalasi gagal karena file        (0.8)
R19 IF F7 AND G26          THEN D11 Installer tidak utuh              (0.9)
R20 IF F7 AND G27          THEN D12 Ruang penyimpanan kurang          (0.6)
R21 IF F7 AND G28          THEN D13 Antivirus memblokir file          (0.7)
R22 IF F7 AND G29          THEN D14 Disk bermasalah                   (0.8)
```

## Alur backward chaining

1. User memilih **jenis masalah**. Pilihan ini menentukan kumpulan goal (D) yang diuji.
2. Mesin mengambil goal pertama, mencari rule yang menyimpulkannya, lalu memproses
   premisnya berurutan. Premis **F** diproses sebagai sub-goal (rekursif), misalnya
   D1 → R3 → F1 → R1.
3. Premis **G** ditanyakan **Ya/Tidak**.
   - **Tidak**: premis gagal, rule gugur, dan cabang yang bergantung padanya ikut gugur
     tanpa ditanyakan.
   - **Ya**: user memilih tingkat gejala, yang menjadi CF_user (0.2 sampai 1.0).
4. Jawaban disimpan di working memory (`answers`) dan **tidak direset saat pindah kategori**,
   jadi gejala bersama (G1, G4) tidak ditanya ulang.
5. Hasil akhir berupa daftar diagnosis beserta CF dan jejak rule yang dilalui.
   Diagnosis dengan CF di atas 40% menampilkan rekomendasi perbaikan.

## Rumus CF (gaya MYCIN)

- `CF(rule) = CF_pakar × min(CF semua premisnya)`.
  Premis G memakai CF_user, premis F memakai CF hasil rule sebelumnya.
- Jika satu kesimpulan didukung beberapa rule: `CFlama + CFbaru × (1 − CFlama)`.

**Contoh (Overheating, goal D1)**

- R3 butuh F1, jadi sub-goal R1: tanya G1 (Ya, Tinggi = 0.8), lalu G5 (Ya, Panas = 0.8).
  `F1 = 0.8 × min(0.8, 0.8) = 0.64`
- Lanjut G2 (Ya, 0.6) dan G7 (Ya, 1):
  `D1 = 0.9 × min(0.64, 0.6, 1) = 0.54`
- Untuk D2, F1 tidak ditanya ulang, hanya G6.
- Jika G1 dijawab **Tidak**, F1 gagal, dan D1 sampai D4 serta F2 gugur sekaligus.
  User hanya ditanya 1 pertanyaan.
