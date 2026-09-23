import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Clock, 
  Calendar, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Download, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  Save, 
  Sparkles, 
  X, 
  Check, 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck, 
  LogIn, 
  LogOut,
  RefreshCw
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PresensiGuru, DataGuru, Pengaturan } from "../types";
import { saveDocument, deleteDocument, batchSaveDocuments, COLLECTIONS } from "../lib/firebase";
import { 
  notifySimpanSuccess, 
  notifySimpanError, 
  notifyEditSuccess, 
  notifyEditError, 
  notifyHapusSuccess, 
  notifyHapusError, 
  confirmDeleteAlert,
  notifyCetakSuccess,
  notifyCetakError
} from "../lib/swal";

interface DaftarHadirGuruViewProps {
  presensiGuruList: PresensiGuru[];
  guruList: DataGuru[];
  config: Pengaturan;
}

const DEFAULT_SAMPLE_GURU: Omit<DataGuru, "id">[] = [
  { nama: "H. Ahmad Fauzi, S.Ag., M.Pd.I.", nip: "19750812 200312 1 002", jabatan: "Guru Fiqih / Waka Kurikulum", mapelUtama: "Fiqih", noHp: "081234567890" },
  { nama: "Siti Nurhaliza, S.Pd.I.", nip: "19820415 200901 2 008", jabatan: "Guru Al-Qur'an Hadis", mapelUtama: "Al-Qur'an Hadis", noHp: "081234567891" },
  { nama: "Muhammad Ridwan, M.Pd.", nip: "19881120 201402 1 004", jabatan: "Guru Matematika / Wali Kelas 7", mapelUtama: "Matematika", noHp: "081234567892" },
  { nama: "Nur Aisyah, S.Si.", nip: "19910305 201903 2 015", jabatan: "Guru IPA Terpadu / Pembina OSIS", mapelUtama: "IPA", noHp: "081234567893" },
  { nama: "Drs. H. Syarifuddin", nip: "19680510 199403 1 003", jabatan: "Guru Bahasa Arab", mapelUtama: "Bahasa Arab", noHp: "081234567894" },
  { nama: "Fatimah Zahra, S.Pd.", nip: "19940718 202012 2 018", jabatan: "Guru Bahasa Indonesia", mapelUtama: "Bahasa Indonesia", noHp: "081234567895" },
  { nama: "Lukman Hakim, S.Pd.", nip: "19860925 201101 1 009", jabatan: "Guru Akidah Akhlak / Guru Piket", mapelUtama: "Akidah Akhlak", noHp: "081234567896" },
  { nama: "Zainal Abidin, S.Kom.", nip: "19920114 201802 1 005", jabatan: "Guru Informatika / Operator Simpatika", mapelUtama: "Informatika", noHp: "081234567897" }
];

