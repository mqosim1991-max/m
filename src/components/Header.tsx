import React, { useState, useEffect } from "react";
import { 
  Menu, 
  CloudCheck, 
  CloudOff, 
  Moon, 
  Sun, 
  GraduationCap, 
  ShieldCheck, 
  LogOut, 
  UserCheck, 
  ChevronDown, 
  X, 
  Check, 
  Users, 
  Search,
  BookOpen
} from "lucide-react";
import { Pengaturan, Guru } from "../types";

interface HeaderProps {
  activeTab: string;
  onToggleSidebar: () => void;
  isDarkMode: boolean;
  onSetDarkMode: (isDark: boolean) => void;
  onToggleDarkMode?: () => void;
  isConnected: boolean;
  config: Pengaturan;
  onLogout?: () => void;
  guruList?: Guru[];
  onSelectGuru?: (guru: Guru) => void;
  onNavigateToGuru?: () => void;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  guru: "Kelola Dewan Guru & Guru Pengampu",
  siswa: "Kelola Master Data Siswa",
  kartu: "Cetak Kartu Pelajar QR Code",
  mapel: "Kelola Mata Pelajaran",
  jadwal: "Jadwal Mengajar Guru",
  absensi: "Input Absensi Harian & QR Scanner",
  penilaian: "Input Nilai Akademik Siswa",
  agenda: "Jurnal Agenda Mengajar",
  bimbingan: "Catatan Bimbingan Guru Wali",
  downloadperangkat: "Download Perangkat Ajar (Deep Learning)",
  perangkat_ai: "Generator Perangkat Ajar AI (Analisis CP, TP, ATP, Prota, Prosem, KKTP)",
  modulai: "Generator Modul Ajar AI (Deep Learning)",
  asistenai: "Asisten AI Pendamping Guru",
  lkpdai: "Generator LKPD AI (Lembar Kerja Peserta Didik)",
  ailainnya: "Generator AI Lainnya",
  laporan: "Pusat Cetak Laporan PDF",
  pengaturan: "Pengaturan & Profil Sekolah",
  resetdb: "Kosongkan & Hapus Seluruh Isi Database"
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onToggleSidebar,
  isDarkMode,
  onSetDarkMode,
  onToggleDarkMode,
  isConnected,
  config,
  onLogout,
  guruList = [],
  onSelectGuru,
  onNavigateToGuru
}) => {
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [currentUser, setCurrentUser] = React.useState<any>(() => {
    try {
      const raw = localStorage.getItem("edadmin_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem("edadmin_user");
        setCurrentUser(raw ? JSON.parse(raw) : null);
      } catch {
        setCurrentUser(null);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleSelectDark = (dark: boolean) => {
    if (onSetDarkMode) {
      onSetDarkMode(dark);
    } else if (onToggleDarkMode) {
      onToggleDarkMode();
    }
  };

  return (
    <header className="sticky top-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0 z-30 transition-colors shadow-xs">
      <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 sm:p-2.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Buka Laci Samping"
          title="Buka Laci Samping (Drawer Menu)"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-400 rounded-xl flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-xs">
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
          </div>
          <div className="flex flex-col min-w-0 leading-tight justify-center shrink-0">
            <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base lg:text-lg tracking-tight block whitespace-nowrap">
              Aplikasi Guru AI
            </span>
            {activeTab !== "dashboard" && TAB_TITLES[activeTab] && (
              <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[120px] sm:max-w-xs block">
                {TAB_TITLES[activeTab]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0 ml-1">
        {/* Firebase Live Status Badge */}
        <div
          className={`hidden min-[480px]:flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold shadow-xs transition-colors shrink-0 ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          }`}
        >
          {isConnected ? (
            <>
              <CloudCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Firebase Live</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Connecting...</span>
            </>
          )}
        </div>

        {/* Teacher / User profile badge with Quick Switcher */}
        <button
          type="button"
          onClick={() => setShowTeacherModal(true)}
          className="hidden min-[380px]:flex items-center space-x-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shrink-0 cursor-pointer active:scale-95 transition-all text-left group"
          title="Klik untuk mengganti Guru Aktif"
        >
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            {config.Nama_Guru ? config.Nama_Guru.slice(0, 1).toUpperCase() : "G"}
          </div>
          <div className="flex flex-col min-w-0 max-w-[85px] sm:max-w-[130px]">
            <span className="text-[11px] sm:text-xs font-extrabold text-blue-900 dark:text-blue-200 truncate group-hover:text-blue-700">
              {config.Nama_Guru || "Guru"}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
        </button>

        {/* Theme Toggle Switch (Sun = Light Mode, Moon = Dark Mode) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-slate-700 space-x-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectDark(false)}
            className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center justify-center min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] cursor-pointer ${
              !isDarkMode
                ? "bg-amber-400 text-slate-950 shadow-xs font-bold scale-105"
                : "text-slate-400 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 active:scale-95"
            }`}
            title="Sinar Matahari: Aktifkan Tema Terang (Light Mode)"
            aria-label="Tema Terang"
          >
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSelectDark(true)}
            className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center justify-center min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] cursor-pointer ${
              isDarkMode
                ? "bg-indigo-600 text-white shadow-xs font-bold scale-105"
                : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95"
            }`}
            title="Bulan Sabit: Aktifkan Tema Gelap (Dark Mode)"
            aria-label="Tema Gelap"
          >
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 sm:p-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 active:scale-95 transition-all min-w-[32px] min-h-[32px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center shrink-0 text-xs font-semibold cursor-pointer"
            title="Keluar dari Akses System (Logout)"
            aria-label="Logout"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>

      {/* Teacher Switcher Modal */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Pilih Guru Aktif
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aplikasi ini dapat digunakan semua guru di sekolah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Currently Active Banner */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs">
              <div className="font-bold text-blue-900 dark:text-blue-200">
                Profil Aktif Sekarang:
              </div>
              <div className="text-blue-700 dark:text-blue-300 font-extrabold mt-0.5">
                {config.Nama_Guru || "Belum dipilih"}
              </div>
              <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                NIP: {config.NIP_Guru || "-"}
              </div>
            </div>

            {/* Search Teacher Input */}
            {guruList.length > 3 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Cari guru berdasarkan nama atau mapel..."
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
                />
              </div>
            )}

            {/* Teachers List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {guruList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                  <p>Belum ada daftar dewan guru yang terdaftar.</p>
                  {onNavigateToGuru && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowTeacherModal(false);
                        onNavigateToGuru();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                    >
                      Buka Menu Kelola Guru
                    </button>
                  )}
                </div>
              ) : (
                guruList
                  .filter((g) =>
                    !teacherSearch ||
                    g.nama.toLowerCase().includes(teacherSearch.toLowerCase()) ||
                    (g.mapelUtama && g.mapelUtama.toLowerCase().includes(teacherSearch.toLowerCase()))
                  )
                  .map((g) => {
                    const isSelected = g.nama === config.Nama_Guru;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          if (onSelectGuru) {
                            onSelectGuru(g);
                          }
                          setShowTeacherModal(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs font-bold"
                            : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/80 hover:bg-blue-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              isSelected
                                ? "bg-white text-blue-600"
                                : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {g.nama.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-xs truncate">{g.nama}</div>
                            <div className={`text-[11px] truncate ${isSelected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                              {g.mapelUtama ? `${g.mapelUtama} • ` : ""}{g.jabatan || "Guru"}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
              )}
            </div>

            {/* Bottom Shortcut to Manage Teachers */}
            {onNavigateToGuru && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherModal(false);
                    onNavigateToGuru();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Kelola Semua Daftar Guru (Tambah / Edit / Hapus)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
