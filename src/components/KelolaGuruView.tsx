import React, { useState } from "react";
import { 
  UserCheck, 
  Upload, 
  Download, 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  X, 
  Save, 
  FileSpreadsheet, 
  CheckCircle2, 
  Check, 
  Star, 
  Phone, 
  Mail, 
  Briefcase, 
  BookOpen, 
  Printer, 
  Sparkles,
  Users
} from "lucide-react";
import * as XLSX from "xlsx";
import { Guru, Mapel, Pengaturan } from "../types";
import { saveDocument, deleteDocument, batchSaveDocuments, COLLECTIONS } from "../lib/firebase";
import { 
  notifySimpanSuccess, 
  notifySimpanError, 
  notifyEditSuccess, 
  notifyEditError, 
  notifyHapusSuccess, 
  notifyHapusError, 
  notifyUnduhSuccess, 
  notifyUnduhError, 
  confirmDeleteAlert 
} from "../lib/swal";

interface KelolaGuruViewProps {
  guruList: Guru[];
  mapelList: Mapel[];
  config: Pengaturan;
  activeGuruId?: string;
  onSelectActiveGuru?: (guru: Guru) => void;
}

export const KelolaGuruView: React.FC<KelolaGuruViewProps> = ({
  guruList,
  mapelList,
  config,
  activeGuruId,
  onSelectActiveGuru
}) => {
  const [nama, setNama] = useState("");
  const [nip, setNip] = useState("");
  const [mapelUtama, setMapelUtama] = useState("");
  const [jabatan, setJabatan] = useState("Guru Mata Pelajaran");
  const [status, setStatus] = useState("PNS");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [noHp, setNoHp] = useState("");
  const [email, setEmail] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit State
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editNip, setEditNip] = useState("");
  const [editMapelUtama, setEditMapelUtama] = useState("");
  const [editJabatan, setEditJabatan] = useState("Guru Mata Pelajaran");
  const [editStatus, setEditStatus] = useState("PNS");
  const [editJenisKelamin, setEditJenisKelamin] = useState<"L" | "P">("L");
  const [editNoHp, setEditNoHp] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Start Editing Guru
  const handleStartEdit = (guru: Guru) => {
    setEditingGuru(guru);
    setEditNama(guru.nama);
    setEditNip(guru.nip || "");
    setEditMapelUtama(guru.mapelUtama || "");
    setEditJabatan(guru.jabatan || "Guru Mata Pelajaran");
    setEditStatus(guru.status || "PNS");
    setEditJenisKelamin((guru.jenisKelamin as "L" | "P") || "L");
    setEditNoHp(guru.noHp || "");
    setEditEmail(guru.email || "");
  };

  // Save Edit Guru
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuru) return;

    if (!editNama.trim()) {
      notifyEditError("Mohon masukkan nama lengkap guru.");
      return;
    }

    const updatedGuru: Guru = {
      ...editingGuru,
      nama: editNama.trim(),
      nip: editNip.trim() || "-",
      mapelUtama: editMapelUtama.trim(),
      jabatan: editJabatan.trim(),
      status: editStatus,
      jenisKelamin: editJenisKelamin,
      noHp: editNoHp.trim(),
      email: editEmail.trim()
    };

    try {
      await saveDocument(COLLECTIONS.GURU, editingGuru.id, updatedGuru);
      setEditingGuru(null);
      notifyEditSuccess(`Data guru ${updatedGuru.nama} berhasil diperbarui!`);
      
      // If currently active guru is edited, sync active state
      if (onSelectActiveGuru && (editingGuru.id === activeGuruId || editingGuru.nama === config.Nama_Guru)) {
        onSelectActiveGuru(updatedGuru);
      }
    } catch (err: any) {
      notifyEditError(err.message || "Gagal memperbarui data guru.");
    }
  };

  // Add New Guru
  const handleAddGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      notifySimpanError("Mohon masukkan Nama Lengkap Guru.");
      return;
    }

    const id = "guru_" + Date.now().toString();
    const newGuru: Guru = {
      id,
      nama: nama.trim(),
      nip: nip.trim() || "-",
      mapelUtama: mapelUtama.trim(),
      jabatan: jabatan.trim(),
      status,
      jenisKelamin,
      noHp: noHp.trim(),
      email: email.trim(),
      isAktif: false
    };

    try {
      await saveDocument(COLLECTIONS.GURU, id, newGuru);
      setNama("");
      setNip("");
      setMapelUtama("");
      setNoHp("");
      setEmail("");
      notifySimpanSuccess(`Guru ${newGuru.nama} berhasil ditambahkan!`);

      // If this is the only guru, make it active
      if (guruList.length === 0 && onSelectActiveGuru) {
        onSelectActiveGuru(newGuru);
      }
    } catch (err: any) {
      notifySimpanError(err.message || "Gagal menyimpan data guru.");
    }
  };

  // Delete Guru
  const handleDeleteGuru = async (id: string, namaGuru: string) => {
    const isConfirmed = await confirmDeleteAlert(
      "Hapus Data Guru?", 
      `Apakah Anda yakin ingin menghapus "${namaGuru}" dari database sekolah?`
    );
    if (isConfirmed) {
      try {
        await deleteDocument(COLLECTIONS.GURU, id);
        notifyHapusSuccess(`Data guru "${namaGuru}" berhasil dihapus.`);
      } catch (err: any) {
        notifyHapusError(err.message || "Gagal menghapus data guru.");
      }
    }
  };

  // Choose as Active Teacher
  const handleSetActiveGuru = (guru: Guru) => {
    if (onSelectActiveGuru) {
      onSelectActiveGuru(guru);
      notifySimpanSuccess(`Guru Aktif dialihkan ke: ${guru.nama}`);
    }
  };

  // Quick Seed Sample Teachers
  const handleSeedTeachers = async () => {
    const sampleTeachers: Guru[] = [
      {
        id: "guru_1",
        nama: config.Nama_Guru || "Drs. Yefri Haryanto, M.Pd.",
        nip: config.NIP_Guru || "19850312 201001 1 008",
        mapelUtama: "Informatika",
        jabatan: "Guru Mata Pelajaran",
        status: "PNS",
        jenisKelamin: "L",
        noHp: "0812-7412-8901",
        email: "yefri@sekolah.sch.id",
        isAktif: true
      },
      {
        id: "guru_2",
        nama: "Siti Rahmawati, S.Pd.",
        nip: "19890415 201402 2 003",
        mapelUtama: "Matematika",
        jabatan: "Wali Kelas VII A",
        status: "PNS",
        jenisKelamin: "P",
        noHp: "0813-6789-1234",
        email: "siti.rahma@sekolah.sch.id"
      },
      {
        id: "guru_3",
        nama: "Ahmad Fauzi, S.Pd.I",
        nip: "19920820 201903 1 007",
        mapelUtama: "Pendidikan Agama Islam",
        jabatan: "Wali Kelas VII B",
        status: "PPPK",
        jenisKelamin: "L",
        noHp: "0821-8901-2345",
        email: "ahmad.fauzi@sekolah.sch.id"
      },
      {
        id: "guru_4",
        nama: "Dewi Lestari, S.Pd., M.Si.",
        nip: "19900210 201504 2 006",
        mapelUtama: "IPA Terpadu",
        jabatan: "Kepala Laboratorium IPA",
        status: "PNS",
        jenisKelamin: "P",
        noHp: "0852-3456-7890",
        email: "dewi.lestari@sekolah.sch.id"
      },
      {
        id: "guru_5",
        nama: "Bambang Sudarsono, S.Pd.",
        nip: "-",
        mapelUtama: "Bahasa Indonesia",
        jabatan: "Guru Mata Pelajaran",
        status: "Honorer / GTT",
        jenisKelamin: "L",
        noHp: "0857-9876-5432",
        email: "bambang.s@sekolah.sch.id"
      },
      {
        id: "guru_6",
        nama: "Nurul Hidayah, S.Sos., M.Pd.",
        nip: "19940505 202012 2 011",
        mapelUtama: "Bimbingan Konseling",
        jabatan: "Guru BK / Konselor",
        status: "PPPK",
        jenisKelamin: "P",
        noHp: "0812-9988-7766",
        email: "nurul.bk@sekolah.sch.id"
      }
    ];

    try {
      await batchSaveDocuments(COLLECTIONS.GURU, sampleTeachers);
      notifySimpanSuccess("Contoh daftar dewan guru berhasil dimuat!");
    } catch (err: any) {
      notifySimpanError("Gagal memuat contoh daftar guru: " + err.message);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (guruList.length === 0) {
      notifyUnduhError("Tidak ada data guru untuk diekspor.");
      return;
    }

    try {
      const dataToExport = guruList.map((g, index) => ({
        "No": index + 1,
        "Nama Lengkap & Gelar": g.nama,
        "NIP": g.nip || "-",
        "Jenis Kelamin": g.jenisKelamin === "P" ? "Perempuan" : "Laki-laki",
        "Mata Pelajaran": g.mapelUtama || "-",
        "Jabatan / Tugas Tambahan": g.jabatan || "-",
        "Status Kepegawaian": g.status || "-",
        "No. WhatsApp / HP": g.noHp || "-",
        "Email": g.email || "-"
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daftar Guru");
      XLSX.writeFile(wb, `Data_Dewan_Guru_${config.Nama_Sekolah?.replace(/\s+/g, "_") || "Sekolah"}.xlsx`);
      notifyUnduhSuccess("File Excel daftar guru berhasil diunduh!");
    } catch (err: any) {
      notifyUnduhError("Gagal mengekspor data: " + err.message);
    }
  };

  // Import from Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          notifySimpanError("File Excel kosong atau format tidak sesuai.");
          return;
        }

        const formattedTeachers: Guru[] = rawData
          .filter((row) => row["Nama Lengkap & Gelar"] || row["Nama"] || row["nama"])
          .map((row, idx) => {
            const namaGuru = String(row["Nama Lengkap & Gelar"] || row["Nama"] || row["nama"] || "").trim();
            const nipGuru = String(row["NIP"] || row["nip"] || "-").trim();
            const mapel = String(row["Mata Pelajaran"] || row["Mapel"] || row["mapelUtama"] || "").trim();
            const jab = String(row["Jabatan / Tugas Tambahan"] || row["Jabatan"] || row["jabatan"] || "Guru Mata Pelajaran").trim();
            const stat = String(row["Status Kepegawaian"] || row["Status"] || row["status"] || "PNS").trim();
            const jkRaw = String(row["Jenis Kelamin"] || row["JK"] || row["jenisKelamin"] || "L").toUpperCase();
            const jk = jkRaw.startsWith("P") ? "P" : "L";
            const hp = String(row["No. WhatsApp / HP"] || row["No HP"] || row["noHp"] || "").trim();
            const em = String(row["Email"] || row["email"] || "").trim();

            return {
              id: "guru_import_" + Date.now() + "_" + idx,
              nama: namaGuru,
              nip: nipGuru,
              mapelUtama: mapel,
              jabatan: jab,
              status: stat,
              jenisKelamin: jk,
              noHp: hp,
              email: em
            };
          });

        if (formattedTeachers.length === 0) {
          notifySimpanError("Tidak ditemukan data nama guru yang valid dalam file Excel.");
          return;
        }

        await batchSaveDocuments(COLLECTIONS.GURU, formattedTeachers);
        notifySimpanSuccess(`${formattedTeachers.length} data guru berhasil diimpor ke Firebase!`);
      } catch (err: any) {
        notifySimpanError("Gagal membaca file Excel: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const template = [
      {
        "Nama Lengkap & Gelar": "Drs. Budi Santoso, M.Pd.",
        "NIP": "19800101 200501 1 002",
        "Jenis Kelamin": "Laki-laki",
        "Mata Pelajaran": "Matematika",
        "Jabatan / Tugas Tambahan": "Wali Kelas VII A",
        "Status Kepegawaian": "PNS",
        "No. WhatsApp / HP": "08123456789",
        "Email": "budi@sekolah.sch.id"
      },
      {
        "Nama Lengkap & Gelar": "Siti Aminah, S.Pd.",
        "NIP": "19920315 201902 2 004",
        "Jenis Kelamin": "Perempuan",
        "Mata Pelajaran": "Bahasa Indonesia",
        "Jabatan / Tugas Tambahan": "Guru Mata Pelajaran",
        "Status Kepegawaian": "PPPK",
        "No. WhatsApp / HP": "08234567890",
        "Email": "siti@sekolah.sch.id"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Guru");
    XLSX.writeFile(wb, "Template_Import_Guru.xlsx");
    notifyUnduhSuccess("Template Excel berhasil diunduh!");
  };

  // Filtered Guru List
  const filteredGuruList = guruList.filter((g) => {
    const matchSearch =
      g.nama.toLowerCase().includes(search.toLowerCase()) ||
      (g.nip && g.nip.includes(search)) ||
      (g.mapelUtama && g.mapelUtama.toLowerCase().includes(search.toLowerCase())) ||
      (g.jabatan && g.jabatan.toLowerCase().includes(search.toLowerCase()));

    const matchStatus = statusFilter === "Semua" || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate Stats
  const totalGuru = guruList.length;
  const totalPNS = guruList.filter((g) => g.status === "PNS").length;
  const totalPPPK = guruList.filter((g) => g.status === "PPPK").length;
  const totalHonorer = guruList.filter((g) => g.status?.toLowerCase().includes("honorer") || g.status?.toLowerCase().includes("gtt")).length;
  const totalWali = guruList.filter((g) => g.jabatan?.toLowerCase().includes("wali")).length;

  // Identify currently active teacher
  const currentActiveName = config.Nama_Guru || "";

  return (
    <div className="space-y-6">
      {/* Top Banner & Active Teacher Indicator */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider backdrop-blur-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-300" />
              Sistem Multi-Guru Terpadu
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Daftar & Kelola Dewan Guru
          </h2>
          <p className="text-blue-100 text-xs md:text-sm max-w-2xl">
            Aplikasi ini dapat digunakan bersama oleh seluruh guru. Pilih salah satu guru sebagai 
            <strong className="text-amber-300 font-bold ml-1">Guru Aktif</strong> untuk mencatat absensi, nilai, agenda mengajar, dan bimbingan wali dengan nama guru tersebut.
          </p>
        </div>

        {/* Currently Active Teacher Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-white min-w-[260px] shrink-0">
          <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            Guru Aktif Saat Ini:
          </div>
          <div className="font-extrabold text-base truncate">
            {currentActiveName || "Belum dipilih"}
          </div>
          <div className="text-xs text-blue-200 mt-0.5 truncate">
            NIP: {config.NIP_Guru || "-"}
          </div>
          <div className="text-[11px] text-blue-200/80 mt-1 italic">
            Klik tombol "Pilih Guru" di bawah untuk berganti pengguna
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center space-x-3">
          <div className="w-11 h-11 bg-blue-100 dark:bg-blue-950/60 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Guru</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{totalGuru}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center space-x-3">
          <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Guru PNS</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{totalPNS}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center space-x-3">
          <div className="w-11 h-11 bg-amber-100 dark:bg-amber-950/60 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Guru PPPK</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{totalPPPK}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center space-x-3">
          <div className="w-11 h-11 bg-purple-100 dark:bg-purple-950/60 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Wali Kelas</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{totalWali}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Input & Guru List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Tambah Guru */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Tambah Data Guru Baru
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Daftarkan dewan guru agar dapat menggunakan aplikasi ini
              </p>
            </div>
          </div>

          <form onSubmit={handleAddGuru} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Nama Guru & Gelar <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Drs. Yefri Haryanto, M.Pd."
                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  NIP Guru
                </label>
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="19850312..."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Jenis Kelamin
                </label>
                <select
                  value={jenisKelamin}
                  onChange={(e) => setJenisKelamin(e.target.value as "L" | "P")}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Mata Pelajaran yang Diampu
              </label>
              <input
                type="text"
                value={mapelUtama}
                onChange={(e) => setMapelUtama(e.target.value)}
                placeholder="Contoh: Informatika, Matematika, IPA"
                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
              />
              {mapelList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {mapelList.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMapelUtama(m.namaMapel)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-600 dark:text-slate-300"
                    >
                      +{m.namaMapel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Status Kepegawaian
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="PNS">PNS</option>
                  <option value="PPPK">PPPK</option>
                  <option value="Honorer / GTT">Honorer / GTT</option>
                  <option value="Guru Tetap Yayasan">Guru Tetap Yayasan</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Tugas / Jabatan
                </label>
                <input
                  type="text"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="Wali Kelas, Guru BK, dll."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  No. WhatsApp / HP
                </label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="0812-..."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guru@sekolah.sch.id"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Data Guru ke Firebase
            </button>
          </form>

          {/* Quick Preload Sample Teachers Button */}
          {guruList.length === 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Database guru masih kosong?
              </p>
              <button
                type="button"
                onClick={handleSeedTeachers}
                className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                Muat Contoh Daftar Dewan Guru
              </button>
            </div>
          )}
        </div>

        {/* Right Column: List of Teachers & Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Action Bar (Search, Filter, Export, Import) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama guru, NIP, mapel..."
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Status Filter */}
            <div className="shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
              >
                <option value="Semua">Semua Status</option>
                <option value="PNS">PNS</option>
                <option value="PPPK">PPPK</option>
                <option value="Honorer / GTT">Honorer / GTT</option>
                <option value="Guru Tetap Yayasan">Guru Tetap Yayasan</option>
              </select>
            </div>

            {/* Excel Import/Export Buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              <label
                className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 transition-colors"
                title="Impor dari Excel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Impor</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs flex items-center gap-1.5 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Ekspor ke Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                title="Unduh Template Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Teacher Directory Cards / Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Daftar Dewan Guru Sekolah
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                  {filteredGuruList.length} Guru
                </span>
              </div>
            </div>

            {filteredGuruList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                  <UserCheck className="w-6 h-6" />
                </div>
                <p className="text-xs">Belum ada data guru yang cocok dengan pencarian atau database masih kosong.</p>
                {guruList.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedTeachers}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Muat Contoh Daftar Guru Sekarang
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredGuruList.map((g) => {
                  const isCurrentlyActive = g.nama === currentActiveName || g.id === activeGuruId;
                  return (
                    <div
                      key={g.id}
                      className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrentlyActive
                          ? "bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-l-blue-600"
                          : "hover:bg-slate-50 dark:hover:bg-slate-750"
                      }`}
                    >
                      {/* Guru Information */}
                      <div className="flex items-start space-x-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            isCurrentlyActive
                              ? "bg-blue-600 text-white"
                              : g.jenisKelamin === "P"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                              : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                          }`}
                        >
                          {g.nama.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {g.nama}
                            </span>
                            {isCurrentlyActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold tracking-wide uppercase shadow-xs">
                                <Check className="w-3 h-3" />
                                Guru Aktif
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              g.status === "PNS"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : g.status === "PPPK"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                            }`}>
                              {g.status || "PNS"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {g.nip && g.nip !== "-" && (
                              <span>NIP: <strong className="text-slate-700 dark:text-slate-300">{g.nip}</strong></span>
                            )}
                            {g.mapelUtama && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-blue-500" />
                                {g.mapelUtama}
                              </span>
                            )}
                            {g.jabatan && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-slate-400" />
                                {g.jabatan}
                              </span>
                            )}
                            {g.noHp && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                {g.noHp}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        {!isCurrentlyActive ? (
                          <button
                            type="button"
                            onClick={() => handleSetActiveGuru(g)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            title="Aktifkan guru ini sebagai pengguna utama"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Pilih Guru</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sedang Digunakan</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartEdit(g)}
                          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer"
                          title="Edit data guru"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteGuru(g.id, g.nama)}
                          className="p-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 active:scale-95 transition-all cursor-pointer"
                          title="Hapus data guru"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Guru Modal */}
      {editingGuru && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Edit Data Guru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Perbarui rincian data dewan guru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingGuru(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Nama Guru & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editJenisKelamin}
                    onChange={(e) => setEditJenisKelamin(e.target.value as "L" | "P")}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Mata Pelajaran yang Diampu
                </label>
                <input
                  type="text"
                  value={editMapelUtama}
                  onChange={(e) => setEditMapelUtama(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Status Kepegawaian
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  >
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Honorer / GTT">Honorer / GTT</option>
                    <option value="Guru Tetap Yayasan">Guru Tetap Yayasan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Tugas / Jabatan
                  </label>
                  <input
                    type="text"
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={editNoHp}
                    onChange={(e) => setEditNoHp(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGuru(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
