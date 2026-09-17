const { useState, useEffect, useRef } = React;

const firebaseConfig = {
  apiKey: "AIzaSyBo04M6atVIJe2wc7prBS6N6y...", 
  authDomain: "budget-planner-app-b6620.firebaseapp.com",
  databaseURL: "https://budget-planner-app-b6620-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "budget-planner-app-b6620",
  storageBucket: "budget-planner-app-b6620.appspot.com",
  messagingSenderId: "104816758240",
  appId: "1:104816758240:web:3ee5fc818719c"
};

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
  const [deviceId] = useState(() => {
    let id = localStorage.getItem("bp_deviceId");
    if (!id) {
      id = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("bp_deviceId", id);
    }
    return id;
  });

  // State เมนูสามขีด และ หน้าต่าง Popup ย่อย
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'transactions', 'categories', 'adjust', 'goals'

  // Profile State
  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");
  const [tempUserName, setTempUserName] = useState("");

  // Admin & Modals State
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(() => !localStorage.getItem("bp_privacyAccepted"));
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reports, setReports] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Delete Confirmation Modal State (ป๊อปอัปยืนยันการลบ)
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'transaction'|'debt', id: string }

  // Core Data State
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

  // Inputs
  const [type, setType] = useState("expense");
  const [account, setAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  const [debtType, setDebtType] = useState("creditor");
  const [debtNote, setDebtNote] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtPerson, setDebtPerson] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  const [bankRealInput, setBankRealInput] = useState("");
  const [cashRealInput, setCashRealInput] = useState("");

  // Scanner State
  const [scanning, setScanning] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ current: 0, total: 0, successCount: 0 });
  const [scanMessage, setScanMessage] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Calculations
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

  const totalCreditor = debts.filter((d) => d.type === "creditor").reduce((acc, d) => acc + d.amount, 0);
  const totalDebtor = debts.filter((d) => d.type === "debtor").reduce((acc, d) => acc + d.amount, 0);
  const totalReimburse = debts.filter((d) => d.type === "reimburse").reduce((acc, d) => acc + d.amount, 0);

  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => {
    const sum = transactions
      .filter((t) => t.type === "expense" && t.category === cat.key)
      .reduce((acc, t) => acc + t.amount, 0);
    return { ...cat, sum };
  }).filter((c) => c.sum > 0);

  // Sync LocalStorage
  useEffect(() => localStorage.setItem("bp_userName", userName), [userName]);
  useEffect(() => localStorage.setItem("bp_userAvatar", userAvatar), [userAvatar]);
  useEffect(() => localStorage.setItem("bp_transactions", JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals)), [savingsGoals]);
  useEffect(() => localStorage.setItem("bp_debts", JSON.stringify(debts)), [debts]);
  useEffect(() => localStorage.setItem("bp_accountAdjustments", JSON.stringify(accountAdjustments)), [accountAdjustments]);

  // Firebase User Sync
  useEffect(() => {
    const syncUserData = async () => {
      try {
        const payload = {
          deviceId,
          userName: userName || "ผู้ใช้ทั่วไป",
          avatar: userAvatar || "",
          balance: totalBalance,
          lastActive: new Date().toLocaleString("th-TH"),
        };
        await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Firebase User Sync Error:", err);
      }
    };
    if (userName) syncUserData();
  }, [userName, userAvatar, totalBalance, deviceId]);

  // Firebase Admin Fetch
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    const fetchAdminData = async () => {
      try {
        const userRes = await fetch(`${firebaseConfig.databaseURL}/users.json`);
        const userData = await userRes.json();
        if (userData) setOnlineUsers(Object.values(userData));

        const reportRes = await fetch(`${firebaseConfig.databaseURL}/reports.json`);
        const reportData = await reportRes.json();
        if (reportData) setReports(Object.values(reportData).reverse());
      } catch (err) {
        console.error("Firebase Admin Fetch Error:", err);
      }
    };
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 4000);
    return () => clearInterval(interval);
  }, [isAdminLoggedIn]);

  // ฟังก์ชันลบข้อมูลเมื่อผู้ใช้ยืนยัน
  const confirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "transaction") {
      setTransactions((prev) => prev.filter((t) => t.id !== itemToDelete.id));
    } else if (itemToDelete.type === "debt") {
      setDebts((prev) => prev.filter((d) => d.id !== itemToDelete.id));
    }
    setItemToDelete(null);
  };

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
    if (adminUsername.trim() === "Admin" && adminPassword.trim() === "27112547") {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setAdminLoginError("");
      setAdminUsername("");
      setAdminPassword("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setAdminLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  const handleSendReport = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    const reportPayload = {
      id: Date.now().toString(),
      userName: userName || "ผู้ใช้ทั่วไป",
      text: reportText.trim(),
      date: new Date().toLocaleString("th-TH"),
    };
    try {
      await fetch(`${firebaseConfig.databaseURL}/reports/${reportPayload.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });
      setReportText("");
      setShowReportModal(false);
      alert("ส่งรายงานปัญหาถึงผู้ดูแลระบบเรียบร้อยแล้ว ขอบคุณครับ");
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถส่งรายงานได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setScanning(true);
    setScanMessage("");
    setQueueStatus({ current: 0, total: files.length, successCount: 0 });

    let successCount = 0;
    const newTxList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueueStatus({ current: i + 1, total: files.length, successCount });

      try {
        const { base64Data, mediaType } = await resizeImage(file);
        const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, mediaType }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.amount && Number(data.amount) > 0) {
            successCount++;
            newTxList.push({
              id: (Date.now() + i).toString(),
              type: "expense",
              account: "bank",
              amount: Number(data.amount),
              category: "food",
              date: data.date || todayStr(),
              note: data.note || "นำเข้าจากสลิป",
            });
          }
        }
      } catch (err) {
        console.error(`Error processing file ${i + 1}:`, err);
      }
    }

    if (newTxList.length > 0) {
      setTransactions((prev) => [...newTxList, ...prev]);
    }

    setScanning(false);
    setScanMessage(`สแกนเสร็จสิ้น! สำเร็จ ${successCount} จาก ${files.length} ใบ`);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12">
      {/* ☰ Side Menu Drawer (แท็บรวมฟังก์ชัน) */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="w-4/5 max-w-sm bg-white h-full p-6 space-y-4 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-lg font-bold text-[#1E1E1E]">เมนูและเครื่องมือ</h2>
              <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 text-xl font-bold">
                ✕
              </button>
            </div>

            {/* ปุ่มเปิดหน้าต่างป๊อปอัปตามฟังก์ชัน */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => { setActiveModal("transactions"); setIsMenuOpen(false); }}
                className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
              >
                <span>📜 รายการประวัติทั้งหมด ({transactions.length})</span>
                <span>➔</span>
              </button>

              <button
                onClick={() => { setActiveModal("categories"); setIsMenuOpen(false); }}
                className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
              >
                <span>📊 สรุปใช้จ่ายตามหมวดหมู่</span>
                <span>➔</span>
              </button>

              <button
                onClick={() => { setActiveModal("goals"); setIsMenuOpen(false); }}
                className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
              >
                <span>🎯 เป้าหมายการออม ({savingsGoals.length})</span>
                <span>➔</span>
              </button>

              <button
                onClick={() => { setActiveModal("adjust"); setIsMenuOpen(false); }}
                className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
              >
                <span>⚖️ ปรับยอดให้ตรงกับบัญชีจริง</span>
                <span>➔</span>
              </button>
            </div>

            <div className="pt-6 border-t space-y-2">
              <button
                onClick={() => { setShowPrivacyNotice(true); setIsMenuOpen(false); }}
                className="w-full text-left text-xs text-gray-600 hover:text-black py-2"
              >
                📜 นโยบายการเก็บข้อมูล
              </button>
              <button
                onClick={() => { setShowReportModal(true); setIsMenuOpen(false); }}
                className="w-full text-left text-xs text-rose-600 hover:text-rose-800 py-2 font-semibold"
              >
                🚨 แจ้งปัญหาการใช้งาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Modal ยืนยันการลบข้อมูล (Delete Confirmation) */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <h3 className="text-base font-bold text-gray-800">ยืนยันการลบรายการ?</h3>
            <p className="text-xs text-gray-500">คุณต้องการลบรายการนี้ใช่หรือไม่ ข้อมูลจะไม่สามารถกู้คืนได้</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🪟 Modals หน้าต่างป๊อปอัปตามฟังก์ชัน (จากเมนู 3 ขีด) */}
      
      {/* 1. หน้าต่างประวัติรายการทั้งหมด */}
      {activeModal === "transactions" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">📜 รายการประวัติทั้งหมด ({transactions.length})</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {transactions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีรายการบันทึก</p>
              ) : (
                transactions.map((tx) => {
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
                        <button
                          onClick={() => setItemToDelete({ type: "transaction", id: tx.id })}
                          className="text-gray-400 hover:text-rose-600 p-1"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. หน้าต่างสัดส่วนใช้จ่ายตามหมวดหมู่ */}
      {activeModal === "categories" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">📊 สรุปใช้จ่ายตามหมวดหมู่</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            {categoryExpenses.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีข้อมูลรายจ่าย</p>
            ) : (
              <div className="space-y-3">
                {categoryExpenses.map((cat) => (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{cat.label}</span>
                      <span className="text-rose-600">-{formatMoney(cat.sum)} บาท</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
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
        </div>
      )}

      {/* 3. หน้าต่างเป้าหมายการออม */}
      {activeModal === "goals" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">🎯 เป้าหมายการออม</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savingsGoals.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีเป้าหมาย</p>
              ) : (
                savingsGoals.map((g) => (
                  <div key={g.id} className="bg-gray-50 p-3 rounded-2xl border text-xs flex justify-between font-bold">
                    <span>{g.name}</span>
                    <span className="text-emerald-600">{formatMoney(g.target)} บ.</span>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleAddGoal} className="space-y-2 pt-2 border-t">
              <input
                type="text"
                placeholder="ชื่อเป้าหมาย"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                required
              />
              <input
                type="number"
                placeholder="จำนวนเงินเป้าหมาย"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                required
              />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-xl text-xs font-bold">
                + เพิ่มเป้าหมาย
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. หน้าต่างปรับยอดเงินตามจริง */}
      {activeModal === "adjust" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">⚖️ ปรับยอดให้ตรงกับบัญชีจริง</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500">ธนาคาร (ในระบบ: {formatMoney(calcBankTotal)} บาท)</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    placeholder="ยอดจริง"
                    value={bankRealInput}
                    onChange={(e) => setBankRealInput(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-xl bg-gray-50"
                  />
                  <button onClick={handleAdjustBank} className="bg-[#1E1E1E] text-white px-4 py-2 rounded-xl font-semibold">
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
                    className="flex-1 px-3 py-2 border rounded-xl bg-gray-50"
                  />
                  <button onClick={handleAdjustCash} className="bg-[#1E1E1E] text-white px-4 py-2 rounded-xl font-semibold">
                    ปรับ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice Modal */}
      {showPrivacyNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#1E1E1E]">การเก็บข้อมูลของคุณ</h3>
            <p className="text-xs text-[#555] leading-relaxed">
              แอปนี้ซิงก์ข้อมูลผู้ใช้และรายงานปัญหากับ Cloud Database (Firebase)
              ข้อมูลสลิปและเงินคงเหลือของคุณจะถูกประมวลผลเพื่อแสดงผลในระบบอย่างปลอดภัย
            </p>
            <button onClick={acceptPrivacy} className="w-full bg-[#1B5E20] text-white py-3 rounded-2xl text-sm font-semibold">
              รับทราบและปิด
            </button>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-[#1E1E1E]">เข้าสู่ระบบผู้ดูแลระบบ</h3>
              <button onClick={() => setShowAdminLogin(false)} className="text-gray-400 text-lg">✕</button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">ชื่อผู้ใช้ (Username)</label>
                <input
                  type="text"
                  placeholder="กรอกชื่อผู้ใช้"
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
                  placeholder="กรอกรหัสผ่าน"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>
              {adminLoginError && <p className="text-xs text-rose-600 font-medium">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-2.5 rounded-xl text-sm font-semibold">
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* User Report Modal */}
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
                ส่งรายงานไปยัง Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        {/* Navbar */}
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
              isAdminLoggedIn ? "bg-[#1E1E1E] text-white border-[#1E1E1E]" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            🛡️ {isAdminLoggedIn ? "ออกจากระบบ Admin" : "ผู้ดูแลระบบ"}
          </button>
        </div>

        {/* Admin Real-time Dashboard */}
        {isAdminLoggedIn && (
          <div className="bg-[#FFFDF6] border-2 border-[#EADBBD] rounded-3xl p-5 space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-[#EADBBD] pb-2">
              <h3 className="text-sm font-bold text-[#8C6D23] flex items-center gap-2">
                <span>🛡️</span> ระบบหลังบ้านผู้ดูแลระบบ (Firebase Cloud Dashboard)
              </h3>
              <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                REAL-TIME ONLINE
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>👥</span> รายชื่อผู้ใช้งานในระบบทั้งหมด ({onlineUsers.length} คน)
              </h4>
              
              {onlineUsers.length === 0 ? (
                <p className="text-xs text-gray-400">ยังไม่มีข้อมูลผู้ใช้งานซิงก์เข้ามา</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {onlineUsers.map((u, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 overflow-hidden border">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{u.userName}</p>
                          <p className="text-[10px] text-gray-400">เข้าล่าสุด: {u.lastActive}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">เงินคงเหลือ</p>
                        <p className="font-extrabold text-emerald-600">{formatMoney(u.balance)} บ.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-[#EADBBD]">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>📋</span> รายการแจ้งปัญหาจากผู้ใช้ Real-time ({reports.length} รายการ)
              </h4>
              {reports.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {reports.map((r) => (
                    <div key={r.id} className="bg-white p-3 rounded-2xl border border-rose-100 text-xs shadow-sm">
                      <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                        <span className="font-bold text-rose-600">👤 {r.userName}</span>
                        <span>{r.date}</span>
                      </div>
                      <p className="text-gray-800 font-medium">{r.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">ยังไม่มีรายการแจ้งปัญหาในขณะนี้</p>
              )}
            </div>
          </div>
        )}

        {/* PC / Mobile Dual Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
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

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* สแกนสลิปแบบ Batch */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">นำเข้าจากสลิปโอนเงิน (สแกนหลายรูปพร้อมกัน)</h2>
              
              <div
                onClick={() => !scanning && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center transition cursor-pointer space-y-1 ${
                  scanning ? "bg-gray-100 opacity-60 cursor-not-allowed" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="text-2xl">🖼️</div>
                <p className="text-xs font-bold text-gray-700">เลือกรูปสลิป (เลือกหลายรูปพร้อมกันได้)</p>
                <p className="text-[11px] text-gray-400">ระบบจะอ่านสลิปทีละรูปและบันทึกคิวให้อัตโนมัติ</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={scanning}
                />
              </div>

              {scanning && (
                <div className="bg-[#FFFDF6] border border-[#EADBBD] p-3.5 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs font-bold text-[#8C6D23]">
                    <span>⏳ กำลังประมวลผลคิวสลิป...</span>
                    <span>ใบที่ {queueStatus.current} / {queueStatus.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1B5E20] h-full transition-all duration-300"
                      style={{ width: `${(queueStatus.current / queueStatus.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 text-center">
                    สำเร็จแล้ว {queueStatus.successCount} ใบ กรุณารอสักครู่...
                  </p>
                </div>
              )}

              {scanMessage && (
                <p className="text-xs text-center font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  {scanMessage}
                </p>
              )}
            </div>

            {/* เจ้าหนี้ / ลูกหนี้ / รายการเบิก */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">เจ้าหนี้ / ลูกหนี้ / รายการเบิก</h2>

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
                        <button
                          onClick={() => setItemToDelete({ type: "debt", id: d.id })}
                          className="text-gray-400 hover:text-rose-600 p-1"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
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
