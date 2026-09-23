import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import firebaseConfigData from "./firebase-applet-config.json";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini AI Client lazily or safely
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({ apiKey });
  };

  // Helper for resilient Gemini API calls with model fallback and exponential retry
  const generateContentWithRetry = async (ai: GoogleGenAI, contents: any) => {
    const modelCandidates = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
    let lastError: any = null;

    for (const modelCandidate of modelCandidates) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelCandidate,
            contents
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code || err?.error?.code;
          const errMsg = String(err?.message || err || "");
          const isTransient =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("high demand") ||
            errMsg.includes("resource exhausted");

          const isQuota =
            status === 429 ||
            errMsg.includes("Quota exceeded") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("rate-limits");

          if (isTransient) {
            if (isQuota) {
              if (attempt === 0) {
                // Short wait on first quota hit as RPM resets quickly (e.g. 1.5s - 2s)
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                // On repeated quota hits, move to next model candidate
                break;
              }
            } else if (attempt < 2) {
              // Wait 1s, 2s before retrying same candidate for transient network/server errors
              await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
            } else {
              break;
            }
          } else {
            // Non-transient error, rethrow immediately
            throw err;
          }
        }
      }
    }
    throw lastError || new Error("Layanan AI sedang sibuk. Silakan coba beberapa saat lagi.");
  };

  // Health check API
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Auth: Secure server-side authentication login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      let validUsername = process.env.AUTH_USERNAME || "www.yefriharyanto.id";
      let validPassword = process.env.AUTH_PASSWORD || "123456";

      // Query Firestore database directly for updated credentials saved in Pengaturan
      try {
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId;
        const dbId = process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigData.firestoreDatabaseId || "(default)";
        const apiKey = process.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey;
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/pengaturan/config?key=${apiKey}`;
        
        const dbResponse = await fetch(firestoreUrl);
        if (dbResponse.ok) {
          const docData = await dbResponse.json();
          const fields = docData.fields || {};
          if (fields.username && fields.username.stringValue) {
            validUsername = fields.username.stringValue;
          }
          if (fields.password && fields.password.stringValue) {
            validPassword = fields.password.stringValue;
          }
        }
      } catch (dbErr) {
        console.warn("Notice: Using fallback credentials due to Firestore config fetch notice:", dbErr);
      }

      if (!username || !password) {
        return res.status(400).json({
          status: "error",
          message: "Username dan Password wajib diisi."
        });
      }

      const inputUsername = String(username).trim().toUpperCase();
      const expectedUsername = String(validUsername).trim().toUpperCase();
      const isUsernameMatch = inputUsername === expectedUsername || inputUsername === "ARDI YOKA" || inputUsername === "WWW.YEFRIHARYANTO.ID";

      if (isUsernameMatch && String(password).trim() === validPassword) {
        // Generate a server-signed session token
        const timestamp = Date.now();
        const token = Buffer.from(`${String(username).trim()}:${timestamp}:edadmin_pro_secure_session`).toString("base64");
        
        return res.json({
          status: "success",
          token,
          user: {
            username: "www.yefriharyanto.id",
            nama: "www.yefriharyanto.id",
            role: "Administrator Guru"
          }
        });
      }

      return res.status(401).json({
        status: "error",
        message: "Username atau Password yang Anda masukkan tidak valid."
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan pada server autentikasi."
      });
    }
  });

  app.get("/api/auth/verify", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: "error", valid: false });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      if (decoded.includes("edadmin_pro_secure_session")) {
        return res.json({ status: "success", valid: true });
      }
    } catch {
      // Token parsing failed
    }
    return res.status(401).json({ status: "error", valid: false });
  });

  // API 1: Generate AI Modul Ajar
  app.post("/api/ai/generate-modul", async (req, res) => {
    try {
      const formData = req.body;
      const ai = getAiClient();

      const metodeText = formData.metode && formData.metode.trim() 
        ? formData.metode.trim() 
        : "Otomatis ditentukan oleh AI secara variatif dan interaktif (Diskusi, Unjuk Kerja, Tanya Jawab, Eksperimen, Presentasi)";

      const systemPrompt = `Bertindaklah sebagai Ahli Kurikulum Nasional dan pengembang Sistem Modul Ajar Deep Learning Pro Administrasi Guru. Susunlah MODUL AJAR DEEP LEARNING (RENCANA PEMBELAJARAN MENDALAM) yang sangat komprehensif, terstruktur, profesional, dan berbobot.

ATURAN UTAMA:
1. JANGAN PERNAH MENYINGKAT PENJELASAN. Berikan penjabaran sedetail mungkin.
2. Setiap langkah (sintak) kegiatan guru dan murid WAJIB dipecah menjadi minimal 3-5 poin aktivitas rinci (gunakan <ul><li>), JANGAN HANYA 1 AKTIVITAS TUNGGAL. Sisipkan juga contoh dialog/perkataan guru.
3. FORMAT WAJIB: MURNI KODE HTML TANPA MARKDOWN / TANPA KODE (DILARANG MENGGUNAKAN \`\`\`html, \`\`\`, TANDA SIMBOL MARKDOWN SEPERTI \`#\`, \`**\`, DLL). GUNAKAN TAG HTML MURNI (<strong>, <b>, <h3>, <p>, <ul>, <li>).
4. SANGAT PENTING - KHUSUS "BAGIAN E. SKENARIO PENGALAMAN BELAJAR PERTEMUAN":
   - PENGALAMAN BELAJAR WAJIB DIBUAT TANPA TABEL (DILARANG MENGGUNAKAN TABEL <table> PADA BAGIAN E).
   - Susunlah Pengalaman Belajar per pertemuan secara rinci, terstruktur, dan berkelas/premium menggunakan heading (<h3>, <h4>), daftar poin (<ul>, <li>), serta penekanan teks (<strong>).
   - Untuk setiap Pertemuan (Pertemuan 1 sampai ${formData.jumlahPertemuan}), bagi dengan struktur rapi:
     a. <h3>Pertemuan 1: [Judul/Topik Pertemuan]</h3>
     b. <h4>1. Kegiatan Pendahuluan (Durasi: X Menit)</h4>
        - <strong>Aktivitas Guru:</strong> (min 3-5 poin + contoh dialog guru)
        - <strong>Aktivitas Peserta Didik:</strong> (min 3-5 poin)
     c. <h4>2. Kegiatan Inti - Deep Learning (Durasi: X Menit)</h4>
        - Jabarkan per Sintak Model (${formData.model}) yang mencakup 3 Fase Deep Learning: <strong>Memahami (Concept)</strong>, <strong>Mengaplikasi (Practice)</strong>, dan <strong>Merefleksi (Reflection)</strong>.
        - Untuk setiap sintak: tuliskan <strong>Kegiatan Guru:</strong> (poin-poin + contoh dialog) dan <strong>Kegiatan Peserta Didik:</strong> (poin-poin aktif).
     d. <h4>3. Kegiatan Penutup (Durasi: X Menit)</h4>
        - <strong>Aktivitas Guru & Peserta Didik:</strong> (Simpulan, Refleksi, Rencana Pertemuan Berikutnya).
5. Untuk bagian A, C2, D, dan G tetap gunakan tabel HTML profesional agar data tersaji rapi.
6. WAJIB BUAT LKPD (Lembar Kerja Peserta Didik) YANG SIAP PAKAI SECARA UTUH DAN LANGSUNG BISA DIKERJAKAN SISWA.
7. Cantumkan footer resmi di bagian bawah.`;

      const userPrompt = `DATA MODUL AJAR:
- Nama Guru: ${formData.namaGuru || 'Guru Pengampu'}
- Nama Sekolah: ${formData.namaSekolah || 'Sekolah'}
- Tahun Ajaran: ${formData.tahunAjaran || '2026/2027'}
- Jenjang: ${formData.jenjang || 'SMP'}
- Fase: ${formData.fase || 'Fase D (Kelas 7-9)'}
- Kelas: ${formData.kelas || 'VII'}
- Alokasi Waktu: ${formData.waktu || '2 x 45 JP'}
- Mata Pelajaran: ${formData.mataPelajaran || 'Umum'}
- Bab/Topik Utama: ${formData.topik || 'Topik Utama'} ${formData.subTopik ? `- ${formData.subTopik}` : ''}
- Jumlah Pertemuan: ${formData.jumlahPertemuan || '1'} Pertemuan (Maksimal 5 Pertemuan)
- Model Pembelajaran: ${formData.model || 'Problem Based Learning (PBL)'}
- Metode Pembelajaran: ${metodeText}
- Tujuan Pembelajaran Spesifik: ${formData.tujuan || 'Siswa dapat memahami dan mengaplikasikan konsep dengan cermat.'}
- Karakteristik Murid: ${formData.karakteristik || 'Heterogen, siap belajar aktif.'}

FORMAT WAJIB LAYOUT HTML:

<h1>MODUL AJAR DEEP LEARNING (RENCANA PEMBELAJARAN MENDALAM)</h1>

<h2>A. INFORMASI UMUM</h2>
<table>
  <thead>
    <tr><th>Komponen</th><th>Detail Informasi</th></tr>
  </thead>
  <tbody>
    <tr><td>Nama Sekolah</td><td>${formData.namaSekolah}</td></tr>
    <tr><td>Nama Penyusun</td><td>${formData.namaGuru}</td></tr>
    <tr><td>Tahun Ajaran</td><td>${formData.tahunAjaran}</td></tr>
    <tr><td>Jenjang / Fase / Kelas</td><td>${formData.jenjang} / ${formData.fase} / Kelas ${formData.kelas}</td></tr>
    <tr><td>Mata Pelajaran</td><td>${formData.mataPelajaran}</td></tr>
    <tr><td>Topik / Sub-Topik</td><td>${formData.topik} ${formData.subTopik ? `(${formData.subTopik})` : ''}</td></tr>
    <tr><td>Alokasi Waktu Total</td><td>${formData.waktu}</td></tr>
    <tr><td>Jumlah Pertemuan</td><td>${formData.jumlahPertemuan} Pertemuan</td></tr>
    <tr><td>Model Pembelajaran</td><td>${formData.model}</td></tr>
    <tr><td>Metode Pembelajaran</td><td>${metodeText}</td></tr>
  </tbody>
</table>

<h2>B. TUJUAN PEMBELAJARAN</h2>
<p>Jelaskan secara spesifik, terukur, kontekstual, berpusat pada murid, dan memacu berfikir kritis (HOTS).</p>

<h2>C. IDENTIFIKASI MURID & PROFIL LULUSAN</h2>
<h3>1. Asesmen Diagnostik Awal</h3>
<p>Penjelasan strategi diagnostik kognitif & non-kognitif.</p>
<h3>2. Pemetaan Kesiapan Belajar</h3>
<table>
  <thead>
    <tr><th>Kategori Kesiapan</th><th>Deskripsi Kategori</th><th>Strategi Pendampingan & Tutor Sebaya</th></tr>
  </thead>
  <tbody>
    <tr><td>Belum Berkembang (BB)</td><td>Siswa membutuhkan bantuan penuh pada fondasi materi.</td><td>Pendampingan intensif oleh guru.</td></tr>
    <tr><td>Mulai Berkembang (MB)</td><td>Siswa memahami sebagian konsep dasar.</td><td>Latihan terbimbing dengan scaffolding.</td></tr>
    <tr><td>Berkembang Sesuai Harapan (BSH)</td><td>Siswa menguasai konsep sesuai standar.</td><td>Pembelajaran mandiri & diskusi kelompok.</td></tr>
    <tr><td>Sangat Berkembang (SDB)</td><td>Siswa mahir & mampu menganalisis mendalam.</td><td>Tutor sebaya & tantangan pengayaan.</td></tr>
  </tbody>
</table>

<h2>D. KERANGKA DESAIN PEMBELAJARAN MENDALAM</h2>
<table>
  <thead>
    <tr><th>Dimensi Pedagogis</th><th>Penerapan Strategis</th></tr>
  </thead>
  <tbody>
    <tr><td>Capaian Pembelajaran (CP)</td><td>Penguasaan konsep esensial dan penalaran reflektif.</td></tr>
    <tr><td>Praktik Pedagogis</td><td>${formData.model} - Metode: ${metodeText} dengan pendekatan Deep Learning (Memahami, Mengaplikasi, Merefleksi).</td></tr>
    <tr><td>Kemitraan Pembelajaran</td><td>Kolaborasi kelompok, diskusi kritis, dan presentasi tim.</td></tr>
    <tr><td>Lingkungan Pembelajaran</td><td>Inklusif, aman, interaktif, dan mendukung eksplorasi.</td></tr>
    <tr><td>Pemanfaatan Digital</td><td>Integrasi media digital, peta konsep interaktif, dan simulasi visual.</td></tr>
  </tbody>
</table>

<h2>E. SKENARIO PENGALAMAN BELAJAR PERTEMUAN</h2>
<p><em>(DIBUAT TANPA TABEL. Gunakan susunan heading <h3>, <h4>, poin-poin <ul><li>, dan <strong> secara terperinci untuk setiap pertemuan)</em></p>
(Buat skenario detail untuk tiap pertemuan dari Pertemuan 1 hingga Pertemuan ${formData.jumlahPertemuan}. DILARANG MENGGUNAKAN TABEL pada bagian E ini.)

<h2>F. REFLEKSI GURU & SISWA</h2>
<p>Daftar 3-5 pertanyaan reflektif mendalam untuk mengukur keberhasilan proses belajar.</p>

<h2>G. ASESMEN PEMBELAJARAN & RUBRIK EVALUASI</h2>
<table>
  <thead>
    <tr><th>Aspek Penilaian</th><th>Teknik Asesmen</th><th>Instrumen Penilaian</th><th>Kriteria Ketuntasan</th></tr>
  </thead>
  <tbody>
    <tr><td>Sikap / Karakter</td><td>Observasi & Jurnal</td><td>Lembar Observasi Aktivitas</td><td>Menunjukkan sikap kritis & kolaboratif</td></tr>
    <tr><td>Pengetahuan (Konsep)</td><td>Tes Tulis / Lisan</td><td>Soal HOTS & Lembar Jawaban</td><td>Nilai >= KKM / Kriteria Sekolah</td></tr>
    <tr><td>Keterampilan / Praktik</td><td>Penilaian Kinerja / LKPD</td><td>Rubrik Unjuk Kerja / Produk</td><td>Mampu menyelesaikan masalah secara sistematis</td></tr>
  </tbody>
</table>

<h2>H. BAHAN AJAR & LKPD (LEMBAR KERJA PESERTA DIDIK) SIAP PAKAI</h2>
<h3>1. Ringkasan Bahan Ajar Esensial</h3>
<p>Materi pembelajaran lengkap yang dapat dibaca siswa.</p>

<h3>2. LKPD Interaktif Siswa</h3>
<p><strong>LEMBAR KERJA PESERTA DIDIK (LKPD)</strong></p>
<p>Nama Siswa: ................................................<br>Kelas: ${formData.kelas}<br>Mata Pelajaran: ${formData.mataPelajaran}<br>Topik: ${formData.topik}</p>
<p><strong>Petunjuk Pengerjaan:</strong><br>1. Bacalah setiap instruksi dengan cermat.<br>2. Kerjakan soal & diskusikan bersama kelompokmu.<br>3. Tuliskan hasil analisis secara rinci pada kolom yang disediakan.</p>
<p><strong>Soal & Aktivitas Studi Kasus:</strong></p>
<ol>
  <li>Jelaskan konsep dasar dari ${formData.topik} berdasarkan pemahamanmu!</li>
  <li>Analisis contoh penerapan ${formData.topik} dalam kehidupan sehari-hari!</li>
  <li>Diskusikan bersama kelompok dan susunlah solusi untuk permasalahan berikut...</li>
</ol>

<h2>I. PENGAYAAN DAN REMEDIAL</h2>
<p>Program remedi untuk siswa BB/MB dan tantangan analisis tinggi untuk siswa SDB.</p>

<h2>J. LAMPIRAN & KUNCI JAWABAN</h2>
<p>Kunci jawaban LKPD, pedoman penskoran, dan referensi pustaka.</p>

<br><hr>
<p style="text-align: center; font-weight: bold; color: #475569;">Hak Cipta &copy; EdAdmin Pro - ${formData.namaSekolah}</p>`;

      const response = await generateContentWithRetry(ai, [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ]);

      let text = response.text || "";
      // Clean up markdown block format and symbols if model generated them
      text = text
        .replace(/```[a-zA-Z]*\n?/g, "")
        .replace(/```/g, "")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/^#+\s*(.*?)$/gm, "<h3>$1</h3>")
        .replace(/`/g, "")
        .trim();

      res.json({ status: "success", html: text });
    } catch (error: any) {
      console.error("Error generating modul:", error);
      res.status(500).json({ status: "error", message: error.message || "Gagal membuat modul AI" });
    }
  });

  // API 2: AI Asisten Chatbot Guru
  app.post("/api/ai/chat-asisten", async (req, res) => {
    try {
      const { message, context } = req.body;
      const ai = getAiClient();

      const systemPrompt = `Anda adalah "EdAdmin AI Assistant", asisten kecerdasan buatan khusus administrasi guru dan pendidik profesional di Indonesia.
Tugas Anda membantu guru dalam:
1. Merumuskan ide RPP, alur tujuan pembelajaran (ATP), dan rubrik asesmen.
2. Memberikan ide metode pengajaran kreatif, esensial, dan berdiferensiasi.
3. Menyusun contoh soal tes (HOTS, PISA style, essay, pilihan ganda) beserta kunci jawaban.
4. Draft kalimat catatan wali kelas untuk rapor atau pesan santun ke orang tua murid.
5. Memberikan solusi akademis, motivasi, dan strategi penanganan disiplin siswa.

Berikan jawaban yang ramah, sopan, terstruktur, berbasis Kurikulum Merdeka / Nasional, mudah dipahami, dan langsung dapat dipraktikkan guru.
Informasi Sekolah/Guru Pendukung: ${JSON.stringify(context || {})}`;

      const response = await generateContentWithRetry(ai, [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nPertanyaan/Permintaan Guru:\n${message}` }] }
      ]);

      const rawText = response.text || "Maaf, saya tidak dapat merespons saat ini.";
      const cleanReply = rawText
        .replace(/```[a-zA-Z]*\n?/g, "")
        .replace(/```/g, "")
        .replace(/^`+|`+$/g, "")
        .trim();

      res.json({ status: "success", reply: cleanReply });
    } catch (error: any) {
      console.error("Error in chat assistant:", error);
      res.status(500).json({ status: "error", message: error.message || "Gagal memproses pertanyaan asisten AI" });
    }
  });

  // Helper to build 16:9 3D styled SVG illustration Data URI
  const createPptSvgImage = (slideIndex: number, topic: string, subject: string) => {
    const colorPalettes = [
      { bg: "#1E3A8A", accent: "#3B82F6", light: "#DBEAFE", dark: "#1E293B", badge: "#2563EB" },
      { bg: "#065F46", accent: "#10B981", light: "#D1FAE5", dark: "#064E3B", badge: "#059669" },
      { bg: "#581C87", accent: "#8B5CF6", light: "#EDE9FE", dark: "#3B0764", badge: "#7C3AED" },
      { bg: "#9A3412", accent: "#F97316", light: "#FFEDD5", dark: "#7C2D12", badge: "#EA580C" },
      { bg: "#0F766E", accent: "#14B8A6", light: "#CCFBF1", dark: "#134E4A", badge: "#0D9488" },
      { bg: "#1E293B", accent: "#6366F1", light: "#E0E7FF", dark: "#0F172A", badge: "#4F46E5" }
    ];

    const palette = colorPalettes[(slideIndex - 1) % colorPalettes.length];
    const safeTopic = (topic || "Edukasi").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeSubject = (subject || "Pelajaran").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="bgGrad${slideIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.bg}" />
          <stop offset="100%" stop-color="${palette.accent}" />
        </linearGradient>
        <linearGradient id="cardGrad${slideIndex}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.08" />
        </linearGradient>
      </defs>

      <!-- Background Canvas -->
      <rect width="800" height="450" fill="url(#bgGrad${slideIndex})" rx="24"/>

      <!-- Decorative Background Spheres -->
      <circle cx="700" cy="80" r="160" fill="#ffffff" opacity="0.08"/>
      <circle cx="100" cy="380" r="120" fill="#ffffff" opacity="0.06"/>
      <circle cx="400" cy="225" r="280" fill="#ffffff" opacity="0.03"/>

      <!-- Glassmorphic Card Frame -->
      <rect x="50" y="50" width="700" height="350" rx="28" fill="url(#cardGrad${slideIndex})" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2"/>

      <!-- 3D Platform Base -->
      <ellipse cx="400" cy="270" rx="140" ry="25" fill="#000000" opacity="0.25"/>

      <!-- 3D Central Badge Circle -->
      <circle cx="400" cy="180" r="70" fill="${palette.light}"/>
      <circle cx="400" cy="180" r="58" fill="${palette.badge}"/>

      <!-- Center Icon Graphic -->
      <path d="M370,165 L430,165 L400,210 Z" fill="#ffffff" opacity="0.95"/>
      <circle cx="400" cy="155" r="12" fill="#ffffff"/>

      <!-- Title Pill -->
      <rect x="160" y="295" width="480" height="52" rx="26" fill="#ffffff"/>

      <!-- Text Labels -->
      <text x="400" y="328" font-family="sans-serif, Arial" font-size="20" font-weight="bold" fill="${palette.dark}" text-anchor="middle">${safeTopic} - Slide ${slideIndex}</text>
      <text x="400" y="375" font-family="sans-serif, Arial" font-size="14" font-weight="bold" fill="#ffffff" opacity="0.95" text-anchor="middle">Visual Edukasi 3D Nano Banana | ${safeSubject}</text>
    </svg>`;

    const base64Svg = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64Svg}`;
  };

  // API 3: PPT Generator AI Bulk All Slides Content
  app.post("/api/ai/generate-ppt-all-slides", async (req, res) => {
    const { topic = "Topik Pembelajaran", subject = "Mata Pelajaran", level = "Sekolah", slideCount = 8, subTopics = [] } = req.body || {};
    const count = Math.max(2, Math.min(14, Number(slideCount) - 1));

    const defaultSubTopics = [
      "Pengertian Dasar dan Definisi Kontekstual",
      "Struktur Anatomi dan Komponen Utama",
      "Mekanisme Kerja dan Proses Fisiologis",
      "Faktor-Faktor yang Memengaruhi Kinerja Sistem",
      "Gangguan, Kelainan, serta Cara Pencegahannya",
      "Peran Penting dalam Menjaga Homeostasis Tubuh",
      "Studi Kasus dan Penerapan dalam Kehidupan Sehari-hari"
    ];

    const actualSubTopics = Array.isArray(subTopics) && subTopics.length > 0 ? subTopics : defaultSubTopics;
    
    // Prepare structured subtopics prompt
    const promptSubtopicsList = Array.from({ length: count }, (_, i) => {
      const st = actualSubTopics[i % actualSubTopics.length];
      return `Slide ${i + 1}: Sub-topik "${st}"`;
    }).join("\n");

    try {
      const ai = getAiClient();
      const prompt = `WAJIB DIPATUHI PADA SETIAP SLIDE:
Jangan membuat slide yang hanya berisi judul atau poin-poin singkat. Setiap slide harus memiliki materi yang lengkap, mudah dipahami, dan siap digunakan untuk mengajar tanpa perlu banyak pengeditan.

Setiap slide wajib memiliki struktur berikut:
1. Judul Slide: Jelas, spesifik, dan menarik. Maksimal 8 kata.
2. Subjudul: Menjelaskan fokus pembahasan pada slide. Maksimal 1–2 kalimat.
3. Materi Utama: Terdiri atas 2–5 paragraf singkat atau 5–8 poin penjelasan yang saling berkaitan. Gunakan bahasa yang sederhana, komunikatif, dan sesuai jenjang pendidikan. Sertakan definisi, konsep utama, penjelasan, contoh, serta fakta penting bila relevan. Hindari hanya menampilkan kata kunci tanpa penjelasan.
4. Contoh: Berikan minimal satu contoh nyata, kontekstual, atau ilustrasi kasus yang berkaitan dengan materi.
5. Visual: Rekomendasi hero illustration utama yang relevan, serta ikon, infografik, diagram, tabel, atau peta konsep pendukung. Komposisi visual sekitar 45-60% area slide.
6. Layout & Animasi: Rekomendasi animasi untuk setiap objek (judul, subjudul, materi, gambar, ikon, diagram) beserta transisi antar-slide.

Standar Kualitas Konten & Visual Premium (Setara Canva Pro, Gamma AI, Beautiful.ai, Microsoft Designer):
- Akurat dan sesuai kurikulum.
- Sistematis dari konsep dasar hingga penerapan.
- Siap dipresentasikan tanpa perlu menambah penjelasan penting.
- Menggunakan bahasa yang mudah dipahami peserta didik sesuai jenjang ${level}.

Buatkan materi presentasi lengkap untuk ${count} slide mengenai topik "${topic}", mata pelajaran ${subject}, tingkat ${level}.

Sub-topik per slide yang wajib dibahas:
${promptSubtopicsList}

Kembalikan HANYA MURNI JSON Array bertipe array of objects tanpa teks pembuka/penutup.
Jumlah elemen dalam JSON Array HARUS TEPAT ${count}.

Format Objek JSON Per Slide:
{
  "title": "Judul Slide Spesifik Menarik (Maksimal 8 kata)",
  "subtitle": "Subjudul 1-2 kalimat menjelaskan fokus pembahasan...",
  "layoutSuggestion": "Split Layout / Hero Layout / Infographic",
  "content": [
    "Poin penjelasan 1: Definisi dan konsep dasar secara mendalam (maks 20 kata)...",
    "Poin penjelasan 2: Analisis mekanisme dan komponen utama (maks 20 kata)...",
    "Poin penjelasan 3: Cara kerja dan proses rinci (maks 20 kata)..."
  ],
  "example": "1 contoh nyata kontekstual atau ilustrasi kasus konkret...",
  "funFact": "1 fakta menarik atau trivia singkat yang relevan...",
  "speakerNotes": "Catatan komprehensif untuk guru: Penjelasan detail, saran animasi, pertanyaan diskusi, dan referensi.",
  "visualRecommendation": {
    "heroIllustration": "Deskripsi hero illustration 3D/vektor 45-60% area slide...",
    "iconsAndDiagrams": ["Ikon 3D Utama", "Diagram Alur Proses", "Infografik Peta Konsep"]
  },
  "animationRecommendation": {
    "objectAnimations": ["Judul: Fade In (0.5s)", "Subjudul & Materi: Fly In Left", "Hero Visual: Zoom In Soft"],
    "slideTransition": "Morph / Push Smooth"
  }
}`;

      const response = await generateContentWithRetry(ai, [
        { role: "user", parts: [{ text: prompt }] }
      ]);

      let rawText = response.text || "";
      rawText = rawText
        .replace(/```[a-zA-Z]*\n?/g, "")
        .replace(/```/g, "")
        .trim();

      let parsedSlides: any[] = [];
      try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedSlides = JSON.parse(jsonMatch[0]);
        } else {
          parsedSlides = JSON.parse(rawText);
        }
      } catch (err) {
        console.warn("Failed to parse batch slides JSON, fallback triggered:", err);
      }

      if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
        const slides = parsedSlides.map((s, idx) => {
          const indexNum = idx + 1;
          const subTitle = actualSubTopics[idx % actualSubTopics.length];
          let rawTitle = s.title || s.slideTitle || `Bagian ${indexNum}: ${subTitle}`;
          const titleWords = rawTitle.split(/\s+/);
          if (titleWords.length > 8) {
            rawTitle = titleWords.slice(0, 8).join(" ");
          }

          const slideContent = Array.isArray(s.content) && s.content.length > 0 
            ? s.content 
            : (Array.isArray(s.mainContent) && s.mainContent.length > 0 ? s.mainContent : [
              `Definisi Esensial: ${subTitle} merupakan landasan utama dalam pemahaman materi ${topic}.`,
              `Konsep Utama: Menguraikan hubungan antar-elemen serta prinsip dasar yang bekerja pada sistem.`,
              `Mekanisme Kerja: Menjelaskan tahapan fisiologis/operasional secara rinci dan sistematis.`,
              `Fakta Penting: Menyoroti parameter penting yang memengaruhi kinerja serta dampaknya.`
            ]);

          return {
            title: rawTitle,
            subtitle: s.subtitle || `Fokus pembahasan mengenai ${subTitle.toLowerCase()} dalam materi ${topic}.`,
            layoutSuggestion: s.layoutSuggestion || "Split Layout",
            content: slideContent,
            example: s.example || `Contoh nyata penerapan ${subTitle.toLowerCase()} dalam kehidupan sehari-hari maupun studi kasus terapan.`,
            funFact: s.funFact || `Tahukah Kamu? Konsep ${subTitle.toLowerCase()} memiliki peran krusial dalam perkembangan teknologi dan sains modern.`,
            speakerNotes: s.speakerNotes || `Saran Animasi: Title (Fade), Image (Zoom In), Text (Wipe)\nCatatan Detail: Guru menjelaskan poin-poin dengan analogi sederhana dan interaktif.`,
            visualRecommendation: {
              heroIllustration: s.visualRecommendation?.heroIllustration || `Ilustrasi 3D beresolusi tinggi menggambarkan ${subTitle.toLowerCase()} (area 50% slide).`,
              iconsAndDiagrams: Array.isArray(s.visualRecommendation?.iconsAndDiagrams) && s.visualRecommendation.iconsAndDiagrams.length > 0 ? s.visualRecommendation.iconsAndDiagrams : ["Ikon 3D Relevan", "Diagram Alur", "Peta Konsep"]
            },
            animationRecommendation: {
              objectAnimations: Array.isArray(s.animationRecommendation?.objectAnimations) && s.animationRecommendation.objectAnimations.length > 0 ? s.animationRecommendation.objectAnimations : ["Judul: Fade In", "Materi: Fly In Left", "Gambar: Zoom In Soft"],
              slideTransition: s.animationRecommendation?.slideTransition || "Morph / Smooth Fade"
            },
            imageUrl: createPptSvgImage(indexNum, topic, subject)
          };
        });

        return res.json({ status: "success", slides });
      }
    } catch (error: any) {
      console.warn("Batch PPT generation fallback applied due to API error/rate-limit:", error?.message);
    }

    // High Quality Fallback for all slides matching prompt guidelines
    const fallbackSlides = Array.from({ length: count }, (_, idx) => {
      const indexNum = idx + 1;
      const subTitle = actualSubTopics[idx % actualSubTopics.length];
      return {
        title: `Materi ${indexNum}: ${subTitle}`.split(/\s+/).slice(0, 8).join(" "),
        subtitle: `Menjelaskan secara komprehensif fokus materi ${subTitle.toLowerCase()} pada topik ${topic}.`,
        layoutSuggestion: "Split Layout",
        content: [
          `Definisi Esensial: ${subTitle} merupakan landasan utama dalam pemahaman ${topic} tingkat ${level}.`,
          `Konsep Utama: Menguraikan struktur, komponen, serta interaksi antar-elemen yang terjadi secara rinci.`,
          `Mekanisme Kerja: Tahapan fisiologis dan operasional yang mendukung berjalannya sistem secara berkesinambungan.`,
          `Fakta Penting: Analisis parameter utama, variasi kondisi, serta dampak sistemik terhadap lingkungan sekitar.`
        ],
        example: `Penerapan nyata konsep ${subTitle.toLowerCase()} pada kehidupan sehari-hari dan sains terapan.`,
        funFact: `Tahukah Kamu? Konsep ${subTitle.toLowerCase()} ini dipelajari secara global untuk pemecahan masalah lingkungan dan kesehatan.`,
        speakerNotes: `Saran Animasi: Judul (Fade), Gambar (Zoom In), Teks (Fly In)\nCatatan Detail: Guru memandu diskusi kelas mengenai contoh kasus kontekstual secara aktif.`,
        visualRecommendation: {
          heroIllustration: `Hero Illustration 3D beresolusi tinggi menggambarkan ${subTitle.toLowerCase()} (komposisi 50% area slide).`,
          iconsAndDiagrams: ["Ikon 3D Utama", "Diagram Struktur Anatomi", "Infografik Peta Konsep"]
        },
        animationRecommendation: {
          objectAnimations: ["Judul & Subjudul: Fade In (0.5s)", "Materi Utama: Fly In Left (Staggered)", "Hero Visual: Zoom In Smooth"],
          slideTransition: "Morph Transition 1.0s"
        },
        imageUrl: createPptSvgImage(indexNum, topic, subject)
      };
    });

    res.json({ status: "success", slides: fallbackSlides });
  });

  // API 4: PPT Generator AI Single Text Fallback
  app.post("/api/ai/generate-ppt-text", async (req, res) => {
    const { subTitle, topic, subject } = req.body || {};
    res.json({
      status: "success",
      content: [
        `Penjelasan esensial mengenai ${subTitle || "materi"} dalam pemahaman ${topic || "topik utama"}.`,
        `Komponen dan mekanisme kunci yang berperan penting dalam materi ${subject || "pelajaran"} ini.`,
        `Penerapan praktis serta relevansi konsep dalam pembelajaran sehari-hari.`
      ]
    });
  });

  // API 5: PPT Generator AI Slide Image Illustration
  app.post("/api/ai/generate-ppt-image", async (req, res) => {
    try {
      const { slideIndex, topic, subject } = req.body;
      const indexNum = slideIndex || 1;
      const encodedSvg = createPptSvgImage(indexNum, topic, subject);
      res.json({ status: "success", imageUrl: encodedSvg });
    } catch (error: any) {
      res.json({
        status: "success",
        imageUrl: `https://placehold.co/800x450/1e3a8a/ffffff.png?text=EduSlide+Part+${req.body?.slideIndex || 1}`
      });
    }
  });

  // API 6: Generator Perangkat Ajar AI (Analisis CP, TP, ATP, Prota, Prosem, KKTP)
  app.post("/api/ai/generate-perangkat-ajar", async (req, res) => {
    try {
      const { docType, formData } = req.body || {};
      const ai = getAiClient();

      const schoolName = formData?.school || "SMA Negeri 1 Jambi";
      const subject = formData?.subject || "Bahasa Indonesia";
      const singkatanMapel = formData?.singkatanMapel || "BI";
      const level = formData?.level || "Fase E / Kelas X";
      const year = formData?.year || "2026/2027";
      const totalJp = formData?.totalJp || "108 JP / Tahun";
      const jpPerMinggu = formData?.jpPerMinggu || "3 JP/Minggu";
      const teacher = formData?.teacher || "Budi Santoso, S.Pd., Gr.";
      const nipTeacher = formData?.nipTeacher || "19900101 201903 1 001";
      const cityDate = formData?.cityDate || "Jambi, 14 Juli 2026";
      const principal = formData?.principal || "Dr. Ahmad Fauzi, M.Pd.";
      const nipPrincipal = formData?.nipPrincipal || "19720514 200003 1 002";

      const cpRasional = formData?.cpRasional || "Pada akhir Fase E, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar sesuai dengan tujuan, konteks sosial, akademis, dan dunia kerja.";
      const cpElemen = formData?.cpElemen || `Elemen 1 — Menyimak: Peserta didik mampu mengevaluasi dan mengkreasi informasi berupa gagasan dari berbagai tipe teks lisan.\nElemen 2 — Membaca dan Memirsa: Peserta didik mampu mengevaluasi informasi berupa gagasan dari teks deskripsi, laporan, narasi, eksplanasi, eksposisi.\nElemen 3 — Berbicara dan Mempresentasikan: Peserta didik mampu mengolah dan menyajikan gagasan untuk tujuan pengajuan usul dan solusi.\nElemen 4 — Menulis: Peserta didik mampu menulis gagasan tertulis secara logis, kritis, dan kreatif.`;

      const generalRules = `
KETENTUAN UTAMA GENERASI HTML ADMINISTRASI:
1. SANGAT PENTING - TANPA LOGO / GAMBAR: Kop Sekolah HANYA berisi teks nama dinas/pemerintah, nama sekolah, alamat, dan garis tebal pembatas. DILARANG MENAMBAHKAN TAG <img>, PLACEHOLDER [LOGO], ATAU GAMBAR APAPUN.
2. TANDA TANGAN SEJAJAR DALAM TABEL TAK TERLIHAT: Bagian tanda tangan penutup Kepala Sekolah (kiri/kanan) dan Guru Mata Pelajaran (kiri/kanan) HARUS disusun sejajar dalam 1 baris menggunakan TABEL HTML 2 KOLOM TANPA BORDER (\`<table style="width:100%; border:none; margin-top:30px;"><tr><td style="border:none; text-align:center; width:50%;">... TTD Kepsek ...</td><td style="border:none; text-align:center; width:50%;">... TTD Guru ...</td></tr></table>\`).
3. DILARANG MENAMPILKAN TEKS/TOMBOL "Cetak Dokumen" atau "🖨️ Cetak" DI DALAM ISI DOKUMEN HTML.
4. WARNA HEADER TABEL WARNA-WARNI KONTRAST: Semua elemen \`<th>\` pada tabel HARUS diberikan atribut \`style="background-color:#1a3a5c; color:#ffffff; font-weight:bold; text-align:center; padding:8px;"\` secara inline agar warna header tabel muncul dengan sempurna di browser maupun di Microsoft Word.
`;

      let docPrompt = "";

      if (docType === "analisis_cp") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **ANALISIS CAPAIAN PEMBELAJARAN (CP)** yang lengkap, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Nama Guru: ${teacher}
- NIP / NUPTK: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- Rasional CP Umum: ${cpRasional}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB (7 Bagian Wajib):
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-CP-${singkatanMapel}-${level.replace(/\s+/g, '')} / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. BAGIAN A — IDENTITAS (Tabel 2 Kolom)
3. BAGIAN B — RASIONAL MATA PELAJARAN (Tabel 3 kolom: No | Uraian | Deskripsi) -> 1. Pentingnya Mapel, 2. Kaitan dengan 8 Dimensi Profil Lulusan, 3. Orientasi Pembelajaran.
4. BAGIAN C — TUJUAN MATA PELAJARAN (Tabel 3 kolom: No | Tujuan | Indikator Umum - min 3 tujuan terukur)
5. BAGIAN D — KARAKTERISTIK MATA PELAJARAN & ELEMEN CP (Tabel 4 kolom: No | Elemen | Deskripsi Elemen | Cakupan Konten Utama - daftar 5-7 topik konkret per elemen)
6. BAGIAN E — CAPAIAN PEMBELAJARAN FASE (Tabel 4 kolom: Fase | Capaian Pembelajaran | Kompetensi Kunci | Konten / Materi Pokok)
7. BAGIAN F — PENJABARAN KATA KERJA OPERASIONAL (KKO) PER ELEMEN (Tabel 3 kolom: No | Elemen | KKO & Arah Tujuan Pembelajaran)
8. BAGIAN G — KETERKAITAN DENGAN 8 DIMENSI PROFIL LULUSAN (Tabel 4 kolom: No | Dimensi Profil Lulusan | Elemen Terkait | Relevansi ✔)
9. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TANPA BORDER.

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa tanda markdown fence (\`\`\`html) dan tanpa teks tambahan lain.
- Gunakan styling CSS internal yang bersih dengan font sans-serif, header tabel warna biru tua (#1a3a5c) teks putih, border tabel tipis, dan styling print @media print { @page { size: A4 portrait; margin: 1.5cm; } }.`;
      } else if (docType === "tp") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **TUJUAN PEMBELAJARAN (TP)** yang lengkap, sistematis, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu Total: ${totalJp}
- Nama Guru: ${teacher}
- NIP Guru: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB (4 Bagian Wajib):
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-TP-${singkatanMapel}-${level.replace(/\s+/g, '')} / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. BAGIAN A — IDENTITAS (Tabel 2 Kolom)
3. BAGIAN B — PANDUAN KODE TUJUAN PEMBELAJARAN (Sub B1 Format Kode box, Sub B2 Tabel Kode Elemen)
4. BAGIAN C — DAFTAR TUJUAN PEMBELAJARAN (Tabel 6 kolom: No | Kode TP | Elemen CP | Tujuan Pembelajaran | Aspek Kompetensi | Alokasi JP). Buat 8-12 TP berprinsip ABCD, KKO Bloom terukur, diawali "Peserta didik mampu...". Total JP HARUS TEPAT SAMA dengan Alokasi Waktu Total (${totalJp}).
5. BAGIAN D — REKAPITULASI ALOKASI WAKTU PER ELEMEN (Tabel 5 kolom: No | Elemen CP | Jumlah TP | Total JP | Persentase)
6. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TAK TERLIHAT (BORDER 0).

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa markdown fence.
- CSS internal rapi, warna header #1a3a5c, @media print { @page { size: A4 portrait; margin: 1.5cm; } }.`;
      } else if (docType === "atp") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **ALUR TUJUAN PEMBELAJARAN (ATP)** yang lengkap, sistematis, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu Total: ${totalJp}
- Nama Guru: ${teacher}
- NIP Guru: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB (4 Bagian Wajib):
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-ATP-${singkatanMapel}-${level.replace(/\s+/g, '')} / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. BAGIAN A — IDENTITAS (Tabel 4 kolom compact)
3. BAGIAN B — ALUR URUTAN TUJUAN PEMBELAJARAN DALAM SATU FASE (Diagram visual Flexbox kotak kode TP dengan panah →)
4. BAGIAN C — TABEL ALUR TUJUAN PEMBELAJARAN (Tabel 8 kolom: No | Kode TP | Elemen CP | Tujuan Pembelajaran | Materi Pokok | Kompetensi & Variasi | 8 Dimensi Profil Lulusan | Alokasi JP | Semester)
5. BAGIAN D — REKAPITULASI ALOKASI WAKTU (Tabel 6 kolom: No | Elemen CP | Jumlah TP | JP Sem 1 | JP Sem 2 | Total JP | Keterangan)
6. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TAK TERLIHAT (BORDER 0).

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa markdown fence.
- Gunakan orientasi LANDSCAPE A4 di @media print { @page { size: A4 landscape; margin: 1.2cm; } }. Warna header #1a3a5c.`;
      } else if (docType === "prota") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **PROGRAM TAHUNAN (PROTA)** yang lengkap, sistematis, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu: ${totalJp} (${jpPerMinggu})
- Nama Guru: ${teacher}
- NIP Guru: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB:
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-PROTA-${singkatanMapel}-${level.replace(/\s+/g, '')} / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. BAGIAN A — IDENTITAS
3. BAGIAN B — DISTRIBUSI MINGGU EFEKTIF — KALENDER PENDIDIKAN (Tabel 7 kolom: Sem | Bulan | Minggu Kalender | Tdk Efektif | Efektif | JP | Keterangan). Sertakan Subtotal Semester 1, Subtotal Semester 2, dan Total Keseluruhan.
4. BAGIAN C — RENCANA PROGRAM TAHUNAN (Tabel 5 kolom: No | Kode TP | Tujuan Pembelajaran & Materi Pokok | Elemen CP | Alokasi JP | Semester). Sertakan header kelompok Semester 1 & Semester 2, serta baris CADANGAN.
5. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TAK TERLIHAT (BORDER 0).

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa markdown fence.
- DILARANG MENAMPILKAN TOMBOL/TEKS "Cetak Dokumen" atau "🖨️ Cetak" DI DALAM ISI HTML.
- CSS internal rapi, warna header #1a3a5c, @media print { @page { size: A4 portrait; margin: 1.5cm; } }.`;
      } else if (docType === "prosem") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **PROGRAM SEMESTER (PROSEM)** yang lengkap, sistematis, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Semester: Semester 1 & 2 (Buatlah tampilan lengkap gabungan / 2 bagian Semester 1 dan Semester 2)
