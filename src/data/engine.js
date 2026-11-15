/* =====================================================================
   MESIN INFERENSI BACKWARD CHAINING + CERTAINTY FACTOR

   Cara kerja:
   - Goal (D) dibuktikan satu per satu. Untuk tiap goal, mesin mencari
     rule yang menyimpulkannya, lalu memproses premis berurutan.
   - Premis F  -> dibuktikan sebagai sub-goal (rekursif).
   - Premis G  -> dicek di working memory (answers). Kalau belum ada,
     mesin berhenti dan mengembalikan { status: "ask", symptom }.
   - Kalau satu premis gagal (G dijawab Tidak, atau F tidak terbukti),
     rule gugur dan premis sesudahnya TIDAK ditanyakan. Cabang yang
     bergantung pada F yang gagal ikut gugur tanpa ditanya.

   Mesin ini stateless: tiap ada jawaban baru, infer() dipanggil lagi dengan
   working memory terbaru. Jawaban lama tidak pernah ditanya ulang.

   answers = {
     G1: { yes: true, cf: 0.8, label: "Tinggi" },
     G2: { yes: false },
   }
   ===================================================================== */
import { RULES, SYMPTOMS, FACTS, DIAGNOSES } from "./rules";

const isSymptom = (id) => id.startsWith("G");

// CF gabungan dua rule yang menyimpulkan hal yang sama (gaya MYCIN)
export const combineCF = (cfOld, cfNew) => cfOld + cfNew * (1 - cfOld);

export const labelOf = (id) =>
  FACTS[id] || DIAGNOSES[id]?.name || SYMPTOMS[id]?.yn || id;

/** Semua gejala yang bisa ditanyakan untuk satu jenis masalah. */
export function symptomsOf(problem) {
  const seen = new Set();
  const visit = (concl) => {
    RULES.filter((r) => r.then === concl).forEach((r) =>
      r.if.forEach((p) => {
        if (isSymptom(p)) seen.add(p);
        else visit(p);
      })
    );
  };
  problem.goals.forEach(visit);
  return [...seen];
}

/**
 * Jalankan backward chaining untuk satu jenis masalah.
 * Return:
 *   { status: "ask", symptom: "G5" }
 *   { status: "done", results: [...], asked, total }
 */
export function infer(problem, answers) {
  const memo = {}; // fakta/diagnosis yang sudah dibuktikan: id -> { cf, fired }

  class NeedAnswer {
    constructor(symptom) {
      this.symptom = symptom;
    }
  }

  // Evaluasi satu rule. Return null kalau gugur, atau { cf, premises }.
  const evalRule = (rule) => {
    let min = 1;
    const premises = [];
    for (const p of rule.if) {
      let cf;
      if (isSymptom(p)) {
        const a = answers[p];
        if (!a) throw new NeedAnswer(p); // belum diketahui -> tanya user
        if (!a.yes) return null; // ditolak -> rule gugur
        cf = a.cf;
        premises.push({ id: p, cf, label: a.label });
      } else {
        cf = prove(p).cf; // sub-goal
        if (cf <= 0) return null; // fakta antara tidak terbukti -> gugur
        premises.push({ id: p, cf });
      }
      min = Math.min(min, cf);
    }
    return { cf: rule.cf * min, premises };
  };

  // Buktikan satu kesimpulan: gabungkan CF semua rule yang berhasil.
  const prove = (concl) => {
    if (memo[concl]) return memo[concl];
    let cf = 0;
    const fired = [];
    for (const rule of RULES.filter((r) => r.then === concl)) {
      const r = evalRule(rule);
      if (!r) continue;
      cf = combineCF(cf, r.cf);
      fired.push({ rule, cf: r.cf, premises: r.premises });
    }
    memo[concl] = { cf, fired };
    return memo[concl];
  };

  try {
    problem.goals.forEach(prove);
  } catch (e) {
    if (e instanceof NeedAnswer) return { status: "ask", symptom: e.symptom };
    throw e;
  }

  // Susun jejak rule (sub-goal lebih dulu) untuk tiap diagnosis
  const traceOf = (id, seen = new Set(), out = []) => {
    (memo[id]?.fired || []).forEach((f) => {
      f.premises.filter((p) => !isSymptom(p.id)).forEach((p) => traceOf(p.id, seen, out));
      if (!seen.has(f.rule.id)) {
        seen.add(f.rule.id);
        out.push({
          id: f.rule.id,
          then: f.rule.then,
          thenLabel: labelOf(f.rule.then),
          cf: f.cf,
          premises: f.premises.map((p) => ({ ...p, text: labelOf(p.id) })),
        });
      }
    });
    return out;
  };

  const results = problem.goals
    .map((id) => ({
      id,
      name: DIAGNOSES[id].name,
      solutions: DIAGNOSES[id].solutions,
      cf: memo[id].cf,
      trace: traceOf(id),
    }))
    .sort((a, b) => b.cf - a.cf);

  const all = symptomsOf(problem);
  const asked = all.filter((g) => answers[g]).length;
  return { status: "done", results, asked, total: all.length };
}
