import React, { useState, useEffect, useRef } from "react";
import {
  Wallet,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  CreditCard,
  Trash2,
  Edit2,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// หมวดหมู่รายจ่าย
const EXPENSE_CATEGORIES = [
  { key: "food", label: "อาหาร/เครื่องดื่ม", color: "#EF4444" },
  { key: "transport", label: "เดินทาง/น้ำมัน", color: "#F59E0B" },
  { key: "shopping", label: "ช้อปปิ้ง", color: "#EC4899" },
  { key: "bills", label: "ค่าน้ำ/ค่าไฟ/เน็ต", color: "#3B82F6" },
  { key: "entertainment", label: "บันเทิง/เกม", color: "#8B5CF6" },
  { key: "health", label: "สุขภาพ/ยา", color: "#10B981" },
  { key: "other_exp", label: "อื่นๆ", color: "#6B7280" },
];

// หมวดหมู่รายรับ
const INCOME_CATEGORIES = [
  { key: "salary", label: "เงินเดือน/ค่าจ้าง", color: "#10B981" },
  { key: "business", label: "ธุรกิจส่วนตัว/งานเสริม", color: "#059669" },
  { key: "gift", label: "โบนัส/ของขวัญ", color: "#34D399" },
  { key: "other_inc", label: "รายรับอื่นๆ", color: "#6EE7B7" },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const ACCOUNTS = [
  { key: "bank", label: "ธนาคาร" },
  { key: "cash", label: "เงินสด" },
];

const ACCOUNT_LABEL = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.label]));

// URL สำหรับ Backend Server บน Render
const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";

function categoryInfo(key) {
  return ALL_CATEGORIES.find((c) => c.key === key) || { label: key, color: "#8A8578" };
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDateThai(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

function resizeImage(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({
          base64Data: dataUrl.split(",")[1],
          mediaType: "image/jpeg",
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BudgetPlanner() {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("bp_transactions");
    return saved ? JSON.parse(saved) : [];
  });

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [account, setAccount] = useState("bank");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("bp_transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (type === "expense" && !EXPENSE_CATEGORIES.some((c) => c.key === category)) {
      setCategory("food");
    } else if (type === "income" && !INCOME_CATEGORIES.some((c) => c.key === category)) {
      setCategory("salary");
    }
  }, [type]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanStatus("กำลังอ่านข้อมูลจากสลิป...");

    try {
      const { base64Data, mediaType } = await resizeImage(file);
      const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, mediaType }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setDate(data.date);
      if (data.note) setNote(data.note);

      setType("expense");
      setAccount("bank");
      setScanStatus("อ่านข้อมูลสลิปสำเร็จ!");
    } catch (err) {
      console.error(err);
      setScanStatus("อ่านสลิปไม่สำเร็จ กรุณากรอกข้อมูลด้วยตนเอง");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    if (editingId) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, type, amount: Number(amount), category, account, date, note }
            : t
        )
      );
      setEditingId(null);
    } else {
      const newTx = {
        id: Date.now().toString(),
        type,
        amount: Number(amount),
        category,
        account,
        date,
        note,
      };
      setTransactions((prev) => [newTx, ...prev]);
    }

    setAmount("");
    setNote("");
    setDate(todayStr());
  };

  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setType(tx.type);
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setAccount(tx.account);
    setDate(tx.date);
    setNote(tx.note || "");
  };

  const handleDelete = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500 text-white rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Budget Planner</h1>
              <p className="text-xs text-slate-500">ระบบบันทึกรายรับ-รายจ่าย AI</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">ยอดยกมาคงเหลือ</p>
              <h3 className={`text-xl font-bold mt-1 ${balance >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                ฿{formatMoney(balance)}
              </h3>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">รายรับรวม</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-1">
                +฿{formatMoney(totalIncome)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">รายจ่ายรวม</p>
              <h3 className="text-xl font-bold text-rose-600 mt-1">
                -฿{formatMoney(totalExpense)}
              </h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-slate-800">
              {editingId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
            </h2>
            
            <label className="cursor-pointer flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition">
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Camera className="w-4 h-4 text-emerald-600" />
              )}
              <span>สแกนสลิปโอนเงิน</span>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={scanning}
              />
            </label>
          </div>

          {scanStatus && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-600" />
              <span>{scanStatus}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  type === "expense"
                    ? "bg-white text-rose-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                รายจ่าย
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  type === "income"
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                รายรับ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
                    (c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  บัญชี / ช่องทาง
                </label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ACCOUNTS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  วันที่
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                บันทึกเพิ่มเติม / ชื่อรายการ
              </label>
              <input
                type="text"
                placeholder="เช่น ค่าอาหารกลางวัน, โอนให้เพื่อน"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
              >
                {editingId ? "บันทึกการแก้ไข" : "บันทึกรายการ"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setAmount("");
                    setNote("");
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            ประวัติรายการล่าสุด ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-xs">
              ยังไม่มีรายการบันทึก
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const info = categoryInfo(tx.category);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-10 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {info.label}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDateThai(tx.date)} • {ACCOUNT_LABEL[tx.account]}
                          {tx.note && ` • ${tx.note}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold ${
                          tx.type === "income" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}฿{formatMoney(tx.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(tx)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