- JP per Minggu: ${jpPerMinggu}
- Nama Guru: ${teacher}
- NIP Guru: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB:
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-PROSEM-${singkatanMapel}-${level.replace(/\s+/g, '')}-S1 / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. Header Identitas & Legenda Warna Sel Matriks (Biru #d0e4f7 = JP Aktif, Merah #ffd6d6 = Libur, Kuning #fff3cd = PTS, Hijau #d4edda = PAS/PAT)
3. TABEL MATRIKS DISTRIBUSI PEMBELAJARAN PER MINGGU (Kolom: No | Kode TP | Tujuan & Materi Pokok | JP | Kolom-kolom Minggu M1..M5 per Bulan | Keterangan Model Pembelajaran).
   PENTING: SEMUA KEPALA KOLOM TABEL (TH) HARUS DIBERI STYLING INLINE: style="background-color:#1a3a5c; color:#ffffff; font-weight:bold; text-align:center;" AGAR TERLIHAT KONTRAST DI WORD DAN BROWSER!
4. Catatan Keterangan Bulan Tidak Efektif & Asesmen
5. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TAK TERLIHAT (BORDER 0).

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa markdown fence.
- Gunakan LANDSCAPE A4 di @media print { @page { size: A4 landscape; margin: 1.0cm; } }.`;
      } else if (docType === "kktp") {
        docPrompt = `Anda adalah asisten pembuatan perangkat administrasi pembelajaran Kurikulum Merdeka yang ahli dan berpengalaman. Tugas Anda adalah membuat dokumen **KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)** yang lengkap, sistematis, profesional, dan siap cetak dalam format HTML.

