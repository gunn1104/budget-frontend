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
const ACCOUNTS = [{ key: "bank", label: "ธนาคาร" }, { key: "cash", label: "เงินสด" }];
const ACCOUNT_LABEL = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.label]));
const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";

function categoryInfo(key) {
  return ALL_CATEGORIES.find((c) => c.key === key) || { label: key, color: "#8A8578" };
}

function formatMoney(n) {
  return (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDateThai(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

export default function App() {
  const [deviceId] = useState(() => {
    let id = localStorage.getItem("bp_deviceId");
    if (!id) {
      id = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("bp_deviceId", id);
    }
    return id;
  });

  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "Rawin");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  
  const [goalToDeposit, setGoalToDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [goalToEdit, setGoalToEdit] = useState(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [editGoalCurrent, setEditGoalCurrent] = useState("");

  const [pendingSlip, setPendingSlip] = useState(null);
  const [slipCategory, setSlipCategory] = useState("food");
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reports, setReports] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem("bp_transactions") || "[]"));
  const [savingsGoals, setSavingsGoals] = useState(() => JSON.parse(localStorage.getItem("bp_savingsGoals") || "[]"));
  const [debts, setDebts] = useState(() => JSON.parse(localStorage.getItem("bp_debts") || "[]"));

  const [type, setType] = useState("expense");
  const [account, setAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");

  const [debtType, setDebtType] = useState("creditor");
  const [debtNote, setDebtNote] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtPerson, setDebtPerson] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("bp_userName", userName);
    localStorage.setItem("bp_userAvatar", userAvatar);
    localStorage.setItem("bp_transactions", JSON.stringify(transactions));
    localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals));
    localStorage.setItem("bp_debts", JSON.stringify(debts));
  }, [userName, userAvatar, transactions, savingsGoals, debts]);

  const calcBankTotal = transactions.reduce((acc, t) => (t.account === "bank" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0);
  const calcCashTotal = transactions.reduce((acc, t) => (t.account === "cash" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalBalance = calcBankTotal + calcCashTotal;

  const totalCreditor = debts.filter((d) => d.type === "creditor").reduce((acc, d) => acc + d.amount, 0);
  const totalDebtor = debts.filter((d) => d.type === "debtor").reduce((acc, d) => acc + d.amount, 0);
  const totalReimburse = debts.filter((d) => d.type === "reimburse").reduce((acc, d) => acc + d.amount, 0);

  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => {
    const sum = transactions.filter((t) => t.type === "expense" && t.category === cat.key).reduce((acc, t) => acc + t.amount, 0);
    return { ...cat, sum };
  }).filter((c) => c.sum > 0);

  // Heartbeat & Sync Firebase
  useEffect(() => {
    const sync = async () => {
      try {
        await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, userName, avatar: userAvatar, balance: totalBalance, lastActive: Date.now() }),
        });
        const res = await fetch(`${firebaseConfig.databaseURL}/users.json`);
        const data = await res.json();
        if (data) setOnlineUsers(Object.entries(data).map(([k, v]) => ({ id: k, ...v })));
        
        const repRes = await fetch(`${firebaseConfig.databaseURL}/reports.json`);
        const repData = await repRes.json();
        if (repData && !isAdminLoggedIn) setReports(Object.values(repData).reverse());
      } catch (e) {}
    };
    sync();
    const iv = setInterval(sync, 10000);
    return () => clearInterval(iv);
  }, [userName, userAvatar, totalBalance, deviceId, isAdminLoggedIn]);

  const formatUserStatus = (ts) => {
    if (!ts) return { text: "ออฟไลน์", isOnline: false };
    const diff = Math.floor((Date.now() - Number(ts)) / 1000);
    if (diff < 25) return { text: "🟢 กำลังใช้งานอยู่", isOnline: true };
    const d = new Date(Number(ts));
    return { text: `⚪ ล่าสุด ${d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`, isOnline: false };
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Data = ev.target.result.split(",")[1];
        const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, mediaType: file.type || "image/jpeg" }),
        });
        const parsed = await res.json();
        setPendingSlip({
          amount: parsed.amount ? String(parsed.amount) : "",
          date: parsed.date || todayStr(),
          note: parsed.note || parsed.receiverName ? `โอนให้: ${parsed.receiverName || ""}` : "",
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("อ่านสลิปไม่สำเร็จ กรุณากรอกเอง");
      setPendingSlip({ amount: "", date: todayStr(), note: "" });
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-[#F3F2ED] min-h-screen text-[#1B211E] font-sans pb-28">
      {/* Modal ยืนยันลบ */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-xl">
            <h3 className="font-bold mb-2">ยืนยันการลบข้อมูล</h3>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setItemToDelete(null)} className="flex-1 bg-gray-200 py-2 rounded-xl text-xs font-bold">ยกเลิก</button>
              <button onClick={() => {
                if (itemToDelete.type === "transaction") setTransactions(transactions.filter(t => t.id !== itemToDelete.id));
                if (itemToDelete.type === "goal") setSavingsGoals(savingsGoals.filter(g => g.id !== itemToDelete.id));
                if (itemToDelete.type === "debt") setDebts(debts.filter(d => d.id !== itemToDelete.id));
                setItemToDelete(null);
              }} className="flex-1 bg-red-600 text-white py-2 rounded-xl text-xs font-bold">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal เพิ่มเป้าหมาย */}
      {activeModal === "addGoal" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">เพิ่มเป้าหมายการออม</h3>
              <button onClick={() => setActiveModal(null)} className="font-bold">✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!goalName || !goalTarget) return;
              setSavingsGoals([...savingsGoals, { id: Date.now(), name: goalName, target: parseFloat(goalTarget), current: parseFloat(goalCurrent) || 0 }]);
              setGoalName(""); setGoalTarget(""); setGoalCurrent(""); setActiveModal(null);
            }} className="space-y-3">
              <input type="text" placeholder="ชื่อเป้าหมาย" value={goalName} onChange={e => setGoalName(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="number" placeholder="ยอดเป้าหมายรวม" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="number" placeholder="เงินออมเริ่มต้น" value={goalCurrent} onChange={e => setGoalCurrent(e.target.value)} className="w-full p-3 rounded-xl border text-xs" />
              <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">บันทึก</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal เติมเงินออม */}
      {goalToDeposit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-xl">
            <h3 className="font-bold mb-1">เติมเงินออม</h3>
            <p className="text-xs text-gray-500 mb-3">{goalToDeposit.name}</p>
            <input type="number" placeholder="จำนวนเงิน" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-3 rounded-xl border text-xs text-center mb-4" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setGoalToDeposit(null)} className="flex-1 bg-gray-200 py-2 rounded-xl text-xs font-bold">ยกเลิก</button>
              <button onClick={() => {
                const amt = parseFloat(depositAmount);
                if (!amt) return;
                setSavingsGoals(savingsGoals.map(g => g.id === goalToDeposit.id ? { ...g, current: g.current + amt } : g));
                setGoalToDeposit(null); setDepositAmount("");
              }} className="flex-1 bg-[#2F6F5E] text-white py-2 rounded-xl text-xs font-bold">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal แก้ไขเป้าหมาย */}
      {goalToEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">แก้ไขเป้าหมาย</h3>
              <button onClick={() => setGoalToEdit(null)} className="font-bold">✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              setSavingsGoals(savingsGoals.map(g => g.id === goalToEdit.id ? { ...g, name: editGoalName, target: parseFloat(editGoalTarget), current: parseFloat(editGoalCurrent) } : g));
              setGoalToEdit(null);
            }} className="space-y-3">
              <input type="text" value={editGoalName} onChange={e => setEditGoalName(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="number" value={editGoalTarget} onChange={e => setEditGoalTarget(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="number" value={editGoalCurrent} onChange={e => setEditGoalCurrent(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">บันทึก</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal เพิ่มหนี้สิน */}
      {activeModal === "addDebt" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">เพิ่มหนี้สิน / รายการเบิก</h3>
              <button onClick={() => setActiveModal(null)} className="font-bold">✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!debtPerson || !debtAmount) return;
              setDebts([...debts, { id: Date.now(), type: debtType, person: debtPerson, amount: parseFloat(debtAmount), note: debtNote }]);
              setDebtPerson(""); setDebtAmount(""); setDebtNote(""); setActiveModal(null);
            }} className="space-y-3">
              <select value={debtType} onChange={e => setDebtType(e.target.value)} className="w-full p-3 rounded-xl border text-xs bg-white">
                <option value="creditor">เจ้าหนี้</option>
                <option value="debtor">ลูกหนี้</option>
                <option value="reimburse">รอเบิก</option>
              </select>
              <input type="text" placeholder="ชื่อบุคคล" value={debtPerson} onChange={e => setDebtPerson(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="number" placeholder="จำนวนเงิน" value={debtAmount} onChange={e => setDebtAmount(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="text" placeholder="รายละเอียด" value={debtNote} onChange={e => setDebtNote(e.target.value)} className="w-full p-3 rounded-xl border text-xs" />
              <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">บันทึก</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal ประวัติทั้งหมด */}
      {activeModal === "historyList" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full h-[80vh] flex flex-col shadow-xl overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">ประวัติธุรกรรมทั้งหมด</h3>
              <button onClick={() => setActiveModal(null)} className="font-bold">✕</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#F3F2ED]">
              {transactions.length === 0 ? <p className="text-center text-xs text-gray-500 py-10">ยังไม่มีประวัติ</p> : transactions.map(t => {
                const info = categoryInfo(t.category);
                return (
                  <div key={t.id} className="bg-white p-3 rounded-xl border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                      <div>
                        <div className="text-xs font-bold">{info.label}</div>
                        <div className="text-[10px] text-gray-500">{t.note || "-"} · {formatDateThai(t.date)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                      </span>
                      <button onClick={() => setItemToDelete({ type: "transaction", id: t.id })} className="text-gray-400 font-bold">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Admin Login */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">เข้าสู่ระบบแอดมิน</h3>
              <button onClick={() => setShowAdminLogin(false)} className="font-bold">✕</button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              if (adminUsername === "admin" && adminPassword === "1234") {
                setIsAdminLoggedIn(true); setShowAdminLogin(false); setAdminUsername(""); setAdminPassword("");
              } else {
                setAdminLoginError("รหัสผ่านไม่ถูกต้อง");
              }
            }} className="space-y-3">
              <input type="text" placeholder="Username" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              <input type="password" placeholder="Password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full p-3 rounded-xl border text-xs" required />
              {adminLoginError && <p className="text-xs text-red-600 font-bold">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">เข้าสู่ระบบ</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal แจ้งปัญหา */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">แจ้งปัญหา / ข้อเสนอแนะ</h3>
              <button onClick={() => setShowReportModal(false)} className="font-bold">✕</button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!reportText) return;
              await fetch(`${firebaseConfig.databaseURL}/reports/${Date.now()}.json`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: Date.now(), userName, text: reportText, time: new Date().toLocaleString("th-TH") })
              });
              alert("ส่งสำเร็จ!"); setReportText(""); setShowReportModal(false);
            }} className="space-y-3">
              <textarea placeholder="พิมพ์ปัญหาที่พบ..." value={reportText} onChange={e => setReportText(e.target.value)} className="w-full p-3 rounded-xl border text-xs h-28" required />
              <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">ส่งข้อความ</button>
            </form>
          </div>
        </div>
      )}

      {/* เมนูด้านข้าง */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="bg-white w-72 h-full p-5 flex flex-col shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="font-bold">{userName}</div>
              <button onClick={() => setIsMenuOpen(false)} className="font-bold">✕</button>
            </div>
            <button onClick={() => { setIsMenuOpen(false); setActiveModal("historyList"); }} className="w-full p-3 bg-[#F3F2ED] rounded-xl text-xs font-bold text-left">📜 ประวัติธุรกรรม</button>
            <button onClick={() => { setIsMenuOpen(false); setShowReportModal(true); }} className="w-full p-3 bg-[#F3F2ED] rounded-xl text-xs font-bold text-left">🚨 แจ้งปัญหา</button>
            <button onClick={() => { setIsMenuOpen(false); setShowAdminLogin(true); }} className="w-full p-3 bg-[#1B211E] text-white rounded-xl text-xs font-bold text-left">🛡️ แอดมิน</button>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {isAdminLoggedIn && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">🛡️ ระบบแอดมิน</h3>
              <button onClick={() => setIsAdminLoggedIn(false)} className="font-bold">✕</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F3F2ED]">
              <div className="bg-white p-3 rounded-xl border">
                <h4 className="font-bold text-xs mb-2">🟢 ผู้ใช้งาน ({onlineUsers.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {onlineUsers.map(u => {
                    const st = formatUserStatus(u.lastActive);
                    return (
                      <div key={u.id} className="p-2 bg-[#F3F2ED] rounded-lg text-xs flex justify-between">
                        <span>{u.userName}</span>
                        <span className={st.isOnline ? "text-emerald-600 font-bold" : "text-gray-500"}>{st.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border">
                <h4 className="font-bold text-xs mb-2">🚨 รายงานปัญหา</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {reports.map(r => (
                    <div key={r.id} className="p-2 bg-[#F3F2ED] rounded-lg text-xs">
                      <div className="font-bold">{r.userName} <span className="text-[10px] text-gray-400">{r.time}</span></div>
                      <div>{r.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* หน้าจอหลัก */}
      <div className="max-w-xl mx-auto px-4 pt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div onClick={() => avatarInputRef.current?.click()} className="w-11 h-11 rounded-full bg-[#2F6F5E] text-white flex items-center justify-center font-bold overflow-hidden cursor-pointer shadow">
              {userAvatar ? <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" /> : userName.charAt(0)}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setUserAvatar(ev.target.result);
                reader.readAsDataURL(file);
              }
            }} />
            <div>
              <div className="text-xs text-gray-500">สวัสดี</div>
              <div className="font-bold">{userName}</div>
            </div>
          </div>
          <button onClick={() => setIsMenuOpen(true)} className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center font-bold shadow-sm">☰</button>
        </div>

        {/* ยอดคงเหลือ */}
        <div className="bg-[#1B211E] text-white rounded-3xl p-5 mb-5 shadow-lg">
          <div className="text-xs text-gray-400 mb-1">ยอดเงินคงเหลือรวม</div>
          <div className="text-3xl font-extrabold mb-3">{formatMoney(totalBalance)} บาท</div>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
            <div>ธนาคาร: <span className="font-bold text-emerald-400">{formatMoney(calcBankTotal)}</span></div>
            <div>เงินสด: <span className="font-bold text-amber-400">{formatMoney(calcCashTotal)}</span></div>
          </div>
        </div>

        {/* เป้าหมายออม */}
        <div className="bg-white rounded-3xl p-4 mb-5 border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold">🎯 เป้าหมายการออม</h3>
            <button onClick={() => setActiveModal("addGoal")} className="bg-[#2F6F5E] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold">+ เพิ่ม</button>
          </div>
          <div className="space-y-2">
            {savingsGoals.length === 0 ? <p className="text-center text-xs text-gray-400 py-2">ยังไม่มีเป้าหมาย</p> : savingsGoals.map(g => {
              const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
              return (
                <div key={g.id} className="p-2.5 bg-[#F3F2ED] rounded-xl border text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{g.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setGoalToEdit(g); setEditGoalName(g.name); setEditGoalTarget(g.target); setEditGoalCurrent(g.current); }} className="text-gray-500">แก้ไข</button>
                      <button onClick={() => setItemToDelete({ type: "goal", id: g.id })} className="text-red-500">✕</button>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#2F6F5E] h-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>สะสม {formatMoney(g.current)} / {formatMoney(g.target)} ({pct}%)</span>
                    <button onClick={() => setGoalToDeposit(g)} className="text-[#2F6F5E] font-bold">+ เติมเงิน</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* สแกนสลิป */}
        <div className="bg-white rounded-3xl p-4 mb-5 border shadow-sm">
          <h3 className="text-xs font-bold mb-2">📷 สแกนสลิป AI</h3>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-4 text-center bg-[#F3F2ED] cursor-pointer">
            {scanning ? <div className="text-xs font-bold text-[#2F6F5E] animate-pulse">กำลังสแกน...</div> : <div className="text-xs font-bold">แตะเพื่ออัปโหลดสลิป</div>}
          </div>
          {pendingSlip && (
            <div className="mt-3 p-3 bg-[#F3F2ED] rounded-xl border space-y-2 text-xs">
              <div className="font-bold text-[#2F6F5E]">พบข้อมูลสลิป:</div>
              <input type="number" value={pendingSlip.amount} onChange={e => setPendingSlip({ ...pendingSlip, amount: e.target.value })} className="w-full p-2 border rounded-lg bg-white" placeholder="จำนวนเงิน" />
              <input type="text" value={pendingSlip.note} onChange={e => setPendingSlip({ ...pendingSlip, note: e.target.value })} className="w-full p-2 border rounded-lg bg-white" placeholder="บันทึก" />
              <div className="flex gap-2">
                <button onClick={() => setPendingSlip(null)} className="flex-1 bg-gray-200 py-1.5 rounded-lg font-bold">ยกเลิก</button>
                <button onClick={() => {
                  const amt = parseFloat(pendingSlip.amount);
                  if (!amt) return;
                  setTransactions([{ id: Date.now(), type: "expense", account: "bank", amount: amt, category: "food", date: pendingSlip.date, note: pendingSlip.note }, ...transactions]);
                  setPendingSlip(null);
                }} className="flex-1 bg-[#2F6F5E] text-white py-1.5 rounded-lg font-bold">ยืนยัน</button>
              </div>
            </div>
          )}
        </div>

        {/* บันทึกรายรับ-รายจ่าย */}
        <div className="bg-white rounded-3xl p-4 mb-5 border shadow-sm">
          <h3 className="text-xs font-bold mb-3">✍️ บันทึกรายการ</h3>
          <div className="flex gap-1 bg-[#F3F2ED] p-1 rounded-xl mb-3">
            <button type="button" onClick={() => setType("expense")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${type === "expense" ? "bg-rose-600 text-white" : "text-gray-500"}`}>รายจ่าย</button>
            <button type="button" onClick={() => setType("income")} className={`flex-1 py-2 rounded-lg text-xs font-bold ${type === "income" ? "bg-emerald-600 text-white" : "text-gray-500"}`}>รายรับ</button>
          </div>
          <form onSubmit={e => {
            e.preventDefault();
            const amt = parseFloat(amount);
            if (!amt) return;
            setTransactions([{ id: Date.now(), type, account, amount: amt, category, date, note }, ...transactions]);
            setAmount(""); setNote("");
          }} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={account} onChange={e => setAccount(e.target.value)} className="p-2.5 border rounded-xl text-xs bg-white">
                {ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <input type="number" placeholder="จำนวนเงิน" value={amount} onChange={e => setAmount(e.target.value)} className="p-2.5 border rounded-xl text-xs" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={category} onChange={e => setCategory(e.target.value)} className="p-2.5 border rounded-xl text-xs bg-white">
                {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2.5 border rounded-xl text-xs bg-white" />
            </div>
            <input type="text" placeholder="บันทึกช่วยจำ" value={note} onChange={e => setNote(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" />
            <button type="submit" className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-xs">บันทึก</button>
          </form>
        </div>

        {/* หนี้สิน */}
        <div className="bg-white rounded-3xl p-4 mb-5 border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold">📌 หนี้สินและเบิก</h3>
            <button onClick={() => setActiveModal("addDebt")} className="bg-[#2F6F5E] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold">+ เพิ่ม</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="p-2 bg-rose-50 rounded-xl border text-[10px]">เจ้าหนี้: <br/><strong className="text-rose-700 text-xs">{formatMoney(totalCreditor)}</strong></div>
            <div className="p-2 bg-emerald-50 rounded-xl border text-[10px]">ลูกหนี้: <br/><strong className="text-emerald-700 text-xs">{formatMoney(totalDebtor)}</strong></div>
            <div className="p-2 bg-amber-50 rounded-xl border text-[10px]">รอเบิก: <br/><strong className="text-amber-700 text-xs">{formatMoney(totalReimburse)}</strong></div>
          </div>
          <div className="space-y-1.5">
            {debts.length === 0 ? <p className="text-center text-xs text-gray-400 py-2">ไม่มีรายการหนี้สิน</p> : debts.map(d => (
              <div key={d.id} className="p-2.5 bg-[#F3F2ED] rounded-xl border text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold">{d.person}</span> ({d.type === "creditor" ? "เจ้าหนี้" : d.type === "debtor" ? "ลูกหนี้" : "รอเบิก"})
                  <div className="text-[10px] text-gray-500">{d.note || "-"}</div>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span>{formatMoney(d.amount)}</span>
                  <button onClick={() => setItemToDelete({ type: "debt", id: d.id })} className="text-gray-400">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* กราฟสัดส่วน */}
        <div className="bg-white rounded-3xl p-4 border shadow-sm">
          <h3 className="text-xs font-bold mb-3">📊 สัดส่วนค่าใช้จ่าย</h3>
          {totalExpense === 0 ? <p className="text-center text-xs text-gray-400 py-6">ยังไม่มีข้อมูลรายจ่าย</p> : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full relative shadow-inner" style={{ background: `conic-gradient(${
                categoryExpenses.reduce((acc, cat, idx, arr) => {
                  const prev = arr.slice(0, idx).reduce((s, c) => s + (c.sum / totalExpense) * 360, 0);
                  const curr = prev + (cat.sum / totalExpense) * 360;
                  return `${acc}${idx > 0 ? ", " : ""}${cat.color} ${prev}deg${curr}deg`;
                }, "")
              })}` }}>
                <div className="absolute inset-5 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-[9px] text-gray-400">รวม</span>
                  <span className="text-[11px] font-bold">{formatMoney(totalExpense)}</span>
                </div>
              </div>
              <div className="w-full grid grid-cols-2 gap-1.5">
                {categoryExpenses.map(c => (
                  <div key={c.key} className="flex justify-between p-2 bg-[#F3F2ED] rounded-xl text-[11px]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.label}</span>
                    <span className="font-bold">{formatMoney(c.sum)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
