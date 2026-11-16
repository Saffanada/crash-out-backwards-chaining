/* Uji mesin inferensi terhadap rule di dokumen "Revisi Penomoran Gejala". */
import { RULES, SYMPTOMS, PROBLEMS, DIAGNOSES } from "./data/rules";
import { infer, symptomsOf, combineCF } from "./data/engine";

const P = (id) => PROBLEMS.find((p) => p.id === id);
const yes = (cf) => ({ yes: true, cf, label: String(cf) });
const no = { yes: false };
const cfOf = (out, d) => out.results.find((r) => r.id === d).cf;

/** Jalankan sampai selesai: ambil jawaban dari map, sisanya "Tidak". Catat urutan pertanyaan. */
function run(problem, given, memory = {}) {
  const answers = { ...memory };
  const asked = [];
  for (let i = 0; i < 50; i++) {
    const out = infer(problem, answers);
    if (out.status === "done") return { out, asked, answers };
    asked.push(out.symptom);
    answers[out.symptom] = given[out.symptom] || no;
  }
  throw new Error("tidak selesai");
}

test("basis pengetahuan: 22 rule, 26 gejala (tanpa G13, G23, G29)", () => {
  expect(RULES).toHaveLength(22);
  expect(RULES.map((r) => r.id)).not.toContain("R23");
  ["G13", "G23", "G29"].forEach((g) => expect(SYMPTOMS[g]).toBeUndefined());
  expect(Object.keys(SYMPTOMS)).toHaveLength(26);
  RULES.flatMap((r) => r.if).filter((p) => p.startsWith("G")).forEach((g) => expect(SYMPTOMS[g]).toBeTruthy());
  // setiap gejala dipakai minimal satu rule
  const used = new Set(RULES.flatMap((r) => r.if));
  Object.keys(SYMPTOMS).forEach((g) => expect(used.has(g)).toBe(true));
});

test("rule sesuai PDF (R1, R9, R16, R22)", () => {
  const r = (id) => RULES.find((x) => x.id === id);
  expect(r("R1")).toMatchObject({ if: ["G1", "G5"], then: "F1", cf: 0.8 });
  expect(r("R9")).toMatchObject({ if: ["F3", "G12", "G4"], then: "D5", cf: 0.8 });
  expect(r("R11")).toMatchObject({ if: ["F4", "G16"], then: "D7", cf: 0.7 });
  expect(r("R16")).toMatchObject({ if: ["F6", "G1"], then: "D9", cf: 0.8 });
  expect(r("R18")).toMatchObject({ if: ["G24", "G25"], then: "F7", cf: 0.8 });
  expect(r("R22")).toMatchObject({ if: ["F7", "G16"], then: "D14", cf: 0.8 });
});

test("gejala bersama: G1, G4, G16 lintas kategori", () => {
  const has = (c, g) => symptomsOf(P(c)).includes(g);
  expect(has("overheating", "G1") && has("glitch", "G1")).toBe(true);
  expect(has("overheating", "G4") && has("bluescreen", "G4")).toBe(true);
  expect(has("bluescreen", "G16") && has("corrupted", "G16")).toBe(true);
});

test("G16 dan G24 berbeda: pertanyaan berbeda dan G24 hanya di Corrupted Install", () => {
  expect(SYMPTOMS.G16.yn).not.toBe(SYMPTOMS.G24.yn);
  expect(SYMPTOMS.G16.yn).toMatch(/read error/);
  expect(SYMPTOMS.G24.yn).toMatch(/corrupt/);
  expect(symptomsOf(P("bluescreen"))).not.toContain("G24");
});

test("D1 = 0,9 x min(F1 0,64; G2 0,6; G7 1) = 0,54", () => {
  const { out } = run(P("overheating"), { G1: yes(0.8), G5: yes(0.8), G2: yes(0.6), G7: yes(1) });
  expect(cfOf(out, "D1")).toBeCloseTo(0.54, 5);
});