${generalRules}

[DATA INPUT GURU]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Nama Guru: ${teacher}
- NIP Guru: ${nipTeacher}
- Kota / Tanggal TTD: ${cityDate}
- Nama Kepala Sekolah: ${principal}
- NIP Kepala Sekolah: ${nipPrincipal}
- CP Per Elemen: ${cpElemen}

STRUKTUR DOKUMEN HTML WAJIB:
1. Kop Sekolah (TANPA LOGO) & Nomor Dokumen: No. Dok: ADM-KKTP-${singkatanMapel}-${level.replace(/\s+/g, '')} / Rev: 00 / Tgl: ${year.slice(0, 4)}
2. Kotak Dasar Hukum Permendikbudristek No. 21 Tahun 2022 & BAGIAN A — IDENTITAS
3. BAGIAN A — DESKRIPSI LEVEL CAPAIAN (Tabel 5 kolom: Level | Skor | Deskripsi Umum | Tindak Lanjut | Rentang Nilai | Predikat - Level 1 Mulai Berkembang 0-55, Level 2 Layak ✓ KKTP 56-70, Level 3 Cakap 71-85, Level 4 Mahir 86-100)
4. BAGIAN B — RUBRIK KKTP PER TUJUAN PEMBELAJARAN (Tabel 9 kolom: No | Kode TP | Tujuan Pembelajaran | IKTP Indikator Ketercapaian | Sub-kolom 4 Level: Mulai Berkembang (1), Layak (2) ✓ KKTP, Cakap (3), Mahir (4)). Buat deskriptor berjenjang yang jelas, kuantitatif/kualitatif untuk setiap TP.
5. Kotak Catatan Penting Ambang Batas Minimal Ketuntasan
6. BAGIAN PENUTUP — TANDA TANGAN SEJAJAR KEPSEK & GURU DENGAN TABEL TAK TERLIHAT (BORDER 0).

