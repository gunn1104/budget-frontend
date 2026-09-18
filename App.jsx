const { useState, useEffect, useRef } = React;
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ACCOUNTS, formatMoney, todayStr, resizeImage } from './utils/constants.js';
import AdminPanel, { AdminChatRoom } from './components/AdminPanel.jsx';
import SidebarMenu from './components/SidebarMenu.jsx';

const firebaseConfig = {
  apiKey: "AIzaSyBo04M6atVIJe2wc7prBS6N6y...", 
  authDomain: "budget-planner-app-b6620.firebaseapp.com",
  databaseURL: "https://budget-planner-app-b6620-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "budget-planner-app-b6620",
  storageBucket: "budget-planner-app-b6620.appspot.com",
  messagingSenderId: "104816758240",
  appId: "1:104816758240:web:3ee5fc818719c"
};

const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";

export default function App() {
  const [deviceId] = useState(() => {
    let id = localStorage.getItem("bp_deviceId");
    if (!id) {
      id = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("bp_deviceId", id);
    }
    return id;
  });

  const [sessionStartTime] = useState(() => {
    let t = sessionStorage.getItem("bp_sessionStart");
    if (!t) {
      t = Date.now().toString();
      sessionStorage.setItem("bp_sessionStart", t);
    }
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

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    const hasOpenModal = activeModal !== null || isMenuOpen || showReportModal || pendingSlip !== null || onboardingStep !== null || tutorialStep > 0 || activeAnnouncement !== null || adminSelectedUserChat !== null;
    document.body.style.overflow = hasOpenModal ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [activeModal, isMenuOpen, showReportModal, pendingSlip, onboardingStep, tutorialStep, activeAnnouncement, adminSelectedUserChat]);

  const calcBankTotal = transactions.reduce((acc, t) => (t.account === "bank" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0) + accountAdjustments.bank;
  const calcCashTotal = transactions.reduce((acc, t) => (t.account === "cash" ? acc + (t.type === "income" ? t.amount : -t.amount) : acc), 0) + accountAdjustments.cash;
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const totalBalance = calcBankTotal + calcCashTotal;

  const totalCreditor = debts.filter((d) => d.type === "creditor").reduce((acc, d) => acc + d.amount, 0);
  const totalDebtor = debts.filter((d) => d.type === "debtor").reduce((acc, d) => acc + d.amount, 0);
  const totalReimburse = debts.filter((d) => d.type === "reimburse").reduce((acc, d) => acc + d.amount, 0);

  const categoryExpenses = EXPENSE_CATEGORIES.map((cat) => {
    const sum = transactions.filter((t) => t.type === "expense" && t.category === cat.key).reduce((acc, t) => acc + t.amount, 0);
    return { ...cat, sum };
  }).filter((c) => c.sum > 0);

  const generatePieChartGradient = () => {
    if (totalExpense === 0 || categoryExpenses.length === 0) return "#333 0deg 360deg";
    let cumulativePercent = 0;
    const gradients = categoryExpenses.map((cat) => {
      const percent = (cat.sum / totalExpense) * 100;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return `${cat.color} ${start * 3.6}deg ${cumulativePercent * 3.6}deg`;
    });
    return gradients.join(", ");
  };

  useEffect(() => { localStorage.setItem("bp_userName", userName); }, [userName]);
  useEffect(() => { localStorage.setItem("bp_userAvatar", userAvatar); }, [userAvatar]);
  useEffect(() => { localStorage.setItem("bp_transactions", JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals)); }, [savingsGoals]);
  useEffect(() => { localStorage.setItem("bp_debts", JSON.stringify(debts)); }, [debts]);
  useEffect(() => { localStorage.setItem("bp_accountAdjustments", JSON.stringify(accountAdjustments)); }, [accountAdjustments]);

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
          } else { setActiveAnnouncement(null); }
        } else { setActiveAnnouncement(null); }

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

  const handleSendAnnouncementFromAdmin = async (text) => {
    const annPayload = { id: Date.now().toString(), text, time: new Date().toLocaleString("th-TH") };
    await fetch(`${firebaseConfig.databaseURL}/announcement.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annPayload),
    });
    alert("ส่งประกาศแจ้งเตือนเรียบร้อยแล้ว!");
  };

  const handleClearAnnouncementFromAdmin = async () => {
    if (!confirm("ต้องการลบประกาศนี้ใช่หรือไม่?")) return;
    await fetch(`${firebaseConfig.databaseURL}/announcement.json`, { method: "DELETE" });
    setActiveAnnouncement(null);
    localStorage.removeItem("bp_closedAnnouncementId");
  };

  const handleDeleteUserFromAdmin = async (targetId) => {
    if (!confirm("ลบผู้ใช้นี้ออกจากระบบใช่หรือไม่?")) return;
    await fetch(`${firebaseConfig.databaseURL}/users/${targetId}.json`, { method: "DELETE" });
    setOnlineUsers((prev) => prev.filter((u) => u.id !== targetId));
  };

  const handleSendUserChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const msgId = Date.now().toString();
    const userMsg = { id: msgId, sender: "user", senderName: userName || "ผู้ใช้", text: userText, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) };

    await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}/${msgId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userMsg),
    });
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    setTimeout(async () => {
      const botMsgId = (Date.now() + 1).toString();
      const botMsg = { id: botMsgId, sender: "admin", senderName: "AI บอทอัจฉริยะ 🤖", text: "🤖 AI บอทรับทราบคำถามของคุณแล้วครับ มีส่วนไหนให้ช่วยเหลือเพิ่มเติมพิมพ์มาได้เลย!", time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) };
      await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}/${botMsgId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(botMsg),
      });
      setChatMessages((prev) => [...prev, botMsg]);
    }, 1000);
  };

  const handleSendAdminChat = async (e) => {
    e.preventDefault();
    if (!adminChatInput.trim() || !adminSelectedUserChat) return;
    const msgId = Date.now().toString();
    const newMsg = { id: msgId, sender: "admin", senderName: "ผู้ดูแลระบบ (Admin)", text: adminChatInput.trim(), time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) };
    await fetch(`${firebaseConfig.databaseURL}/chats/${adminSelectedUserChat.id}/${msgId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMsg),
    });
    setAdminChatInput("");
  };

  const handleResetMyAccount = async () => {
    if (!confirm("⚠️ ลบข้อมูลทั้งหมดและเริ่มต้นใหม่ใช่หรือไม่?")) return;
    try { await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, { method: "DELETE" }); } catch (e) {}
    localStorage.clear(); sessionStorage.clear(); window.location.reload();
  };

  const handleSingleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMessage("กำลังอ่านข้อมูลสลิป...");
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
          setPendingSlip({ amount: Number(data.amount), date: data.date || todayStr(), time: data.time || "", note: data.note || "" });
          setSlipCategory("food"); setScanMessage("");
        } else { setScanMessage("อ่านสลิปสำเร็จ แต่ไม่พบยอดเงิน"); }
      } else { setScanMessage("ไม่สามารถประมวลผลสลิปนี้ได้"); }
    } catch (err) { setScanMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ"); } finally { setScanning(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleConfirmSlip = (e) => {
    e.preventDefault();
    if (!pendingSlip) return;
    const newTx = { id: Date.now().toString(), type: "expense", account: "bank", amount: pendingSlip.amount, category: slipCategory, customCategoryNote: slipCategory === "other_exp" ? slipCustomNote.trim() : "", date: pendingSlip.date, time: slipTime.trim(), note: pendingSlip.note || "นำเข้าจากสลิป" };
    setTransactions((prev) => [newTx, ...prev]);
    setPendingSlip(null);
    setScanMessage(`บันทึกรายจ่าย ${formatMoney(pendingSlip.amount)} บาท เรียบร้อยแล้ว`);
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12 relative">
      {activeAnnouncement && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center border-2 border-amber-500">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">📢</div>
            <h3 className="text-base font-extrabold text-gray-900">ประกาศสำคัญจากผู้ดูแลระบบ</h3>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed text-left">{activeAnnouncement.text}</div>
            <p className="text-[10px] text-gray-400">ส่งเมื่อ: {activeAnnouncement.time}</p>
            {canCloseAnnouncement ? (
              <button onClick={() => { localStorage.setItem("bp_closedAnnouncementId", activeAnnouncement.id); setActiveAnnouncement(null); }} className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold shadow-md">✕ ปิดประกาศนี้</button>
            ) : (
              <div className="w-full bg-gray-200 text-gray-500 py-3 rounded-2xl text-xs font-bold cursor-not-allowed">⏳ กรุณารอสักครู่ (สามารถปิดได้ใน 3 วินาที)...</div>
            )}
          </div>
        </div>
      )}

      {onboardingStep === 1 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">👋</div>
            <h3 className="text-lg font-extrabold text-gray-900">ยินดีต้อนรับสู่แอปงบประมาณ!</h3>
            <p className="text-xs text-gray-500">กรุณาใส่ชื่อของคุณเพื่อเริ่มต้นใช้งานระบบ</p>
            <form onSubmit={(e) => { e.preventDefault(); if (inputName.trim()) { setUserName(inputName.trim()); setOnboardingStep(2); } }} className="space-y-3 pt-2">
              <input type="text" placeholder="ชื่อของคุณ" value={inputName} onChange={(e) => setInputName(e.target.value)} className="w-full px-4 py-3 border rounded-2xl text-sm bg-gray-50 font-semibold text-center" required />
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold">ถัดไป ➔</button>
            </form>
          </div>
        </div>
      )}

      {onboardingStep === 2 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <h3 className="text-lg font-extrabold text-gray-900">ตั้งค่ารูปโปรไฟล์</h3>
            <div onClick={() => avatarInputRef.current?.click()} className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 mx-auto shadow-inner">
              {userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : <span className="text-2xl">➕</span>}
              <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=(ev)=>setUserAvatar(ev.target.result); r.readAsDataURL(f); } }} />
            </div>
            <button onClick={() => setOnboardingStep(null)} className="w-full py-3 bg-[#1E1E1E] text-white rounded-2xl text-xs font-bold">เสร็จสิ้น</button>
          </div>
        </div>
      )}

      <SidebarMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onOpenModal={(m) => setActiveModal(m)} onResetAccount={handleResetMyAccount} onStartTutorial={() => setTutorialStep(1)} onReportProblem={() => setShowReportModal(true)} transactionsCount={transactions.length} />

      {activeModal === "chat_admin" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-[#1E1E1E] text-white shrink-0">
              <h3 className="text-sm font-bold">แชทซัพพอร์ต & AI บอทอัจฉริยะ</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-xl font-bold p-1">✕</button>
            </div>
            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === "admin" ? "items-start" : "items-end"}`}>
                  <span className="text-[10px] text-gray-400 px-1 mb-0.5">{msg.senderName} • {msg.time}</span>
                  <div className={`p-3 rounded-2xl text-xs max-w-[85%] whitespace-pre-wrap ${msg.sender === "admin" ? "bg-white border text-gray-800" : "bg-[#1E1E1E] text-white"}`}>{msg.text}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendUserChat} className="p-3 border-t bg-white flex gap-2 shrink-0">
              <input type="text" placeholder="พิมพ์ข้อความสอบถาม..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="flex-1 px-4 py-2.5 border rounded-2xl text-xs bg-gray-50" required />
              <button type="submit" className="px-5 py-2.5 bg-[#1E1E1E] text-white rounded-2xl text-xs font-bold">ส่ง</button>
            </form>
          </div>
        </div>
      )}

      {adminSelectedUserChat && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-[#8C6D23] text-white shrink-0">
              <h3 className="text-sm font-bold">ห้องแชทกับ: {adminSelectedUserChat.userName}</h3>
              <button onClick={() => setAdminSelectedUserChat(null)} className="text-white text-xl font-bold p-1">✕</button>
            </div>
            <AdminChatRoom targetUserId={adminSelectedUserChat.id} databaseURL={firebaseConfig.databaseURL} />
            <form onSubmit={handleSendAdminChat} className="p-3 border-t bg-white flex gap-2 shrink-0">
              <input type="text" placeholder="ตอบกลับลูกค้า..." value={adminChatInput} onChange={(e) => setAdminChatInput(e.target.value)} className="flex-1 px-4 py-2.5 border rounded-2xl text-xs bg-gray-50" required />
              <button type="submit" className="px-5 py-2.5 bg-[#8C6D23] text-white rounded-2xl text-xs font-bold">ส่ง</button>
            </form>
          </div>
        </div>
      )}

      {pendingSlip && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">🧾 ยืนยันรายการจากสลิป ({formatMoney(pendingSlip.amount)} บาท)</h3>
            <form onSubmit={handleConfirmSlip} className="space-y-3 text-xs">
              <select value={slipCategory} onChange={(e) => setSlipCategory(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl bg-gray-50 font-bold">
                {EXPENSE_CATEGORIES.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
              </select>
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl font-bold">✓ บันทึกรายการนี้</button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2.5 bg-white rounded-2xl border shadow-sm text-xl">☰</button>
            <h1 className="text-xl font-bold text-[#1E1E1E]">งบประมาณของฉัน</h1>
          </div>
          <button onClick={() => { if (isAdminLoggedIn) setIsAdminLoggedIn(false); else { const p = prompt("กรอกรหัสผ่าน Admin:"); if (p === "27112547") setIsAdminLoggedIn(true); else if (p) alert("รหัสผ่านผิด!"); } }} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${isAdminLoggedIn ? "bg-[#1E1E1E] text-white" : "bg-white text-gray-600"}`}>
            🛡️ {isAdminLoggedIn ? "ออกจากระบบ Admin" : "ผู้ดูแลระบบ"}
          </button>
        </div>

        {isAdminLoggedIn && (
          <AdminPanel firebaseConfig={firebaseConfig} onSendAnnouncement={handleSendAnnouncementFromAdmin} activeAnnouncement={activeAnnouncement} onClearAnnouncement={handleClearAnnouncementFromAdmin} onlineUsers={onlineUsers} onDeleteUser={handleDeleteUserFromAdmin} onSelectUserChat={(u) => setAdminSelectedUserChat(u)} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border">
              <h2 className="text-sm font-bold">โปรไฟล์</h2>
              <div className="flex items-center gap-4">
                <div onClick={() => avatarInputRef.current?.click()} className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden border">
                  {userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : <span>?</span>}
                </div>
                <span className="text-sm font-bold">{userName || "ผู้ใช้ทั่วไป"}</span>
              </div>
            </div>

            <div className="bg-[#1E1E1E] text-white rounded-3xl p-6 shadow-md space-y-5">
              <div>
                <p className="text-xs text-gray-400">คงเหลือทั้งหมด</p>
                <h2 className="text-3xl font-extrabold mt-1">{formatMoney(totalBalance)} บาท</h2>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
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
      </div>
    </div>
  );
}
