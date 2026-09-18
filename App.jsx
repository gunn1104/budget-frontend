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

  // Profile State
  const [userName, setUserName] = useState(() => localStorage.getItem("bp_userName") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("bp_userAvatar") || "");

  // Onboarding Wizard State
  const [onboardingStep, setOnboardingStep] = useState(() => {
    return !localStorage.getItem("bp_userName") ? 1 : null;
  });
  const [inputName, setInputName] = useState("");

  // Tutorial Tour State
  const [tutorialStep, setTutorialStep] = useState(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  
  const [goalToDeposit, setGoalToDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");

  const [goalToEdit, setGoalToEdit] = useState(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [editGoalCurrent, setEditGoalCurrent] = useState("");

  // Pending Slip State
  const [pendingSlip, setPendingSlip] = useState(null);
  const [slipCategory, setSlipCategory] = useState("food");
  const [slipCustomNote, setSlipCustomNote] = useState("");
  const [slipTime, setSlipTime] = useState("");

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [adminSelectedUserChat, setAdminSelectedUserChat] = useState(null);
  const [adminChatInput, setAdminChatInput] = useState("");
  const chatScrollRef = useRef(null);

  // Budget Sets State
  const [budgetSets, setBudgetSets] = useState(() => {
    const saved = localStorage.getItem("bp_budgetSets");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [activeBudgetSetId, setActiveBudgetSetId] = useState(() => {
    return localStorage.getItem("bp_activeBudgetSetId") || "";
  });
  
  const [newSetName, setNewSetName] = useState("");
  const [newSetTotal, setNewSetTotal] = useState("");
  const [setAllocations, setSetAllocations] = useState({});
  const [setCustomLabels, setSetCustomLabels] = useState({});

  // Modals & Admin State
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(() => !localStorage.getItem("bp_privacyAccepted"));
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reports, setReports] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Admin Broadcast Announcement State
  const [announcementText, setAnnouncementText] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [canCloseAnnouncement, setCanCloseAnnouncement] = useState(false);

  const [itemToDelete, setItemToDelete] = useState(null);

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

  const [bankRealInput, setBankRealInput] = useState("");
  const [cashRealInput, setCashRealInput] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // ระบบจัดการการเลื่อนหน้าจอที่ปลอดภัยและลื่นไหลที่สุด (ป้องกันหน้าจอค้างเลื่อนไม่ลง)
  useEffect(() => {
    const hasOpenModal =
      activeModal !== null ||
      isMenuOpen ||
      showPrivacyNotice ||
      showReportModal ||
      goalToDeposit !== null ||
      goalToEdit !== null ||
      pendingSlip !== null ||
      itemToDelete !== null ||
      onboardingStep !== null ||
      tutorialStep > 0 ||
      activeAnnouncement !== null ||
      adminSelectedUserChat !== null;

    if (hasOpenModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    activeModal,
    isMenuOpen,
    showPrivacyNotice,
    showReportModal,
    goalToDeposit,
    goalToEdit,
    pendingSlip,
    itemToDelete,
    onboardingStep,
    tutorialStep,
    activeAnnouncement,
    adminSelectedUserChat,
  ]);

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

  useEffect(() => localStorage.setItem("bp_userName", userName), [userName]);
  useEffect(() => localStorage.setItem("bp_userAvatar", userAvatar), [userAvatar]);
  useEffect(() => localStorage.setItem("bp_transactions", JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem("bp_savingsGoals", JSON.stringify(savingsGoals)), [savingsGoals]);
  useEffect(() => localStorage.setItem("bp_debts", JSON.stringify(debts)), [debts]);
  useEffect(() => localStorage.setItem("bp_accountAdjustments", JSON.stringify(accountAdjustments)), [accountAdjustments]);
  useEffect(() => localStorage.setItem("bp_budgetSets", JSON.stringify(budgetSets)), [budgetSets]);
  useEffect(() => localStorage.setItem("bp_activeBudgetSetId", activeBudgetSetId), [activeBudgetSetId]);

  // ส่ง Heartbeat สถานะออนไลน์แบบลื่นไหล
  useEffect(() => {
    if (!userName) return;
    const sendHeartbeat = async () => {
      try {
        const payload = {
          deviceId,
          userName: userName || "ผู้ใช้ทั่วไป",
          avatar: userAvatar || "",
          balance: totalBalance,
          lastActive: Date.now(),
        };
        await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Firebase Heartbeat Error:", err);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [userName, userAvatar, totalBalance, deviceId]);

  const formatUserStatus = (lastActiveTimestamp) => {
    if (!lastActiveTimestamp) return { text: "ออฟไลน์", isOnline: false };
    const diffSec = Math.floor((Date.now() - lastActiveTimestamp) / 1000);
    if (diffSec < 25) {
      return { text: "🟢 กำลังใช้งานอยู่", isOnline: true };
    } else {
      const dateObj = new Date(lastActiveTimestamp);
      const timeStr = dateObj.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const dateStr = dateObj.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      return { text: `⚪ ใช้งานล่าสุดเมื่อ ${dateStr} เวลา ${timeStr}`, isOnline: false };
    }
  };

  // ดึงข้อมูลคลาวด์และห้องแชท
  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        const userRes = await fetch(`${firebaseConfig.databaseURL}/users.json`);
        const userData = await userRes.json();
        if (userData) {
          const usersList = Object.entries(userData).map(([key, val]) => ({ id: key, ...val }));
          setOnlineUsers(usersList);
        } else {
          setOnlineUsers([]);
        }

        if (!isAdminLoggedIn) {
          const reportRes = await fetch(`${firebaseConfig.databaseURL}/reports.json`);
          const reportData = await reportRes.json();
          if (reportData) setReports(Object.values(reportData).reverse());
        }

        const annRes = await fetch(`${firebaseConfig.databaseURL}/announcement.json`);
        const annData = await annRes.json();
        if (annData && annData.text) {
          setActiveAnnouncement((prev) => {
            if (!prev || prev.id !== annData.id) {
              setCanCloseAnnouncement(false);
              setTimeout(() => setCanCloseAnnouncement(true), 3000);
              return annData;
            }
            return prev;
          });
        } else {
          setActiveAnnouncement(null);
        }

        if (deviceId) {
          const chatRes = await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}.json`);
          const chatData = await chatRes.json();
          if (chatData) {
            setChatMessages(Object.values(chatData));
          } else {
            setChatMessages([]);
          }
        }
      } catch (err) {
        console.error("Firebase Fetch Error:", err);
      }
    };

    fetchCloudData();
    const interval = setInterval(fetchCloudData, 4000);
    return () => clearInterval(interval);
  }, [deviceId, isAdminLoggedIn]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeModal]);

  // 🤖 ระบบ AI บอทอัจฉริยะวิเคราะห์เจตนา + ถามย้ำอัตโนมัติ
  const handleSendUserChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const msgId = Date.now().toString();
    const userMsg = {
      id: msgId,
      sender: "user",
      senderName: userName || "ผู้ใช้",
      text: userText,
      time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}/${msgId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMsg),
      });
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput("");

      const lower = userText.toLowerCase();
      let botReplyText = "";

      if (lower.includes("เลื่อน") || lower.includes("ขยับ") || lower.includes("พัง") || lower.includes("บั๊ก") || lower.includes("ใช้ไม่ได้") || lower.includes("ค้าง")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังสอบถามเกี่ยวกับ **ปัญหาการใช้งาน / หน้าจอเลื่อนไม่ได้ใช่ไหมครับ?**\n\n💡 **วิธีแก้ไข:** แนะนำให้รีเฟรชหน้าเว็บ 1 ครั้ง ระบบจะปลดล็อกและกลับมาเลื่อนได้ปกติครับ หรือกดแจ้งปัญหาในเมนู 3 ขีดได้เลย!";
      } else if (lower.includes("รูป") || lower.includes("สลิป") || lower.includes("ภาพ") || lower.includes("โปรไฟล์") || lower.includes("อัปโหลด")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังต้องการสอบถามเกี่ยวกับ **การใส่รูปภาพหรืออัปโหลดสลิปโอนเงินใช่ไหมครับ?**\n\n💡 **คำตอบ:** กดที่รูปโปรไฟล์ซ้ายบนเพื่อเปลี่ยนรูป หรือเลือกอัปโหลดสลิปทีละ 1 รูปที่กล่องสแกนหน้าแรกได้เลยครับ";
      } else if (lower.includes("วิธี") || lower.includes("ยังไง") || lower.includes("ใช้") || lower.includes("เริ่มต้น") || lower.includes("คู่มือ") || lower.includes("app")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังต้องการทราบ **วิธีการใช้งานแอปพลิเคชันใช่ไหมครับ?**\n\n💡 **สรุป:** กดปุ่ม '+' เพื่อจดรายรับ-รายจ่าย, ตั้งเป้าหมายออมเงิน หรือไปที่เมนู 3 ขีดเพื่อจัดสรรงบประมาณล่วงหน้าครับ";
      } else if (lower.includes("สวัสดี") || lower.includes("hi") || lower.includes("hello")) {
        botReplyText = `🤖 AI วิเคราะห์คำถาม:\nสวัสดีครับคุณ ${userName || "ผู้ใช้"}! มีเรื่องไหนให้ AI ช่วยวิเคราะห์หรือสอบถามแอดมิน พิมพ์บอกได้เลยครับ ยินดีให้บริการ 24 ชม.!`;
      } else {
        botReplyText = `🤖 AI วิเคราะห์คำถาม:\nอืมน้า... จากข้อความ "${userText}" AI ยังไม่แน่ใจว่าคุณหมายถึงเรื่องอะไรครับ\n\n❓ **คุณต้องการสอบถามเกี่ยวกับเรื่องใดด้านล่างนี้หรือเปล่าครับ?**\n1. วิธีใช้งานแอปพลิเคชัน\n2. วิธีการใส่รูปภาพ / สแกนสลิป\n3. ปัญหาหน้าจอเลื่อนไม่ได้\n4. การวางแผนการเงิน\n\nพิมพ์ระบุหัวข้อเพิ่มเติมได้เลยครับ AI พร้อมตอบคำตอบให้ทันที!`;
      }

      setTimeout(async () => {
        const botMsgId = (Date.now() + 1).toString();
        const botMsg = {
          id: botMsgId,
          sender: "admin",
          senderName: "AI บอทอัจฉริยะ 🤖",
          text: botReplyText,
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        };

        await fetch(`${firebaseConfig.databaseURL}/chats/${deviceId}/${botMsgId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(botMsg),
        });
        setChatMessages((prev) => [...prev, botMsg]);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("ไม่สามารถส่งข้อความได้");
    }
  };

  const handleSendAdminChat = async (e) => {
    e.preventDefault();
    if (!adminChatInput.trim() || !adminSelectedUserChat) return;
    const msgId = Date.now().toString();
    const newMsg = {
      id: msgId,
      sender: "admin",
      senderName: "ผู้ดูแลระบบ (Admin)",
      text: adminChatInput.trim(),
      time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      await fetch(`${firebaseConfig.databaseURL}/chats/${adminSelectedUserChat.id}/${msgId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg),
      });
      setAdminChatInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    const annPayload = {
      id: Date.now().toString(),
      text: announcementText.trim(),
      time: new Date().toLocaleString("th-TH"),
    };
    try {
      await fetch(`${firebaseConfig.databaseURL}/announcement.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annPayload),
      });
      setAnnouncementText("");
      alert("ส่งประกาศแจ้งเตือนไปยังหน้าจอผู้ใช้ทุกคนเรียบร้อยแล้ว!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAnnouncement = async () => {
    if (!confirm("ต้องการลบประกาศนี้ออกจากหน้าจอผู้ใช้ทั้งหมดใช่หรือไม่?")) return;
    try {
      await fetch(`${firebaseConfig.databaseURL}/announcement.json`, {
        method: "DELETE",
      });
      setActiveAnnouncement(null);
      alert("ลบประกาศเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (targetDeviceId) => {
    if (!confirm("คุณต้องการลบข้อมูลผู้ใช้งานคนนี้ออกจากระบบหลังบ้านใช่หรือไม่?")) return;
    try {
      await fetch(`${firebaseConfig.databaseURL}/users/${targetDeviceId}.json`, {
        method: "DELETE",
      });
      setOnlineUsers((prev) => prev.filter((u) => u.id !== targetDeviceId));
      alert("ลบผู้ใช้งานเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetMyAccount = async () => {
    if (!confirm("⚠️ คำเตือน: คุณต้องการลบข้อมูลทั้งหมดและเริ่มใช้งานใหม่ใช่หรือไม่?")) return;
    try {
      await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);
    }
    localStorage.clear();
    window.location.reload();
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "transaction") {
      setTransactions((prev) => prev.filter((t) => t.id !== itemToDelete.id));
    } else if (itemToDelete.type === "debt") {
      setDebts((prev) => prev.filter((d) => d.id !== itemToDelete.id));
    } else if (itemToDelete.type === "goal") {
      setSavingsGoals((prev) => prev.filter((g) => g.id !== itemToDelete.id));
    } else if (itemToDelete.type === "budgetSet") {
      const remaining = budgetSets.filter((s) => s.id !== itemToDelete.id);
      setBudgetSets(remaining);
      if (activeBudgetSetId === itemToDelete.id && remaining.length > 0) {
        setActiveBudgetSetId(remaining[0].id);
      } else if (remaining.length === 0) {
        setActiveBudgetSetId("");
      }
    }
    setItemToDelete(null);
  };

  const handleDepositGoal = (e) => {
    e.preventDefault();
    if (!goalToDeposit || !depositAmount || Number(depositAmount) <= 0) return;
    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === goalToDeposit.id ? { ...g, current: (g.current || 0) + Number(depositAmount) } : g))
    );
    setGoalToDeposit(null);
    setDepositAmount("");
  };

  const handleUpdateGoal = (e) => {
    e.preventDefault();
    if (!goalToEdit || !editGoalName || !editGoalTarget || Number(editGoalTarget) <= 0) return;
    setSavingsGoals((prev) =>
      prev.map((g) =>
        g.id === goalToEdit.id
          ? { ...g, name: editGoalName.trim(), target: Number(editGoalTarget), current: Number(editGoalCurrent) || 0 }
          : g
      )
    );
    setGoalToEdit(null);
    setEditGoalName("");
    setEditGoalTarget("");
    setEditGoalCurrent("");
  };

  const handleSaveNewBudgetSet = (e) => {
    e.preventDefault();
    if (!newSetName || !newSetTotal || Number(newSetTotal) <= 0) return;
    const newId = Date.now().toString();
    const newSet = {
      id: newId,
      name: newSetName.trim(),
      totalBudget: Number(newSetTotal),
      items: { ...setAllocations },
      customLabels: { ...setCustomLabels },
    };
    setBudgetSets((prev) => [...prev, newSet]);
    setActiveBudgetSetId(newId);
    setNewSetName("");
    setNewSetTotal("");
    setSetAllocations({});
    setSetCustomLabels({});
    alert("บันทึกเซ็ตแผนการเงินเรียบร้อยแล้ว!");
  };

  const acceptPrivacy = () => {
    localStorage.setItem("bp_privacyAccepted", "true");
    setShowPrivacyNotice(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUserAvatar(ev.target.result);
      reader.readAsDataURL(file);
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
      alert("ส่งรายงานปัญหาถึงผู้ดูแลระบบเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
    }
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
          setPendingSlip({
            amount: Number(data.amount),
            date: data.date || todayStr(),
            time: data.time || "",
            note: data.note || "",
          });
          setSlipCategory("food");
          setSlipCustomNote("");
          setSlipTime(data.time || "");
          setScanMessage("");
        } else {
          setScanMessage("อ่านสลิปสำเร็จ แต่ไม่พบยอดเงิน");
        }
      } else {
        setScanMessage("ไม่สามารถประมวลผลสลิปนี้ได้");
      }
    } catch (err) {
      console.error(err);
      setScanMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmSlip = (e) => {
    e.preventDefault();
    if (!pendingSlip) return;

    const newTx = {
      id: Date.now().toString(),
      type: "expense",
      account: "bank",
      amount: pendingSlip.amount,
      category: slipCategory,
      customCategoryNote: slipCategory === "other_exp" ? slipCustomNote.trim() : "",
      date: pendingSlip.date,
      time: slipTime.trim(),
      note: pendingSlip.note || "นำเข้าจากสลิป",
    };

    setTransactions((prev) => [newTx, ...prev]);
    setPendingSlip(null);
    setScanMessage(`บันทึกรายจ่าย ${formatMoney(pendingSlip.amount)} บาท เรียบร้อยแล้ว`);
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
      customCategoryNote: category === "other_exp" ? customCategoryNote.trim() : "",
      date,
      time: time.trim(),
      note,
    };
    setTransactions((prev) => [newTx, ...prev]);
    setAmount("");
    setNote("");
    setCustomCategoryNote("");
    setTime("");
    setActiveModal(null);
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!goalName || !goalTarget || Number(goalTarget) <= 0) return;
    setSavingsGoals((prev) => [
      ...prev,
      { id: Date.now().toString(), name: goalName, target: Number(goalTarget), current: Number(goalCurrent) || 0 },
    ]);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("");
    setActiveModal(null);
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
    setActiveModal(null);
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

  const activeBudgetSet = budgetSets.find((s) => s.id === activeBudgetSetId) || budgetSets[0];
  const totalAllocated = activeBudgetSet ? Object.values(activeBudgetSet.items).reduce((a, b) => a + Number(b), 0) : 0;
  const remainingBudget = activeBudgetSet ? activeBudgetSet.totalBudget - totalAllocated : 0;

  const newSetTotalAllocated = Object.values(setAllocations).reduce((a, b) => a + Number(b), 0);
  const newSetRemaining = (Number(newSetTotal) || 0) - newSetTotalAllocated;

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#2C2C2C] font-sans pb-12 relative">

      {/* 🚨 แจ้งเตือนประกาศจาก Admin */}
      {activeAnnouncement && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center border-2 border-amber-500">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
              📢
            </div>
            <h3 className="text-base font-extrabold text-gray-900">ประกาศสำคัญจากผู้ดูแลระบบ</h3>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed text-left">
              {activeAnnouncement.text}
            </div>
            <p className="text-[10px] text-gray-400">ส่งเมื่อ: {activeAnnouncement.time}</p>

            {canCloseAnnouncement ? (
              <button
                onClick={() => setActiveAnnouncement(null)}
                className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold shadow-md hover:bg-black transition flex items-center justify-center gap-2"
              >
                <span>✕ ปิดประกาศนี้</span>
              </button>
            ) : (
              <div className="w-full bg-gray-200 text-gray-500 py-3 rounded-2xl text-xs font-bold cursor-not-allowed">
                ⏳ กรุณารอสักครู่ (สามารถปิดได้ใน 3 วินาที)...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🚀 ONBOARDING WIZARD */}
      {onboardingStep === 1 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
              👋
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">ยินดีต้อนรับสู่แอปงบประมาณ!</h3>
            <p className="text-xs text-gray-500">กรุณาใส่ชื่อของคุณเพื่อเริ่มต้นใช้งานระบบ</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputName.trim()) {
                  setUserName(inputName.trim());
                  setOnboardingStep(2);
                }
              }}
              className="space-y-3 pt-2"
            >
              <input
                type="text"
                placeholder="ชื่อของคุณ (เช่น Gun)"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-4 py-3 border rounded-2xl text-sm bg-gray-50 font-semibold text-center"
                required
              />
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold shadow-md">
                ถัดไป ➔
              </button>
            </form>
          </div>
        </div>
      )}

      {onboardingStep === 2 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
              📷
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">ตั้งค่ารูปโปรไฟล์</h3>
            <p className="text-xs text-gray-500">คุณสามารถอัปโหลดรูปภาพโปรไฟล์ของคุณได้ (หรือจะข้ามไปก่อนก็ได้)</p>
            
            <div className="py-2 flex justify-center">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 mx-auto shadow-inner"
              >
                {userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : <span className="text-2xl">➕</span>}
                <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setOnboardingStep(3)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl text-xs font-bold">
                ข้ามขั้นตอนนี้
              </button>
              <button onClick={() => setOnboardingStep(3)} className="flex-1 py-3 bg-[#1E1E1E] text-white rounded-2xl text-xs font-bold">
                ถัดไป ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingStep === 3 && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
              💡
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">ต้องการแนะนำวิธีใช้งานไหม?</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              เรามีระบบทัวร์แนะนำ 6 ขั้นตอนครอบคลุมทุกฟังก์ชัน เพื่อให้คุณใช้งานได้คล่องทันที คุณต้องการรับชมไหมครับ?
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => { setOnboardingStep(null); setTutorialStep(1); }}
                className="w-full py-3 bg-[#1B5E20] text-white rounded-2xl text-xs font-bold shadow-md"
              >
                ✨ เริ่มทัวร์แนะนำการใช้งาน (6 ขั้นตอน)
              </button>
              <button onClick={() => setOnboardingStep(null)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl text-xs font-bold">
                ข้ามไปหน้าหลักเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ ระบบสอนใช้งานแบบทัวร์ 6 ขั้นตอน */}
      {tutorialStep > 0 && (
        <div className="fixed inset-0 bg-black/80 z-[250] flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="max-w-sm w-full space-y-4 bg-[#1E1E1E] p-6 rounded-3xl border border-gray-700 shadow-2xl text-left">
            <div className="flex justify-between items-center text-xs text-gray-400 font-bold border-b border-gray-800 pb-2">
              <span>คู่มือการใช้งานระบบ</span>
              <span className="text-emerald-400">ขั้นตอนที่ {tutorialStep} จาก 6</span>
            </div>

            {tutorialStep === 1 && (
              <div className="space-y-2">
                <div className="text-2xl">👋</div>
                <h4 className="text-sm font-bold text-emerald-400">1. ยินดีต้อนรับสู่แอปจัดการการเงิน</h4>
                <p className="text-xs text-gray-300 leading-relaxed">แอปนี้ออกแบบมาให้คุณจัดการเงิน เก็บออม และตรวจสอบสถานะทางการเงินได้อย่างรวดเร็วในหน้าจอเดียว!</p>
              </div>
            )}
            {tutorialStep === 2 && (
              <div className="space-y-2">
                <div className="text-2xl">📊</div>
                <h4 className="text-sm font-bold text-emerald-400">2. ยอดเงินคงเหลือและกราฟวงกลม</h4>
                <p className="text-xs text-gray-300 leading-relaxed">การ์ดสีดำด้านซ้ายจะสรุปยอดเงินทั้งหมดของคุณ และมีกราฟวงกลมแสดงสัดส่วนรายจ่ายให้เห็นชัดเจน</p>
              </div>
            )}
            {tutorialStep === 3 && (
              <div className="space-y-2">
                <div className="text-2xl">📸</div>
                <h4 className="text-sm font-bold text-emerald-400">3. สแกนสลิปอัจฉริยะ</h4>
                <p className="text-xs text-gray-300 leading-relaxed">ไม่ต้องพิมพ์เอง! แค่เลือกรูปสลิปโอนเงิน ระบบจะดึงยอดเงินและวันที่ให้อัตโนมัติ พร้อมให้คุณเลือกหมวดหมู่</p>
              </div>
            )}
            {tutorialStep === 4 && (
              <div className="space-y-2">
                <div className="text-2xl">➕</div>
                <h4 className="text-sm font-bold text-emerald-400">4. บันทึกข้อมูล & เจ้าหนี้/ลูกหนี้</h4>
                <p className="text-xs text-gray-300 leading-relaxed">ใช้ปุ่มเพิ่มข้อมูลด้านล่างเพื่อจดรายรับ-รายจ่าย หรือบันทึกรายการเจ้าหนี้/ลูกหนี้</p>
              </div>
            )}
            {tutorialStep === 5 && (
              <div className="space-y-2">
                <div className="text-2xl">🎯</div>
                <h4 className="text-sm font-bold text-emerald-400">5. เป้าหมายการออม & วางแผนงบ</h4>
                <p className="text-xs text-gray-300 leading-relaxed">ตั้งเป้าหมายเก็บเงินและจัดสรรงบเป็นเซ็ตล่วงหน้า (เช่น Set 1, Set 2)</p>
              </div>
            )}
            {tutorialStep === 6 && (
              <div className="space-y-2">
                <div className="text-2xl">☰</div>
                <h4 className="text-sm font-bold text-emerald-400">6. เมนูเพิ่มเติม (3 ขีดซ้ายบน)</h4>
                <p className="text-xs text-gray-300 leading-relaxed">กดปุ่ม 3 ขีดเพื่อเปิดดูประวัติย้อนหลัง, แชทคุยกับแอดมินหรือบอท AI, หรือปรับยอดเงินสด/ธนาคาร</p>
              </div>
            )}

            <div className="flex gap-2 pt-3">
              {tutorialStep > 1 && (
                <button onClick={() => setTutorialStep((prev) => prev - 1)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold">
                  ← ย้อนกลับ
                </button>
              )}
              {tutorialStep < 6 ? (
                <button onClick={() => setTutorialStep((prev) => prev + 1)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                  ถัดไป ➔
                </button>
              ) : (
                <button onClick={() => setTutorialStep(0)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                  🎉 จบการแนะนำ เริ่มใช้งานเลย
                </button>
              )}
            </div>
            <div className="text-center pt-1">
              <button onClick={() => setTutorialStep(0)} className="text-[11px] text-gray-400 hover:text-white underline">
                ข้ามการแนะนำ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ☰ Side Menu Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="w-4/5 max-w-sm bg-white h-full p-6 space-y-4 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-lg font-bold text-[#1E1E1E]">เมนูและเครื่องมือ</h2>
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 text-xl font-bold">✕</button>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => { setActiveModal("chat_admin"); setIsMenuOpen(false); }}
                  className="w-full flex justify-between items-center p-3.5 bg-blue-50 hover:bg-blue-100 rounded-2xl text-xs font-bold text-blue-800 border border-blue-200"
                >
                  <span>💬 แชทซัพพอร์ต (พร้อม AI บอทอัจฉริยะ)</span>
                  <span>➔</span>
                </button>

                <button
                  onClick={() => { setActiveModal("transactions"); setIsMenuOpen(false); }}
                  className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
                >
                  <span>📜 รายการประวัติทั้งหมด ({transactions.length})</span>
                  <span>➔</span>
                </button>

                <button
                  onClick={() => { setActiveModal("budget_planner"); setIsMenuOpen(false); }}
                  className="w-full flex justify-between items-center p-3.5 bg-emerald-50 hover:bg-emerald-100 rounded-2xl text-xs font-bold text-emerald-800 border border-emerald-200"
                >
                  <span>🗺️ วางแผนการเงิน / จัดสรรงบ (เซ็ต Set 1, 2...)</span>
                  <span>➔</span>
                </button>

                <button
                  onClick={() => { setActiveModal("categories_detail"); setIsMenuOpen(false); }}
                  className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
                >
                  <span>📊 สรุปใช้จ่ายตามหมวดหมู่ (ละเอียดยิบ)</span>
                  <span>➔</span>
                </button>

                <button
                  onClick={() => { setActiveModal("goals_detail"); setIsMenuOpen(false); }}
                  className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
                >
                  <span>🎯 เป้าหมายการออม (รายละเอียดทั้งหมด)</span>
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

              <div className="pt-4 border-t space-y-2">
                <button onClick={() => { setTutorialStep(1); setIsMenuOpen(false); }} className="w-full text-left text-xs text-emerald-600 hover:text-emerald-800 py-2 font-semibold">
                  💡 เปิดดูคู่มือแนะนำการใช้งาน (6 ขั้นตอน)
                </button>
                <button onClick={() => { setShowPrivacyNotice(true); setIsMenuOpen(false); }} className="w-full text-left text-xs text-gray-600 hover:text-black py-2">
                  📜 นโยบายการเก็บข้อมูล
                </button>
                <button onClick={() => { setShowReportModal(true); setIsMenuOpen(false); }} className="w-full text-left text-xs text-rose-600 hover:text-rose-800 py-2 font-semibold">
                  🚨 แจ้งปัญหาการใช้งาน
                </button>
              </div>
            </div>

            <div className="pt-4 border-t shrink-0">
              <button
                onClick={handleResetMyAccount}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold border border-rose-200 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>🗑️</span>
                <span>รีเซ็ตบัญชีและลบข้อมูลทั้งหมด (เริ่มต้นใหม่)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💬 Modal หน้าต่างแชท (AI บอทอัจฉริยะ) */}
      {activeModal === "chat_admin" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-[#1E1E1E] text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-bold">แชทซัพพอร์ต & AI บอทอัจฉริยะ</h3>
                  <p className="text-[10px] text-blue-300">วิเคราะห์คำถามและให้คำตอบทันที 24 ชม.</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-xl font-bold p-1">✕</button>
            </div>

            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="text-3xl">🤖💬</div>
                  <p className="text-xs font-bold text-gray-700">สอบถามปัญหาหรือวิธีใช้งานได้เลย!</p>
                  <p className="text-[11px] text-gray-400">พิมพ์มาได้ทุกรูปแบบ AI จะช่วยวิเคราะห์และตอบคำถามให้อัตโนมัติครับ</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isAdmin = msg.sender === "admin";
                  return (
                    <div key={msg.id} className={`flex flex-col ${isAdmin ? "items-start" : "items-end"}`}>
                      <span className="text-[10px] text-gray-400 px-1 mb-0.5">{msg.senderName} • {msg.time}</span>
                      <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-sm whitespace-pre-wrap ${
                        isAdmin ? "bg-white text-gray-800 border border-gray-200 rounded-tl-sm" : "bg-[#1E1E1E] text-white rounded-tr-sm"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendUserChat} className="p-3 border-t bg-white flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="พิมพ์ข้อความสอบถาม (เช่น ใช้แอปยังไง, เลื่อนไม่ได้)..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-4 py-2.5 border rounded-2xl text-xs bg-gray-50 font-medium"
                required
              />
              <button type="submit" className="px-5 py-2.5 bg-[#1E1E1E] text-white rounded-2xl text-xs font-bold shadow-sm hover:bg-black transition">
                ส่ง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💬 Modal แอดมินตอบแชทลูกค้าแต่ละห้อง */}
      {adminSelectedUserChat && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-[#8C6D23] text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white text-[#8C6D23] flex items-center justify-center font-bold overflow-hidden border">
                  {adminSelectedUserChat.avatar ? <img src={adminSelectedUserChat.avatar} className="w-full h-full object-cover" /> : adminSelectedUserChat.userName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold">ห้องแชทกับ: {adminSelectedUserChat.userName}</h3>
                  <p className="text-[10px] text-amber-200">Device ID: {adminSelectedUserChat.id}</p>
                </div>
              </div>
              <button onClick={() => setAdminSelectedUserChat(null)} className="text-white text-xl font-bold p-1">✕</button>
            </div>

            <AdminChatRoom targetUserId={adminSelectedUserChat.id} />

            <form onSubmit={handleSendAdminChat} className="p-3 border-t bg-white flex gap-2 shrink-0">
              <input
                type="text"
                placeholder={`ตอบกลับ ${adminSelectedUserChat.userName}...`}
                value={adminChatInput}
                onChange={(e) => setAdminChatInput(e.target.value)}
                className="flex-1 px-4 py-2.5 border rounded-2xl text-xs bg-gray-50 font-medium"
                required
              />
              <button type="submit" className="px-5 py-2.5 bg-[#8C6D23] text-white rounded-2xl text-xs font-bold shadow-sm">
                ส่งข้อความ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals ทั่วไปอื่นๆ */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto">🗑️</div>
            <h3 className="text-base font-bold text-gray-800">ยืนยันการลบเซ็ตแผนการเงินนี้?</h3>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold">ยกเลิก</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold">ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}

      {pendingSlip && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">🧾 ยืนยันรายการจากสลิป</h3>
                <p className="text-xs text-emerald-600 font-bold">ยอดเงิน: {formatMoney(pendingSlip.amount)} บาท</p>
              </div>
              <button onClick={() => setPendingSlip(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleConfirmSlip} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-500 block mb-1">เลือกหมวดหมู่จริง</label>
                <select value={slipCategory} onChange={(e) => setSlipCategory(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl bg-gray-50 font-bold">
                  {EXPENSE_CATEGORIES.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                </select>
              </div>
              {slipCategory === "other_exp" && (
                <div>
                  <label className="text-gray-500 block mb-1">ระบุรายละเอียด (ค่าอะไร?)</label>
                  <input type="text" placeholder="เช่น ค่าซ่อมรถ" value={slipCustomNote} onChange={(e) => setSlipCustomNote(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium" required />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 block mb-1">วันที่</label>
                  <input type="date" value={pendingSlip.date} onChange={(e) => setPendingSlip({ ...pendingSlip, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium" />
                </div>
                <div>
                  <label className="text-gray-500 block mb-1">เวลา</label>
                  <input type="text" placeholder="14:30" value={slipTime} onChange={(e) => setSlipTime(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl font-bold">✓ บันทึกรายการนี้</button>
            </form>
          </div>
        </div>
      )}

      {goalToDeposit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-800">💰 เติมเงินออม: {goalToDeposit.name}</h3>
              <button onClick={() => setGoalToDeposit(null)} className="text-gray-400 text-lg">✕</button>
            </div>
            <form onSubmit={handleDepositGoal} className="space-y-3">
              <input type="number" placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50" required />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-xl text-xs font-bold">ยืนยันการเติมเงิน</button>
            </form>
          </div>
        </div>
      )}

      {goalToEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">✏️ แก้ไขเป้าหมายการออม</h3>
              <button onClick={() => setGoalToEdit(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateGoal} className="space-y-3 text-xs">
              <input type="text" value={editGoalName} onChange={(e) => setEditGoalName(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold" required />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={editGoalTarget} onChange={(e) => setEditGoalTarget(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold" required />
                <input type="number" value={editGoalCurrent} onChange={(e) => setEditGoalCurrent(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold" required />
              </div>
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-xl font-bold">💾 บันทึกการแก้ไข</button>
            </form>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2.5 bg-white rounded-2xl border border-gray-200 shadow-sm hover:bg-gray-50 text-xl">☰</button>
            <h1 className="text-xl font-bold text-[#1E1E1E]">งบประมาณของฉัน</h1>
          </div>
          
          {/* ปุ่มเข้าสู่ระบบ Admin แบบคลิกเดียวเปิด/ปิด */}
          <button
            onClick={() => {
              if (isAdminLoggedIn) {
                setIsAdminLoggedIn(false);
              } else {
                const pass = prompt("กรุณากรอกรหัสผ่านผู้ดูแลระบบ (Admin):");
                if (pass === "27112547") {
                  setIsAdminLoggedIn(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else if (pass !== null) {
                  alert("รหัสผ่านไม่ถูกต้อง!");
                }
              }
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              isAdminLoggedIn ? "bg-[#1E1E1E] text-white border-[#1E1E1E]" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            🛡️ {isAdminLoggedIn ? "ออกจากระบบ Admin" : "ผู้ดูแลระบบ"}
          </button>
        </div>

        {isAdminLoggedIn && (
          <div className="bg-[#FFFDF6] border-2 border-[#EADBBD] rounded-3xl p-5 space-y-5 shadow-md">
            <div className="flex justify-between items-center border-b border-[#EADBBD] pb-2">
              <h3 className="text-sm font-bold text-[#8C6D23] flex items-center gap-2">
                <span>🛡️</span> ระบบหลังบ้านผู้ดูแลระบบ (Firebase Cloud Dashboard)
              </h3>
              <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-0.5 rounded-full font-bold animate-pulse">REAL-TIME ONLINE</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3 shadow-sm">
              <h4 className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                <span>📢</span> ส่งข้อความประกาศแจ้งเตือน (เด้งขึ้นหน้าจอผู้ใช้)
              </h4>
              <form onSubmit={handleSendAnnouncement} className="space-y-2">
                <textarea rows="2" placeholder="พิมพ์ข้อความประกาศ..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 font-medium" required />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm">🚀 ส่งประกาศเด้งหน้าจอผู้ใช้</button>
                  {activeAnnouncement && (
                    <button type="button" onClick={handleClearAnnouncement} className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200">🗑️ ปิดประกาศ</button>
                  )}
                </div>
              </form>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>💬</span> ห้องแชทและรายชื่อผู้ใช้งาน ({onlineUsers.length} คน) - คลิกชื่อเพื่อเปิดแชทตอบลูกค้า
              </h4>
              {onlineUsers.length === 0 ? (
                <p className="text-xs text-gray-400">ยังไม่มีข้อมูลผู้ใช้งานซิงก์เข้ามา</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {onlineUsers.map((u) => {
                    const statusInfo = formatUserStatus(u.lastActive);
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs hover:border-amber-400 transition">
                        <div onClick={() => setAdminSelectedUserChat(u)} className="flex items-center gap-3 flex-1 cursor-pointer">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 overflow-hidden border shrink-0">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.userName.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-gray-800 flex items-center gap-1.5">
                              <span>{u.userName}</span>
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-md">💬 เปิดแชท</span>
                            </p>
                            <p className={`text-[10px] font-semibold ${statusInfo.isOnline ? "text-emerald-600" : "text-gray-400"}`}>
                              {statusInfo.text}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400">เงินคงเหลือ</p>
                            <p className="font-extrabold text-emerald-600">{formatMoney(u.balance)} บ.</p>
                          </div>
                          <button onClick={() => handleDeleteUser(u.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition text-sm" title="ลบผู้ใช้">🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-[#EADBBD]">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>📋</span> รายการแจ้งปัญหา ({reports.length} รายการ)
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">โปรไฟล์</h2>
              <div className="flex items-center gap-4">
                <div onClick={() => avatarInputRef.current?.click()} className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer overflow-hidden border">
                  {userAvatar ? <img src={userAvatar} className="w-full h-full object-cover" /> : <span className="text-xl">?</span>}
                  <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-gray-400 block mb-1">ชื่อที่แสดง</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{userName || "ผู้ใช้ทั่วไป"}</span>
                    <button onClick={() => setUserName(prompt("เปลี่ยนชื่อผู้ใช้:", userName) || userName)} className="text-xs text-gray-400">✏️ แก้ไข</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1E1E1E] text-white rounded-3xl p-6 shadow-md space-y-5">
              <div>
                <p className="text-xs text-gray-400">คงเหลือทั้งหมด</p>
                <h2 className="text-3xl font-extrabold mt-1">
                  {formatMoney(totalBalance)} <span className="text-sm font-normal text-gray-400">บาท</span>
                </h2>
              </div>

              <div className="pt-3 border-t border-gray-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300 font-bold">📊 สัดส่วนรายจ่ายคร่าวๆ</span>
                  <span className="text-gray-400 font-medium">รวม: {formatMoney(totalExpense)} บ.</span>
                </div>

                {categoryExpenses.length === 0 ? (
                  <p className="text-[11px] text-gray-500 text-center py-2">ยังไม่มีข้อมูลรายจ่ายในระบบ</p>
                ) : (
                  <div className="flex items-center gap-4 py-1">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <div className="w-full h-full rounded-full shadow-inner" style={{ background: `conic-gradient(${generatePieChartGradient()})` }} />
                      <div className="absolute inset-2 bg-[#1E1E1E] rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-300">EXP</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {categoryExpenses.map((cat) => {
                        const percent = totalExpense > 0 ? ((cat.sum / totalExpense) * 100).toFixed(0) : 0;
                        return (
                          <div key={cat.key} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                              <span className="text-gray-300 truncate max-w-[90px]">{cat.label}</span>
                            </div>
                            <span className="font-bold text-rose-400">~{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-800 text-xs">
                <div><span className="text-gray-400">↗ รายรับ </span><span className="font-bold text-emerald-400">{formatMoney(totalIncome)}</span></div>
                <div><span className="text-gray-400">↘ รายจ่าย </span><span className="font-bold text-rose-400">{formatMoney(totalExpense)}</span></div>
                <div><span className="text-gray-400">ธนาคาร </span><span className="font-bold text-gray-200">{formatMoney(calcBankTotal)} บ.</span></div>
                <div><span className="text-gray-400">เงินสด </span><span className="font-bold text-gray-200">{formatMoney(calcCashTotal)} บ.</span></div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-2 justify-center">
              <button onClick={() => setActiveModal("add_tx")} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition">➕ เพิ่มรายรับ/รายจ่าย</button>
              <button onClick={() => setActiveModal("add_debt")} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition">🤝 เพิ่มเจ้าหนี้/ลูกหนี้</button>
              <button onClick={() => setActiveModal("add_goal")} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition">🎯 เพิ่มเป้าหมายออม</button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">สรุป เจ้าหนี้ / ลูกหนี้ / รายการเบิก</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                  <p className="text-rose-600 font-medium text-[11px]">เจ้าหนี้ (เราติด)</p>
                  <p className="text-base font-extrabold text-rose-700 mt-1">{formatMoney(totalCreditor)} บ.</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                  <p className="text-emerald-600 font-medium text-[11px]">ลูกหนี้ (ใครติดเรา)</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-1">{formatMoney(totalDebtor)} บ.</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                  <p className="text-blue-600 font-medium text-[11px]">รอเบิกคืน</p>
                  <p className="text-base font-extrabold text-blue-700 mt-1">{formatMoney(totalReimburse)} บ.</p>
                </div>
              </div>
            </div>

            {/* นำเข้าสลิปทีละ 1 รูป */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
              <h2 className="text-sm font-bold text-[#1E1E1E]">นำเข้าจากสลิปโอนเงิน (เลือกทีละ 1 รูปไม่ใช่เลือกทีละหลายคน)</h2>
              <div
                onClick={() => !scanning && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center transition cursor-pointer space-y-1 ${
                  scanning ? "bg-gray-100 opacity-60 cursor-not-allowed" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="text-2xl">🖼️</div>
                <p className="text-xs font-bold text-gray-700">คลิกเพื่อเลือกรูปสลิป (ทีละ 1 รูปไม่ใช่เลือกทีหลายๆคน)</p>
                <p className="text-[11px] text-gray-400">ระบบจะสแกนและให้เลือกหมวดหมู่ก่อนบันทึก</p>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleSingleFileUpload} disabled={scanning} />
              </div>
              {scanning && <p className="text-xs text-center font-bold text-[#8C6D23] animate-pulse">⏳ กำลังสแกนสลิป กรุณารอสักครู่...</p>}
              {scanMessage && <p className="text-xs text-center font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">{scanMessage}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminChatRoom({ targetUserId }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`https://budget-planner-app-b6620-default-rtdb.asia-southeast1.firebasedatabase.app/chats/${targetUserId}.json`);
        const data = await res.json();
        if (data) setMessages(Object.values(data));
        else setMessages([]);
      } catch (err) {
        console.error(err);
      }
    };
    fetchRoom();
    const interval = setInterval(fetchRoom, 2500);
    return () => clearInterval(interval);
  }, [targetUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
      {messages.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">ยังไม่มีข้อความสนทนาในห้องนี้</p>
      ) : (
        messages.map((msg) => {
          const isAdmin = msg.sender === "admin";
          return (
            <div key={msg.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-gray-400 px-1 mb-0.5">{msg.senderName} • {msg.time}</span>
              <div className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed shadow-sm whitespace-pre-wrap ${
                isAdmin ? "bg-[#8C6D23] text-white rounded-tr-sm" : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