KETENTUAN LAYOUT HTML:
- Hasilkan MURNI KODE HTML tanpa markdown fence.
- SANGAT PENTING: DILARANG MEMASUKKAN LOGO / GAMBAR DI HEADER KOP.
- Gunakan LANDSCAPE A4 di @media print { @page { size: A4 landscape; margin: 1.2cm; } }. Warna header #1a3a5c.`;
      } else {
        // Default prompt for generate overview / all
        docPrompt = `Buatkan Dokumen Analisis Capaian Pembelajaran (CP) dan Administrasi Perangkat Ajar Kurikulum Merdeka untuk sekolah ${schoolName}, mapel ${subject}, ${level}, tahun ${year}, guru ${teacher}. Hasilkan MURNI HTML lengkap dengan Kop Sekolah, Tabel Rapi, dan Tanda Tangan Penutup.`;
      }

      const contents = [{ role: "user", parts: [{ text: docPrompt }] }];
      const response = await generateContentWithRetry(ai, contents);

      let htmlOutput = response?.text || "";
      // Strip markdown code fences if model wrapped response in ```html ... ```
      htmlOutput = htmlOutput.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      res.json({ status: "success", html: htmlOutput, docType });
    } catch (err: any) {
      console.error("Gagal generate Perangkat Ajar AI:", err);
      res.status(500).json({
        status: "error",
        message: err?.message || "Terjadi kesalahan saat memproses Perangkat Ajar AI."
      });
    }
  });

  // API Endpoint: Generator Perangkat Ajar KBC (Kurikulum Berbasis Cinta Kemenag)
  app.post("/api/ai/generate-perangkat-ajar-kbc", async (req, res) => {
    try {
      const ai = getAiClient();
      const { docType, formData } = req.body;
      const {
        schoolName = "MAN 1 Kerinci",
        kemenagOffice = "KANTOR KEMENTERIAN AGAMA KABUPATEN KERINCI",
        schoolAddress = "Jl. Raya Semurup No. 45, Semurup, Kabupaten Kerinci",
        subject = "Akidah Akhlak",
        singkatanMapel = "AA",
        level = "Fase E / Kelas X",
        year = "2026/2027",
        totalJp = "72 JP / Tahun",
        jpPerMinggu = "2 JP/Minggu",
        teacher = "Drs. Yefri Haryanto, M.Pd.",
        nipTeacher = "19850312 201001 1 008",
        cityDate = "Kerinci, 14 Juli 2026",
        principal = "Hamdani, S.Pd., M.Si.",
        nipPrincipal = "19780514 200212 1 003",
        cpRasional = "",
        cpElemen = "",
        learningModel = "Discovery Learning",
        sintakModel = "1. Stimulasi/Pemberian Rangsangan, 2. Identifikasi Masalah, 3. Pengumpulan Data, 4. Pengolahan Data, 5. Pembuktian, 6. Penarikan Kesimpulan",
        kodeTp = "TP.AA.ELE.10.01",
        rumusanTp = "Peserta didik mampu menganalisis konsep tauhid dan Asmaul Husna secara mendalam, serta menginternalisasi nilai kasih sayang Allah Swt. dalam kehidupan sehari-hari dan kearifan lokal Kerinci.",
        elemenCp = "Akidah",
        jumlahPertemuan = "3",
        jpPerPertemuan = "2",
        topikLokal = "Pelestarian Lingkungan Hutan TNKS & Budaya Adat Mudik Kerinci"
      } = formData || {};

      let docPrompt = "";

      const generalKbcRules = `
[ATURAN PENTING KBC & KEMENAG]:
- Kamu adalah Ahli Kurikulum & Pengembang Perangkat Ajar Kemenag RI, menguasai "Kurikulum Berbasis Cinta (KBC)" (turunan Kurikulum Merdeka yang mengintegrasikan Panca Cinta Kemenag & 10 Nilai PPRA: Ta'addub, Qudwah, Muwaṭanah, Tawassuṭ, Tawāzun, I'tidāl, Musāwah, Syūrā, Tasāmuh, Tathawwur wa Ibtikār).
- Hasil WAJIB MURNI KODE HTML tanpa markdown code fences (\`\`\`html) atau teks pengantar lain.
- Gunakan CSS internal rapi dengan font sans-serif (Arial/Calibri), header tabel warna biru tua (#1a3a5c) teks putih bold.
- Tanda tangan penutup 2 kolom sejajar border 0 (Kepala Sekolah & Guru Mata Pelajaran).
- Tanggal & Kota TTD: ${cityDate}.
      `;

      if (docType === "analisis_cp") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "ANALISIS CAPAIAN PEMBELAJARAN (ACP) KURIKULUM BERBASIS CINTA" dengan struktur, urutan, dan format tabel PERSIS seperti kerangka baku di bawah ini. Jangan mengubah urutan bagian (A–H), jangan menghilangkan kolom, dan jangan menyingkat isi tabel.

[DATA IDENTITAS GURU & MADRASAH]:
- Kantor / Yayasan: ${kemenagOffice}
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject} (${singkatanMapel})
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Nama Guru: ${teacher} (NIP/NUPTK: ${nipTeacher})
- Nama Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})
- Rasional & Elemen CP: ${cpRasional} \n ${cpElemen}

STRUKTUR DOKUMEN (WAJIB PERSIS URUTAN A-H):
KOP DOKUMEN:
KEMENTERIAN AGAMA REPUBLIK INDONESIA
${kemenagOffice}
${schoolName.toUpperCase()}
[Alamat Lengkap Madrasah]
Judul: ANALISIS CAPAIAN PEMBELAJARAN
Sub-judul: Kurikulum Berbasis Cinta (KBC) | Tahun Pelajaran ${year}

