const { useState, useEffect, useRef } = React;

const EXPENSE_CATEGORIES = [
  { key: "food", label: "อาหาร/เครื่องดื่ม", color: "#EF4444" },
  { key: "transport", label: "เดินทาง/น้ำมัน", color: "#F59E0B" },
  { key: "shopping", label: "ช้อปปิ้ง", color: "#EC4899" },
  { key: "bills", label: "ค่าน้ำ/ค่าไฟ/เน็ต", color: "#3B82F6" },
  { key: "entertainment", label: "บันเทิง/เกม", color: "#8B5CF6" },
  { key: "health", label: "สุขภาพ/ยา", color: "#10B981" },
  { key: "other_exp", label: "อื่นๆ", color: "#6B7280" },
];

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

function App() {
  // Profile State
  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");
  const [tempUserName, setTempUserName] = useState("");

  // System Modals
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(() => !localStorage.getItem("bp_privacyAccepted"));
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem("bp_reports");
    return saved ? JSON.parse(saved) : [];
  });

  // App Core Data
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("bp_transactions");
    return saved ? JSON.parse(saved) : [];
  });

  const [savingsGoals, setSavingsGoals] = useState(() => {
    const saved = localStorage.getItem("bp_savingsGoals");
    return saved ? JSON.parse(saved) : [];
  });

  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem("bp_debts");
    return saved ? JSON.parse(saved) : [];
  });

  const [accountAdjustments, setAccountAdjustments] = useState(() => {
    const saved = localStorage.getItem("bp_accountAdjustments");
    return saved ? JSON.parse(saved) : { bank: 0, cash: 0 };
  });

  // Transaction Form State
  const [type, setType] = useState("expense");
  const [account, setAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  // Goal Form State
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  // Debt Form State
  const [debtType, setDebtType] = useState("debt"); // "debt" หรือ "reimburse"
  const [debtNote, setDebtNote] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtPerson, setDebtPerson] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  // Adjustment Inputs
  const [bankRealInput, setBankRealInput] = useState("");
  const [cashRealInput, setCashRealInput] = useState("");

  // Slip Scanner
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem("bp_userName", userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem("bp_userAvatar", userAvatar);
  }, [userAvatar]);

  useEffect(() => {
    localStorage.setItem("bp_transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals));
  }, [savingsGoals]);

  useEffect(() => {
    localStorage.setItem("bp_debts", JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem("bp_accountAdjustments", JSON.stringify(accountAdjustments));
  }, [accountAdjustments]);

  useEffect(() => {
    localStorage.setItem("bp_reports", JSON.stringify(reports));
  }, [reports]);

  const acceptPrivacy = () => {
    localStorage.setItem("bp_privacyAccepted", "true");
    setShowPrivacyNotice(false);
  };

  const handleSetProfileName = (e) => {
    e.preventDefault();
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUserAvatar(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === "Admin" && adminPassword === "27112547") {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setAdminLoginError("");
      setAdminUsername("");
      setAdminPassword("");
    } else {
      setAdminLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  const handleSendReport = (e) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    const newReport = {
      id: Date.now().toString(),
      userName: userName || "ผู้ใช้ทั่วไป",
      text: reportText.trim(),
      date: new Date().toLocaleString("th-TH"),
    };
    setReports((prev) => [newReport, ...prev]);
    setReportText("");
    setShowReportModal(false);
    alert("ส่งรายงานปัญหาเรียบร้อยแล้ว ขอบคุณครับ");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanStatus("กำลังอ่านข้อมูลจากสลิปด้วย AI...");

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

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const newTx = {
      id: Date.now().toString(),
      type,
      account,
      amount: Number(amount),
      category,
      date,
      note,
      createdByName: userName || "ผู้ใช้ทั่วไป",
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAmount("");
    setNote("");
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!goalName || !goalTarget || Number(goalTarget) <= 0) return;
    const newGoal = {
      id: Date.now().toString(),
      name: goalName,
      target: Number(goalTarget),
      current: 0,
    };
    setSavingsGoals((prev) => [...prev, newGoal]);
    setGoalName("");
    setGoalTarget("");
  };

  const handleAddDebt = (e) => {
    e.preventDefault();
    if (!debtAmount || Number(debtAmount) <= 0) return;
    const newDebt = {
      id: Date.now().toString(),
      type: debtType,
      note: debtNote,
      amount: Number(debtAmount),
      person: debtPerson,
      dueDate: debtDueDate,
    };
    setDebts((prev) => [newDebt, ...prev]);
    setDebtNote("");
    setDebtAmount("");
    setDebtPerson("");
    setDebtDueDate("");
  };

  const handleAdjustBank = () => {
    if (!bankRealInput) return;
    const realVal = Number(bankRealInput);
    const calculatedBank = transactions.reduce((acc, t) => {
      if (t.account === "bank") {
        return acc + (t.type === "income" ? t.amount : -t.amount);
      }
      return acc;
    }, 0);
    const diff = realVal - calculatedBank;
    setAccountAdjustments((prev) => ({ ...prev, bank: diff }));
    setBankRealInput("");
  };

  const handleAdjustCash = () => {
    if (!cashRealInput) return;
    const realVal = Number(cashRealInput);
    const calculatedCash = transactions.reduce((acc, t) => {
      if (t.account === "cash") {
        return acc + (t.type === "income" ? t.amount : -t.amount);
      }
      return acc;
    }, 0);
    const diff = realVal - calculatedCash;
    setAccountAdjustments((prev) => ({ ...prev, cash: diff }));
    setCashRealInput("");
  };

  // Calculations
  const calcBankTotal =
    transactions.reduce((acc, t) => {
      if (t.account === "bank") {
        return acc + (t.type === "income" ? t.amount : -t.amount);
      }
      return acc;
    }, 0) + accountAdjustments.bank;

  const calcCashTotal =
    transactions.reduce((acc, t) => {
      if (t.account === "cash") {
        return acc + (t.type === "income" ? t.amount : -t.amount);
      }
      return acc;
    }, 0) + accountAdjustments.cash;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalBalance = calcBankTotal + calcCashTotal;

  const totalDebtsPayable = debts
    .filter((d) => d.type === "debt")
    .reduce((acc, d) => acc + d.amount, 0);

  const totalDebtsReimburse = debts
    .filter((d) => d.type === "reimburse")
    .reduce((acc, d) => acc + d.amount, 0);

  // Category proportions
  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => {
    const sum = transactions
      .filter((t) => t.type === "expense" && t.category === cat.key)
      .reduce((acc, t) => acc + t.amount, 0);
    return { ...cat, sum };
  }).filter((c) => c.sum > 0);

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12">
      {/* 1. Modal บังคับแจ้งเตือนการเก็บข้อมูล (ครั้งแรก) */}
      {showPrivacyNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#1E1E1E]">การเก็บข้อมูลของคุณ</h3>
            <div className="text-xs text-[#555] space-y-2 leading-relaxed">
              <p>แอปนี้จะเก็บข้อมูลต่อไปนี้ไว้ในระบบเก็บข้อมูลที่ผูกกับบัญชีของคุณ:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>รายรับ-รายจ่าย เป้าหมายการออม และรายการหนี้สิน/รายการเบิกที่คุณกรอก</li>
                <li>ชื่อโปรไฟล์และรูปโปรไฟล์ที่คุณอัปโหลด</li>
                <li>รูปสลิปโอนเงินที่คุณเลือกอัปโหลด – รูปจะถูกส่งให้ AI อ่านยอดเงินหนึ่งครั้ง</li>
              </ul>
              <p>
                ระบบนี้ไม่มีการเข้าสู่ระบบด้วยอีเมลจริง และไม่มีรหัสผ่าน
                ชื่อโปรไฟล์เป็นเพียงข้อความที่คุณพิมพ์เอง ไม่ใช่การยืนยันตัวตนจริง
              </p>
            </div>
            <button
              onClick={acceptPrivacy}
              className="w-full bg-[#1B5E20] hover:bg-[#144718] text-white py-3 rounded-2xl text-sm font-semibold transition"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal เข้าสู่ระบบผู้ดูแลระบบ */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#1E1E1E]">เข้าสู่ระบบผู้ดูแลระบบ</h3>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="text-gray-400 text-lg hover:text-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">ชื่อผู้ใช้ (Username)</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">รหัสผ่าน (Password)</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>
              {adminLoginError && (
                <p className="text-xs text-rose-600 font-medium">{adminLoginError}</p>
              )}
              <button
                type="submit"
                className="w-full bg-[#1E1E1E] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-black transition"
              >
                ตกลง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal แจ้งปัญหาการใช้งาน */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#1E1E1E]">แจ้งปัญหาการใช้งาน</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 text-lg hover:text-black"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendReport} className="space-y-3">
              <textarea
                rows="4"
                placeholder="อธิบายปัญหาที่พบ หรือข้อเสนอแนะ..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                required
              />
              <button
                type="submit"
                className="w-full bg-[#9E2A2B] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#802122] transition"
              >
                ส่งรายงาน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-[#1E1E1E]">งบประมาณของฉัน</h1>
            <button
              onClick={() => setShowPrivacyNotice(true)}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >
              นโยบายข้อมูล
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isAdminLoggedIn) {
                  setIsAdminLoggedIn(false);
                } else {
                  setShowAdminLogin(true);
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition ${
                isAdminLoggedIn
                  ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <span>🛡️</span>
              <span>{isAdminLoggedIn} ผู้ดูแลระบบ</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition"
            >
              🚨 แจ้งปัญหา
            </button>
          </div>
        </div>

        {/* ผู้ดูแลระบบ View Panel */}
        {isAdminLoggedIn && (
          <div className="bg-[#FFFDF6] border border-[#EADBBD] rounded-3xl p-5 space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b border-[#EADBBD] pb-2">
              <h3 className="text-xs font-bold text-[#8C6D23]">🛡️ มุมมองผู้ดูแลระบบ</h3>
              <span className="text-[10px] bg-[#EADBBD] text-[#5C4510] px-2 py-0.5 rounded-full font-bold">
                Admin Mode
              </span>
            </div>
            <div className="text-xs space-y-1.5 text-gray-600">
              <p>• ชื่อผู้ใช้ปัจจุบัน: <strong>{userName || "ยังไม่ตั้งชื่อ"}</strong></p>
              <p>• รายการทั้งหมดในเครื่อง: <strong>{transactions.length} รายการ</strong></p>
              <p>• รายการแจ้งปัญหาที่ค้างอยู่: <strong>{reports.length} รายการ</strong></p>
            </div>

            {reports.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#EADBBD] space-y-2">
                <p className="text-xs font-bold text-gray-700">รายการแจ้งปัญหาจากผู้ใช้:</p>
                <div className="max-h-36 overflow-y-auto space-y-2">
                  {reports.map((r) => (
                    <div key={r.id} className="bg-white p-2.5 rounded-xl border border-gray-200 text-xs">
                      <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                        <span>👤 {r.userName}</span>
                        <span>{r.date}</span>
                      </div>
                      <p className="text-gray-800">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* โปรไฟล์ผู้ใช้งาน */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">โปรไฟล์</h2>
          <div className="flex items-center gap-4">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer overflow-hidden border border-gray-200 group"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">?</span>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] transition">
                เปลี่ยน
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex-1">
              <label className="text-[11px] text-gray-400 block mb-1">ชื่อที่แสดง (บังคับตั้งชื่อ)</label>
              {userName ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1E1E1E]">{userName}</span>
                  <button
                    onClick={() => {
                      setTempUserName(userName);
                      setUserName("");
                    }}
                    className="text-xs text-gray-400 hover:text-black"
                  >
                    ✏️ แก้ไข
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSetProfileName} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="เช่น Gun"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#1E1E1E] text-white rounded-xl text-xs font-semibold"
                  >
                    บันทึก
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* การ์ดคงเหลือทั้งหมด */}
        <div className="bg-[#1E1E1E] text-white rounded-3xl p-6 shadow-md space-y-4">
          <div>
            <p className="text-xs text-gray-400">คงเหลือทั้งหมด</p>
            <h2 className="text-3xl font-extrabold mt-1">
              {formatMoney(totalBalance)} <span className="text-sm font-normal text-gray-400">บาท</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800 text-xs">
            <div>
              <span className="text-gray-400">↗ รายรับ </span>
              <span className="font-bold text-emerald-400">{formatMoney(totalIncome)}</span>
            </div>
            <div>
              <span className="text-gray-400">↘ รายจ่าย </span>
              <span className="font-bold text-rose-400">{formatMoney(totalExpense)}</span>
            </div>
            <div>
              <span className="text-gray-400">ธนาคาร </span>
              <span className="font-bold text-gray-200">{formatMoney(calcBankTotal)} บาท</span>
            </div>
            <div>
              <span className="text-gray-400">เงินสด </span>
              <span className="font-bold text-gray-200">{formatMoney(calcCashTotal)} บาท</span>
            </div>
          </div>
        </div>

        {/* เป้าหมายการออม */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E] flex items-center gap-1.5">
            <span>🎯</span> เป้าหมายการออม
          </h2>

          {savingsGoals.length === 0 ? (
            <p className="text-xs text-gray-400">ยังไม่มีเป้าหมาย เพิ่มเป้าหมายแรกได้เลย</p>
          ) : (
            <div className="space-y-2">
              {savingsGoals.map((g) => (
                <div key={g.id} className="bg-gray-50 p-3 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{g.name}</span>
                    <span>
                      {formatMoney(g.current)} / {formatMoney(g.target)} บาท
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1B5E20] h-full transition-all"
                      style={{
                        width: `${Math.min(100, (g.current / g.target) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddGoal} className="grid grid-cols-3 gap-2 pt-2">
            <input
              type="text"
              placeholder="ชื่อเป้าหมาย"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="col-span-1 px-3 py-2 border rounded-xl text-xs bg-gray-50"
            />
            <input
              type="number"
              placeholder="เป้าหมาย (บาท)"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              className="col-span-1 px-3 py-2 border rounded-xl text-xs bg-gray-50"
            />
            <button
              type="submit"
              className="col-span-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold py-2 transition"
            >
              + เพิ่มเป้าหมาย
            </button>
          </form>
        </div>

        {/* ปรับยอดให้ตรงกับบัญชีจริง */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E] flex items-center gap-1.5">
            <span>⚖️</span> ปรับยอดให้ตรงกับบัญชีจริง
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-gray-500 mb-1">
                <span>ธนาคาร (ในระบบ: {formatMoney(calcBankTotal)} บาท)</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="ยอดจริงที่มี"
                  value={bankRealInput}
                  onChange={(e) => setBankRealInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-xl bg-gray-50"
                />
                <button
                  onClick={handleAdjustBank}
                  className="bg-[#1E1E1E] text-white px-4 py-2 rounded-xl font-semibold hover:bg-black transition"
                >
                  ปรับยอด
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-gray-500 mb-1">
                <span>เงินสด (ในระบบ: {formatMoney(calcCashTotal)} บาท)</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="ยอดจริงที่มี"
                  value={cashRealInput}
                  onChange={(e) => setCashRealInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-xl bg-gray-50"
                />
                <button
                  onClick={handleAdjustCash}
                  className="bg-[#1E1E1E] text-white px-4 py-2 rounded-xl font-semibold hover:bg-black transition"
                >
                  ปรับยอด
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* นำเข้าจากสลิปโอนเงิน (AI Powered) */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">นำเข้าจากสลิปโอนเงิน</h2>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer space-y-2"
          >
            <div className="text-2xl">🖼️</div>
            <p className="text-xs font-bold text-gray-700">เลือกรูปสลิป</p>
            <p className="text-[11px] text-gray-400">
              ระบบอ่านยอดเงินและวันที่จากรูปให้อัตโนมัติด้วย AI
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={scanning}
            />
          </div>
          {scanStatus && (
            <p className="text-xs text-center font-medium text-emerald-600">{scanStatus}</p>
          )}
        </div>

        {/* เพิ่มรายการใหม่ */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">เพิ่มรายการ</h2>

          <form onSubmit={handleAddTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`py-2 text-xs font-semibold rounded-xl transition ${
                  type === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"
                }`}
              >
                รายจ่าย
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`py-2 text-xs font-semibold rounded-xl transition ${
                  type === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
                }`}
              >
                รายรับ
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccount("bank")}
                className={`py-2 text-xs font-semibold border rounded-xl transition ${
                  account === "bank"
                    ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                ธนาคาร
              </button>
              <button
                type="button"
                onClick={() => setAccount("cash")}
                className={`py-2 text-xs font-semibold border rounded-xl transition ${
                  account === "cash"
                    ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                เงินสด
              </button>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">จำนวนเงิน (บาท)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">หมวดหมู่</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                >
                  {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">วันที่</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">รายละเอียด (ไม่บังคับ)</label>
              <input
                type="text"
                placeholder="เช่น ข้าวเที่ยงกับเพื่อน"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#9E2A2B] hover:bg-[#802122] text-white py-3 rounded-2xl font-bold text-xs transition"
            >
              + เพิ่มรายการ
            </button>
          </form>
        </div>

        {/* ใช้จ่ายตามหมวดหมู่ */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">ใช้จ่ายตามหมวดหมู่</h2>
          {categoryExpenses.length === 0 ? (
            <p className="text-xs text-gray-400">ยังไม่มีรายจ่าย เพิ่มรายการเพื่อดูสัดส่วน</p>
          ) : (
            <div className="space-y-2">
              {categoryExpenses.map((cat) => (
                <div key={cat.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{cat.label}</span>
                    <span className="text-rose-600">-{formatMoney(cat.sum)} บาท</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        backgroundColor: cat.color,
                        width: `${Math.min(100, (cat.sum / totalExpense) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* หนี้สินและรายการเบิก */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">หนี้สินและรายการเบิก</h2>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
              <p className="text-rose-600 font-medium">ติดหนี้ค้างอยู่</p>
              <p className="text-base font-bold text-rose-700 mt-1">
                {formatMoney(totalDebtsPayable)} บาท
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
              <p className="text-emerald-600 font-medium">รอเบิกคืน</p>
              <p className="text-base font-bold text-emerald-700 mt-1">
                {formatMoney(totalDebtsReimburse)} บาท
              </p>
            </div>
          </div>

          <form onSubmit={handleAddDebt} className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDebtType("debt")}
                className={`py-1.5 font-semibold rounded-lg transition ${
                  debtType === "debt" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"
                }`}
              >
                หนี้ที่ติดอยู่
              </button>
              <button
                type="button"
                onClick={() => setDebtType("reimburse")}
                className={`py-1.5 font-semibold rounded-lg transition ${
                  debtType === "reimburse" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
                }`}
              >
                รายการเบิก
              </button>
            </div>

            <input
              type="text"
              placeholder="รายละเอียด (เช่น ยืมเพื่อนค่าทริป)"
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="จำนวนเงิน (บาท)"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
              />
              <input
                type="text"
                placeholder="กับใคร (ไม่บังคับ)"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
              />
            </div>

            <input
              type="date"
              value={debtDueDate}
              onChange={(e) => setDebtDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
            />

            <button
              type="submit"
              className="w-full bg-[#9E2A2B] text-white py-2.5 rounded-xl text-xs font-bold transition"
            >
              + เพิ่มรายการ
            </button>
          </form>
        </div>

        {/* ประวัติรายการทั้งหมด */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
          <h2 className="text-sm font-bold text-[#1E1E1E]">
            รายการทั้งหมด ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <p className="text-xs text-gray-400">ยังไม่มีรายการ เริ่มเพิ่มรายรับหรือรายจ่ายด้านบนได้เลย</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const info = categoryInfo(tx.category);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl text-xs border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-8 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      <div>
                        <p className="font-semibold text-gray-800">{info.label}</p>
                        <p className="text-[10px] text-gray-400">
                          {formatDateThai(tx.date)} • {ACCOUNT_LABEL[tx.account]}
                          {tx.note && ` • ${tx.note}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          tx.type === "income" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatMoney(tx.amount)}
                      </span>
                      <button
                        onClick={() =>
                          setTransactions((prev) => prev.filter((t) => t.id !== tx.id))
                        }
                        className="p-1 text-gray-400 hover:text-rose-600 text-xs"
                      >
                        🗑️
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
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
