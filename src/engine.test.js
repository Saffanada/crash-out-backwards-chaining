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

test("basis pengetahuan: 23 rule, G1-G22 dan G24-G29, tanpa G23", () => {
  expect(RULES).toHaveLength(23);
  expect(SYMPTOMS.G23).toBeUndefined();
  expect(Object.keys(SYMPTOMS)).toHaveLength(28);
  RULES.flatMap((r) => r.if).filter((p) => p.startsWith("G")).forEach((g) => expect(SYMPTOMS[g]).toBeTruthy());
});

test("rule sesuai PDF (spot check R1, R16, R23)", () => {
  const r = (id) => RULES.find((x) => x.id === id);
  expect(r("R1")).toMatchObject({ if: ["G1", "G5"], then: "F1", cf: 0.8 });
  expect(r("R16")).toMatchObject({ if: ["F6", "G1"], then: "D9", cf: 0.8 });
  expect(r("R23")).toMatchObject({ if: ["F3", "G12", "G4"], then: "D5", cf: 0.8 });
});

test("G1 dipakai di Overheating dan Graphic Glitch, G4 di Overheating dan Blue Screen", () => {
  expect(symptomsOf(P("overheating"))).toContain("G1");
  expect(symptomsOf(P("glitch"))).toContain("G1");
  expect(symptomsOf(P("overheating"))).toContain("G4");
  expect(symptomsOf(P("bluescreen"))).toContain("G4");
});

test("D1 = 0,9 x min(F1 0,64; G2 0,6; G7 1) = 0,54", () => {
  const { out } = run(P("overheating"), { G1: yes(0.8), G5: yes(0.8), G2: yes(0.6), G7: yes(1) });
  expect(cfOf(out, "D1")).toBeCloseTo(0.54, 5);
});

test("F5: R12 (0,8) + R13 (0,6) digabung = 0,92 (contoh PDF)", () => {
  expect(combineCF(0.8, 0.6)).toBeCloseTo(0.92, 5);
  const { out } = run(P("glitch"), { G17: yes(1), G18: yes(1), G22: yes(1) });
  // D10 = 0,9 x min(F5 0,92; G22 1) = 0,828
  expect(cfOf(out, "D10")).toBeCloseTo(0.828, 5);
});

test("D5: R9 dan R23 digabung bila keduanya terpenuhi", () => {
  const g = { G10: yes(1), G11: yes(1), G12: yes(1), G13: yes(1), G4: yes(1) };
  const { out } = run(P("bluescreen"), g);
  // F3 = 0,8 -> R9 = 0,64 ; R23 = 0,64 ; gabungan = 0,64 + 0,64 x 0,36 = 0,8704
  expect(cfOf(out, "D5")).toBeCloseTo(0.8704, 5);
  const ids = out.results.find((r) => r.id === "D5").trace.map((t) => t.id);
  expect(ids).toEqual(expect.arrayContaining(["R7", "R9", "R23"]));
});

test("D5: jalur R23 tetap diperiksa walau R9 gagal (G13 = Tidak)", () => {
  const g = { G10: yes(1), G11: yes(1), G12: yes(1), G13: no, G4: yes(1) };
  const { out, asked } = run(P("bluescreen"), g);
  expect(asked).toContain("G4");
  expect(cfOf(out, "D5")).toBeCloseTo(0.64, 5);
});

test("D5: hanya R9 terpenuhi (G4 = Tidak)", () => {
  const g = { G10: yes(1), G11: yes(1), G12: yes(1), G13: yes(1), G4: no };
  expect(cfOf(run(P("bluescreen"), g).out, "D5")).toBeCloseTo(0.64, 5);
});

test("working memory: G1 dari Overheating tidak ditanya lagi di Graphic Glitch (R16)", () => {
  const first = run(P("overheating"), { G1: yes(1), G5: no });
  expect(first.asked).toContain("G1");
  const second = run(P("glitch"), { G17: yes(1), G19: yes(1) }, first.answers);
  expect(second.asked).not.toContain("G1");
  // F5 = 0,8 ; F6 = 0,6 x 0,8 = 0,48 ; D9 = 0,8 x min(0,48; G1 1) = 0,384
  expect(cfOf(second.out, "D9")).toBeCloseTo(0.384, 5);
});

test("working memory: G4 dari Overheating dipakai ulang di Blue Screen (R23)", () => {
  const first = run(P("overheating"), { G1: yes(1), G5: yes(1), G3: yes(1), G4: yes(1) });
  const second = run(P("bluescreen"), { G10: yes(1), G11: yes(1), G12: yes(1) }, first.answers);
  expect(second.asked).not.toContain("G4");
  expect(cfOf(second.out, "D5")).toBeCloseTo(0.64, 5); // R23 saja, R9 gagal (G13 Tidak)
});

test("G1 = Tidak: Overheating gugur setelah 1 pertanyaan", () => {
  const { asked, out } = run(P("overheating"), {});
  expect(asked).toEqual(["G1"]);
  out.results.forEach((r) => expect(r.cf).toBe(0));
});

test("D3 dan D10 ditandai sebagai dugaan; nama diagnosis sesuai PDF", () => {
  expect(DIAGNOSES.D3.suspected).toBe(true);
  expect(DIAGNOSES.D10.suspected).toBe(true);
  expect(DIAGNOSES.D5.name).toBe("Indikasi driver atau update bermasalah");
  expect(DIAGNOSES.D4.name).toBe("Overheating kritis yang memicu proteksi suhu");
});