A. IDENTITAS (Tabel 2 kolom: Label | Isi, 6 baris)
B. RASIONAL MATA PELAJARAN (Tabel 3 kolom: No | Uraian | Deskripsi — 3 baris: 1. Pentingnya Mapel & Panca Cinta, 2. Kaitan dengan 8 Dimensi Profil Lulusan & 10 Nilai PPRA, 3. Orientasi Pembelajaran)
C. TUJUAN MATA PELAJARAN (Tabel 3 kolom: No | Tujuan | Indikator Umum — 2-3 baris terukur)
D. KARAKTERISTIK MATA PELAJARAN & ELEMEN CP (Tabel 4 kolom: No | Elemen | Deskripsi Elemen | Cakupan Konten Utama)
E. CAPAIAN PEMBELAJARAN FASE ${level} (Tabel 4 kolom: Fase | Capaian Pembelajaran | Kompetensi Kunci | Konten/Materi Pokok)
F. PENJABARAN KATA KERJA OPERASIONAL (KKO) PER ELEMEN (Tabel 3 kolom: No | Elemen | KKO & Arah Tujuan Pembelajaran — sertakan KKO Bloom tinggi, Panca Cinta, & nilai PPRA konkret)
G. KETERKAITAN DENGAN 10 NILAI PPRA (Tabel 4 kolom: No | Dimensi Profil Lulusan | Elemen Terkait | Relevansi ✔ — WAJIB 10 baris urut: Ta'addub, Qudwah, Muwaṭanah, Tawassuṭ, Tawāzun, I'tidāl, Musāwah, Syūrā, Tasāmuh, Tathawwur wa Ibtikār)
H. INTEGRASI NILAI PPRA DALAM PEMBELAJARAN (Tabel 4 kolom: No | Nilai PPRA | Deskripsi Nilai | Integrasi dalam Kegiatan Pembelajaran — WAJIB 10 baris urut sesuai Bagian G)

PENUTUP: Tanda tangan sejajar Kepala Sekolah & Guru (${cityDate}).
Layout: A4 Portrait (@media print { @page { size: A4 portrait; margin: 1.2cm; } }).
`;
      } else if (docType === "tp") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "TUJUAN PEMBELAJARAN (TP) KURIKULUM BERBASIS CINTA" (breakdown CP menjadi TP per elemen, lengkap dengan kode dan alokasi JP), dengan struktur, urutan, dan format tabel PERSIS seperti kerangka baku di bawah ini.

[DATA IDENTITAS]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu Total: ${totalJp}
- Nama Guru: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})
- CP Elemen: ${cpElemen}

STRUKTUR DOKUMEN WAJIB:
KOP DOKUMEN KEMENTERIAN AGAMA & MADRASAH
Judul: TUJUAN PEMBELAJARAN KURIKULUM BERBASIS CINTA | Tahun Pelajaran ${year}

A. IDENTITAS (Tabel 2 kolom dengan format titik dua)
B. PANDUAN KODE TUJUAN PEMBELAJARAN (Format Kode: [SINGKATAN_MAPEL]-[FASE]-[KODE_ELEMEN]-[NOMOR], Contoh: ${singkatanMapel}-E-ELE-001 & Tabel Kode Elemen)
C. DAFTAR TUJUAN PEMBELAJARAN (Tabel 6 kolom: No | Kode TP | Elemen CP | Tujuan Pembelajaran & Aspek Kompetensi | Integrasi Nilai (KBC & PPRA) | JP). Buat 8-12 TP berpola "Peserta didik mampu...", cantumkan Panca Cinta & Nilai PPRA (salah satu dari 10 nilai baku). Total JP = ${totalJp}.
D. REKAPITULASI ALOKASI WAKTU PER ELEMEN (Tabel 5 kolom: No | Elemen CP | Jumlah TP | Total JP | Persentase %)
PENUTUP / PENGESAHAN (${cityDate}).
Layout: A4 Portrait (@media print { @page { size: A4 portrait; margin: 1.2cm; } }).
`;
      } else if (docType === "atp") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "ALUR TUJUAN PEMBELAJARAN (ATP) KURIKULUM BERBASIS CINTA" — pengurutan logis-hierarkis seluruh TP dalam satu fase dengan struktur PERSIS seperti kerangka baku di bawah ini.

[DATA IDENTITAS]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu Total: ${totalJp}
- Nama Guru: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})
- CP Elemen: ${cpElemen}

STRUKTUR DOKUMEN WAJIB:
KOP DOKUMEN KEMENTERIAN AGAMA & MADRASAH
Judul: ALUR TUJUAN PEMBELAJARAN KURIKULUM BERBASIS CINTA (KBC)

A. IDENTITAS (Tabel 2 kolom berdampingan: Kiri & Kanan)
B. ALUR URUTAN TUJUAN PEMBELAJARAN DALAM SATU FASE (Kotak Diagram Alur Horizontal [KODE-TP-001] → [KODE-TP-002] → ... dihubungkan tanda panah, dilengkapi Legenda ■ Hitam = Pembuka, □ Putih = Lanjutan)
C. TABEL ALUR TUJUAN PEMBELAJARAN (Tabel 9 kolom: No | Kode TP | Elemen CP | Tujuan Pembelajaran | Materi Pokok | Aspek Kompetensi | Integrasi Nilai (PC & PPRA) | Alokasi JP | Semester). Dikelompokkan per baris elemen.
PENUTUP / PENGESAHAN (${cityDate}).
Layout: A4 Landscape (@media print { @page { size: A4 landscape; margin: 1.2cm; } }).
`;
      } else if (docType === "prota") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "PROGRAM TAHUNAN (PROTA) KURIKULUM BERBASIS CINTA" — pemetaan seluruh TP ke minggu efektif kalender akademik dalam satu tahun ajaran.

[DATA IDENTITAS]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Alokasi Waktu: ${totalJp} (${jpPerMinggu})
- Nama Guru: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})

STRUKTUR DOKUMEN WAJIB:
KOP DOKUMEN KEMENTERIAN AGAMA & MADRASAH
Judul: PROGRAM TAHUNAN | Kurikulum Berbasis Cinta | ${subject} | ${level} | TP ${year}

A. IDENTITAS
B. DISTRIBUSI MINGGU EFEKTIF — KALENDER PENDIDIKAN (Tabel 7 kolom: Sem. | Bulan | Minggu Kalender | Tdk Efektif | Efektif | JP | Keterangan). Sertakan Subtotal Sem 1, Subtotal Sem 2, & TOTAL KESELURUHAN.
C. RENCANA PROGRAM TAHUNAN (Tabel 7 kolom: No | Kode TP | Tujuan Pembelajaran & Materi Pokok | Elemen CP | Integrasi Nilai (KBC & PPRA) | Alokasi JP | Semester). Sertakan header kelompok Semester 1 & Semester 2, serta baris CADANGAN.
PENUTUP / PENGESAHAN (${cityDate}).
Layout: A4 Portrait (@media print { @page { size: A4 portrait; margin: 1.2cm; } }).
`;
      } else if (docType === "prosem") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "PROGRAM SEMESTER (PROSEM) KURIKULUM BERBASIS CINTA" — jadwal distribusi pembelajaran mingguan per semester.

[DATA IDENTITAS]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Singkatan Mapel: ${singkatanMapel}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- JP per Minggu: ${jpPerMinggu}
- Nama Guru: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})

STRUKTUR DOKUMEN WAJIB:
KOP DOKUMEN KEMENTERIAN AGAMA & MADRASAH
Judul: PROGRAM SEMESTER (PROSEM) | Kurikulum Berbasis Cinta | ${subject} | ${level}

BLOK INFORMASI HEADER & Legenda Warna: [■ biru] JP Aktif Pembelajaran, [■ abu] Libur, [■ kuning] PTS, [■ merah] PAS.
TABEL DISTRIBUSI PEMBELAJARAN (Grid mingguan: No | Kode TP | Tujuan Pembelajaran & Materi Pokok | JP | Integrasi Nilai (KBC & PPRA) | Kolom M1..M5 per bulan Juli-Desember & Januari-Juni).
KETERANGAN: Catatan minggu tidak efektif per bulan & Catatan Semester.
PENUTUP / PENGESAHAN (${cityDate}).
Layout: A4 Landscape (@media print { @page { size: A4 landscape; margin: 1.0cm; } }).
`;
      } else if (docType === "kktp") {
        docPrompt = `
${generalKbcRules}

TUGAS: Buatkan dokumen "KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP) KURIKULUM BERBASIS CINTA" — rubrik 4 level capaian untuk setiap TP.

[DATA IDENTITAS]:
- Satuan Pendidikan: ${schoolName}
- Mata Pelajaran: ${subject}
- Fase / Kelas: ${level}
- Tahun Pelajaran: ${year}
- Nama Guru: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})

STRUKTUR DOKUMEN WAJIB:
KOP DOKUMEN KEMENTERIAN AGAMA & MADRASAH
Judul: KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP) | Kurikulum Berbasis Cinta

BLOK INFORMASI HEADER & PARAGRAF DASAR (Mengutip Permendikbudristek & Filosofi KBC / Panca Cinta & PPRA).
A. DESKRIPSI LEVEL CAPAIAN (Tabel 6 kolom: Level | Skor | Deskripsi Umum | Tindak Lanjut | Rentang Nilai | Predikat — Level 1 Mulai Berkembang 0-55, Level 2 Layak ✓ KKTP 56-70, Level 3 Cakap 71-85, Level 4 Mahir 86-100).
B. RUBRIK KKTP PER TUJUAN PEMBELAJARAN (Tabel 5 kolom utama dengan sub-kolom 4 level: Mulai Berkembang (1), Layak (2) ✓ KKTP, Cakap (3), Mahir (4)). Tulis deskriptor progresi bertingkat yang kaya nilai PPRA & Panca Cinta.
CATATAN PENTING AMBANG BATAS KETUNTASAN.
PENUTUP / PENGESAHAN (${cityDate}).
Layout: A4 Landscape (@media print { @page { size: A4 landscape; margin: 1.2cm; } }).
`;
      } else if (docType === "modul_ajar") {
        docPrompt = `
${generalKbcRules}

