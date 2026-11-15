import { render, screen, fireEvent, act } from "@testing-library/react";
import Diagnose from "./components/Diagnose";

const tick = async (ms = 2500) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const click = async (name) => { fireEvent.click(screen.getByRole("button", { name })); await tick(); };

beforeEach(() => { jest.useFakeTimers(); window.scrollTo = () => {}; Element.prototype.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {}; });
afterEach(() => jest.useRealTimers());

async function toChat() {
  render(<Diagnose user={{ name: "Budi X" }} onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Laptop/ }));
  fireEvent.click(screen.getByRole("button", { name: /Mulai chat/ }));
  fireEvent.click(screen.getByRole("button", { name: /OK, mulai chat/ }));
  await tick();
}

test("Overheating: Ya -> tingkat -> hasil dengan CF 54%", async () => {
  await toChat();
  await click(/Overheating/);
  // G1 Ya, Tinggi(0.8)
  await click(/^Ya$/);
  fireEvent.click(screen.getByLabelText(/^Tinggi/)); await click(/Kirim/);
  // G5 Ya, Panas(0.8)
  await click(/^Ya$/);
  fireEvent.click(screen.getByLabelText(/^Panas/)); await click(/Kirim/);
  // G02 Ya, Cukup keras (0.6)
  await click(/^Ya$/);
  fireEvent.click(screen.getByLabelText(/^Cukup keras/)); await click(/Kirim/);
  // G07 Ya, tersumbat (1)
  await click(/^Ya$/);
  fireEvent.click(screen.getByLabelText(/^Tersumbat/)); await click(/Kirim/);
  // sisanya Tidak
  for (let i = 0; i < 5; i++) {
    if (!screen.queryByRole("button", { name: /^Tidak$/ })) break;
    await click(/^Tidak$/);
  }
  await tick(3000);
  expect(screen.getAllByText(/54%/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Rekomendasi Perbaikan: Debu/)).toBeTruthy();
});

test("Overheating: G1 Tidak -> hanya 1 pertanyaan lalu tidak ada yang cocok", async () => {
  await toChat();
  await click(/Overheating/);
  await click(/^Tidak$/);
  await tick(3000);
  expect(screen.getByText(/Kamu hanya ditanya 1 dari 9 gejala/)).toBeTruthy();
  expect(screen.getByText(/Ya, cek lagi/)).toBeTruthy();
});

test("Gejala bersama: G1 dijawab di Overheating tidak ditanya lagi di Graphic Glitch", async () => {
  await toChat();
  await click(/Overheating/);
  await click(/^Ya$/); // G1
  fireEvent.click(screen.getByLabelText(/^Tinggi/)); await click(/Kirim/);
  for (let i = 0; i < 9; i++) {
    if (!screen.queryByRole("button", { name: /^Tidak$/ })) break;
    await click(/^Tidak$/);
  }
  await tick(3000);
  await click(/Ya, cek lagi/);
  await click(/Graphic Glitch/);
  expect(screen.getAllByText(/sudah tersimpan/).length).toBeGreaterThan(0);
  // pertanyaan pertama Graphic Glitch adalah G17 (artefak), bukan suhu
  expect(screen.getByText(/titik, garis, atau kotak warna aneh/)).toBeTruthy();
  expect(screen.queryByText(/suhu CPU atau GPU terasa/)).toBeTruthy(); // hanya riwayat chat sebelumnya
});