export const DaftarHadirGuruView: React.FC<DaftarHadirGuruViewProps> = ({
  presensiGuruList,
  guruList,
  config
}) => {
  const [activeTab, setActiveTab] = useState<"mandiri" | "kolektif" | "rekap" | "cetak" | "kelola_guru">("mandiri");
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live Clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  // Presensi Mandiri State
  const currentGuruName = config.Nama_Guru || "Guru Madrasah";
  const currentGuruNip = config.NIP_Guru || "-";
  
  // Find today's record for logged-in teacher
  const todayMyRecord = presensiGuruList.find(
    (p) => p.tanggal === todayStr && (p.namaGuru.trim().toLowerCase() === currentGuruName.trim().toLowerCase() || p.idGuru === "current_user")
  );

  const [mandiriStatus, setMandiriStatus] = useState<'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Cuti' | 'Alpa'>(
    todayMyRecord?.status || 'Hadir'
  );
  const [mandiriJamMasuk, setMandiriJamMasuk] = useState<string>(todayMyRecord?.jamMasuk || "");
  const [mandiriJamPulang, setMandiriJamPulang] = useState<string>(todayMyRecord?.jamPulang || "");
  const [mandiriKeterangan, setMandiriKeterangan] = useState<string>(todayMyRecord?.keterangan || "");

  // Update mandiri state when record changes
  useEffect(() => {
    if (todayMyRecord) {
      setMandiriStatus(todayMyRecord.status);
      setMandiriJamMasuk(todayMyRecord.jamMasuk || "");
      setMandiriJamPulang(todayMyRecord.jamPulang || "");
      setMandiriKeterangan(todayMyRecord.keterangan || "");
    }
  }, [todayMyRecord]);

  // Presensi Kolektif State
  const [kolektifTanggal, setKolektifTanggal] = useState<string>(todayStr);
  const [kolektifSearch, setKolektifSearch] = useState<string>("");
  const [kolektifState, setKolektifState] = useState<Record<string, {
    status: 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Cuti' | 'Alpa';
    jamMasuk: string;
    jamPulang: string;
    keterangan: string;
  }>>({});

  // Sync collective attendance state when date or teachers list changes
  useEffect(() => {
    const recordsForDate = presensiGuruList.filter((p) => p.tanggal === kolektifTanggal);
    const stateMap: Record<string, {
      status: 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Cuti' | 'Alpa';
      jamMasuk: string;
      jamPulang: string;
      keterangan: string;
    }> = {};

    // Get combined list of teachers (master guru list + logged in guru)
    const allTeachers = getEffectiveTeachers();

    allTeachers.forEach((guru) => {
      const existing = recordsForDate.find(
        (r) => r.idGuru === guru.id || r.namaGuru.trim().toLowerCase() === guru.nama.trim().toLowerCase()
      );
      stateMap[guru.id] = {
        status: existing?.status || "Hadir",
        jamMasuk: existing?.jamMasuk || (kolektifTanggal === todayStr ? "07:15" : "07:15"),
        jamPulang: existing?.jamPulang || (kolektifTanggal === todayStr ? "14:30" : "14:30"),
        keterangan: existing?.keterangan || ""
      };
    });

    setKolektifState(stateMap);
  }, [kolektifTanggal, presensiGuruList, guruList, config.Nama_Guru]);

  // Combine guruList with active user teacher profile
  function getEffectiveTeachers(): DataGuru[] {
    const list = [...guruList];
    const loggedInName = config.Nama_Guru;
    if (loggedInName && !list.some((g) => g.nama.trim().toLowerCase() === loggedInName.trim().toLowerCase())) {
      list.unshift({
        id: "guru_utama",
        nama: loggedInName,
        nip: config.NIP_Guru || "-",
        jabatan: "Guru Pengampu / Wali Kelas",
        mapelUtama: "Mata Pelajaran Utama"
      });
    }
    return list;
  }

  // Rekapitulasi State & Filters
  const [rekapBulan, setRekapBulan] = useState<string>(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [rekapTahun, setRekapTahun] = useState<string>(String(new Date().getFullYear()));
  const [rekapGuruFilter, setRekapGuruFilter] = useState<string>("");
  const [rekapStatusFilter, setRekapStatusFilter] = useState<string>("");
  const [rekapSearch, setRekapSearch] = useState<string>("");
  const [editingRecord, setEditingRecord] = useState<PresensiGuru | null>(null);

  // Master Guru State (Add / Edit)
  const [isGuruModalOpen, setIsGuruModalOpen] = useState(false);
  const [editingGuruId, setEditingGuruId] = useState<string | null>(null);
  const [guruForm, setGuruForm] = useState({
    nama: "",
    nip: "",
    jabatan: "",
    mapelUtama: "",
    noHp: ""
  });

  // Action: Simpan Presensi Mandiri
  const handleSaveMandiri = async (overrideMasuk?: string, overridePulang?: string) => {
    const nowTimeStr = new Date().toTimeString().slice(0, 5); // "HH:mm"
    const finalMasuk = overrideMasuk !== undefined ? overrideMasuk : mandiriJamMasuk || nowTimeStr;
    const finalPulang = overridePulang !== undefined ? overridePulang : mandiriJamPulang;

    const [thn, bln] = todayStr.split("-");
    const docId = `presensi_mandiri_${todayStr}_${encodeURIComponent(currentGuruName.replace(/\s+/g, "_"))}`;

    const newRecord: PresensiGuru = {
      id: todayMyRecord?.id || docId,
      tanggal: todayStr,
      idGuru: "guru_utama",
      namaGuru: currentGuruName,
      nipGuru: currentGuruNip,
      jabatan: "Guru Pengampu",
      status: mandiriStatus,
      jamMasuk: finalMasuk,
      jamPulang: finalPulang,
      keterangan: mandiriKeterangan,
      bulan: bln,
      tahun: thn
    };

    try {
      await saveDocument(COLLECTIONS.PRESENSI_GURU, newRecord.id, newRecord);
      setMandiriJamMasuk(finalMasuk);
      if (finalPulang) setMandiriJamPulang(finalPulang);
      notifySimpanSuccess(`Presensi Anda untuk hari ini berhasil disimpan!`);
    } catch (err: any) {
      notifySimpanError(err?.message || "Gagal menyimpan presensi mandiri.");
    }
  };

  // Quick One-Click Absen Masuk
  const handleQuickAbsenMasuk = () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    setMandiriJamMasuk(nowTime);
    setMandiriStatus("Hadir");
    handleSaveMandiri(nowTime, mandiriJamPulang);
  };

  // Quick One-Click Absen Pulang
  const handleQuickAbsenPulang = () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    setMandiriJamPulang(nowTime);
    handleSaveMandiri(mandiriJamMasuk, nowTime);
  };

  // Kolektif: Set Hadir Semua
  const handleSetAllHadirKolektif = () => {
    const updated = { ...kolektifState };
    Object.keys(updated).forEach((id) => {
      updated[id] = {
        ...updated[id],
        status: "Hadir",
        jamMasuk: updated[id].jamMasuk || "07:15",
        jamPulang: updated[id].jamPulang || "14:30"
      };
    });
    setKolektifState(updated);
  };

  // Kolektif: Simpan Batch Presensi Guru
  const handleSaveKolektif = async () => {
    const allTeachers = getEffectiveTeachers();
    if (allTeachers.length === 0) {
      notifySimpanError("Belum ada data guru.");
      return;
    }

    const [thn, bln] = kolektifTanggal.split("-");
    const recordsToSave: PresensiGuru[] = allTeachers.map((guru) => {
      const state = kolektifState[guru.id] || {
        status: "Hadir",
        jamMasuk: "07:15",
        jamPulang: "14:30",
        keterangan: ""
      };
      const cleanName = guru.nama.replace(/[^a-zA-Z0-9]/g, "_");
      const docId = `presensi_${kolektifTanggal}_${guru.id}_${cleanName}`;

      return {
        id: docId,
        tanggal: kolektifTanggal,
        idGuru: guru.id,
        namaGuru: guru.nama,
        nipGuru: guru.nip || "-",
        jabatan: guru.jabatan || "Dewan Guru",
        status: state.status,
        jamMasuk: state.jamMasuk,
        jamPulang: state.jamPulang,
        keterangan: state.keterangan,
        bulan: bln,
        tahun: thn
      };
    });

    try {
      await batchSaveDocuments(COLLECTIONS.PRESENSI_GURU, recordsToSave);
      notifySimpanSuccess(`Presensi ${recordsToSave.length} dewan guru tanggal ${kolektifTanggal} berhasil disimpan!`);
    } catch (err: any) {
      notifySimpanError(err?.message || "Gagal menyimpan presensi kolektif.");
    }
  };

  // Filtered Rekapitulasi Records
  const filteredRekapRecords = presensiGuruList.filter((rec) => {
    const [recYear, recMonth] = (rec.tanggal || "").split("-");
    if (rekapBulan && recMonth !== rekapBulan) return false;
    if (rekapTahun && recYear !== rekapTahun) return false;
    if (rekapGuruFilter && rec.namaGuru.toLowerCase() !== rekapGuruFilter.toLowerCase()) return false;
    if (rekapStatusFilter && rec.status !== rekapStatusFilter) return false;
    if (rekapSearch) {
      const q = rekapSearch.toLowerCase();
      const matchName = (rec.namaGuru || "").toLowerCase().includes(q);
      const matchKet = (rec.keterangan || "").toLowerCase().includes(q);
      const matchNip = (rec.nipGuru || "").toLowerCase().includes(q);
      if (!matchName && !matchKet && !matchNip) return false;
    }
    return true;
  }).sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));

  // Statistics calculation
  const totalHadir = filteredRekapRecords.filter((r) => r.status === "Hadir").length;
  const totalIzin = filteredRekapRecords.filter((r) => r.status === "Izin").length;
  const totalSakit = filteredRekapRecords.filter((r) => r.status === "Sakit").length;
  const totalDL = filteredRekapRecords.filter((r) => r.status === "Dinas Luar").length;
  const totalCuti = filteredRekapRecords.filter((r) => r.status === "Cuti").length;
  const totalAlpa = filteredRekapRecords.filter((r) => r.status === "Alpa").length;
  const totalKehadiranEfektif = totalHadir + totalDL;
  const totalEntri = filteredRekapRecords.length;
  const persenKehadiran = totalEntri > 0 ? Math.round((totalKehadiranEfektif / totalEntri) * 100) : 0;

  // Edit Rekap Record
  const handleSaveEditRecord = async () => {
    if (!editingRecord) return;
    try {
      await saveDocument(COLLECTIONS.PRESENSI_GURU, editingRecord.id, editingRecord);
      setEditingRecord(null);
      notifyEditSuccess("Data presensi guru berhasil diperbarui.");
    } catch (err: any) {
      notifyEditError(err?.message || "Gagal memperbarui presensi.");
    }
  };

  // Delete Rekap Record
  const handleDeleteRecord = async (id: string, nama: string, tgl: string) => {
    const confirmed = await confirmDeleteAlert(`Hapus catatan presensi untuk ${nama} pada tanggal ${tgl}?`);
    if (confirmed) {
      try {
        await deleteDocument(COLLECTIONS.PRESENSI_GURU, id);
        notifyHapusSuccess("Catatan presensi berhasil dihapus.");
      } catch (err: any) {
        notifyHapusError(err?.message || "Gagal menghapus catatan presensi.");
      }
    }
  };

  // Master Guru Actions
  const handleOpenGuruModal = (guru?: DataGuru) => {
    if (guru) {
      setEditingGuruId(guru.id);
      setGuruForm({
        nama: guru.nama,
        nip: guru.nip || "",
        jabatan: guru.jabatan || "",
        mapelUtama: guru.mapelUtama || "",
        noHp: guru.noHp || ""
      });
    } else {
      setEditingGuruId(null);
      setGuruForm({
        nama: "",
        nip: "",
        jabatan: "Guru Mata Pelajaran",
        mapelUtama: "",
        noHp: ""
      });
    }
    setIsGuruModalOpen(true);
  };

  const handleSaveGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guruForm.nama.trim()) {
      notifySimpanError("Nama guru wajib diisi!");
      return;
    }

    const id = editingGuruId || `guru_${Date.now()}`;
    const newGuru: DataGuru = {
      id,
      nama: guruForm.nama.trim(),
      nip: guruForm.nip.trim() || "-",
      jabatan: guruForm.jabatan.trim() || "Guru",
      mapelUtama: guruForm.mapelUtama.trim(),
      noHp: guruForm.noHp.trim()
    };

    try {
      await saveDocument(COLLECTIONS.DATA_GURU, id, newGuru);
      setIsGuruModalOpen(false);
      notifySimpanSuccess(editingGuruId ? "Data guru berhasil diubah!" : "Guru baru berhasil ditambahkan!");
    } catch (err: any) {
      notifySimpanError(err?.message || "Gagal menyimpan data guru.");
    }
  };

  const handleDeleteGuru = async (guru: DataGuru) => {
    const confirmed = await confirmDeleteAlert(`Hapus guru ${guru.nama} dari daftar dewan guru?`);
    if (confirmed) {
      try {
        await deleteDocument(COLLECTIONS.DATA_GURU, guru.id);
        notifyHapusSuccess("Data guru berhasil dihapus.");
      } catch (err: any) {
        notifyHapusError(err?.message || "Gagal menghapus data guru.");
      }
    }
  };

  // Seed sample teachers if empty
  const handleLoadSampleGuru = async () => {
    try {
      const items: DataGuru[] = DEFAULT_SAMPLE_GURU.map((g, idx) => ({
        ...g,
        id: `sample_guru_${Date.now()}_${idx}`
      }));
      await batchSaveDocuments(COLLECTIONS.DATA_GURU, items);
      notifySimpanSuccess(`${items.length} data guru MTs berhasil dimuat ke database!`);
    } catch (err: any) {
      notifySimpanError(err?.message || "Gagal memuat contoh guru.");
    }
  };

  // Official Kop Surat PDF Builder Helper
  const applyOfficialKop = (doc: jsPDF, title: string, isLandscape = false) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    const pemerintah = (config.Pemerintah || "KEMENTERIAN AGAMA REPUBLIK INDONESIA").toUpperCase();
    const sekolah = (config.Nama_Sekolah || "MADRASAH TSANAWIYAH").toUpperCase();
    const alamat = config.Alamat_Sekolah || "Jalan Pendidikan Madrasah No. 1";
    const logoUrl = config.Logo_Kiri || config.Logo_Kanan;

    if (logoUrl) {
      try {
        const logoWidth = 20;
        const logoHeight = 20;
        const logoX = Math.max(12, centerX - 65);
        doc.addImage(logoUrl, "PNG", logoX, 10, logoWidth, logoHeight);
      } catch {
        // Safe fallback
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(pemerintah, centerX, 14, { align: "center" });
    doc.text("KANTOR KEMENTERIAN AGAMA KABUPATEN / KOTA", centerX, 19, { align: "center" });

    doc.setFontSize(13);
    doc.text(sekolah, centerX, 26, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(alamat, centerX, 31, { align: "center" });

    // Double rule lines
    doc.setLineWidth(1);
    doc.line(12, 35, pageWidth - 12, 35);
    doc.setLineWidth(0.3);
    doc.line(12, 36.5, pageWidth - 12, 36.5);

    // Document Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), centerX, 44, { align: "center" });
  };

  // Signatures on PDF
  const applySignatures = (doc: jsPDF, lastY: number) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = lastY + 16;
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    const kepsek = config.Nama_Kepsek || "Nama Kepala Madrasah, M.Pd.I.";
    const nipKepsek = config.NIP_Kepsek || "19780514 200212 1 003";
    const namaGuru = config.Nama_Guru || "Petugas Piket / Koordinator";
    const nipGuru = config.NIP_Guru || "-";
    const tempat = config.Tempat_Tanda_Tangan || "Kerinci";

    const dateStr = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Left Signature (Kepala Madrasah)
    doc.text("Mengetahui,", 25, y);
    doc.text("Kepala Madrasah / Sekolah", 25, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(kepsek, 25, y + 27);
    doc.setFont("helvetica", "normal");
    if (nipKepsek) doc.text("NIP. " + nipKepsek, 25, y + 32);

    // Right Signature (Guru Piket / Admin)
    const rightX = pageWidth - 65;
    doc.text(`${tempat}, ${dateStr}`, rightX, y, { align: "center" });
    doc.text("Petugas Piket / Penanggung Jawab", rightX, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(namaGuru, rightX, y + 27, { align: "center" });
    doc.setFont("helvetica", "normal");
    if (nipGuru && nipGuru !== "-") doc.text("NIP. " + nipGuru, rightX, y + 32, { align: "center" });
  };

  // Export 1: Cetak Daftar Hadir Harian Guru PDF
  const handleExportHarianPDF = (targetDate: string = kolektifTanggal) => {
    try {
      const records = presensiGuruList.filter((p) => p.tanggal === targetDate);
      const allTeachers = getEffectiveTeachers();

      const doc = new jsPDF("p", "mm", "a4");
      const dateFormatted = new Date(targetDate).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      applyOfficialKop(doc, `DAFTAR HADIR HARIAN DEWAN GURU & PEGAWAI`);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Hari / Tanggal : ${dateFormatted}`, 14, 50);

      const tableData = allTeachers.map((guru, index) => {
        const found = records.find(
          (r) => r.idGuru === guru.id || r.namaGuru.trim().toLowerCase() === guru.nama.trim().toLowerCase()
        );
        return [
          (index + 1).toString(),
          guru.nama,
          guru.nip || "-",
          guru.jabatan || "Guru",
          found?.jamMasuk || "-",
          found?.jamPulang || "-",
          found?.status || "Hadir",
          found?.keterangan || (found?.status === "Hadir" ? "Terlaksana" : "-"),
          "" // blank space for manual paraf / signature
        ];
      });

      autoTable(doc, {
        head: [["No", "Nama Guru & Pegawai", "NIP", "Jabatan", "Masuk", "Pulang", "Status", "Keterangan", "Paraf"]],
        body: tableData,
        startY: 54,
        styles: { fontSize: 8, cellPadding: 2.2, halign: "center" },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 42, halign: "left" },
          2: { cellWidth: 32, halign: "left" },
          3: { cellWidth: 28, halign: "left" },
          4: { cellWidth: 14 },
          5: { cellWidth: 14 },
          6: { cellWidth: 18 },
          7: { cellWidth: 22, halign: "left" },
          8: { cellWidth: 16 }
        }
      });

      const lastY = (doc as any).lastAutoTable.finalY || 160;
      applySignatures(doc, lastY);

      doc.save(`Daftar_Hadir_Guru_${targetDate}.pdf`);
      notifyCetakSuccess("Daftar Hadir Harian Guru PDF berhasil diunduh!");
    } catch (err: any) {
      notifyCetakError(err?.message || "Gagal mencetak PDF.");
    }
  };

  // Export 2: Cetak Rekapitulasi Bulanan Guru PDF
  const handleExportBulananPDF = () => {
    try {
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const selectedMonthName = monthNames[parseInt(rekapBulan, 10) - 1] || "Bulan";

      const allTeachers = getEffectiveTeachers();
      const monthRecords = presensiGuruList.filter((p) => {
        const [y, m] = (p.tanggal || "").split("-");
        return y === rekapTahun && m === rekapBulan;
      });

      const doc = new jsPDF("l", "mm", "a4");
      applyOfficialKop(doc, `REKAPITULASI PRESENSI DEWAN GURU - BULAN ${selectedMonthName.toUpperCase()} ${rekapTahun}`, true);

      const tableData = allTeachers.map((guru, idx) => {
        const guruRecords = monthRecords.filter(
          (r) => r.idGuru === guru.id || r.namaGuru.trim().toLowerCase() === guru.nama.trim().toLowerCase()
        );

        const h = guruRecords.filter((r) => r.status === "Hadir").length;
        const i = guruRecords.filter((r) => r.status === "Izin").length;
        const s = guruRecords.filter((r) => r.status === "Sakit").length;
        const dl = guruRecords.filter((r) => r.status === "Dinas Luar").length;
        const c = guruRecords.filter((r) => r.status === "Cuti").length;
        const a = guruRecords.filter((r) => r.status === "Alpa").length;
        const total = guruRecords.length;
        const efektif = h + dl;
        const pct = total > 0 ? `${Math.round((efektif / total) * 100)}%` : "0%";

        return [
          (idx + 1).toString(),
          guru.nama,
          guru.nip || "-",
          guru.jabatan || "Guru",
          h.toString(),
          dl.toString(),
          i.toString(),
          s.toString(),
          c.toString(),
          a.toString(),
          total.toString(),
          pct
        ];
      });

      autoTable(doc, {
        head: [["No", "Nama Guru", "NIP", "Jabatan", "Hadir (H)", "Dinas Luar (DL)", "Izin (I)", "Sakit (S)", "Cuti (C)", "Alpa (A)", "Total Hari", "% Kehadiran"]],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8.5, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 60, halign: "left" },
          2: { cellWidth: 45, halign: "left" },
          3: { cellWidth: 40, halign: "left" },
          4: { cellWidth: 18 },
          5: { cellWidth: 20 },
          6: { cellWidth: 16 },
          7: { cellWidth: 16 },
          8: { cellWidth: 16 },
          9: { cellWidth: 16 },
          10: { cellWidth: 18 },
          11: { cellWidth: 20, fontStyle: "bold" }
        }
      });

      const lastY = (doc as any).lastAutoTable.finalY || 140;
      applySignatures(doc, lastY);

      doc.save(`Rekap_Presensi_Guru_${rekapBulan}_${rekapTahun}.pdf`);
      notifyCetakSuccess("Rekapitulasi Presensi Bulanan Guru PDF berhasil diunduh!");
    } catch (err: any) {
      notifyCetakError(err?.message || "Gagal mencetak PDF rekapitulasi.");
    }
  };

  // Export 3: Unduh CSV / Excel Rekap
  const handleExportCSV = () => {
    if (filteredRekapRecords.length === 0) {
      notifySimpanError("Tidak ada data untuk diekspor!");
      return;
    }

    const headers = ["No", "Tanggal", "Nama Guru", "NIP", "Jabatan", "Status", "Jam Masuk", "Jam Pulang", "Keterangan"];
    const rows = filteredRekapRecords.map((r, i) => [
      i + 1,
      `"${r.tanggal || ""}"`,
      `"${(r.namaGuru || "").replace(/"/g, '""')}"`,
      `"${r.nipGuru || "-"}"`,
      `"${(r.jabatan || "").replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.jamMasuk || ""}"`,
      `"${r.jamPulang || ""}"`,
      `"${(r.keterangan || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daftar_Hadir_Guru_${rekapBulan}_${rekapTahun}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifyCetakSuccess("File CSV Daftar Hadir Guru berhasil diunduh!");
  };

  const allEffectiveTeachers = getEffectiveTeachers();

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/30 text-xs font-semibold backdrop-blur-xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-200" />
              <span>Modul Presensi Terpadu Madrasah / Sekolah</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Daftar Hadir Dewan Guru
            </h1>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              Pencatatan presensi harian mandiri guru, absensi dewan guru oleh guru piket, rekapitulasi kehadiran bulanan, dan cetak dokumen resmi format Kemenag/Kemdikbud.
            </p>
          </div>

          {/* Live Digital Clock Widget */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center shrink-0 min-w-[200px] text-center shadow-lg">
            <div className="flex items-center space-x-2 text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">
              <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Waktu Saat Ini</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {currentTime.toTimeString().slice(0, 8)}
            </div>
            <div className="text-xs text-blue-100 font-medium mt-1">
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="mt-6 pt-5 border-t border-white/15 flex items-center space-x-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab("mandiri")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              activeTab === "mandiri"
                ? "bg-white text-blue-900 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Presensi Saya (Mandiri)</span>
            {todayMyRecord && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("kolektif")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              activeTab === "kolektif"
                ? "bg-white text-blue-900 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Presensi Kolektif (Piket)</span>
          </button>

          <button
            onClick={() => setActiveTab("rekap")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              activeTab === "rekap"
                ? "bg-white text-blue-900 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Rekapitulasi Kehadiran</span>
          </button>

          <button
            onClick={() => setActiveTab("cetak")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              activeTab === "cetak"
                ? "bg-white text-blue-900 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen Resmi</span>
          </button>

          <button
            onClick={() => setActiveTab("kelola_guru")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              activeTab === "kelola_guru"
                ? "bg-white text-blue-900 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Data Dewan Guru</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/40 text-white font-mono">
              {allEffectiveTeachers.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: PRESENSI MANDIRI (SAYA) */}
      {activeTab === "mandiri" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Check-In Action Card */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-700 gap-4">
              <div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Profil Guru Aktif
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {currentGuruName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  NIP: {currentGuruNip} &bull; {config.Nama_Sekolah || "Madrasah / Sekolah"}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-2">
                {todayMyRecord ? (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Sudah Presensi ({todayMyRecord.status})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-extrabold border border-amber-300 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Belum Presensi Hari Ini</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Large Buttons: Absen Masuk & Absen Pulang */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleQuickAbsenMasuk}
                className="group p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-300 dark:border-emerald-700/60 hover:border-emerald-500 hover:shadow-lg transition-all text-left flex items-start justify-between cursor-pointer active:scale-[0.98]"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md mb-3 group-hover:scale-105 transition-transform">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Presensi Datang
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Catat Absen Masuk
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {mandiriJamMasuk ? `Tercatat pkl ${mandiriJamMasuk} WIB` : "Klik untuk catat jam masuk otomatis"}
                  </p>
                </div>
                {mandiriJamMasuk && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-mono font-bold">
                    {mandiriJamMasuk}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleQuickAbsenPulang}
                className="group p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-2 border-blue-300 dark:border-blue-700/60 hover:border-blue-500 hover:shadow-lg transition-all text-left flex items-start justify-between cursor-pointer active:scale-[0.98]"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md mb-3 group-hover:scale-105 transition-transform">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Presensi Selesai
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Catat Absen Pulang
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {mandiriJamPulang ? `Tercatat pkl ${mandiriJamPulang} WIB` : "Klik saat jam dinas/KBM berakhir"}
                  </p>
                </div>
                {mandiriJamPulang && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-mono font-bold">
                    {mandiriJamPulang}
                  </span>
                )}
              </button>
            </div>

            {/* Detailed Form: Status, Jam Manual, Keterangan */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Rincian Kehadiran & Status Dinas</span>
              </h3>

              {/* Status Radio / Pill Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Pilih Status Kehadiran Hari Ini:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {(["Hadir", "Dinas Luar", "Izin", "Sakit", "Cuti", "Alpa"] as const).map((st) => {
                    const isSelected = mandiriStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setMandiriStatus(st)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                          isSelected
                            ? st === "Hadir"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : st === "Dinas Luar"
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : st === "Izin"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : st === "Sakit"
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : st === "Cuti"
                              ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                              : "bg-red-600 text-white border-red-600 shadow-xs"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Jam Masuk & Jam Pulang */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Masuk:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={mandiriJamMasuk}
                      onChange={(e) => setMandiriJamMasuk(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMandiriJamMasuk(new Date().toTimeString().slice(0, 5))}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors"
                      title="Isi jam sekarang"
                    >
                      Kini
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Pulang:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={mandiriJamPulang}
                      onChange={(e) => setMandiriJamPulang(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMandiriJamPulang(new Date().toTimeString().slice(0, 5))}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-colors"
                      title="Isi jam sekarang"
                    >
                      Kini
                    </button>
                  </div>
                </div>
              </div>

              {/* Keterangan / Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan / Agenda Dinas / Catatan:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Mengajar KBM Kelas 7 & 8, Rapat Dinas Kemenag, atau Sakit Flu..."
                  value={mandiriKeterangan}
                  onChange={(e) => setMandiriKeterangan(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveMandiri()}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Presensi Saya</span>
                </button>
              </div>
            </div>
          </div>

          {/* Side Info & Tips Card */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Ringkasan Kehadiran Saya</span>
              </h3>

              {(() => {
                const myAllRecords = presensiGuruList.filter(
                  (r) => r.namaGuru.trim().toLowerCase() === currentGuruName.trim().toLowerCase() || r.idGuru === "guru_utama"
                );
                const myHadir = myAllRecords.filter((r) => r.status === "Hadir").length;
                const myDL = myAllRecords.filter((r) => r.status === "Dinas Luar").length;
                const myIzin = myAllRecords.filter((r) => r.status === "Izin").length;
                const mySakit = myAllRecords.filter((r) => r.status === "Sakit").length;
                const totalHadirEfektif = myHadir + myDL;
                const myPersen = myAllRecords.length > 0 ? Math.round((totalHadirEfektif / myAllRecords.length) * 100) : 100;

                return (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Tingkat Kehadiran Anda
                      </div>
                      <div className="text-3xl font-black text-blue-900 dark:text-blue-100 mt-1">
                        {myPersen}%
                      </div>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                        {myAllRecords.length} total hari terekam
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-slate-500 dark:text-slate-400 block">Hadir</span>
                        <strong className="text-base text-emerald-700 dark:text-emerald-400">{myHadir} hari</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                        <span className="text-slate-500 dark:text-slate-400 block">Dinas Luar</span>
                        <strong className="text-base text-indigo-700 dark:text-indigo-400">{myDL} hari</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <span className="text-slate-500 dark:text-slate-400 block">Izin</span>
                        <strong className="text-base text-blue-700 dark:text-blue-400">{myIzin} hari</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <span className="text-slate-500 dark:text-slate-400 block">Sakit</span>
                        <strong className="text-base text-amber-700 dark:text-amber-400">{mySakit} hari</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-amber-50 dark:bg-slate-800/80 rounded-3xl p-5 border border-amber-200/80 dark:border-slate-700 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Petunjuk Penggunaan Presensi Guru:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                <li>Klik tombol <strong>Absen Masuk</strong> saat tiba di madrasah/sekolah.</li>
                <li>Jika berhalangan atau tugas dinas, pilih opsi <strong>Dinas Luar</strong> atau <strong>Izin</strong> beserta nomor surat tugas di keterangan.</li>
                <li>Guru Piket dapat menggunakan tab <strong>Presensi Kolektif (Piket)</strong> untuk mengisi kehadiran seluruh dewan guru sekaligus.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRESENSI KOLEKTIF (GURU PIKET / HARIAN) */}
      {activeTab === "kolektif" && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Presensi Kolektif Dewan Guru (Harian)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Pengisian kehadiran seluruh dewan guru dan tenaga kependidikan oleh Petugas Piket / Waka Kurikulum.
              </p>
            </div>

            {/* Date Picker & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-700/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <input
                  type="date"
                  value={kolektifTanggal}
                  onChange={(e) => setKolektifTanggal(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleSetAllHadirKolektif}
                className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Set Hadir Semua</span>
              </button>

              <button
                type="button"
                onClick={handleSaveKolektif}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Presensi Semua</span>
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="flex items-center space-x-2 max-w-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama guru atau jabatan..."
                value={kolektifSearch}
                onChange={(e) => setKolektifSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Teacher Attendance Rows List */}
          <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-4 min-w-[200px]">Nama Guru & NIP</th>
                  <th className="py-3 px-3 min-w-[140px]">Jabatan / Mapel</th>
                  <th className="py-3 px-3 min-w-[280px]">Status Kehadiran</th>
                  <th className="py-3 px-3 min-w-[110px]">Jam Masuk</th>
                  <th className="py-3 px-3 min-w-[110px]">Jam Pulang</th>
                  <th className="py-3 px-4 min-w-[180px]">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                {allEffectiveTeachers
                  .filter((g) => {
                    if (!kolektifSearch) return true;
                    const q = kolektifSearch.toLowerCase();
                    return g.nama.toLowerCase().includes(q) || (g.jabatan || "").toLowerCase().includes(q);
                  })
                  .map((guru, index) => {
                    const rowState = kolektifState[guru.id] || {
                      status: "Hadir",
                      jamMasuk: "07:15",
                      jamPulang: "14:30",
                      keterangan: ""
                    };

                    const handleRowChange = (field: string, val: string) => {
                      setKolektifState((prev) => ({
                        ...prev,
                        [guru.id]: {
                          ...prev[guru.id],
                          [field]: val
                        }
                      }));
                    };

                    return (
                      <tr key={guru.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-3 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {guru.nama}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            NIP. {guru.nip || "-"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                            {guru.jabatan || "Dewan Guru"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(["Hadir", "Dinas Luar", "Izin", "Sakit", "Cuti", "Alpa"] as const).map((st) => {
                              const active = rowState.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleRowChange("status", st)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                    active
                                      ? st === "Hadir"
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                        : st === "Dinas Luar"
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                        : st === "Izin"
                                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                        : st === "Sakit"
                                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : st === "Cuti"
                                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                        : "bg-red-600 text-white border-red-600 shadow-xs"
                                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="time"
                            value={rowState.jamMasuk}
                            onChange={(e) => handleRowChange("jamMasuk", e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:border-blue-500 w-24"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="time"
                            value={rowState.jamPulang}
                            onChange={(e) => handleRowChange("jamPulang", e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold outline-none focus:border-blue-500 w-24"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Catatan / surat..."
                            value={rowState.keterangan}
                            onChange={(e) => handleRowChange("keterangan", e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total {allEffectiveTeachers.length} dewan guru & pegawai siap diabsen
            </span>
            <button
              type="button"
              onClick={handleSaveKolektif}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Presensi Semua Dewan Guru</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: REKAPITULASI & RIWAYAT PRESENSI */}
      {activeTab === "rekap" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Entri</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{totalEntri}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Hadir</span>
              <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1 block">{totalHadir}</span>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">Dinas Luar</span>
              <span className="text-2xl font-black text-indigo-800 dark:text-indigo-200 mt-1 block">{totalDL}</span>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Izin</span>
              <span className="text-2xl font-black text-blue-800 dark:text-blue-200 mt-1 block">{totalIzin}</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Sakit</span>
              <span className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1 block">{totalSakit}</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">Cuti / Alpa</span>
              <span className="text-2xl font-black text-purple-800 dark:text-purple-200 mt-1 block">{totalCuti + totalAlpa}</span>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-blue-100 uppercase tracking-wider block">% Kehadiran</span>
              <span className="text-2xl font-black mt-1 block">{persenKehadiran}%</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Filter Rekapitulasi Presensi</span>
              </h3>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportBulananPDF}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Rekap PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Bulan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Bulan:</label>
                <select
                  value={rekapBulan}
                  onChange={(e) => setRekapBulan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none"
                >
                  <option value="01">Januari</option>
                  <option value="02">Februari</option>
                  <option value="03">Maret</option>
                  <option value="04">April</option>
                  <option value="05">Mei</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">Agustus</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>

              {/* Tahun */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Tahun:</label>
                <select
                  value={rekapTahun}
                  onChange={(e) => setRekapTahun(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>

              {/* Guru */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Pilih Guru:</label>
                <select
                  value={rekapGuruFilter}
                  onChange={(e) => setRekapGuruFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none"
                >
                  <option value="">Semua Dewan Guru</option>
                  {allEffectiveTeachers.map((g) => (
                    <option key={g.id} value={g.nama}>
                      {g.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Status:</label>
                <select
                  value={rekapStatusFilter}
                  onChange={(e) => setRekapStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold outline-none"
                >
                  <option value="">Semua Status</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Dinas Luar">Dinas Luar</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Cuti">Cuti</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </div>

              {/* Pencarian */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Cari Keterangan / Nama:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik kata kunci..."
                    value={rekapSearch}
                    onChange={(e) => setRekapSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table of Records */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-4 min-w-[110px]">Tanggal</th>
                    <th className="py-3 px-4 min-w-[200px]">Nama Guru & NIP</th>
                    <th className="py-3 px-3 min-w-[100px]">Status</th>
                    <th className="py-3 px-3 min-w-[90px]">Jam Masuk</th>
                    <th className="py-3 px-3 min-w-[90px]">Jam Pulang</th>
                    <th className="py-3 px-4 min-w-[180px]">Keterangan</th>
                    <th className="py-3 px-3 text-center min-w-[100px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {filteredRekapRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        Belum ada data presensi guru yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRekapRecords.map((rec, index) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-3 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {rec.tanggal}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {rec.namaGuru}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            NIP. {rec.nipGuru || "-"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              rec.status === "Hadir"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                : rec.status === "Dinas Luar"
                                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300"
                                : rec.status === "Izin"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                                : rec.status === "Sakit"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                                : rec.status === "Cuti"
                                ? "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300"
                                : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {rec.jamMasuk || "-"}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {rec.jamPulang || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                          {rec.keterangan || "-"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditingRecord({ ...rec })}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                              title="Edit Data Presensi"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id, rec.namaGuru, rec.tanggal)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                              title="Hapus Data Presensi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Record Modal */}
          {editingRecord && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Edit Catatan Presensi Guru
                  </h3>
                  <button
                    onClick={() => setEditingRecord(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Nama Guru:</label>
                    <input
                      type="text"
                      disabled
                      value={editingRecord.namaGuru}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Tanggal:</label>
                    <input
                      type="date"
                      value={editingRecord.tanggal}
                      onChange={(e) => setEditingRecord({ ...editingRecord, tanggal: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Status Kehadiran:</label>
                    <select
                      value={editingRecord.status}
                      onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      <option value="Hadir">Hadir</option>
                      <option value="Dinas Luar">Dinas Luar</option>
                      <option value="Izin">Izin</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Cuti">Cuti</option>
                      <option value="Alpa">Alpa</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Jam Masuk:</label>
                      <input
                        type="time"
                        value={editingRecord.jamMasuk || ""}
                        onChange={(e) => setEditingRecord({ ...editingRecord, jamMasuk: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Jam Pulang:</label>
                      <input
                        type="time"
                        value={editingRecord.jamPulang || ""}
                        onChange={(e) => setEditingRecord({ ...editingRecord, jamPulang: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Keterangan:</label>
                    <input
                      type="text"
                      value={editingRecord.keterangan || ""}
                      onChange={(e) => setEditingRecord({ ...editingRecord, keterangan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditRecord}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CETAK DOKUMEN RESMI FORMAT KEMENAG / KEMDIKBUD */}
      {activeTab === "cetak" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Cetak 1: Daftar Hadir Harian */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Daftar Hadir Harian Dewan Guru
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Dokumen presensi harian fisik untuk ditandatangani langsung oleh masing-masing guru, dilengkapi kolom Jam Masuk, Jam Pulang, Paraf, dan tanda tangan Kepala Madrasah.
              </p>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Tanggal Cetak:
                </label>
                <input
                  type="date"
                  value={kolektifTanggal}
                  onChange={(e) => setKolektifTanggal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleExportHarianPDF(kolektifTanggal)}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Daftar Hadir Harian (PDF)</span>
            </button>
          </div>

          {/* Card Cetak 2: Rekapitulasi Bulanan */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Rekapitulasi Presensi Bulanan Guru
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Laporan rekapitulasi kehadiran dewan guru format landscape (Matriks H, DL, I, S, C, A, Total Hari & Persentase Kehadiran) untuk laporan bulanan ke Pengawas & Kemenag/Dinas.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bulan:
                  </label>
                  <select
                    value={rekapBulan}
                    onChange={(e) => setRekapBulan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none"
                  >
                    <option value="01">Januari</option>
                    <option value="02">Februari</option>
                    <option value="03">Maret</option>
                    <option value="04">April</option>
                    <option value="05">Mei</option>
                    <option value="06">Juni</option>
                    <option value="07">Juli</option>
                    <option value="08">Agustus</option>
                    <option value="09">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Desember</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tahun:
                  </label>
                  <select
                    value={rekapTahun}
                    onChange={(e) => setRekapTahun(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleExportBulananPDF}
                className="flex-1 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Rekap PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MASTER DATA DEWAN GURU */}
      {activeTab === "kelola_guru" && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-700 gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Master Data Dewan Guru & Pegawai</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola daftar dewan guru yang terdaftar dalam presensi dan administrasi sekolah.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {guruList.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadSampleGuru}
                  className="px-3.5 py-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Contoh Guru MTs</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleOpenGuruModal()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Guru</span>
              </button>
            </div>
          </div>

          {/* Teachers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allEffectiveTeachers.map((guru) => {
              const isMainGuru = guru.id === "guru_utama";
              return (
                <div
                  key={guru.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isMainGuru
                      ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {isMainGuru ? "Guru Akun Aktif" : "Dewan Guru"}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                        {guru.nama}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        NIP: {guru.nip || "-"}
                      </p>
                    </div>

                    {!isMainGuru && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenGuruModal(guru)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuru(guru)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Jabatan:</strong> {guru.jabatan || "-"}
                    </div>
                    {guru.mapelUtama && (
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Mapel:</strong> {guru.mapelUtama}
                      </div>
                    )}
                    {guru.noHp && (
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">No. HP:</strong> {guru.noHp}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add / Edit Guru Modal */}
          {isGuruModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {editingGuruId ? "Edit Data Guru" : "Tambah Guru Baru"}
                  </h3>
                  <button
                    onClick={() => setIsGuruModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveGuru} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Lengkap & Gelar:*
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: H. Ahmad Fauzi, S.Ag., M.Pd.I."
                      value={guruForm.nama}
                      onChange={(e) => setGuruForm({ ...guruForm, nama: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      NIP (Nomor Induk Pegawai):
                    </label>
                    <input
                      type="text"
                      placeholder="19800101 200501 1 001 atau -"
                      value={guruForm.nip}
                      onChange={(e) => setGuruForm({ ...guruForm, nip: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tugas / Jabatan:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Guru Fiqih / Guru Piket / Waka Kurikulum"
                      value={guruForm.jabatan}
                      onChange={(e) => setGuruForm({ ...guruForm, jabatan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mata Pelajaran Utama:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Al-Qur'an Hadis, Matematika, IPA"
                      value={guruForm.mapelUtama}
                      onChange={(e) => setGuruForm({ ...guruForm, mapelUtama: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      No. WhatsApp / HP:
                    </label>
                    <input
                      type="text"
                      placeholder="0812xxxxxxxx"
                      value={guruForm.noHp}
                      onChange={(e) => setGuruForm({ ...guruForm, noHp: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsGuruModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm"
                    >
                      Simpan Data Guru
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