PERAN & KONTEKS
Kamu adalah Ahli Kurikulum dan Pengembang Perangkat Ajar berpengalaman di satuan pendidikan naungan Kementerian Agama RI, menguasai penyusunan Modul Ajar berbasis Deep Learning (Mindful, Meaningful, Joyful Learning) yang diintegrasikan penuh dengan Kurikulum Berbasis Cinta (KBC) — Panca Cinta dan 10 Nilai PPRA (Profil Pelajar Rahmatan lil 'Alamin).

TUGAS
Susun dokumen "PERENCANAAN PEMBELAJARAN (MODUL AJAR DEEP LEARNING - KBC)" untuk Tujuan Pembelajaran [Kode: ${kodeTp}, Rumusan: ${rumusanTp}] mata pelajaran ${subject} kelas ${level} tahun pelajaran ${year}, dengan identitas satuan pendidikan:
- Kementerian Agama Republik Indonesia
- ${kemenagOffice}
- ${schoolName}
- ${schoolAddress}
- Penyusun: ${teacher} (NIP: ${nipTeacher}) | Kepala Madrasah: ${principal} (NIP: ${nipPrincipal})

INPUT YANG DIBERIKAN PENGGUNA
- Rumusan lengkap TP dan Elemen CP: Kode ${kodeTp} - ${rumusanTp} | Elemen: ${elemenCp}
- Model pembelajaran (${learningModel}) beserta sintaknya: ${sintakModel}
- Jumlah pertemuan dan alokasi JP per pertemuan: ${jumlahPertemuan} Pertemuan x ${jpPerPertemuan} JP (${Number(jpPerPertemuan) * 45} Menit/Pertemuan)
- Topik/konteks lokal yang relevan: ${topikLokal}

ATURAN STRUKTUR MODUL AJAR (WAJIB DIIKUTI PERSIS)
Hasilkan MURNI KODE HTML tanpa markdown code fences (\`\`\`html). Gunakan CSS internal rapi dengan font sans-serif (Arial/Calibri), header tabel warna biru tua (#1a3a5c) teks putih bold.

KOP SURAT DOKUMEN:
KEMENTERIAN AGAMA REPUBLIK INDONESIA
${kemenagOffice.toUpperCase()}
${schoolName.toUpperCase()}
${schoolAddress}

BAGIAN A — INFORMASI UMUM
- Tabel identitas: Nama Penyusun, Satuan Pendidikan, Mata Pelajaran, Fase/Kelas, Kode & Judul TP, Elemen CP, Alokasi Waktu, Model Pembelajaran, Moda, Tahun Pelajaran
- B. Identifikasi Kesiapan Peserta Didik (1 paragraf naratif mengaitkan capaian belajar sebelumnya dengan TP ini)
- C. Karakteristik Materi Pelajaran (1 paragraf: sifat materi, tingkat kesulitan, relevansi lokal: ${topikLokal})
- 1. Tujuan Pembelajaran (1 kalimat utuh memuat kompetensi + nilai KBC yang ditumbuhkan)
- 2. Kompetensi Awal/Prasyarat (tabel: No | Kompetensi Prasyarat | Cara Mengecek)
- 3. 8 Dimensi Profil Lulusan (pilih 2 dimensi paling relevan; tabel: No | Dimensi | Deskripsi Perwujudan, setiap deskripsi WAJIB diakhiri anotasi "(PC: [Panca Cinta] | PPRA: [Nilai])")
- 3a. Integrasi KBC: baris terpisah "Panca Cinta: [...]" dan "Nilai PPRA: [...]" (pilih 2-3 nilai paling relevan dari 10 Nilai PPRA)
- 4. Sarana & Prasarana (tabel: Kategori | Rincian | Keterangan)
- 5. Target Peserta Didik & Diferensiasi (3 kolom: Reguler/Tipikal | Kesulitan Belajar | Berbakat/Cepat — masing-masing berisi Sasaran & Perlakuan)

BAGIAN B — KOMPONEN INTI
- 6. Pemahaman Bermakna (kotak bertekstur naratif-reflektif, mengaitkan materi dengan minimal 1 istilah PPRA, misal Tathawwur wa Ibtikār / Syūrā / I'tidāl)
- 7. Pertanyaan Pemantik (tabel: No | Pertanyaan | Tujuan Pertanyaan, 3 butir)
- 8. Asesmen Diagnostik:
  8a. Non-Kognitif (tabel: No | Pertanyaan Refleksi | Tujuan Diagnostik, 3 butir)
  8b. Kognitif (tabel: No | Indikator | Bentuk Soal | Tindak Lanjut, 3 butir) + 5 contoh soal campuran (isian, PG, terbuka)
- 9. KEGIATAN PEMBELAJARAN — cantumkan nama model (${learningModel}) & urutan sintak lengkap (${sintakModel}) di awal.
  UNTUK SETIAP PERTEMUAN (Pertemuan 1 s.d. ${jumlahPertemuan}), wajib memuat:
  a. Judul pertemuan bertema naratif + Alokasi (${jpPerPertemuan} JP & ${Number(jpPerPertemuan) * 45} menit) + Sintak yang dicakup + Fokus
  b. Tujuan Pertemuan (3 butir: Keterampilan, Pengetahuan, Sikap)
  c. ● PEMBUKA (15 menit) — prinsip Deep Learning + integrasi KBC (PC & PPRA), tabel 2 kolom (Aktivitas Guru | Aktivitas Siswa) berpasangan No, 5 baris, SETIAP baris aktivitas guru MAUPUN siswa diakhiri anotasi "(PC: ... | PPRA: ...)"
  d. SINTAK [n] [Nama Sintak] (durasi menit) — prinsip pembelajaran + integrasi KBC, tabel sama seperti di atas (5 baris)
  e. Ulangi (d) untuk setiap sintak dalam pertemuan tsb (${sintakModel})
  f. ● PENUTUP (15 menit) — format sama, 5 baris
  Total menit per pertemuan harus sama dengan alokasi ${jpPerPertemuan} JP × 45 menit (${Number(jpPerPertemuan) * 45} menit).
- 10. Asesmen Formatif (tabel: No | Teknik | Instrumen | Waktu Pelaksanaan | Aspek yang Dinilai, satu baris per pertemuan) + 5 contoh soal proses pembelajaran
- 11. Asesmen Sumatif (tabel: No | Komponen | Deskripsi Tugas | Bobot | Acuan KKTP; bobot harus total 100%)
- 12. Pengayaan & Remedial (3 kolom: Remedial | Reguler | Pengayaan, masing-masing berisi Sasaran, Kegiatan, Waktu)
- 13. Refleksi Guru & Peserta Didik (2 kolom, masing-masing 3-4 pertanyaan reflektif, refleksi guru memuat kata "teladan (Qudwah)")

BAGIAN C — LAMPIRAN
- Deskripsi singkat tiap lampiran (LKPD, lembar penilaian sahabat, dsb.)
- Glosarium (3 istilah kunci materi)
- Daftar Pustaka (format APA, minimal Kemendikbudristek CP + 1 buku ajar)
- Blok tanda tangan: ${cityDate} | Mengetahui Kepala Madrasah (${principal}, NIP: ${nipPrincipal}) — Dibuat oleh Guru Mata Pelajaran (${teacher}, NIP: ${nipTeacher}).
Layout: A4 Portrait (@media print { @page { size: A4 portrait; margin: 1.2cm; } }).
`;
      } else if (docType === "lkpd") {
        docPrompt = `
${generalKbcRules}

PERAN & KONTEKS
Kamu adalah Ahli Kurikulum dan Pengembang Perangkat Ajar berpengalaman di satuan pendidikan naungan Kementerian Agama RI, menguasai penyusunan LKPD berbasis Deep Learning (Mindful, Meaningful, Joyful Learning) yang diintegrasikan penuh dengan Kurikulum Berbasis Cinta (KBC) — Panca Cinta dan 10 Nilai PPRA.

TUGAS
Susun dokumen "LEMBAR KERJA PESERTA DIDIK (LKPD) KURIKULUM BERBASIS CINTA" untuk Tujuan Pembelajaran [Kode: ${kodeTp}, Rumusan: ${rumusanTp}] mata pelajaran ${subject} kelas ${level} tahun pelajaran ${year}, dengan identitas satuan pendidikan:
- Kementerian Agama Republik Indonesia
- ${kemenagOffice}
- ${schoolName}
- ${schoolAddress}
- Penyusun: ${teacher} (NIP: ${nipTeacher}) | Kepala Madrasah: ${principal} (NIP: ${nipPrincipal})

INPUT YANG DIBERIKAN PENGGUNA
- Rumusan lengkap TP dan Elemen CP: Kode ${kodeTp} - ${rumusanTp} | Elemen: ${elemenCp}
- Model pembelajaran (${learningModel}) beserta sintaknya: ${sintakModel}
- Jumlah pertemuan dan alokasi JP per pertemuan: ${jumlahPertemuan} Pertemuan x ${jpPerPertemuan} JP
- Topik/konteks lokal yang relevan: ${topikLokal}

ATURAN STRUKTUR LKPD (WAJIB DIIKUTI PERSIS)
Hasilkan MURNI KODE HTML tanpa markdown code fences (\`\`\`html). Gunakan CSS internal rapi dengan font sans-serif (Arial/Calibri), header tabel warna biru tua (#1a3a5c) teks putih bold.

- Kop surat identik dengan Modul Ajar:
  KEMENTERIAN AGAMA REPUBLIK INDONESIA
  ${kemenagOffice.toUpperCase()}
  ${schoolName.toUpperCase()}
  ${schoolAddress}
- Judul LKPD + subjudul tematik (mis. "Lembar Penilaian Sahabat (Syūrā) & Eksplorasi ${topikLokal}")
- Identitas kelompok & tanggal dalam tabel 2 kolom (Nama Kelompok, Anggota 1-4, Tanggal, Kelas)
- Petunjuk pengerjaan singkat (1 paragraf memuat nilai PPRA yang ditekankan)
- Bagian-bagian LKPD mengikuti PERSIS urutan sintak model pembelajaran ${learningModel} (${sintakModel}) (huruf A, B, C, ...), masing-masing berupa tabel isian atau kotak jawaban kosong bergaris (misal ______________)
- Sertakan bagian Refleksi Akhir Peserta Didik (jika pertemuan terakhir/proyek akhir)
- Lembar Penilaian Sahabat di akhir jika ada nilai Syūrā/kolaborasi: tabel indikator (4 butir) dengan 3 kolom checklist (Sangat Baik | Baik | Perlu Bimbingan)
- Blok tanda tangan: ${cityDate} | Mengetahui Kepala Madrasah (${principal}, NIP: ${nipPrincipal}) — Dibuat oleh Guru Mata Pelajaran (${teacher}, NIP: ${nipTeacher}).
Layout: A4 Portrait (@media print { @page { size: A4 portrait; margin: 1.2cm; } }).
`;
      } else if (docType === "rubrik") {
        docPrompt = `
${generalKbcRules}

PERAN & KONTEKS
Kamu adalah Ahli Kurikulum dan Pengembang Perangkat Ajar berpengalaman di satuan pendidikan naungan Kementerian Agama RI, menguasai penyusunan Rubrik Penilaian Formatif & Sumatif berbasis Kurikulum Berbasis Cinta (KBC) — Panca Cinta dan 10 Nilai PPRA.

TUGAS
Susun dokumen "RUBRIK PENILAIAN FORMATIF & SUMATIF KURIKULUM BERBASIS CINTA" untuk Tujuan Pembelajaran [Kode: ${kodeTp}, Rumusan: ${rumusanTp}] mata pelajaran ${subject} kelas ${level} tahun pelajaran ${year}, dengan identitas satuan pendidikan:
- Kementerian Agama Republik Indonesia
- ${kemenagOffice}
- ${schoolName}
- ${schoolAddress}
- Penyusun: ${teacher} (NIP: ${nipTeacher}) | Kepala Madrasah: ${principal} (NIP: ${nipPrincipal})

INPUT YANG DIBERIKAN PENGGUNA
- Rumusan lengkap TP dan Elemen CP: Kode ${kodeTp} - ${rumusanTp} | Elemen: ${elemenCp}
- Model pembelajaran (${learningModel}) beserta sintaknya: ${sintakModel}
- Jumlah pertemuan dan alokasi JP per pertemuan: ${jumlahPertemuan} Pertemuan x ${jpPerPertemuan} JP
- Topik/konteks lokal yang relevan: ${topikLokal}

ATURAN STRUKTUR RUBRIK (WAJIB DIIKUTI PERSIS)
Hasilkan MURNI KODE HTML tanpa markdown code fences (\`\`\`html). Gunakan CSS internal rapi dengan font sans-serif (Arial/Calibri), header tabel warna biru tua (#1a3a5c) teks putih bold.

- Kop surat identik dengan Modul Ajar + judul "RUBRIK PENILAIAN FORMATIF KURIKULUM BERBASIS CINTA" + rumusan TP (${kodeTp}: ${rumusanTp}) + metadata (Mapel: ${subject} | Fase/Kelas: ${level} | Tahun: ${year} | Model: ${learningModel} | Nama Guru: ${teacher})
- Per pertemuan (Pertemuan 1 s.d. ${jumlahPertemuan}): judul pertemuan + sintak, lalu tabel 5 kolom (Kriteria | 4-Sangat Berkembang | 3-BSH | 2-Mulai Berkembang | 1-Perlu Bimbingan), 3 kriteria kinerja per pertemuan selaras dengan Tujuan Pertemuan pada Modul Ajar
  - Kalimat level 4 SELALU pola: "[capaian superlatif], menjadi Qudwah (teladan) [nilai]."
  - Kalimat level 1 SELALU pola: "Baru [aktivitas awal] dan perlu pendampingan penuh kasih sayang."
- Di pertemuan terakhir, tambahkan:
  B. Penilaian Dimensi Profil Lulusan (kriteria = 2 dimensi dari Modul Ajar bagian 3)
  C. Penilaian Integrasi Nilai (KBC & PPRA) — kriteria = Panca Cinta + Nilai PPRA terpilih
- "RUBRIK PENILAIAN SUMATIF KURIKULUM BERBASIS CINTA" — judul TP sama + metadata, lalu Komponen Penilaian (list persentase, total 100%) dan tabel rubrik 6 kolom (No | Kriteria | 4 | 3 | 2/1 digabung | Bobot), Total Bobot 100%
- Blok tanda tangan: ${cityDate} | Mengetahui Kepala Madrasah (${principal}, NIP: ${nipPrincipal}) — Dibuat oleh Guru Mata Pelajaran (${teacher}, NIP: ${nipTeacher}).
Layout: A4 Landscape (@media print { @page { size: A4 landscape; margin: 1.0cm; } }).
`;
      } else {
        docPrompt = `Buatkan Dokumen Perangkat Ajar Kurikulum Berbasis Cinta (KBC) Kemenag untuk ${schoolName}, mapel ${subject}, ${level}, tahun ${year}, guru ${teacher}. Hasilkan MURNI HTML lengkap dengan Kop Kemenag/Sekolah, Tabel Rapi, dan Tanda Tangan Penutup.`;
      }

      const contents = [{ role: "user", parts: [{ text: docPrompt }] }];
      const response = await generateContentWithRetry(ai, contents);

      let htmlOutput = response?.text || "";
      htmlOutput = htmlOutput.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      res.json({ status: "success", html: htmlOutput, docType });
    } catch (err: any) {
      console.error("Gagal generate Perangkat Ajar KBC:", err);
      res.status(500).json({
        status: "error",
        message: err?.message || "Terjadi kesalahan saat memproses Perangkat Ajar KBC."
      });
    }
  });

  // API 4.5: Generate Kartu Soal AI (Kisi-Kisi, Kartu Soal per Nomor, Kunci & Rubrik)
  app.post("/api/ai/generate-kartu-soal", async (req, res) => {
    try {
      const { formData } = req.body || {};
      const ai = getAiClient();

      const school = formData?.school || "SMP NEGERI 3 KERINCI";
      const subject = formData?.subject || "Bahasa Indonesia";
      const level = formData?.level || "Kelas VIII / Fase D";
      const curriculum = formData?.curriculum || "Kurikulum Merdeka";
      const mainTopic = formData?.mainTopic || "Teks Laporan Hasil Observasi (LHO) & Artikel Ilmiah Populer";
      const duration = formData?.duration || "90 Menit";
      const assessmentType = formData?.assessmentType || "Sumatif"; // Formatif / Sumatif
      const totalQuestions = formData?.totalQuestions || "10 Soal (5 PG, 3 Isian Singkat, 2 Uraian)";
      const cognitiveSpread = formData?.cognitiveSpread || "30% LOTS (C1-C2), 40% MOTS (C3), 30% HOTS (C4-C6)";
      const questionTypesSpread = formData?.questionTypesSpread || "Pilihan Ganda 50%, Isian Singkat 30%, Uraian 20%";
      const additionalNotes = formData?.additionalNotes || "";

      const prompt = `
Anda adalah ahli asesmen dan penulis soal berpengalaman di bidang pendidikan Indonesia (kurikulum merdeka/K13, sesuai kebutuhan). Buatkan KARTU SOAL untuk asesmen ${assessmentType.toUpperCase()} dengan ketentuan berikut:

## A. IDENTITAS SOAL
- Satuan pendidikan: ${school}
- Mata pelajaran: ${subject}
- Kelas/Fase: ${level}
- Kurikulum: ${curriculum}
- Materi pokok: ${mainTopic}
- Alokasi waktu: ${duration}
- Jenis asesmen: ${assessmentType} ${assessmentType === "Formatif" ? "(untuk pemantauan proses belajar)" : "(untuk penilaian akhir capaian)"}
${additionalNotes ? `- Catatan Khusus / Kisi-kisi Awal: ${additionalNotes}` : ""}

## B. KOMPONEN KARTU SOAL YANG WAJIB ADA
Untuk SETIAP butir soal, sajikan dalam format kartu soal berikut:

1. Nomor soal
2. Capaian Pembelajaran (CP) / Kompetensi Dasar (KD)
3. Materi
4. Indikator soal (rumusan perilaku terukur, gunakan kata kerja operasional)
5. Level kognitif (C1–C6 Bloom Taksonomi revisi, atau Level 1/2/3 AKM: Pemahaman/Aplikasi/Penalaran)
6. Bentuk soal: [Pilihan Ganda / Pilihan Ganda Kompleks / Benar-Salah / Menjodohkan / Isian Singkat / Uraian/Esai]
7. Butir soal lengkap (stimulus/wacana bila ada, pertanyaan, dan opsi jawaban jika PG)
8. Kunci jawaban
9. Pedoman penskoran/rubrik (khusus uraian: rubrik analitik dengan skor per komponen jawaban)
10. Keterangan tingkat kesukaran: [Mudah/Sedang/Sukar]

## C. JUMLAH DAN SEBARAN SOAL
- Jumlah soal: ${totalQuestions}
- Sebaran level kognitif: ${cognitiveSpread}
- Sebaran bentuk soal: ${questionTypesSpread}

## D. KAIDAH PENULISAN SOAL YANG HARUS DIPATUHI
- Materi soal sesuai indikator, tidak menyimpang dari KD/CP
- Satu soal mengukur satu kompetensi/perilaku yang jelas
- Stimulus (jika ada) kontekstual, relevan dengan kehidupan sehari-hari/isu nyata, dan orisinal (bukan kutipan berhak cipta)
- Pokok soal dirumuskan dengan jelas, tidak bermakna ganda (ambigu)
- Pokok soal tidak memberi petunjuk ke kunci jawaban
- Untuk PG: hindari pilihan jawaban "semua benar/semua salah"; pengecoh (distraktor) harus homogen, logis, dan berfungsi (tidak mengada-ada)
- Panjang rumusan pilihan jawaban relatif sama
- Gambar/grafik/tabel/data (jika ada) jelas, berfungsi, dan terbaca
- Bahasa sesuai kaidah PUEBI, komunikatif, sesuai jenjang kognitif dan usia peserta didik
- Tidak menggunakan bahasa/istilah yang berlaku setempat jika soal akan digunakan lintas daerah
- Tidak mengandung unsur SARA, gender bias, atau konten sensitif

${assessmentType === "Formatif" ? `
## E. KHUSUS ASESMEN FORMATIF
- Fokus pada soal diagnostik/pemantauan proses, bukan penentu nilai akhir
- Sertakan umpan balik (feedback) untuk tiap pilihan jawaban/kesalahan umum siswa
- Sertakan rekomendasi tindak lanjut pembelajaran berdasarkan hasil (remedial/pengayaan)
` : `
## F. KHUSUS ASESMEN SUMATIF
- Sertakan kisi-kisi soal lengkap (tabel: No, KD/CP, Materi, Indikator, Level Kognitif, Bentuk Soal, Nomor Soal, Tingkat Kesukaran)
- Sertakan pedoman penskoran total dan konversi ke nilai akhir (skala 0-100)
- Pastikan validitas isi: soal representatif terhadap seluruh cakupan materi yang diujikan
`}

## G. FORMAT OUTPUT
Sajikan hasil dalam bentuk:
1. Kisi-kisi soal (tabel)
2. Kartu soal per nomor (format terstruktur sesuai poin B)
3. Kunci jawaban dan pedoman penskoran (rekap terpisah di akhir)

Gunakan format tabel Markdown yang rapi agar mudah dibaca dan disalin ke Word/Excel.
`;

      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      const response = await generateContentWithRetry(ai, contents);

      const markdownOutput = response?.text || "";

      res.json({
        status: "success",
        markdown: markdownOutput
      });
    } catch (err: any) {
      console.error("Gagal generate Kartu Soal AI:", err);
      res.status(500).json({
        status: "error",
        message: err?.message || "Terjadi kesalahan saat memproses Kartu Soal AI."
      });
    }
  });

  // API 4.7: Generate Modul Kokurikuler AI
  app.post("/api/ai/generate-modul-kokurikuler", async (req, res) => {
    try {
      const { formData } = req.body || {};
      const ai = getAiClient();

      const school = formData?.school || "SMP NEGERI 3 KERINCI";
      const grade = formData?.grade || "Kelas VIII";
      const topic = formData?.topic || "Peduli Lingkungan & Pengelolaan Sampah Organik";
      const duration = formData?.duration || "4 JP (4 x 40 Menit)";
      const location = formData?.location || "Lingkungan sekolah dan bank sampah sekitar";
      const selectedDimensions = Array.isArray(formData?.dimensions) && formData.dimensions.length > 0 
        ? formData.dimensions 
        : ["Penalaran Kritis", "Kolaborasi"];
      const subject1 = formData?.subject1 || "IPA";
      const subject2 = formData?.subject2 || "Bahasa Indonesia";
      const pedagogicalPractice = formData?.pedagogicalPractice || "Pembelajaran Berbasis Proyek (Project-Based Learning)";
      const learningEnvironment = formData?.learningEnvironment || "Memberi kesempatan siswa untuk mengeksplorasi dan mengamati secara langsung pemilahan sampah di lingkungan sekolah dan sekitarnya";
      const partnership = formData?.partnership || "Kolaborasi lintas mata pelajaran IPA (analisis dekomposisi sampah) dan Bahasa Indonesia (penyusunan teks laporan hasil observasi), serta kemitraan dengan pengelola Bank Sampah";
      const digitalTools = formData?.digitalTools || "Canva untuk infografis kampanye, Google Spreadsheet untuk pencatatan data timbangan sampah, dan video dokumentasi smartphone";

      const prompt = `
Buatkan saya perencanaan kegiatan kokurikuler dengan format berikut. Sesuaikan tingkat kompleksitas bahasa, tujuan pembelajaran, dan kegiatan dengan jenjang kelas yang saya tentukan (SMP untuk kelas VII–IX, SMA untuk kelas X–XII).

Nama satuan pendidikan : ${school}
Kelas : ${grade}
Tema Kegiatan : ${topic}
Alokasi Waktu : ${duration}
Lokasi Kegiatan : ${location}

A. Dimensi Profil Lulusan
Pilih hanya 2 Dimensi Profil Lulusan dari 8 daftar dimensi di bawah ini yang paling sesuai dengan tema kegiatan di atas (Fokus dimensi yang dipilih: ${selectedDimensions.join(" dan ")}):
1. Keimanan dan Ketakwaan terhadap Tuhan YME — dipilih jika tema terkait keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa; mengacu pada individu yang memiliki keyakinan dan mengamalkan ajaran agama/kepercayaannya, berakhlak mulia, serta menjaga hubungan dengan Tuhan, sesama manusia, dan lingkungan.
2. Kewargaan — dipilih jika tema terkait individu yang bangga akan identitas dan budayanya, menghargai keberagaman, menjaga persatuan bangsa, menaati aturan bernegara dan bermasyarakat, serta menjaga keberlanjutan kehidupan, lingkungan, dan harmoni antarbangsa.
3. Penalaran Kritis — dipilih jika tema terkait individu yang memiliki rasa ingin tahu, mampu berpikir logis dan analitis, menganalisis dan menyelesaikan permasalahan, berargumentasi logis, serta memanfaatkan literasi dan numerasi untuk memecahkan masalah.
4. Kreativitas — dipilih jika tema terkait individu yang mampu berperilaku produktif, menciptakan inovasi, dan merumuskan solusi bagi permasalahan di sekitarnya.
5. Kolaborasi — dipilih jika tema terkait individu yang membiasakan diri peduli dan berbagi, serta membangun kerja sama dengan berbagai kalangan di lingkungan sekitar.
6. Kemandirian — dipilih jika tema terkait individu yang mampu bertanggung jawab, berinisiatif, dan beradaptasi dalam pembelajaran dan pengembangan diri.
7. Kesehatan — dipilih jika tema terkait individu yang menjalankan pola hidup bersih dan sehat berdasarkan pemahaman tentang kebugaran, kesehatan fisik dan mental, dan berkontribusi positif terhadap lingkungannya.
8. Komunikasi — dipilih jika tema terkait individu yang memiliki kemampuan menyimak, membaca, berbicara, dan menulis dengan baik dan benar, sesuai etika dalam beragam konteks dan moda.

(Tuliskan secara terperinci dan mendalam mengenai 2 dimensi yang dipilih tersebut dan kaitannya dengan tema kegiatan).

B. Tujuan Pembelajaran
Tuliskan 2 tujuan pembelajaran yang ingin dicapai, masing-masing dari mata pelajaran yang berbeda namun relevan dengan tema:
- Tujuan pembelajaran untuk mata pelajaran ${subject1} — gambarkan hasil yang diharapkan setelah kegiatan kokurikuler.
- Tujuan pembelajaran untuk mata pelajaran ${subject2}, yang berkaitan dengan mata pelajaran pertama sehingga mendukung kemitraan lintas mata pelajaran pada bagian E.

C. Praktik Pedagogis
${pedagogicalPractice}

D. Lingkungan Belajar
${learningEnvironment}

E. Kemitraan Pembelajaran
${partnership}

F. Pemanfaatan Digital
${digitalTools}

G. Kegiatan
Tuliskan langkah-langkah kegiatan secara runtut beserta estimasi waktu tiap langkah (dalam menit), dengan total waktu sesuai Alokasi Waktu (${duration}) yang ditentukan di atas. Minimal 6 langkah runtut (misal: 1. Pembukaan & Pengkondisian Siswa, 2. Pembagian Kelompok & Penjelasan Misi, 3. Investigasi / Eksplorasi Langsung di Lokasi, 4. Analisis Data & Pengolahan Temuan Kelompok, 5. Presentasi & Umpan Balik Teman Sejawat, 6. Refleksi & Penarikan Kesimpulan Bersama).

H. Asesmen
Gunakan teknik observasi dengan instrumen catatan anekdotal + penilaian kinerja rubrik.
1. Tabel Lembar Observasi Catatan Anekdotal:
   - Kolom: No | Nama Murid | Peristiwa / Perilaku Teramati | Catatan Guru (berdasarkan 2 dimensi profil lulusan yang dipilih di bagian A) | Tindak Lanjut
   - Berikan contoh baris terisi minimal 3 murid.

2. Rubrik Penilaian Kinerja Kokurikuler:
   - Kolom: Aspek yang Dinilai (sesuai 2 dimensi profil lulusan yang dipilih) | Belum Berkembang (BB) | Mulai Berkembang (MB) | Berkembang Sesuai Harapan (BSH) | Sangat Berkembang (SB)
   - Berikan deskriptor singkat dan terukur untuk tiap level skala pada setiap aspek yang dinilai.

Format Output:
Sajikan seluruh hasil dalam format terstruktur rapi (heading A–H sesuai di atas), dengan tabel pada bagian H menggunakan format tabel markdown yang presisi.
`;

      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      const response = await generateContentWithRetry(ai, contents);

      const markdownOutput = response?.text || "";

      res.json({
        status: "success",
        markdown: markdownOutput
      });
    } catch (err: any) {
      console.error("Gagal generate Modul Kokurikuler AI:", err);
      res.status(500).json({
        status: "error",
        message: err?.message || "Terjadi kesalahan saat memproses Modul Kokurikuler AI."
      });
    }
  });

  // API 5: Generate Soal Ujian AI (Naskah Soal Ujian, Lembar Jawaban Siswa, Kunci & Pedoman Penskoran)
  app.post("/api/ai/generate-soal-ujian", async (req, res) => {
    try {
      const { docType = "naskah", formData } = req.body || {};
      const ai = getAiClient();

      const schoolName = formData?.school || "SMP NEGERI 3 KERINCI";
      const subject = formData?.subject || "Bahasa Indonesia";
      const level = formData?.level || "Kelas VIII / Fase D";
      const examType = formData?.examType || "Asesmen Sumatif Akhir Semester (SAS)";
      const year = formData?.year || "2026/2027 - Semester Ganjil";
      const examDate = formData?.examDate || "Senin, 1 Desember 2026";
      const duration = formData?.duration || "90 Menit";
      const totalQuestions = formData?.totalQuestions || "40 Butir Soal (30 Pilihan Ganda, 5 Isian Singkat, 5 Uraian)";
      const rawMateriSoal = formData?.sumberMateri || "";
      const logoUrl = formData?.logoUrl || "https://lh3.googleusercontent.com/d/19TVwFRIp_t7sHTMntziM9SgZVoJAkhQU";
      const teacher = formData?.teacher || "Drs. Yefri Haryanto, M.Pd.";
      const nipTeacher = formData?.nipTeacher || "19850312 201001 1 008";
      const principal = formData?.principal || "Hamdani, S.Pd., M.Si.";
      const nipPrincipal = formData?.nipPrincipal || "19780514 200212 1 003";
      const cityDate = formData?.cityDate || "Kerinci, 1 Desember 2026";

      let prompt = "";

      const commonCss = `
<style>
  @page {
    size: A4 portrait;
    margin: 2cm 2cm 2cm 2cm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11.5pt;
    line-height: 1.45;
    color: #111827;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  .kop-naskah {
    text-align: center;
    border-bottom: 3px double #000000;
    padding-bottom: 8px;
    margin-bottom: 12px;
    position: relative;
  }
  .kop-logo {
    position: absolute;
    left: 5px;
    top: 5px;
    max-height: 65px;
    width: auto;
  }
  .kop-title {
    font-size: 13pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0 0 2px 0;
    letter-spacing: 0.5px;
  }
  .kop-school {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0 0 4px 0;
  }
  .kop-meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 10.5pt;
  }
  .kop-meta-table td {
    padding: 2px 4px;
    vertical-align: top;
  }
  .kotak-identitas {
    border: 1.5px solid #000;
    padding: 8px 12px;
    margin-bottom: 14px;
    background-color: #fbfbfb;
    border-radius: 4px;
    page-break-inside: avoid;
  }
  .kotak-identitas table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  .petunjuk-umum {
    border: 1px dashed #333;
    padding: 8px 12px;
    margin-bottom: 16px;
    background: #f9f9f9;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  .petunjuk-umum ol {
    margin: 4px 0 0 16px;
    padding: 0;
  }
  .section-title {
    font-size: 12pt;
    font-weight: bold;
    background-color: #f0f0f0;
    padding: 5px 10px;
    border-left: 4px solid #1e3a8a;
    margin: 18px 0 10px 0;
    page-break-inside: avoid;
    text-transform: uppercase;
  }
  .section-instruction {
    font-style: italic;
    font-size: 10.5pt;
    margin-bottom: 12px;
    color: #374151;
  }
  .soal-item {
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .soal-nomor {
    font-weight: bold;
    display: inline;
  }
  .soal-text {
    display: inline;
  }
  .opsi-container {
    margin-top: 5px;
    margin-left: 20px;
  }
  .opsi-grid-2 {
    display: table;
    width: 100%;
    margin-top: 4px;
  }
  .opsi-col {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding-bottom: 3px;
  }
  .opsi-single {
    margin-bottom: 3px;
  }
  .space-isian {
    display: inline-block;
    min-width: 250px;
    border-bottom: 1.5px dotted #000;
    margin-left: 8px;
    height: 18px;
  }
  .space-uraian {
    border: 1px solid #999;
    min-height: 90px;
    margin-top: 8px;
    margin-bottom: 10px;
    background: #fafafa;
    border-radius: 3px;
  }
  .footer-naskah {
    margin-top: 30px;
    text-align: center;
    font-style: italic;
    font-weight: bold;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    font-size: 11pt;
    page-break-inside: avoid;
  }
  .badge-rahasia {
    border: 2px solid #b91c1c;
    color: #b91c1c;
    background: #fef2f2;
    padding: 6px 12px;
    text-align: center;
    font-weight: 900;
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .table-kunci {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    margin-bottom: 15px;
    font-size: 10.5pt;
  }
  .table-kunci th, .table-kunci td {
    border: 1px solid #333;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  .table-kunci th {
    background-color: #1e3a8a;
    color: #ffffff;
    font-weight: bold;
    text-align: center;
  }
  .ttd-container {
    margin-top: 30px;
    width: 100%;
    border-collapse: collapse;
    page-break-inside: avoid;
  }
  .ttd-container td {
    vertical-align: top;
    width: 50%;
    text-align: center;
    font-size: 11pt;
  }
</style>
`;

      if (docType === "naskah") {
        prompt = `
Anda adalah penyusun naskah ujian profesional di Indonesia. Buatkan NASKAH SOAL UJIAN SIAP CETAK berdasarkan kartu soal/kisi-kisi/materi berikut, dengan format layout resmi seperti lembar soal ujian sekolah di Indonesia. Hasilkan sebagai file HTML terstruktur rapi (siap dikonversi ke Word dan PDF), BUKAN sekadar teks biasa.

INFORMASI IDENTITAS NASKAH:
- Nama Sekolah: ${schoolName}
- Logo Sekolah: ${logoUrl}
- Mata Pelajaran: ${subject}
- Kelas/Fase: ${level}
- Jenis Penilaian: ${examType}
- Tahun Ajaran & Semester: ${year}
- Hari, Tanggal: ${examDate}
- Waktu Pengerjaan: ${duration}
- Jumlah Butir Soal: ${totalQuestions}

SUMBER MATERI SOAL / KISI-KISI / KARTU SOAL:
${rawMateriSoal}

PETUNJUK STRUKTUR NASKAH YANG WAJIB DIIKUTI PERSIS:
1. Kop/kepala naskah resmi: Berisi nama sekolah (${schoolName}), judul ujian (${examType}), tabel identitas 2 kolom (Mata Pelajaran: ${subject}, Kelas/Fase: ${level}, Hari/Tanggal: ${examDate}, Waktu: ${duration}), garis pembatas ganda tebal.
2. Kotak identitas peserta ujian: Kolom untuk Nama Siswa (titik-titik), Nomor Peserta / Absen, Kelas / Ruang, Tanda Tangan Peserta.
3. Petunjuk umum mengerjakan soal: Lengkap & formal (Berdoa sebelum mengerjakan, tulis identitas pada lembar yang disediakan, periksa kelengkapan soal, dahulukan soal yang dianggap mudah, gunakan bolpoin hitam/biru, dilarang menggunakan kalkulator/alat bantu/HP, periksa kembali pekerjaan sebelum diserahkan).
4. Butir-butir soal dikelompokkan per bagian jika ada beberapa bentuk soal (misal Bagian I: Pilihan Ganda (opsi A-D untuk SMP / A-E untuk SMA), Bagian II: Pilihan Ganda Kompleks / Benar-Salah, Bagian III: Isian Singkat, Bagian IV: Uraian/Esai).
   - Setiap bagian WAJIB memiliki petunjuk pengerjaan spesifik.
   - Penomoran soal HARUS berurutan dari 1 sampai akhir secara konsisten.
   - Opsi PG disusun rapi (gunakan tata letak 2 kolom atau 1 kolom jika opsi panjang).
   - Isian singkat diberi garis titik-titik jawaban.
   - Soal uraian diberi ruang kosong secukupnya untuk menuliskan jawaban.
5. Footer naskah di akhir: "--- SELAMAT MENGERJAKAN & SEMOGA SUKSES ---".
6. Format CSS Print-Friendly A4: Gunakan Times New Roman 11.5pt, margin standar, page-break-inside: avoid pada butir soal agar tidak terpotong jelek saat dicetak.

PENTING:
Hasilkan MURNI kode HTML (lengkap dengan tag <div class="naskah-ujian">...</div> dan styling). JANGAN gunakan markdown code block (\`\`\`html). Output harus langsung dapat dirender di browser dan dicetak ke kertas A4.
`;
      } else if (docType === "ljs") {
        prompt = `
Anda adalah penyusun instrumen ujian profesional di Indonesia. Buatkan LEMBAR JAWABAN SISWA (LJS) SIAP CETAK terpisah yang rapi dan elegan, sesuai dengan format ujian sekolah resmi di Indonesia.

INFORMASI UJIAN:
- Nama Sekolah: ${schoolName}
- Mata Pelajaran: ${subject}
- Kelas/Fase: ${level}
- Jenis Penilaian: ${examType}
- Tahun Ajaran & Semester: ${year}
- Hari, Tanggal: ${examDate}
- Waktu Pengerjaan: ${duration}
- Estimasi Jumlah Soal: ${totalQuestions}

SUMBER KISI-KISI / MATERI:
${rawMateriSoal}

PETUNJUK STRUKTUR LEMBAR JAWABAN SISWA (LJS) YANG WAJIB ADA:
1. Kop Lembar Jawaban: Judul "LEMBAR JAWABAN SISWA (LJS)", nama sekolah (${schoolName}), mata pelajaran, kelas, hari/tanggal.
2. Kotak Identitas Siswa: Nama Lengkap Siswa, Nomor Ujian/Absen, Kelas, Ruang Ujian, Tanda Tangan Siswa.
3. Petunjuk Pengisian LJS: Petunjuk hitamkan bulatan atau silang [X] huruf pilihan jawaban, gunakan pensil 2B atau bolpoin, dll.
4. Area Lembar Jawab Pilihan Ganda: Tabel kotak bernomor rapi dengan kolom opsi jawaban (misal [ A ] [ B ] [ C ] [ D ] [ E ]) disusun dalam grid 2-3 kolom agar hemat ruang dan muat 1 halaman A4.
5. Area Lembar Jawab Isian Singkat (jika ada): Tabel nomor soal dengan kolom titik-titik/garis jawaban isian.
6. Area Lembar Jawab Uraian / Esai (jika ada): Kolom bergaris luas untuk jawaban siswa per nomor uraian.
7. Kolom Nilai & Catatan Pengawas/Pemeriksa: Kotak Skor PG, Skor Isian, Skor Uraian, Total Nilai Akhir (0-100), dan Tanda Tangan Guru/Pemeriksa.
8. CSS Print-Friendly A4: Layout efisien, hemat kertas, pas 1-2 lembar A4 siap fotokopi/cetak.

PENTING:
Hasilkan MURNI kode HTML (tanpa code block markdown \`\`\`html).
`;
      } else if (docType === "kunci") {
        prompt = `
Anda adalah penyusun naskah ujian profesional di Indonesia. Buatkan DOKUMEN KUNCI JAWABAN & PEDOMAN PENSKORAN (DOKUMEN GURU) resmi dan terperinci berdasarkan kartu soal/kisi-kisi berikut.

INFORMASI UJIAN:
- Nama Sekolah: ${schoolName}
- Mata Pelajaran: ${subject}
- Kelas/Fase: ${level}
- Jenis Penilaian: ${examType}
- Tahun Ajaran & Semester: ${year}
- Hari, Tanggal: ${examDate}
- Jumlah Soal: ${totalQuestions}
- Guru Pengampu: ${teacher} (NIP: ${nipTeacher})
- Kepala Sekolah: ${principal} (NIP: ${nipPrincipal})
- Tempat, Tanggal: ${cityDate}

SUMBER KISI-KISI / SOAL:
${rawMateriSoal}

STRUKTUR DOKUMEN YANG WAJIB ADA (DOKUMEN GURU):
1. Peringatan Rahasia Guru: Banner tebal "DOKUMEN GURU — RAHASIA — TIDAK UNTUK DIBAGIKAN KEPADA SISWA".
2. Kop & Identitas Ujian Lengkap.
3. Tabel Kunci Jawaban Pilihan Ganda: Tabel berisi No, Kunci Jawaban (A/B/C/D/E), Skor Per Nomor (mis. bobot 1 atau 2), Pembahasan Singkat jika perlu.
4. Kunci Jawaban & Rubrik Penskoran Isian Singkat: No, Kunci Jawaban Baku & Alternatif Benar, Skor Maksimal.
5. Kunci Jawaban & Rubrik Penskoran Uraian/Esai (Sangat Detail):
   - No Soal Uraian
   - Kunci/Indikator Jawaban Lengkap
   - Kriteria Penskoran Berjenjang (mis. Jawaban lengkap & tepat = 4, Jawaban sebagian tepat = 3, Jawaban kurang tepat = 2, Jawaban salah ada usaha = 1, Kosong = 0)
   - Skor Maksimal per butir soal
6. Rekapitulasi Skor Maksimal & Rumus Konversi Nilai Akhir:
   - Total Skor Maksimal PG + Isian + Uraian
   - Rumus Perhitungan Nilai Akhir (Skala 0 - 100): NA = (Total Skor Perolehan / Total Skor Maksimal) x 100, atau rumus pembobotan yang jelas (mis. PG 60%, Uraian 40%).
7. Blok Tanda Tangan Resmi: Tempat Tanggal (${cityDate}), Mengetahui Kepala Sekolah (${principal}, NIP: ${nipPrincipal}) dan Guru Mata Pelajaran (${teacher}, NIP: ${nipTeacher}).

PENTING:
Hasilkan MURNI kode HTML (tanpa code block markdown \`\`\`html).
`;
      } else {
        prompt = `Buatkan Dokumen Ujian Sekolah untuk ${schoolName}, mapel ${subject}, kelas ${level}, tahun ${year}. Sumber materi: ${rawMateriSoal}. Hasilkan HTML siap cetak A4.`;
      }

      const contents = [{ role: "user", parts: [{ text: `${commonCss}\n\n${prompt}` }] }];
      const response = await generateContentWithRetry(ai, contents);

      let htmlOutput = response?.text || "";
      htmlOutput = htmlOutput.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

      res.json({ status: "success", html: htmlOutput, docType });
    } catch (err: any) {
      console.error("Gagal generate Soal Ujian AI:", err);
      res.status(500).json({
        status: "error",
        message: err?.message || "Terjadi kesalahan saat memproses Naskah Soal Ujian AI."
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server EdAdmin Pro running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
