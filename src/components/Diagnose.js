import { useState, useEffect, useRef } from "react";
import {
  CpuIcon,
  ThermometerHotIcon,
  MonitorIcon,
  FileXIcon,
  PaperPlaneRightIcon,
  ArrowCounterClockwiseIcon,
  HouseIcon,
  WrenchIcon,
  CameraIcon,
  UploadSimpleIcon,
  XIcon,
  ArrowDownIcon,
  LaptopIcon,
  DesktopTowerIcon,
  ArrowRightIcon,
  CheckIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { img } from "../Assets";
import { PROBLEMS, SYMPTOMS, DIAGNOSES, verdict } from "../data/rules";
import { infer, symptomsOf } from "../data/engine";
import "./Diagnose.css";

const THRESHOLD = 40; // batas persentase diagnosis dianggap terbukti

const VISUAL = {
  overheating: { image: img.overheating, Icon: ThermometerHotIcon },
  bluescreen: { image: img.blueScreen, Icon: MonitorIcon },
  glitch: { image: img.glitch, Icon: CpuIcon },
  corrupted: { image: img.corrupted, Icon: FileXIcon },
};

const EMPTY_SPEC = {
  type: "",
  model: "",
  cpu: "",
  gpu: "",
  ram: "",
  storage: "",
  os: "",
};

/* ---------- Form spek (sebelum chat, tidak mempengaruhi perhitungan) ---------- */
function SpecForm({ spec, setSpec, onDone, onExit }) {
  const [error, setError] = useState("");

  const change = (e) => {
    setSpec({ ...spec, [e.target.name]: e.target.value });
    setError("");
  };

  const submit = (e) => {
    e.preventDefault();
    if (!spec.type) return setError("Pilih dulu jenis perangkatmu.");
    onDone();
  };

  return (
    <form className="spec-card" onSubmit={submit} noValidate>
      <div className="spec-head">
        <span className="bot-avatar">
          <CpuIcon size={20} color="#fafafa" weight="fill" />
        </span>
        <div>
          <h2>Spek perangkatmu</h2>
          <p>Isi sebisanya saja. Data ini hanya sebagai catatan dan tidak mempengaruhi hasil diagnosa.</p>
        </div>
      </div>

      <p className="spec-label">Jenis perangkat</p>
      <div className="type-row">
        <button
          type="button"
          className={spec.type === "Laptop" ? "type-btn on" : "type-btn"}
          onClick={() => {
            setSpec({ ...spec, type: "Laptop" });
            setError("");
          }}
        >
          <LaptopIcon size={26} weight="duotone" /> Laptop
        </button>
        <button
          type="button"
          className={spec.type === "PC Desktop" ? "type-btn on" : "type-btn"}
          onClick={() => {
            setSpec({ ...spec, type: "PC Desktop" });
            setError("");
          }}
        >
          <DesktopTowerIcon size={26} weight="duotone" /> PC Desktop
        </button>
      </div>

      <div className="spec-grid">
        <label className="spec-field">
          <span>Merek / model</span>
          <input name="model" value={spec.model} onChange={change} placeholder="Contoh: ASUS VivoBook 14" />
        </label>
        <label className="spec-field">
          <span>Prosesor (CPU)</span>
          <input name="cpu" value={spec.cpu} onChange={change} placeholder="Contoh: Intel Core i5-1135G7" />
        </label>
        <label className="spec-field">
          <span>Kartu grafis (GPU)</span>
          <input name="gpu" value={spec.gpu} onChange={change} placeholder="Contoh: NVIDIA GTX 1650 / bawaan" />
        </label>
        <label className="spec-field">
          <span>RAM</span>
          <select name="ram" value={spec.ram} onChange={change}>
            <option value="">Pilih</option>
            <option>4 GB</option>
            <option>8 GB</option>
            <option>16 GB</option>
            <option>32 GB</option>
            <option>64 GB atau lebih</option>
            <option>Tidak tahu</option>
          </select>
        </label>
        <label className="spec-field">
          <span>Penyimpanan</span>
          <select name="storage" value={spec.storage} onChange={change}>
            <option value="">Pilih</option>
            <option>SSD</option>
            <option>HDD</option>
            <option>SSD + HDD</option>
            <option>Tidak tahu</option>
          </select>
        </label>
        <label className="spec-field">
          <span>Sistem operasi</span>
          <select name="os" value={spec.os} onChange={change}>
            <option value="">Pilih</option>
            <option>Windows 11</option>
            <option>Windows 10</option>
            <option>Windows lainnya</option>
            <option>Linux</option>
            <option>macOS</option>
            <option>Tidak tahu</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="spec-actions">
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          Kembali
        </button>
        <button type="submit" className="btn btn-dark">
          Mulai chat <ArrowRightIcon size={16} weight="bold" />
        </button>
      </div>
    </form>
  );
}

/* ---------- Screenshot & deskripsi tambahan (sebelum chat, semua opsional) ---------- */
function ExtraForm({ note, setNote, shot, setShot, onDone, onBack }) {
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (shot) URL.revokeObjectURL(shot.url);
    setShot({ url: URL.createObjectURL(f), name: f.name });
  };

  const removeShot = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
  };

  return (
    <div className="spec-card">
      <div className="spec-head">
        <span className="bot-avatar">
          <CameraIcon size={20} color="#fafafa" weight="fill" />
        </span>
        <div>
          <h2>Screenshot &amp; deskripsi tambahan</h2>
          <p>Boleh dikosongkan. Kalau tidak ada, langsung tekan OK untuk mulai chat.</p>
        </div>
      </div>

      <p className="spec-label">
        Screenshot masalah <span className="opt-tag">Opsional</span>
      </p>
      <div className="shot-row">
        {shot ? (
          <div className="shot">
            <img src={shot.url} alt="Screenshot masalah" />
            <span>{shot.name}</span>
            <button
              type="button"
              className="shot-x"
              aria-label="Hapus screenshot"
              onClick={removeShot}
            >
              <XIcon size={14} weight="bold" />
            </button>
          </div>
        ) : (
          <label className="upload">
            <UploadSimpleIcon size={18} />
            Upload screenshot masalah
            <input type="file" accept="image/*" onChange={onFile} hidden />
          </label>
        )}
      </div>

      <p className="spec-label">
        Deskripsi tambahan <span className="opt-tag">Opsional</span>
      </p>
      <textarea
        className="note"
        rows={4}
        placeholder="Contoh: PC mulai panas sejak ganti casing, kipas berisik terutama saat main game..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="spec-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Kembali
        </button>
        <button type="button" className="btn btn-dark" onClick={onDone}>
          OK, mulai chat <ArrowRightIcon size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Bubble hasil: daftar diagnosis + CF + jejak rule ---------- */
function ResultCard({ problem, run }) {
  const found = run.results.filter((r) => r.cf > 0);
  const top = found[0];
  const topPct = top ? Math.round(top.cf * 100) : 0;
  const matched = top && topPct >= THRESHOLD;
  const skipped = run.total - run.asked;
  const reused = run.reused || [];
  const newlyAsked = run.asked - reused.length;

  return (
    <div className="msg bot">
      <div className="bubble result">
        <p className="result-intro">
          Semua jalur untuk <b>{problem.name}</b> sudah diuji. Berikut hasilnya:
        </p>

        {found.length === 0 ? (
          <p className="result-line">
            Tidak ada satu pun diagnosis yang terbukti dari jawabanmu, jadi
            kemungkinan PC-mu tidak mengalami <b>{problem.name}</b>.
          </p>
        ) : (
          <>
            {found.map((r) => {
              const pct = Math.round(r.cf * 100);
              const v = verdict(r.cf);
              return (
                <div className="diag-row" key={r.id}>
                  <div className="diag-row-top">
                    <span className="diag-name">
                      {r.name}
                      {DIAGNOSES[r.id]?.suspected && <small> (dugaan)</small>}
                    </span>
                    <span className={`diag-pct ${v.tone}`}>
                      {pct}% · {v.label}
                    </span>
                  </div>
                  <div className="bar">
                    <div className={`bar-fill ${v.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            <p className="result-line">
              {matched ? (
                <>
                  Diagnosis yang paling mungkin adalah <b>{top.name}</b> dengan skor
                  confidence <b>{topPct}%</b>
                  {DIAGNOSES[top.id]?.suspected && " (masih berupa dugaan, bukan kepastian kerusakan)"}.
                </>
              ) : (
                <>
                  Skor tertinggi hanya <b>{topPct}%</b> ({top.name}), jadi belum ada
                  diagnosis yang cukup kuat.
                </>
              )}
            </p>
          </>
        )}

        {skipped > 0 && (
          <p className="result-note">
            Kamu hanya ditanya {newlyAsked} dari {run.total} gejala. Sisanya gugur
            otomatis karena premisnya sudah ditolak.
          </p>
        )}

        {reused.length > 0 && (
          <p className="result-note">
            Jawaban tersimpan untuk {reused.join(", ")} dipakai ulang dari
            pemeriksaan sebelumnya (tidak ditanya lagi).
          </p>
        )}

        {found.length > 0 && (
          <details className="trace">
            <summary>Lihat jejak rule yang dilalui</summary>
            {found.map((r) => (
              <div className="trace-block" key={r.id}>
                <b>{r.name}</b>
                <ul>
                  {r.trace.map((t) => (
                    <li key={t.id}>
                      <span className="trace-id">{t.id}</span>
                      <span className="trace-body">
                        <span className="trace-if">
                          {t.premises.map((p, i) => (
                            <span key={p.id}>
                              {i > 0 && " DAN "}
                              {p.id}
                              {p.label ? ` (${p.label})` : ""}
                            </span>
                          ))}
                        </span>
                        <span className="trace-then">
                          maka {t.then} {t.thenLabel} · CF {t.cf.toFixed(2)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        )}

        {matched && (
          <p className="result-hint">
            <ArrowDownIcon size={14} weight="bold" /> Rekomendasi perbaikan ada di bawah
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Halaman utama ---------- */
function Diagnose({ user, onExit }) {
  const firstName = user?.name?.split(" ")[0] || "kamu";

  const [spec, setSpec] = useState(EMPTY_SPEC);
  const [specDone, setSpecDone] = useState(false);
  const [extraDone, setExtraDone] = useState(false);

  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState("pick"); // pick | ask | result | low
  const [problem, setProblem] = useState(null);
  const [answers, setAnswers] = useState({}); // working memory: { G1: { yes, cf, label } }, dibagi lintas kategori
  const [step, setStep] = useState(null); // { symptom: "G5", stage: "yn" | "level" }
  const [asked, setAsked] = useState(0); // jumlah gejala yang sudah ditanya (untuk penomoran)
  const [selected, setSelected] = useState(null);
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState(null); // { problem, matched } hanya kalau ada diagnosis cocok

  // screenshot & deskripsi tambahan (diisi sebelum chat)
  const [note, setNote] = useState("");
  const [shot, setShot] = useState(null); // { url, name }

  const idRef = useRef(1);
  const timers = useRef([]);
  const bodyRef = useRef(null);
  const afterRef = useRef(null);
  const reusedRef = useRef([]); // gejala dari kategori sebelumnya yang dipakai ulang

  const later = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const add = (...items) => {
    const withIds = items.map((it) => ({ id: idRef.current++, ...it }));
    setMessages((m) => [...m, ...withIds]);
  };

  // chat selalu scroll ke bawah
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, step, phase]);

  // setelah hasil cocok keluar, halaman scroll ke bagian di bawah chat
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      afterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 1800);
    return () => clearTimeout(t);
  }, [result]);

  /* 0. spek selesai diisi -> mulai chat */
  const startChat = () => {
    const parts = [spec.type, spec.model].filter(Boolean).join(" ");
    const extras = [shot && "screenshot", note.trim() && "deskripsi tambahan"].filter(Boolean);
    setExtraDone(true);
    window.scrollTo({ top: 0 });
    add(
      { from: "bot", text: `Hai ${firstName}! Aku sudah catat perangkatmu: ${parts}.` },
      ...(extras.length
        ? [{ from: "bot", text: `${extras.join(" dan ")} darimu juga sudah kucatat.` }]
        : []),
      { from: "bot", text: "Sekarang, masalah apa yang mau kita telusuri di PC-mu?" }
    );
  };

  /* Jalankan mesin inferensi dengan working memory terbaru, lalu
     tanya gejala berikutnya atau tampilkan hasil. */
  const advance = (p, nextAnswers, askedCount) => {
    const out = infer(p, nextAnswers);

    if (out.status === "ask") {
      later(() => {
        setStep({ symptom: out.symptom, stage: "yn" });
        setTyping(false);
      }, 600);
      return;
    }

    // semua goal sudah dibuktikan atau gugur -> hasil
    later(() => {
      add({ from: "bot", type: "result", problem: p, run: { ...out, reused: reusedRef.current } });
      const matched = out.results.filter((r) => Math.round(r.cf * 100) >= THRESHOLD);
      setStep(null);

      if (matched.length > 0) {
        setResult({ problem: p, matched });
        setPhase("result");
        setTyping(false);
      } else {
        setPhase("low");
        later(() => {
          add({
            from: "bot",
            text: `Sepertinya tidak ada yang cocok dengan gejalamu untuk "${p.name}". Apakah mau cek masalah lain?`,
          });
          setTyping(false);
        }, 900);
      }
    }, 1100);
  };

  /* 1. user memilih jenis masalah -> menentukan kumpulan goal */
  const pickProblem = (p) => {
    add({ from: "user", text: p.name });
    setTyping(true);
    // Working memory dipertahankan antar kategori: gejala yang sama (mis. G1, G4)
    // cukup ditanyakan satu kali dan jawabannya dipakai ulang.
    const reused = symptomsOf(p).filter((g) => answers[g]);
    reusedRef.current = reused;
    later(() => {
      add({
        from: "bot",
        text: `Oke, kita telusuri "${p.name}". Aku tanya satu per satu, dan pertanyaannya akan makin mengerucut sesuai jawabanmu.`,
      });
      if (reused.length > 0) {
        add({
          from: "bot",
          text: `Jawabanmu untuk ${reused.join(", ")} sudah tersimpan dari pemeriksaan sebelumnya, jadi tidak kutanyakan lagi dan langsung kupakai.`,
        });
      }
      setProblem(p);
      setAsked(0);
      setSelected(null);
      setStep(null);
      setPhase("ask");
      advance(p, answers, 0);
    }, 800);
  };

  /* 2a. gerbang Ya/Tidak untuk gejala yang sedang ditanya */
  const answerYN = (yes) => {
    if (!step || !problem) return;
    const g = step.symptom;
    add({ from: "bot", text: SYMPTOMS[g].yn }, { from: "user", text: yes ? "Ya" : "Tidak" });

    if (yes) {
      // lanjut ke pilihan tingkat gejala
      setSelected(null);
      setStep({ symptom: g, stage: "level" });
      return;
    }

    // Tidak -> premis gagal, rule dan cabang yang bergantung padanya gugur
    const nextAnswers = { ...answers, [g]: { yes: false } };
    setAnswers(nextAnswers);
    setAsked(asked + 1);
    setStep(null);
    setTyping(true);
    advance(problem, nextAnswers, asked + 1);
  };

  /* 2b. user memilih tingkat gejala -> jadi CF_user */
  const sendLevel = () => {
    if (selected === null || !step || !problem) return;
    const g = step.symptom;
    const option = SYMPTOMS[g].options[selected];

    add({ from: "bot", text: SYMPTOMS[g].level }, { from: "user", text: option.label });
    const nextAnswers = { ...answers, [g]: { yes: true, cf: option.value, label: option.label } };
    setAnswers(nextAnswers);
    setAsked(asked + 1);
    setSelected(null);
    setStep(null);
    setTyping(true);
    advance(problem, nextAnswers, asked + 1);
  };

  /* 3. cek masalah lain */
  const another = () => {
    add({ from: "user", text: "Cek masalah lain" });
    setPhase("pick");
    setResult(null);
    setTyping(true);
    later(() => {
      add({ from: "bot", text: "Siap! Masalah apa yang mau ditelusuri berikutnya?" });
      setProblem(null);
      setStep(null);
      setAsked(0);
      setTyping(false);
    }, 700);
  };

  const showPick = !typing && phase === "pick";
  const showYN = !typing && phase === "ask" && step?.stage === "yn";
  const showLevel = !typing && phase === "ask" && step?.stage === "level";
  const showEnd = !typing && phase === "result";
  const showLow = !typing && phase === "low";

  // ringkasan spek singkat untuk header chat
  const specSummary = [spec.type, spec.cpu].filter(Boolean).join(" · ");

  /* ---------- Tahap 1: form spek ---------- */
  if (!specDone) {
    return (
      <section className="diag">
        <div className="diag-shell">
          <SpecForm
            spec={spec}
            setSpec={setSpec}
            onDone={() => {
              setSpecDone(true);
              window.scrollTo({ top: 0 });
            }}
            onExit={onExit}
          />
        </div>
      </section>
    );
  }

  /* ---------- Tahap 2: screenshot & deskripsi tambahan (opsional) ---------- */
  if (!extraDone) {
    return (
      <section className="diag">
        <div className="diag-shell">
          <ExtraForm
            note={note}
            setNote={setNote}
            shot={shot}
            setShot={setShot}
            onDone={startChat}
            onBack={() => setSpecDone(false)}
          />
        </div>
      </section>
    );
  }

  /* ---------- Tahap 3: chat ---------- */
  return (
    <section className="diag">
      <div className="diag-shell">
        <div className="chat">
          <div className="chat-head">
            <span className="bot-avatar">
              <CpuIcon size={20} color="#fafafa" weight="fill" />
            </span>
            <div>
              <strong>Asisten crash-out</strong>
              <small>{specSummary || "Diagnosa dengan Backward Chaining & Certainty Factor"}</small>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onExit}>
              <HouseIcon size={14} weight="bold" /> Beranda
            </button>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {messages.map((m) =>
              m.type === "result" ? (
                <ResultCard key={m.id} problem={m.problem} run={m.run} />
              ) : (
                <div key={m.id} className={`msg ${m.from}`}>
                  <div className="bubble">{m.text}</div>
                </div>
              )
            )}

            {typing && (
              <div className="msg bot">
                <div className="bubble typing">
                  <span /> <span /> <span />
                </div>
              </div>
            )}

            {/* pilih jenis masalah (menentukan kumpulan goal) */}
            {showPick && (
              <div className="msg bot">
                <div className="bubble prompt wide">
                  <p className="prompt-q">Pilih masalah yang mau ditelusuri</p>
                  <div className="hypo-grid">
                    {PROBLEMS.map((p) => {
                      const { image, Icon } = VISUAL[p.id];
                      return (
                        <button key={p.id} className="hypo-card" onClick={() => pickProblem(p)}>
                          <img src={image} alt={p.name} />
                          <div>
                            <b>
                              <Icon size={16} weight="fill" /> {p.name}
                            </b>
                            <small>{p.desc}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* fase 1: gerbang Ya/Tidak */}
            {showYN && (
              <div className="msg bot">
                <div className="bubble prompt">
                  <span className="q-tag">Gejala ke-{asked + 1}</span>
                  <p className="prompt-q">{SYMPTOMS[step.symptom].yn}</p>
                  <div className="yn-row">
                    <button className="btn btn-dark btn-sm yn-btn" onClick={() => answerYN(true)}>
                      <CheckIcon size={14} weight="bold" /> Ya
                    </button>
                    <button className="btn btn-ghost btn-sm yn-btn" onClick={() => answerYN(false)}>
                      <XCircleIcon size={14} weight="bold" /> Tidak
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* fase 2: tingkat gejala (jadi CF user) */}
            {showLevel && (
              <div className="msg bot">
                <div className="bubble prompt">
                  <span className="q-tag">Gejala ke-{asked + 1}</span>
                  <p className="prompt-q">{SYMPTOMS[step.symptom].level}</p>
                  <div className="options">
                    {SYMPTOMS[step.symptom].options.map((o, i) => (
                      <label key={`${step.symptom}-${o.label}`} className={selected === i ? "opt on" : "opt"}>
                        <input
                          type="radio"
                          name={`q-${step.symptom}`}
                          checked={selected === i}
                          onChange={() => setSelected(i)}
                        />
                        <span className="dot" />
                        <span className="opt-label">
                          {o.label}
                          {o.hint && <small>{o.hint}</small>}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn btn-dark btn-sm send"
                    disabled={selected === null}
                    onClick={sendLevel}
                  >
                    Kirim <PaperPlaneRightIcon size={14} weight="fill" />
                  </button>
                </div>
              </div>
            )}

            {/* ada diagnosis cocok */}
            {showEnd && (
              <div className="end-actions">
                <button className="btn btn-dark btn-sm" onClick={another}>
                  <ArrowCounterClockwiseIcon size={14} weight="bold" /> Cek masalah lain
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onExit}>
                  Kembali ke beranda
                </button>
              </div>
            )}

            {/* tidak ada yang cocok -> tanya mau cek lagi */}
            {showLow && (
              <div className="end-actions">
                <button className="btn btn-dark btn-sm" onClick={another}>
                  <ArrowCounterClockwiseIcon size={14} weight="bold" /> Ya, cek lagi
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onExit}>
                  Tidak, kembali ke beranda
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Di bawah chat: rekomendasi per diagnosis yang terbukti ---------- */}
      {result && (
        <div className="diag-after" ref={afterRef}>
          {result.matched.map((d, idx) => (
            <div className="after-card" key={d.id} style={{ "--d": `${idx * 120}ms` }}>
              <div className="after-head">
                <span className="after-icon">
                  <WrenchIcon size={20} weight="fill" />
                </span>
                <div>
                  <h3>
                    Rekomendasi Perbaikan: {d.name}
                  </h3>
                  <p>Keyakinan {Math.round(d.cf * 100)}% · {verdict(d.cf).label}</p>
                </div>
              </div>

              <ol className="steps">
                {d.solutions.map((s, i) => (
                  <li key={i}>
                    <span className="step-no">{i + 1}</span>
                    <p>{s}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Diagnose;
