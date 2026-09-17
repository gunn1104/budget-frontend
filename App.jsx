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
  // Sidebar Menu Drawer
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Profile State
  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");
  const [tempUserName, setTempUserName] = useState("");

  // Modals
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

  // Data States
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("bp_transactions");
    return saved ? JSON.parse(saved) : [];
  });

  const [savingsGoals, setSavingsGoals] = useState(() => {
    const saved = localStorage.getItem("bp_savingsGoals");
    return saved ? JSON.parse(saved) : [];
  });

  // Debt & Loans State (เจ้าหนี้, ลูกหนี้, รายการเบิก)
  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem("bp_debts");
    return saved ? JSON.parse(saved) : [];
  });

  const [accountAdjustments, setAccountAdjustments] = useState(() => {
    const saved = localStorage.getItem("bp_accountAdjustments");
    return saved ? JSON.parse(saved) : { bank: 0, cash: 0 };
  });

  // Form Inputs
  const [type, setType] = useState("expense");
  const [account, setAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  // Goal Form State
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  // Debt/Loan Form State
  const [debtType, setDebtType] = useState("creditor"); // "creditor" (เจ้าหนี้), "debtor" (ลูกหนี้/ใครติดเรา), "reimburse" (รายการเบิก)
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

  // Sync LocalStorage
  useEffect(() => localStorage.setItem("bp_userName", userName), [userName]);
  useEffect(() => localStorage.setItem("bp_userAvatar", userAvatar), [userAvatar]);
  useEffect(() => localStorage.setItem("bp_transactions", JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals)), [savingsGoals]);
  useEffect(() => localStorage.setItem("bp_debts", JSON.stringify(debts)), [debts]);
  useEffect(() => localStorage.setItem("bp_accountAdjustments", JSON.stringify(accountAdjustments)), [accountAdjustments]);
  useEffect(() => localStorage.setItem("bp_reports", JSON.stringify(reports)), [reports]);

  const acceptPrivacy = () => {
    localStorage.setItem("bp_privacyAccepted", "true");
    setShowPrivacyNotice(false);
  };

  const handleSetProfileName = (e) => {
    e.preventDefault();
    if (tempUserName.trim()) setUserName(tempUserName.trim());
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUserAvatar(ev.target.result);
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
    alert("ส่งรายงานปัญหาเรียบร้อยแล้ว");
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
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAmount("");
    setNote("");
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!goalName || !goalTarget || Number(goalTarget) <= 0) return;
    setSavingsGoals((prev) => [
      ...prev,
      { id: Date.now().toString(), name: goalName, target: Number(goalTarget), current: 0 },
    ]);
    setGoalName("");
    setGoalTarget("");
  };

  const handleAddDebt = (e) => {
    e.preventDefault();
    if (!debtAmount || Number(debtAmount) <= 0) return;
    setDebts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: debtType,
        note: debtNote,
        amount: Number(debtAmount),
        person: debtPerson,
        dueDate: debtDueDate,
      },
    ]);
    setDebtNote("");
    setDebtAmount("");
    setDebtPerson("");
    setDebtDueDate("");
  };

  const handleAdjustBank = () => {
    if (!bankRealInput) return;
    const realVal = Number(bankRealInput);
    const calculatedBank = transactions.reduce(
      (acc, t) => (t.account === "bank" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc),
      0
    );
    setAccountAdjustments((prev) => ({ ...prev, bank: realVal - calculatedBank }));
    setBankRealInput("");
  };

  const handleAdjustCash = () => {
    if (!cashRealInput) return;
    const realVal = Number(cashRealInput);
    const calculatedCash = transactions.reduce(
      (acc, t) => (t.account === "cash" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc),
      0
    );
    setAccountAdjustments((prev) => ({ ...prev, cash: realVal - calculatedCash }));
    setCashRealInput("");
  };

  // Totals Calculation
  const calcBankTotal =
    transactions.reduce(
      (acc, t) => (t.account === "bank" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc),
      0
    ) + accountAdjustments.bank;

  const calcCashTotal =
    transactions.reduce(
      (acc, t) => (t.account === "cash" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc),
      0
    ) + accountAdjustments.cash;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalBalance = calcBankTotal + calcCashTotal;

  // H หนี้สินและลูกหนี้
  const totalCreditor = debts.filter((d) => d.type === "creditor").reduce((acc, d) => acc + d.amount, 0);
  const totalDebtor = debts.filter((d) => d.type === "debtor").reduce((acc, d) => acc + d.amount, 0);
  const totalReimburse = debts.filter((d) => d.type === "reimburse").reduce((acc, d) => acc + d.amount, 0);

  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => {
    const sum = transactions
      .filter((t) => t.type === "expense" && t.category === cat.key)
      .reduce((acc, t) => acc + t.amount, 0);
    return { ...cat, sum };
  }).filter((c) => c.sum > 0);

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12">
      {/* ☰ Side Menu Drawer (ซ่อนเมนูที่ไม่จำเป็นไว้ข้างๆ) */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="w-4/5 max-w-sm bg-white h-full p-6 space-y-6 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-lg font-bold text-[#1E1E1E]">เมนูและเครื่องมือ</h2>
              <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 text-xl font-bold">
                ✕
              </button>
            </div>

            {/* เครื่องมือพิเศษ */}
            <div className="space-y-4">
              {/* ปรับยอดให้ตรงกับบัญชีจริง */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h3 className="text-xs font-bold text-gray-700">⚖️ ปรับยอดให้ตรงกับบัญชีจริง</h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-500">ธนาคาร (ในระบบ: {formatMoney(calcBankTotal)} บาท)</span>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        placeholder="ยอดจริง"
                        value={bankRealInput}
                        onChange={(e) => setBankRealInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 border rounded-xl bg-white"
                      />
                      <button onClick={handleAdjustBank} className="bg-[#1E1E1E] text-white px-3 py-1.5 rounded-xl font-semibold">
                        ปรับ
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">เงินสด (ในระบบ: {formatMoney(calcCashTotal)} บาท)</span>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        placeholder="ยอดจริง"
                        value={cashRealInput}
                        onChange={(e) => setCashRealInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 border rounded-xl bg-white"
                      />
                      <button onClick={handleAdjustCash} className="bg-[#1E1E1E] text-white px-3 py-1.5 rounded-xl font-semibold">
                        ปรับ
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* เป้าหมายการออม */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h3 className="text-xs font-bold text-gray-700">🎯 เป้าหมายการออม</h3>
                {savingsGoals.length === 0 ? (
                  <p className="text-xs text-gray-400">ยังไม่มีเป้าหมาย</p>
                ) : (
                  <div className="space-y-2">
                    {savingsGoals.map((g) => (
                      <div key={g.id} className="bg-white p-2.5 rounded-xl border text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span>{g.name}</span>
                          <span>{formatMoney(g.target)} บ.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddGoal} className="space-y-2">
                  <input
                    type="text"
                    placeholder="ชื่อเป้าหมาย"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-xl text-xs bg-white"
                  />
                  <input
                    type="number"
                    placeholder="จำนวนเงินเป้าหมาย"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-xl text-xs bg-white"
                  />
                  <button type="submit" className="w-full bg-[#1B5E20] text-white py-2 rounded-xl text-xs font-bold">
                    + เพิ่มเป้าหมาย
                  </button>
                </form>
              </div>

              {/* ปุ่มนโยบายและแจ้งปัญหา */}
              <div className="pt-4 border-t space-y-2">
                <button
                  onClick={() => {
                    setShowPrivacyNotice(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left text-xs text-gray-600 hover:text-black py-2"
                >
                  📜 นโยบายการเก็บข้อมูล
                </button>
                <button
                  onClick={() => {
                    setShowReportModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left text-xs text-rose-600 hover:text-rose-800 py-2 font-semibold"
                >
                  🚨 แจ้งปัญหาการใช้งาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals ต่างๆ */}
      {showPrivacyNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#1E1E1E]">การเก็บข้อมูลของคุณ</h3>
            <p className="text-xs text-[#555] leading-relaxed">
              แอปนี้จะเก็บข้อมูลรายรับ-รายจ่าย รายการเจ้าหนี้/ลูกหนี้ และสลิปโอนเงินไว้ในเบราว์เซอร์ของคุณ
              ข้อมูลรูปสลิปจะถูกส่งให้ AI ประมวลผลและอ่านยอดเงินอย่างถูกต้อง
            </p>
            <button onClick={acceptPrivacy} className="w-full bg-[#1B5E20] text-white py-3 rounded-2xl text-sm font-semibold">
              รับทราบและปิด
            </button>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#1E1E1E]">เข้าสู่ระบบผู้ดูแลระบบ</h3>
              <button onClick={() => setShowAdminLogin(false)} className="text-gray-400 text-lg">✕</button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="text"
                placeholder="Username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                required
              />
              {adminLoginError && <p className="text-xs text-rose-600">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-2.5 rounded-xl text-sm font-semibold">
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#1E1E1E]">แจ้งปัญหาการใช้งาน</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 text-lg">✕</button>
            </div>
            <form onSubmit={handleSendReport} className="space-y-3">
              <textarea
                rows="4"
                placeholder="ระบุรายละเอียดปัญหาที่พบ..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm bg-gray-50"
                required
              />
              <button type="submit" className="w-full bg-[#9E2A2B] text-white py-2.5 rounded-xl text-sm font-semibold">
                ส่งรายงาน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Header Container */}
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        {/* Top Navbar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2.5 bg-white rounded-2xl border border-gray-200 shadow-sm hover:bg-gray-50 text-xl"
            >
              ☰
            </button>
            <h1 className="text-xl font-bold text-[#1E1E1E]">งบประมาณของฉัน</h1>
          </div>

          <button
            onClick={() => (isAdminLoggedIn ? setIsAdminLoggedIn(false) : setShowAdminLogin(true))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              isAdminLoggedIn ? "bg-[#1E1E1E] text-white" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            🛡️ {isAdminLoggedIn ? "ผู้ดูแลระบบ (Admin)" : "ผู้ดูแลระบบ"}
          </button>
        </div>

        {/* Admin Dashboard */}
        {isAdminLoggedIn && (
          <div className="bg-[#FFFDF6] border border-[#EADBBD] rounded-3xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#8C6D23]">🛡️ มุมมองผู้ดูแลระบบ</h3>
            <div className="text-xs space-y-1 text-gray-600">
              <p>• ชื่อผู้ใช้ปัจจุบัน: <strong>{userName || "ยังไม่ตั้งชื่อ"}</strong></p>
              <p>• รายการแจ้งปัญหาค้างอยู่: <strong>{reports.length} รายการ</strong></p>
            </div>
            {reports.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#EADBBD]">
                {reports.map((r) => (
                  <div key={r.id} className="bg-white p-2.5 rounded-xl border text-xs">
                    <span className="font-bold">{r.userName}:</span> {r.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Layout Grid สำหรับคอมพิวเตอร์ (PC Dual Column View) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ฝั่งซ้าย (Left Column) */}
          <div className="lg:col-span-5 space-y-4">
            {/* โปรไฟล์ */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">โปรไฟล์</h2>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer overflow-hidden border"
                >
                  {userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : <span className="text-xl">?</span>}
                  <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-gray-400 block mb-1">ชื่อที่แสดง</label>
                  {userName ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{userName}</span>
                      <button onClick={() => setUserName("")} className="text-xs text-gray-400">✏️ แก้ไข</button>
                    </div>
                  ) : (
                    <form onSubmit={handleSetProfileName} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="เช่น Gun"
                        value={tempUserName}
                        onChange={(e) => setTempUserName(e.target.value)}
                        className="flex-1 px-3 py-1.5 border rounded-xl text-xs bg-gray-50"
                        required
                      />
                      <button type="submit" className="px-3 py-1.5 bg-[#1E1E1E] text-white rounded-xl text-xs font-semibold">
                        บันทึก
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* คงเหลือทั้งหมด */}
            <div className="bg-[#1E1E1E] text-white rounded-3xl p-6 shadow-md space-y-4">
              <div>
                <p className="text-xs text-gray-400">คงเหลือทั้งหมด</p>
                <h2 className="text-3xl font-extrabold mt-1">
                  {formatMoney(totalBalance)} <span className="text-sm font-normal text-gray-400">บาท</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800 text-xs">
                <div><span className="text-gray-400">↗ รายรับ </span><span className="font-bold text-emerald-400">{formatMoney(totalIncome)}</span></div>
                <div><span className="text-gray-400">↘ รายจ่าย </span><span className="font-bold text-rose-400">{formatMoney(totalExpense)}</span></div>
                <div><span className="text-gray-400">ธนาคาร </span><span className="font-bold text-gray-200">{formatMoney(calcBankTotal)} บาท</span></div>
                <div><span className="text-gray-400">เงินสด </span><span className="font-bold text-gray-200">{formatMoney(calcCashTotal)} บาท</span></div>
              </div>
            </div>

            {/* เพิ่มรายการใหม่ */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">เพิ่มรายการ</h2>
              <form onSubmit={handleAddTransaction} className="space-y-3">
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`py-2 text-xs font-semibold rounded-xl ${type === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"}`}
                  >
                    รายจ่าย
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`py-2 text-xs font-semibold rounded-xl ${type === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"}`}
                  >
                    รายรับ
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccount("bank")}
                    className={`py-2 text-xs font-semibold border rounded-xl ${account === "bank" ? "bg-[#1E1E1E] text-white" : "bg-white text-gray-600"}`}
                  >
                    ธนาคาร
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccount("cash")}
                    className={`py-2 text-xs font-semibold border rounded-xl ${account === "cash" ? "bg-[#1E1E1E] text-white" : "bg-white text-gray-600"}`}
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
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50">
                      {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">วันที่</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">รายละเอียด (ไม่บังคับ)</label>
                  <input
                    type="text"
                    placeholder="เช่น ข้าวเที่ยง"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                  />
                </div>

                <button type="submit" className="w-full bg-[#9E2A2B] text-white py-3 rounded-2xl font-bold text-xs">
                  + เพิ่มรายการ
                </button>
              </form>
            </div>
          </div>

          {/* ฝั่งขวา (Right Column) */}
          <div className="lg:col-span-7 space-y-4">
            {/* สแกนสลิปโอนเงิน */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">นำเข้าจากสลิปโอนเงิน</h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer space-y-1"
              >
                <div className="text-2xl">🖼️</div>
                <p className="text-xs font-bold text-gray-700">เลือกรูปสลิป</p>
                <p className="text-[11px] text-gray-400">ระบบอ่านยอดเงินและวันที่ให้อัตโนมัติด้วย AI</p>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} disabled={scanning} />
              </div>
              {scanStatus && <p className="text-xs text-center font-medium text-emerald-600">{scanStatus}</p>}
            </div>

            {/* หนี้สิน, เจ้าหนี้, ลูกหนี้ และรายการเบิก */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">เจ้าหนี้ / ลูกหนี้ / รายการเบิก</h2>

              {/* การ์ดสรุป 3 ช่อง */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-rose-50 p-2.5 rounded-2xl border border-rose-100">
                  <p className="text-rose-600 font-medium text-[11px]">เจ้าหนี้ (เราติด)</p>
                  <p className="text-sm font-bold text-rose-700 mt-1">{formatMoney(totalCreditor)} บ.</p>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100">
                  <p className="text-emerald-600 font-medium text-[11px]">ลูกหนี้ (ใครติดเรา)</p>
                  <p className="text-sm font-bold text-emerald-700 mt-1">{formatMoney(totalDebtor)} บ.</p>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-100">
                  <p className="text-blue-600 font-medium text-[11px]">รอเบิกคืน</p>
                  <p className="text-sm font-bold text-blue-700 mt-1">{formatMoney(totalReimburse)} บ.</p>
                </div>
              </div>

              {/* ฟอร์มเพิ่มหนี้สิน/ลูกหนี้ */}
              <form onSubmit={handleAddDebt} className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDebtType("creditor")}
                    className={`py-1.5 font-semibold rounded-lg ${debtType === "creditor" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"}`}
                  >
                    เจ้าหนี้ (ติดอยู่)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtType("debtor")}
                    className={`py-1.5 font-semibold rounded-lg ${debtType === "debtor" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"}`}
                  >
                    ลูกหนี้ (ติดเรา)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtType("reimburse")}
                    className={`py-1.5 font-semibold rounded-lg ${debtType === "reimburse" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                  >
                    รายการเบิก
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="รายละเอียดรายการ"
                  value={debtNote}
                  onChange={(e) => setDebtNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                  required
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="จำนวนเงิน (บาท)"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                    required
                  />
                  <input
                    type="text"
                    placeholder="ชื่อบุคคล"
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

                <button type="submit" className="w-full bg-[#9E2A2B] text-white py-2.5 rounded-xl text-xs font-bold">
                  + บันทึกรายการ
                </button>
              </form>

              {/* รายการแสดงผล */}
              {debts.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  {debts.map((d) => (
                    <div key={d.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl text-xs">
                      <div>
                        <span className={`font-bold mr-1 ${d.type === "creditor" ? "text-rose-600" : d.type === "debtor" ? "text-emerald-600" : "text-blue-600"}`}>
                          [{d.type === "creditor" ? "เจ้าหนี้" : d.type === "debtor" ? "ลูกหนี้" : "เบิก"}]
                        </span>
                        <span>{d.note}</span>
                        {d.person && <span className="text-gray-400"> ({d.person})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatMoney(d.amount)} บ.</span>
                        <button onClick={() => setDebts((prev) => prev.filter((item) => item.id !== d.id))} className="text-gray-400 hover:text-rose-600">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* สัดส่วนการใช้จ่ายตามหมวดหมู่ */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">ใช้จ่ายตามหมวดหมู่</h2>
              {categoryExpenses.length === 0 ? (
                <p className="text-xs text-gray-400">ยังไม่มีรายจ่าย</p>
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

            {/* ประวัติรายการทั้งหมด */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">รายการทั้งหมด ({transactions.length})</h2>
              {transactions.length === 0 ? (
                <p className="text-xs text-gray-400">ยังไม่มีรายการบันทึก</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const info = categoryInfo(tx.category);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-8 rounded-full" style={{ backgroundColor: info.color }} />
                          <div>
                            <p className="font-semibold text-gray-800">{info.label}</p>
                            <p className="text-[10px] text-gray-400">
                              {formatDateThai(tx.date)} • {ACCOUNT_LABEL[tx.account]}
                              {tx.note && ` • ${tx.note}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                            {tx.type === "income" ? "+" : "-"}{formatMoney(tx.amount)}
                          </span>
                          <button onClick={() => setTransactions((prev) => prev.filter((t) => t.id !== tx.id))} className="text-gray-400 hover:text-rose-600">
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
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
