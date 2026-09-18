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

const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
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
        resolve({ base64Data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" });
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
    if (!id) { id = "user_" + Math.random().toString(36).substr(2, 9); localStorage.setItem("bp_deviceId", id); }
    return id;
  });

  const [sessionStartTime] = useState(() => {
    let t = sessionStorage.getItem("bp_sessionStart");
    if (!t) { t = Date.now().toString(); sessionStorage.setItem("bp_sessionStart", t); }
    return Number(t);
  });

  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");
  const [onboardingStep, setOnboardingStep] = useState(() => !localStorage.getItem("bp_userName") ? 1 : null);
  const [inputName, setInputName] = useState("");
  const [tutorialStep, setTutorialStep] = useState(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  const [pendingSlip, setPendingSlip] = useState(null);
  const [slipCategory, setSlipCategory] = useState("food");
  const [slipCustomNote, setSlipCustomNote] = useState("");
  const [slipTime, setSlipTime] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [adminSelectedUserChat, setAdminSelectedUserChat] = useState(null);
  const [adminChatInput, setAdminChatInput] = useState("");
  const chatScrollRef = useRef(null);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [canCloseAnnouncement, setCanCloseAnnouncement] = useState(false);

  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem("bp_transactions") || "[]"));
  const [savingsGoals, setSavingsGoals] = useState(() => JSON.parse(localStorage.getItem("bp_savingsGoals") || "[]"));
  const [debts, setDebts] = useState(() => JSON.parse(localStorage.getItem("bp_debts") || "[]"));
  const [accountAdjustments, setAccountAdjustments] = useState(() => JSON.parse(localStorage.getItem("bp_accountAdjustments") || '{"bank":0,"cash":0}'));

  const [type, setType] = useState("expense");
  const [account, setAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("");
  const [customCategoryNote, setCustomCategoryNote] = useState("");
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
  const [scanMessage, setScanMessage] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const calcBankTotal = transactions.reduce((acc, t) => (t.account === "bank" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0) + accountAdjustments.bank;
  const calcCashTotal = transactions.reduce((acc, t) => (t.account === "cash" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0) + accountAdjustments.cash;
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalBalance = calcBankTotal + calcCashTotal;

  const totalCreditor = debts.filter((d) => d.type === "creditor").reduce((acc, d) => acc + d.amount, 0);
  const totalDebtor = debts.filter((d) => d.type === "debtor").reduce((acc, d) => acc + d.amount, 0);
  const totalReimburse = debts.filter((d) => d.type === "reimburse").reduce((acc, d) => acc + d.amount, 0);

  useEffect(() => { localStorage.setItem("bp_transactions", JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals)); }, [savingsGoals]);
  useEffect(() => { localStorage.setItem("bp_debts", JSON.stringify(debts)); }, [debts]);
  useEffect(() => { localStorage.setItem("bp_userName", userName); }, [userName]);

  useEffect(() => {
    if (!userName) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, userName, avatar: userAvatar, balance: totalBalance, lastActive: Date.now() }),
        });
      } catch (err) { console.error(err); }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [userName, userAvatar, totalBalance, deviceId]);

  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        const userRes = await fetch(`${firebaseConfig.databaseURL}/users.json`);
        const userData = await userRes.json();
        setOnlineUsers(userData ? Object.entries(userData).map(([key, val]) => ({ id: key, ...val })) : []);

        const annRes = await fetch(`${firebaseConfig.databaseURL}/announcement.json`);
        const annData = await annRes.json();
        if (annData && annData.text) {
          const announcementTime = Number(annData.id);
          const isOnlineBefore = sessionStartTime <= announcementTime + 5000;
          const closedAnnId = localStorage.getItem("bp_closedAnnouncementId");
          if (isOnlineBefore && closedAnnId !== annData.id) {
            setActiveAnnouncement((prev) => {
              if (!prev || prev.id !== annData.id) {
                setCanCloseAnnouncement(false);
                setTimeout(() => setCanCloseAnnouncement(true), 3000);
                return annData;
              }
              return prev;
            });
          }
        }
        if (deviceId) {
          const chatRes = await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}.json`);
          const chatData = await chatRes.json();
          setChatMessages(chatData ? Object.values(chatData) : []);
        }
      } catch (err) { console.error(err); }
    };
    fetchCloudData();
    const interval = setInterval(fetchCloudData, 4000);
    return () => clearInterval(interval);
  }, [deviceId, sessionStartTime]);

  const handleSendUserChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const msgId = Date.now().toString();
    const userMsg = { id: msgId, sender: "user", senderName: userName || "ผู้ใช้", text: userText, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) };
    await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}/${msgId}.json`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userMsg),
    });
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
  };

  const handleSingleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMessage("กำลังอ่านข้อมูลสลิป...");
    try {
      const { base64Data, mediaType } = await resizeImage(file);
      const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64Data, mediaType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.amount && Number(data.amount) > 0) {
          setPendingSlip({ amount: Number(data.amount), date: data.date || todayStr(), time: data.time || "", note: data.note || "" });
          setScanMessage("");
        } else { setScanMessage("อ่านสลิปสำเร็จ แต่ไม่พบยอดเงิน"); }
      } else { setScanMessage("ไม่สามารถประมวลผลสลิปนี้ได้"); }
    } catch (err) { setScanMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ"); } finally { setScanning(false); }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12 relative">
      {activeAnnouncement && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center border-2 border-amber-500">
            <h3 className="text-base font-extrabold text-gray-900">ประกาศสำคัญจากผู้ดูแลระบบ</h3>
            <div className="bg-amber-50 p-4 rounded-2xl text-xs text-gray-800 text-left">{activeAnnouncement.text}</div>
            {canCloseAnnouncement ? (
              <button onClick={() => { localStorage.setItem("bp_closedAnnouncementId", activeAnnouncement.id); setActiveAnnouncement(null); }} className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold">✕ ปิดประกาศ</button>
            ) : (
              <div className="text-xs text-gray-400">⏳ กรุณารอสักครู่...</div>
            )}
          </div>
        </div>
      )}

      {onboardingStep === 1 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <h3 className="text-lg font-extrabold text-gray-900">ยินดีต้อนรับ!</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (inputName.trim()) { setUserName(inputName.trim()); setOnboardingStep(null); } }} className="space-y-3">
              <input type="text" placeholder="ชื่อของคุณ" value={inputName} onChange={(e) => setInputName(e.target.value)} className="w-full px-4 py-3 border rounded-2xl text-sm text-center" required />
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold">เริ่มต้นใช้งาน</button>
            </form>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="w-4/5 max-w-sm bg-white h-full p-6 space-y-4 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-lg font-bold text-[#1E1E1E]">เมนูและเครื่องมือ</h2>
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 text-xl font-bold">✕</button>
              </div>
              <div className="space-y-2 pt-2">
                <button onClick={() => { setActiveModal("chat_admin"); setIsMenuOpen(false); }} className="w-full flex justify-between items-center p-3.5 bg-blue-50 rounded-2xl text-xs font-bold text-blue-800">
                  <span>💬 แชทซัพพอร์ต & AI บอท</span><span>➔</span>
                </button>
                <button onClick={() => { setActiveModal("transactions"); setIsMenuOpen(false); }} className="w-full flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl text-xs font-bold text-gray-800">
                  <span>📜 รายการประวัติทั้งหมด ({transactions.length})</span><span>➔</span>
                </button>
              </div>
            </div>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold">🗑️ รีเซ็ตบัญชีทั้งหมด</button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2.5 bg-white rounded-2xl border shadow-sm text-xl">☰</button>
            <h1 className="text-xl font-bold text-[#1E1E1E]">งบประมาณของฉัน</h1>
          </div>
          <button onClick={() => { const p = prompt("รหัสผ่าน Admin:"); if (p === "27112547") setIsAdminLoggedIn(!isAdminLoggedIn); else if (p) alert("รหัสผิด!"); }} className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white text-gray-600">
            🛡️ {isAdminLoggedIn ? "ปิด Admin" : "ผู้ดูแลระบบ"}
          </button>
        </div>

        {isAdminLoggedIn && (
          <div className="bg-[#FFFDF6] border-2 border-[#EADBBD] rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#8C6D23]">🛡️ ระบบหลังบ้าน (ออนไลน์: {onlineUsers.length} คน)</h3>
            <textarea rows="2" placeholder="พิมพ์ข้อความประกาศ..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-gray-50" />
            <button onClick={async () => {
              if (!announcementText.trim()) return;
              await fetch(`${firebaseConfig.databaseURL}/announcement.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Date.now().toString(), text: announcementText.trim(), time: new Date().toLocaleString("th-TH") }) });
              setAnnouncementText(""); alert("ส่งประกาศแล้ว!");
            }} className="py-2 px-4 bg-amber-600 text-white rounded-xl text-xs font-bold">🚀 ส่งประกาศเด้งเฉพาะคนออนไลน์</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#1E1E1E] text-white rounded-3xl p-6 shadow-md space-y-2">
            <p className="text-xs text-gray-400">คงเหลือทั้งหมด</p>
            <h2 className="text-3xl font-extrabold">{formatMoney(totalBalance)} บาท</h2>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-2">
            <p className="text-xs text-gray-400">เจ้าหนี้ / ลูกหนี้</p>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-rose-600">เจ้าหนี้: {formatMoney(totalCreditor)} บ.</span>
              <span className="text-emerald-600">ลูกหนี้: {formatMoney(totalDebtor)} บ.</span>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm border space-y-2 flex flex-col justify-center gap-2">
            <button onClick={() => setActiveModal("add_tx")} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold">➕ เพิ่มรายรับ/รายจ่าย</button>
            <button onClick={() => setActiveModal("add_goal")} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold">🎯 เพิ่มเป้าหมายออม</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border">
          <h2 className="text-sm font-bold">นำเข้าจากสลิปโอนเงิน (ทีละ 1 รูป)</h2>
          <div onClick={() => !scanning && fileInputRef.current?.click()} className="border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer bg-gray-50 hover:bg-gray-100">
            <p className="text-xs font-bold text-gray-700">คลิกเพื่อเลือกรูปสลิป</p>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleSingleFileUpload} disabled={scanning} />
          </div>
          {scanning && <p className="text-xs text-center font-bold text-[#8C6D23] animate-pulse">กำลังสแกนสลิป...</p>}
          {scanMessage && <p className="text-xs text-center font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl">{scanMessage}</p>}
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