test("F5: R12 (0,8) + R13 (0,6) digabung = 0,92 (contoh PDF)", () => {
  expect(combineCF(0.8, 0.6)).toBeCloseTo(0.92, 5);
  const { out } = run(P("glitch"), { G17: yes(1), G18: yes(1), G22: yes(1) });
  expect(cfOf(out, "D10")).toBeCloseTo(0.828, 5); // 0,9 x min(0,92; 1)
});

test("D5 lewat R9 (F3, G12, G4): 0,8 x min(0,8; 1; 1) = 0,64", () => {
  const g = { G10: yes(1), G11: yes(1), G12: yes(1), G4: yes(1) };
  const { out, asked } = run(P("bluescreen"), g);
  expect(cfOf(out, "D5")).toBeCloseTo(0.64, 5);
  expect(asked).not.toContain("G13");
});

test("G4 dipakai bersama: dijawab di Overheating, tidak ditanya lagi di Blue Screen (R9)", () => {
  const first = run(P("overheating"), { G1: yes(1), G5: yes(1), G3: yes(1), G4: yes(1) });
  expect(cfOf(first.out, "D4")).toBeGreaterThan(0);
  const second = run(P("bluescreen"), { G10: yes(1), G11: yes(1), G12: yes(1) }, first.answers);
  expect(second.asked).not.toContain("G4");
  expect(cfOf(second.out, "D5")).toBeCloseTo(0.64, 5);
});

test("G1 dipakai bersama: dari Overheating dipakai ulang di Graphic Glitch (R16)", () => {
  const first = run(P("overheating"), { G1: yes(1), G5: no });
  const second = run(P("glitch"), { G17: yes(1), G19: yes(1) }, first.answers);
  expect(second.asked).not.toContain("G1");
  expect(cfOf(second.out, "D9")).toBeCloseTo(0.384, 5); // 0,8 x min(F6 0,48; 1)
});

test("G16 dipakai bersama: dari Blue Screen dipakai ulang di Corrupted Install (R22)", () => {
  const first = run(P("bluescreen"), { G10: yes(1), G11: yes(1), G14: yes(1), G16: yes(1) });
  expect(cfOf(first.out, "D7")).toBeCloseTo(0.7 * 0.48, 5); // F3 0,8 ; F4 0,48
  const second = run(P("corrupted"), { G24: yes(1), G25: yes(1) }, first.answers);
  expect(second.asked).not.toContain("G16");
  expect(cfOf(second.out, "D14")).toBeCloseTo(0.8 * 0.8, 5); // F7 0,8 ; x G16 (1) -> 0,64
});

test("G16 TIDAK menggantikan G24: tanpa G24 Corrupted Install tetap ditanya G24", () => {
  const first = run(P("bluescreen"), { G10: yes(1), G11: yes(1), G14: yes(1), G16: yes(1) });
  const second = run(P("corrupted"), { G24: no }, first.answers);
  expect(second.asked).toContain("G24");
  second.out.results.forEach((r) => expect(r.cf).toBe(0)); // F7 gagal -> semua D gugur
});

test("Corrupted Install: G24 Ya tidak mengisi G16 (G16 ditanya sendiri)", () => {
  const { asked } = run(P("corrupted"), { G24: yes(1), G25: yes(1) });
  expect(asked).toEqual(expect.arrayContaining(["G24", "G25", "G26", "G27", "G28", "G16"]));
});

test("G1 = Tidak: Overheating gugur setelah 1 pertanyaan", () => {
  const { asked, out } = run(P("overheating"), {});
  expect(asked).toEqual(["G1"]);
  out.results.forEach((r) => expect(r.cf).toBe(0));
});

test("D3 dan D10 ditandai dugaan; nama diagnosis sesuai PDF", () => {
  expect(DIAGNOSES.D3.suspected).toBe(true);
  expect(DIAGNOSES.D10.suspected).toBe(true);
  expect(DIAGNOSES.D5.name).toBe("Indikasi driver atau update bermasalah");
  expect(DIAGNOSES.D14.name).toBe("Indikasi disk bermasalah");
});
