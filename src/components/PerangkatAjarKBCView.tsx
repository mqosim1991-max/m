import React, { useState } from "react";
import { 
  FileCheck, 
  Sparkles, 
  Printer, 
  Download, 
  BookOpen, 
  Loader2, 
  CheckCircle2, 
  Layers, 
  Calendar, 
  Award,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  HeartHandshake,
  FileText,
  CheckSquare,
  BookMarked,
  LayoutList
} from "lucide-react";
import { Pengaturan } from "../types";
import { notifySimpanSuccess, notifySimpanError, notifyUnduhSuccess } from "../lib/swal";

interface PerangkatAjarKBCViewProps {
  config: Pengaturan;
}

export const PerangkatAjarKBCView: React.FC<PerangkatAjarKBCViewProps> = ({ config }) => {
  const [activeDoc, setActiveDoc] = useState<
    "analisis_cp" | "tp" | "atp" | "prota" | "prosem" | "kktp" | "modul_ajar" | "lkpd" | "rubrik"
  >("analisis_cp");

  const [inputTab, setInputTab] = useState<"admin" | "modul">("admin");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState("");

  // Store generated HTML for each document type
  const [generatedDocs, setGeneratedDocs] = useState<Record<string, string>>({
    analisis_cp: "",
    tp: "",
    atp: "",
    prota: "",
    prosem: "",
    kktp: "",
    modul_ajar: "",
    lkpd: "",
    rubrik: ""
  });

  // Data Form untuk Administrasi (Dokumen 1-6: ACP, TP, ATP, Prota, Prosem, KKTP)
  const [formData, setFormData] = useState({
    schoolName: config.Nama_Sekolah || "MAN 1 Kerinci",
    kemenagOffice: "KANTOR KEMENTERIAN AGAMA KABUPATEN KERINCI",
    subject: "Akidah Akhlak",
    singkatanMapel: "AA",
    level: "Fase E / Kelas X",
    year: "2026/2027",
    totalJp: "72 JP / Tahun",
    jpPerMinggu: "2 JP/Minggu",
    teacher: config.Nama_Guru || "Drs. Yefri Haryanto, M.Pd.",
    nipTeacher: config.NIP_Guru || "19850312 201001 1 008",
    cityDate: `${config.Tempat_Tanda_Tangan || "Kerinci"}, 14 Juli 2026`,
    principal: config.Nama_Kepsek || "Hamdani, S.Pd., M.Si.",
    nipPrincipal: config.NIP_Kepsek || "19780514 200212 1 003",
    learningModel: "Discovery Learning",
    cpRasional: "Kurikulum Berbasis Cinta (KBC) mengintegrasikan Panca Cinta Kemenag (Cinta Allah & Rasul, Cinta Diri & Sesama, Cinta Ilmu, Cinta Bangsa & Negara, Cinta Alam) serta 10 Nilai PPRA (Ta'addub, Qudwah, Muwaṭanah, Tawassuṭ, Tawāzun, I'tidāl, Musāwah, Syūrā, Tasāmuh, Tathawwur wa Ibtikār). Membentuk peserta didik madrasah yang berkeadaban, bernalar kritis, dan berakhlak mulia.",
    cpElemen: `Elemen 1 — Akidah:
Peserta didik mampu menganalisis sifat-sifat Allah Swt., konsep tauhid, dan Asmaul Husna secara mendalam serta menginternalisasi nilai kasih sayang dan keagungan Allah dalam kehidupan sehari-hari.

Elemen 2 — Akhlak:
Peserta didik mampu menganalisis dan membiasakan akhlak terpuji (mahmudah) seperti ta'addub, tasamuh, dan qudwah, serta menghindari akhlak tercela (mazmumah) dalam interaksi sosial dan digital.

Elemen 3 — Adab:
Peserta didik mampu menerapkan adab islami terhadap orang tua, guru, sesama manusia, serta lingkungan hidup berbasis kepedulian dan cinta kasih sesama.`
  });

  // Data Form KHUSUS Modul Ajar, LKPD, & Rubrik (Dokumen 7-9)
  const [formDataModul, setFormDataModul] = useState({
    kemenagOffice: "KANTOR KEMENTERIAN AGAMA KABUPATEN KERINCI",
    schoolName: config.Nama_Sekolah || "MAN 1 Kerinci",
    schoolAddress: "Jl. Raya Semurup No. 45, Semurup, Kabupaten Kerinci",
    subject: "Akidah Akhlak",
    level: "Fase E / Kelas X",
    year: "2026/2027",
    teacher: config.Nama_Guru || "Drs. Yefri Haryanto, M.Pd.",
    nipTeacher: config.NIP_Guru || "19850312 201001 1 008",
    cityDate: `${config.Tempat_Tanda_Tangan || "Kerinci"}, 14 Juli 2026`,
    principal: config.Nama_Kepsek || "Hamdani, S.Pd., M.Si.",
    nipPrincipal: config.NIP_Kepsek || "19780514 200212 1 003",
    kodeTp: "TP.AA.ELE.10.01",
    rumusanTp: "Peserta didik mampu menganalisis konsep tauhid dan Asmaul Husna secara mendalam, serta menginternalisasi nilai kasih sayang Allah Swt. dalam kehidupan sehari-hari dan kearifan lokal Kerinci.",
    elemenCp: "Akidah",
    learningModel: "Discovery Learning",
    sintakModel: "1. Stimulasi/Pemberian Rangsangan, 2. Identifikasi Masalah, 3. Pengumpulan Data, 4. Pengolahan Data, 5. Pembuktian, 6. Penarikan Kesimpulan",
    jumlahPertemuan: "3",
    jpPerPertemuan: "2",
    topikLokal: "Pelestarian Lingkungan Hutan TNKS & Budaya Adat Mudik Kerinci (Panca Cinta & PPRA)"
  });

  const docTypeList = [
    { id: "analisis_cp", label: "1. Analisis CP", fullTitle: "Analisis Capaian Pembelajaran (ACP) KBC", icon: BookOpen },
    { id: "tp", label: "2. Tujuan Pembelajaran", fullTitle: "Tujuan Pembelajaran (TP) KBC", icon: FileCheck },
    { id: "atp", label: "3. Alur TP (ATP)", fullTitle: "Alur Tujuan Pembelajaran (ATP) KBC", icon: Layers },
    { id: "prota", label: "4. Program Tahunan", fullTitle: "Program Tahunan (Prota) KBC", icon: Calendar },
    { id: "prosem", label: "5. Program Semester", fullTitle: "Program Semester (Prosem) KBC", icon: FileSpreadsheet },
    { id: "kktp", label: "6. KKTP KBC", fullTitle: "Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) KBC", icon: Award },
    { id: "modul_ajar", label: "7. Modul Ajar KBC", fullTitle: "Modul Ajar Deep Learning KBC", icon: HeartHandshake },
    { id: "lkpd", label: "8. LKPD KBC", fullTitle: "Lembar Kerja Peserta Didik (LKPD) KBC", icon: FileText },
    { id: "rubrik", label: "9. Rubrik Formatif & Sumatif", fullTitle: "Rubrik Penilaian Formatif & Sumatif KBC", icon: CheckSquare }
  ];

  const handleSelectDoc = (docId: any) => {
    setActiveDoc(docId);
    if (docId === "modul_ajar" || docId === "lkpd" || docId === "rubrik") {
      setInputTab("modul");
    } else {
      setInputTab("admin");
    }
  };

  const handleFillSample = () => {
    setFormData({
      schoolName: config.Nama_Sekolah || "MAN 1 Kerinci",
      kemenagOffice: "KANTOR KEMENTERIAN AGAMA KABUPATEN KERINCI",
      subject: "Akidah Akhlak",
      singkatanMapel: "AA",
      level: "Fase E / Kelas X",
      year: "2026/2027",
      totalJp: "72 JP / Tahun",
      jpPerMinggu: "2 JP/Minggu",
      teacher: config.Nama_Guru || "Drs. Yefri Haryanto, M.Pd.",
      nipTeacher: config.NIP_Guru || "19850312 201001 1 008",
      cityDate: `${config.Tempat_Tanda_Tangan || "Kerinci"}, 14 Juli 2026`,
      principal: config.Nama_Kepsek || "Hamdani, S.Pd., M.Si.",
      nipPrincipal: config.NIP_Kepsek || "19780514 200212 1 003",
      learningModel: "Discovery Learning",
      cpRasional: "Kurikulum Berbasis Cinta (KBC) mengintegrasikan Panca Cinta Kemenag (Cinta Allah & Rasul, Cinta Diri & Sesama, Cinta Ilmu, Cinta Bangsa & Negara, Cinta Alam) serta 10 Nilai PPRA (Ta'addub, Qudwah, Muwaṭanah, Tawassuṭ, Tawāzun, I'tidāl, Musāwah, Syūrā, Tasāmuh, Tathawwur wa Ibtikār). Membentuk peserta didik madrasah yang berkeadaban, bernalar kritis, dan berakhlak mulia.",
      cpElemen: `Elemen 1 — Akidah:
Peserta didik mampu menganalisis sifat-sifat Allah Swt., konsep tauhid, dan Asmaul Husna secara mendalam serta menginternalisasi nilai kasih sayang dan keagungan Allah dalam kehidupan sehari-hari.

Elemen 2 — Akhlak:
Peserta didik mampu menganalisis dan membiasakan akhlak terpuji (mahmudah) seperti ta'addub, tasamuh, dan qudwah, serta menghindari akhlak tercela (mazmumah) dalam interaksi sosial dan digital.

Elemen 3 — Adab:
Peserta didik mampu menerapkan adab islami terhadap orang tua, guru, sesama manusia, serta lingkungan hidup berbasis kepedulian dan cinta kasih sesama.`
    });
    notifySimpanSuccess("Contoh data Administrasi KBC berhasil dimuat!");
  };

  const handleFillSampleModul = () => {
    setFormDataModul({
      kemenagOffice: "KANTOR KEMENTERIAN AGAMA KABUPATEN KERINCI",
      schoolName: config.Nama_Sekolah || "MAN 1 Kerinci",
      schoolAddress: "Jl. Raya Semurup No. 45, Semurup, Kabupaten Kerinci",
      subject: "Akidah Akhlak",
      level: "Fase E / Kelas X",
      year: "2026/2027",
      teacher: config.Nama_Guru || "Drs. Yefri Haryanto, M.Pd.",
      nipTeacher: config.NIP_Guru || "19850312 201001 1 008",
      cityDate: `${config.Tempat_Tanda_Tangan || "Kerinci"}, 14 Juli 2026`,
      principal: config.Nama_Kepsek || "Hamdani, S.Pd., M.Si.",
      nipPrincipal: config.NIP_Kepsek || "19780514 200212 1 003",
      kodeTp: "TP.AA.ELE.10.01",
      rumusanTp: "Peserta didik mampu menganalisis konsep tauhid dan Asmaul Husna secara mendalam, serta menginternalisasi nilai kasih sayang Allah Swt. dalam kehidupan sehari-hari dan kearifan lokal Kerinci.",
      elemenCp: "Akidah",
      learningModel: "Discovery Learning",
      sintakModel: "1. Stimulasi/Pemberian Rangsangan, 2. Identifikasi Masalah, 3. Pengumpulan Data, 4. Pengolahan Data, 5. Pembuktian, 6. Penarikan Kesimpulan",
      jumlahPertemuan: "3",
      jpPerPertemuan: "2",
      topikLokal: "Pelestarian Lingkungan Hutan TNKS & Budaya Adat Mudik Kerinci (Panca Cinta & PPRA)"
    });
    notifySimpanSuccess("Contoh data Khusus Modul Ajar, LKPD & Rubrik KBC berhasil dimuat!");
  };

  const sanitizeHtmlForOutput = (rawHtml: string) => {
    if (!rawHtml) return "";
    let clean = rawHtml;
    const defaultLogoTag = `<img src="${config.Logo_Kiri || config.Logo_Kanan || 'https://lh3.googleusercontent.com/d/19TVwFRIp_t7sHTMntziM9SgZVoJAkhQU'}" alt="Logo Kemenag/Sekolah" class="logo-sekolah" style="max-height: 70px; width: auto; float: left; margin-right: 15px; object-fit: contain;" />`;
    
    clean = clean.replace(/\[\s*LOGO[^\n\]]*\]/gi, defaultLogoTag);
    clean = clean.replace(/\[\s*Gambar Logo[^\n\]]*\]/gi, defaultLogoTag);
    clean = clean.replace(/<button[^>]*>.*?cetak.*?<\/button>/gi, "");
    clean = clean.replace(/<a[^>]*>.*?cetak.*?<\/a>/gi, "");
    clean = clean.replace(/🖨️?\s*Cetak\s*Dokumen/gi, "");
    clean = clean.replace(/🖨️/g, "");
    return clean;
  };

  const handleGenerateDoc = async (targetType: string) => {
    setIsGenerating(true);
    const docMeta = docTypeList.find((d) => d.id === targetType);
    setGeneratingProgress(`Menyusun ${docMeta?.fullTitle || targetType}...`);

    const isModulType = targetType === "modul_ajar" || targetType === "lkpd" || targetType === "rubrik";
    const payloadData = isModulType ? formDataModul : formData;

    try {
      const res = await fetch("/api/ai/generate-perangkat-ajar-kbc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: targetType,
          formData: payloadData
        })
      });

      const data = await res.json();
      if (data.status === "success" && data.html) {
        const cleanedHtml = sanitizeHtmlForOutput(data.html);
        setGeneratedDocs((prev) => ({
          ...prev,
          [targetType]: cleanedHtml
        }));
        notifySimpanSuccess(`${docMeta?.fullTitle || "Dokumen"} KBC berhasil dibuat!`);
      } else {
        throw new Error(data.message || "Gagal menghasilkan dokumen KBC");
      }
    } catch (err: any) {
      console.error(err);
      notifySimpanError(`Gagal membuat ${docMeta?.fullTitle}: ` + (err?.message || "Terjadi kesalahan server."));
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate 3 Paket Pembelajaran (Modul Ajar, LKPD, Rubrik)
  const handleGenerate3ModulDocs = async () => {
    setIsGenerating(true);
    const modulTypes = [
      { id: "modul_ajar", title: "Modul Ajar Deep Learning KBC" },
      { id: "lkpd", title: "LKPD KBC" },
      { id: "rubrik", title: "Rubrik Penilaian Formatif & Sumatif KBC" }
    ];

    for (let i = 0; i < modulTypes.length; i++) {
      const t = modulTypes[i];
      setGeneratingProgress(`[${i + 1}/3] Menyusun ${t.title}...`);

      try {
        const res = await fetch("/api/ai/generate-perangkat-ajar-kbc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType: t.id,
            formData: formDataModul
          })
        });

        const data = await res.json();
        if (data.status === "success" && data.html) {
          const cleanedHtml = sanitizeHtmlForOutput(data.html);
          setGeneratedDocs((prev) => ({
            ...prev,
            [t.id]: cleanedHtml
          }));
        }
      } catch (err) {
        console.error(`Gagal pada ${t.id}:`, err);
      }
    }

    setIsGenerating(false);
    setActiveDoc("modul_ajar");
    notifySimpanSuccess("Paket 3 Dokumen (Modul Ajar, LKPD, & Rubrik KBC) Berhasil Dibuat!");
  };

  const handleGenerateAllDocs = async () => {
    setIsGenerating(true);
    const types = docTypeList.map((d) => d.id);

    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      const docMeta = docTypeList.find((d) => d.id === t);
      setGeneratingProgress(`[${i + 1}/${types.length}] Menyusun ${docMeta?.fullTitle}...`);

      const isModulType = t === "modul_ajar" || t === "lkpd" || t === "rubrik";
      const payloadData = isModulType ? formDataModul : formData;

      try {
        const res = await fetch("/api/ai/generate-perangkat-ajar-kbc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType: t,
            formData: payloadData
          })
        });

        const data = await res.json();
        if (data.status === "success" && data.html) {
          const cleanedHtml = sanitizeHtmlForOutput(data.html);
          setGeneratedDocs((prev) => ({
            ...prev,
            [t]: cleanedHtml
          }));
        }
      } catch (err) {
        console.error(`Gagal pada ${t}:`, err);
      }
    }

    setIsGenerating(false);
    notifySimpanSuccess("Seluruh 9 Dokumen Administrasi Perangkat Ajar KBC Berhasil Dibuat!");
  };

  // Print A4 Function
  const handlePrintA4 = () => {
    const rawHtml = generatedDocs[activeDoc];
    if (!rawHtml) {
      notifySimpanError("Belum ada dokumen KBC yang dihasilkan untuk dicetak.");
      return;
    }

    const activeHtml = sanitizeHtmlForOutput(rawHtml);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      notifySimpanError("Gagal membuka jendela cetak. Periksa pembatas pop-up browser Anda.");
      return;
    }

    const isLandscape = activeDoc === "atp" || activeDoc === "prosem" || activeDoc === "kktp" || activeDoc === "rubrik";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Perangkat Ajar KBC - A4 Presisi</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 ${isLandscape ? "landscape" : "portrait"};
              margin: 1.2cm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 8px;
              font-size: 10pt;
            }
            th {
              background-color: #1a3a5c !important;
              color: #ffffff !important;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            table[style*="border:none"], table[style*="border: 0"], table.ttd-table, table.signature-table {
              border: none !important;
            }
            table[style*="border:none"] td, table[style*="border: 0"] td, table.ttd-table td, table.signature-table td {
              border: none !important;
            }
            img, .logo-sekolah, .kop-logo {
              display: inline-block !important;
              max-height: 75px;
              width: auto;
              object-fit: contain;
              vertical-align: middle;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img, .logo-sekolah, .kop-logo {
                display: inline-block !important;
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${activeHtml}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Download Word (.doc)
  const handleDownloadWord = () => {
    const rawHtml = generatedDocs[activeDoc];
    if (!rawHtml) {
      notifySimpanError("Belum ada dokumen KBC yang dihasilkan untuk diunduh.");
      return;
    }

    const activeHtml = sanitizeHtmlForOutput(rawHtml);
    const orientation = activeDoc === "atp" || activeDoc === "prosem" || activeDoc === "kktp" || activeDoc === "rubrik" ? "landscape" : "portrait";
    const docTitle = docTypeList.find((d) => d.id === activeDoc)?.fullTitle || "Perangkat_Ajar_KBC";
    const wordPageSize = orientation === "landscape" ? "841.9pt 595.3pt" : "595.3pt 841.9pt";
    const currentSubject = activeDoc === "modul_ajar" || activeDoc === "lkpd" || activeDoc === "rubrik" ? formDataModul.subject : formData.subject;

    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForCustomXSL/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page WordSection1 {
              size: ${wordPageSize};
              mso-page-orientation: ${orientation};
              margin: 36.0pt 36.0pt 36.0pt 36.0pt;
            }
            div.WordSection1 {
              page: WordSection1;
            }
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 15px;
            }
            td, th {
              border: 1px solid #1a3a5c;
              padding: 6px 8px;
              vertical-align: top;
            }
            th, td.header-cell, th.bg-header {
              background-color: #1a3a5c !important;
              background: #1a3a5c !important;
              color: #ffffff !important;
              font-weight: bold;
              text-align: center;
              mso-shading: windowtext transparent;
              mso-pattern: fill #1a3a5c;
            }
            table[style*="border:none"], table[style*="border: 0"], table[style*="border:none !important"], table.ttd-table, table.signature-table {
              border: none !important;
              mso-border-alt: none !important;
            }
            table[style*="border:none"] td, table[style*="border: 0"] td, table[style*="border:none !important"] td, table.ttd-table td, table.signature-table td {
              border: none !important;
              mso-border-alt: none !important;
            }
            img {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="WordSection1">
            ${activeHtml}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", wordContent], {
      type: "application/msword;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDoc.toUpperCase()}_KBC_${currentSubject.replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifyUnduhSuccess(`File Word (.doc) ${docTitle} berhasil diunduh!`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner KBC */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-emerald-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-emerald-400 text-slate-950 font-black px-3 py-1 rounded-full text-xs uppercase tracking-wider shadow-xs">
              <HeartHandshake className="w-4 h-4 text-slate-950" />
              <span>Kurikulum Berbasis Cinta (KBC) Kemenag RI</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-emerald-300">
              Perangkat Ajar KBC AI
            </h2>
            <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
              Generator 9 Paket Perangkat Administrasi Pembelajaran KBC (Analisis CP, TP, ATP, Prota, Prosem, KKTP, Modul Ajar Deep Learning, LKPD, & Rubrik Formatif/Sumatif) terintegrasi Panca Cinta Kemenag & 10 Nilai PPRA!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
            {inputTab === "modul" ? (
              <button
                onClick={handleGenerate3ModulDocs}
                disabled={isGenerating}
                className="bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black px-5 py-3 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-xs md:text-sm cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Modul + LKPD + Rubrik</span>
              </button>
            ) : (
              <button
                onClick={handleGenerateAllDocs}
                disabled={isGenerating}
                className="bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black px-5 py-3 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-xs md:text-sm cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate 9 Dokumen KBC</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selector Tab Mode Input */}
      <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setInputTab("admin")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition flex items-center justify-center space-x-2 cursor-pointer ${
            inputTab === "admin"
              ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-md border border-emerald-200 dark:border-emerald-800"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <LayoutList className="w-4 h-4 text-emerald-600" />
          <span>1. Input Administrasi KBC (ACP, TP, ATP, Prota, Prosem, KKTP)</span>
        </button>

        <button
          onClick={() => setInputTab("modul")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition flex items-center justify-center space-x-2 cursor-pointer ${
            inputTab === "modul"
              ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-md border border-emerald-200 dark:border-emerald-800"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <BookMarked className="w-4 h-4 text-amber-500" />
          <span>2. Input Khusus Modul Ajar, LKPD & Rubrik KBC</span>
        </button>
      </div>

      {/* Form Input Mode 1: Administrasi Pembelajaran */}
      {inputTab === "admin" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 flex-wrap gap-2">
            <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Data Identitas Madrasah & Capaian Pembelajaran (Dokumen Administrasi 1-6)</span>
            </h3>
            <button
              onClick={handleFillSample}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Isi Contoh Administrasi</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Kantor / Yayasan Kemenag</label>
              <input
                type="text"
                value={formData.kemenagOffice}
                onChange={(e) => setFormData({ ...formData, kemenagOffice: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Satuan Pendidikan / Madrasah</label>
              <input
                type="text"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mata Pelajaran</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Singkatan Mapel (Kode TP)</label>
              <input
                type="text"
                value={formData.singkatanMapel}
                onChange={(e) => setFormData({ ...formData, singkatanMapel: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fase / Kelas</label>
              <input
                type="text"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tahun Pelajaran</label>
              <input
                type="text"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Alokasi Waktu Total</label>
              <input
                type="text"
                value={formData.totalJp}
                onChange={(e) => setFormData({ ...formData, totalJp: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">JP per Minggu</label>
              <input
                type="text"
                value={formData.jpPerMinggu}
                onChange={(e) => setFormData({ ...formData, jpPerMinggu: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Model Pembelajaran Sintaks</label>
              <select
                value={formData.learningModel}
                onChange={(e) => setFormData({ ...formData, learningModel: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                <option value="Discovery Learning">Discovery Learning</option>
                <option value="Problem Based Learning">Problem Based Learning</option>
                <option value="Project Based Learning">Project Based Learning</option>
                <option value="Inquiry Learning">Inquiry Learning</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Guru Penyusun</label>
              <input
                type="text"
                value={formData.teacher}
                onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">NIP / NUPTK Guru</label>
              <input
                type="text"
                value={formData.nipTeacher}
                onChange={(e) => setFormData({ ...formData, nipTeacher: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Kota & Tanggal TTD</label>
              <input
                type="text"
                value={formData.cityDate}
                onChange={(e) => setFormData({ ...formData, cityDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Kepala Madrasah</label>
              <input
                type="text"
                value={formData.principal}
                onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">NIP Kepala Madrasah</label>
              <input
                type="text"
                value={formData.nipPrincipal}
                onChange={(e) => setFormData({ ...formData, nipPrincipal: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                CP Umum / Rasional KBC (Panca Cinta & PPRA)
              </label>
              <textarea
                rows={4}
                value={formData.cpRasional}
                onChange={(e) => setFormData({ ...formData, cpRasional: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-medium leading-relaxed"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Capaian Pembelajaran (CP) Per Elemen
              </label>
              <textarea
                rows={4}
                value={formData.cpElemen}
                onChange={(e) => setFormData({ ...formData, cpElemen: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-medium leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Input Mode 2: KHUSUS Modul Ajar, LKPD, & Rubrik KBC */}
      {inputTab === "modul" && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-6 border-2 border-emerald-300 dark:border-emerald-800 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <BookMarked className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-base md:text-lg font-black text-emerald-950 dark:text-emerald-200">
                  Input Khusus: Modul Ajar Deep Learning, LKPD, & Rubrik KBC
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                  Perangkat Pembelajaran Terhubung (1 TP, Sintak Model, Alokasi JP & Konteks Lokal Relevan)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleFillSampleModul}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Isi Contoh Modul + LKPD + Rubrik</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Blok Utama 1: Rumusan TP & Elemen CP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Kode TP</label>
                <input
                  type="text"
                  value={formDataModul.kodeTp}
                  onChange={(e) => setFormDataModul({ ...formDataModul, kodeTp: e.target.value })}
                  placeholder="misal: TP.IPA.KPS.7.01 / TP.AA.ELE.10.01"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Elemen CP</label>
                <input
                  type="text"
                  value={formDataModul.elemenCp}
                  onChange={(e) => setFormDataModul({ ...formDataModul, elemenCp: e.target.value })}
                  placeholder="misal: Akidah / Pemahaman IPA"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div className="md:col-span-3">
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Rumusan Lengkap Tujuan Pembelajaran (TP)
                </label>
                <textarea
                  rows={3}
                  value={formDataModul.rumusanTp}
                  onChange={(e) => setFormDataModul({ ...formDataModul, rumusanTp: e.target.value })}
                  placeholder="Rumusan lengkap TP yang akan dicapai..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 leading-relaxed"
                />
              </div>
            </div>

            {/* Blok Utama 2: Model Pembelajaran, Sintaks & Alokasi */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Model Pembelajaran</label>
                <select
                  value={formDataModul.learningModel}
                  onChange={(e) => setFormDataModul({ ...formDataModul, learningModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  <option value="Discovery Learning">Discovery Learning</option>
                  <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                  <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                  <option value="Inquiry Learning">Inquiry Learning</option>
                  <option value="Cooperative Learning">Cooperative Learning</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Jumlah Pertemuan</label>
                <input
                  type="text"
                  value={formDataModul.jumlahPertemuan}
                  onChange={(e) => setFormDataModul({ ...formDataModul, jumlahPertemuan: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Alokasi JP Per Pertemuan</label>
                <input
                  type="text"
                  value={formDataModul.jpPerPertemuan}
                  onChange={(e) => setFormDataModul({ ...formDataModul, jpPerPertemuan: e.target.value })}
                  placeholder="misal: 2 JP (2 x 45 menit)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              <div className="md:col-span-3">
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Urutan Sintaks Model Pembelajaran
                </label>
                <input
                  type="text"
                  value={formDataModul.sintakModel}
                  onChange={(e) => setFormDataModul({ ...formDataModul, sintakModel: e.target.value })}
                  placeholder="Urutan sintaks lengkap..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="md:col-span-3">
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Topik / Konteks Lokal Relevan (Kearifan Lokal Kerinci / Isu Lingkungan / Budaya)
                </label>
                <textarea
                  rows={2}
                  value={formDataModul.topikLokal}
                  onChange={(e) => setFormDataModul({ ...formDataModul, topikLokal: e.target.value })}
                  placeholder="misal: Isu lingkungan Hutan TNKS Kerinci, Budaya Gotong Royong Adat Kerinci, Tradisi Mudik Kerinci..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold leading-relaxed"
                />
              </div>
            </div>

            {/* Blok Utama 3: Identitas Madrasah & Pengesahan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Kantor Kemenag Kabupaten/Kota</label>
                <input
                  type="text"
                  value={formDataModul.kemenagOffice}
                  onChange={(e) => setFormDataModul({ ...formDataModul, kemenagOffice: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Madrasah / Sekolah</label>
                <input
                  type="text"
                  value={formDataModul.schoolName}
                  onChange={(e) => setFormDataModul({ ...formDataModul, schoolName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Alamat Lengkap Madrasah</label>
                <input
                  type="text"
                  value={formDataModul.schoolAddress}
                  onChange={(e) => setFormDataModul({ ...formDataModul, schoolAddress: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mata Pelajaran</label>
                <input
                  type="text"
                  value={formDataModul.subject}
                  onChange={(e) => setFormDataModul({ ...formDataModul, subject: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fase / Kelas</label>
                <input
                  type="text"
                  value={formDataModul.level}
                  onChange={(e) => setFormDataModul({ ...formDataModul, level: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tahun Pelajaran</label>
                <input
                  type="text"
                  value={formDataModul.year}
                  onChange={(e) => setFormDataModul({ ...formDataModul, year: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Guru Penyusun</label>
                <input
                  type="text"
                  value={formDataModul.teacher}
                  onChange={(e) => setFormDataModul({ ...formDataModul, teacher: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">NIP Guru</label>
                <input
                  type="text"
                  value={formDataModul.nipTeacher}
                  onChange={(e) => setFormDataModul({ ...formDataModul, nipTeacher: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Kota & Tanggal TTD</label>
                <input
                  type="text"
                  value={formDataModul.cityDate}
                  onChange={(e) => setFormDataModul({ ...formDataModul, cityDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nama Kepala Madrasah</label>
                <input
                  type="text"
                  value={formDataModul.principal}
                  onChange={(e) => setFormDataModul({ ...formDataModul, principal: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">NIP Kepala Madrasah</label>
                <input
                  type="text"
                  value={formDataModul.nipPrincipal}
                  onChange={(e) => setFormDataModul({ ...formDataModul, nipPrincipal: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Menu Tabs Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm md:text-base">
              Pilih Dokumen KBC Yang Ingin Digenerate / Ditampilkan:
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGenerateDoc(activeDoc)}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate {docTypeList.find((d) => d.id === activeDoc)?.label}</span>
            </button>
          </div>
        </div>

        {/* 9 Sub-menu Tab Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {docTypeList.map((doc) => {
            const Icon = doc.icon;
            const isTabActive = activeDoc === doc.id;
            const isDone = Boolean(generatedDocs[doc.id]);
            const isSpecialModul = doc.id === "modul_ajar" || doc.id === "lkpd" || doc.id === "rubrik";

            return (
              <button
                key={doc.id}
                onClick={() => handleSelectDoc(doc.id)}
                className={`flex flex-col items-center text-center p-2.5 rounded-xl border text-[11px] font-bold transition-all relative cursor-pointer ${
                  isTabActive
                    ? isSpecialModul
                      ? "bg-amber-600 text-white border-amber-600 shadow-md scale-102"
                      : "bg-emerald-600 text-white border-emerald-600 shadow-md scale-102"
                    : isDone
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                    : isSpecialModul
                    ? "bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 mb-1 ${isTabActive ? "text-white" : isDone ? "text-emerald-600" : isSpecialModul ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`} />
                <span className="truncate w-full leading-tight">{doc.label}</span>
                {isDone && (
                  <CheckCircle2 className="w-3 h-3 absolute top-1 right-1 text-emerald-600 dark:text-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading overlay */}
      {isGenerating && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl flex items-center justify-center space-x-4 animate-pulse">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <div>
            <p className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm md:text-base">
              {generatingProgress || "Sedang memproses AI Perangkat Ajar KBC..."}
            </p>
          </div>
        </div>
      )}

      {/* Output Document Display & Action Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
            <span className="font-extrabold text-sm md:text-base text-emerald-300">
              {docTypeList.find((d) => d.id === activeDoc)?.fullTitle}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintA4}
              disabled={!generatedDocs[activeDoc]}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-2 disabled:opacity-40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF (A4)</span>
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={!generatedDocs[activeDoc]}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-2 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Word (.doc)</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-x-auto min-h-[500px] bg-slate-50 dark:bg-slate-900">
          {generatedDocs[activeDoc] ? (
            <div
              className="bg-white text-slate-900 p-8 rounded-xl shadow-md border border-slate-300 max-w-5xl mx-auto font-sans leading-relaxed text-sm"
              dangerouslySetInnerHTML={{ __html: generatedDocs[activeDoc] }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-slate-800 text-emerald-600 rounded-full flex items-center justify-center">
                <HeartHandshake className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                Belum ada dokumen {docTypeList.find((d) => d.id === activeDoc)?.label}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Klik tombol "Generate {docTypeList.find((d) => d.id === activeDoc)?.label}" di atas untuk menyusun dokumen KBC secara otomatis menggunakan AI.
              </p>
              <button
                onClick={() => handleGenerateDoc(activeDoc)}
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs shadow-md transition flex items-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Mulai Generate {docTypeList.find((d) => d.id === activeDoc)?.label}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
