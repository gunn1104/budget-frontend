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

export default function App() {
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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reports, setReports] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Admin Broadcast Announcement State
  const [announcementText, setAnnouncementText] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

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

  // ควบคุมการเลื่อนหน้าจอเมื่อเปิด Modal
  useEffect(() => {
    const isAnyModalOpen =
      activeModal ||
      isMenuOpen ||
      showPrivacyNotice ||
      showAdminLogin ||
      showReportModal ||
      goalToDeposit ||
      goalToEdit ||
      pendingSlip ||
      itemToDelete ||
      onboardingStep ||
      tutorialStep > 0 ||
      activeAnnouncement ||
      adminSelectedUserChat;

    if (isAnyModalOpen) {
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
    showAdminLogin,
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

  // ส่ง Heartbeat สถานะออนไลน์ไปยัง Firebase
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
    const interval = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(interval);
  }, [userName, userAvatar, totalBalance, deviceId]);

  // ดึงข้อมูลคลาวด์และห้องแชท พร้อมระบบเช็คประกาศแบบเด้งครั้งเดียว
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

        // เช็คประกาศสำคัญจากแอดมิน (แสดงเฉพาะคนที่ยังไม่เคยปิดประกาศนี้ และแสดงครั้งเดียว)
        const annRes = await fetch(`${firebaseConfig.databaseURL}/announcement.json`);
        const annData = await annRes.json();
        if (annData && annData.text) {
          const closedId = localStorage.getItem("bp_closedAnnouncementId");
          if (closedId !== String(annData.id)) {
            setActiveAnnouncement((prev) => (!prev || prev.id !== annData.id ? annData : prev));
          } else {
            setActiveAnnouncement(null);
          }
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
    const interval = setInterval(fetchCloudData, 3000);
    return () => clearInterval(interval);
  }, [deviceId, isAdminLoggedIn]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeModal]);

  // 🤖 ระบบ AI บอทอัจฉริยะวิเคราะห์เจตนา + ถามย้ำ + ให้คำตอบ
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

      if (lower.includes("เลื่อน") || lower.includes("ขยับ") || lower.includes("พัง") || lower.includes("บั๊ก") || lower.includes(" error ") || lower.includes("ใช้ไม่ได้") || lower.includes("ค้าง")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังสอบถามเกี่ยวกับ **ปัญหาการใช้งาน / หน้าจอเลื่อนไม่ได้ใช่ไหมครับ?**\n\n💡 **วิธีแก้ไขเบื้องต้น:**\nอาการนี้เกิดจากหน้าต่างป๊อปอัปค้างการล็อกหน้าจอ แนะนำให้รีเฟรชหน้าเว็บ 1 ครั้ง ระบบจะกลับมาปกติครับ";
      } else if (lower.includes("รูป") || lower.includes("สลิป") || lower.includes("ภาพ") || lower.includes("โปรไฟล์") || lower.includes("อัปโหลด")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังต้องการสอบถามเกี่ยวกับ **การใส่รูปภาพหรืออัปโหลดสลิปโอนเงินใช่ไหมครับ?**\n\n💡 **คำตอบ:** กดที่วงกลมรูปโปรไฟล์มุมซ้ายบนเพื่อเปลี่ยนรูป หรือใช้กล่องสแกนสลิปหน้าแรกเพื่อดึงยอดเงินอัตโนมัติครับ";
      } else if (lower.includes("วิธี") || lower.includes("ยังไง") || lower.includes("ใช้") || lower.includes("เริ่มต้น") || lower.includes("คู่มือ")) {
        botReplyText = "🤖 AI วิเคราะห์คำถาม:\nคุณกำลังต้องการทราบ **วิธีการใช้งานแอปพลิเคชันใช่ไหมครับ?**\n\n💡 1. บันทึกรายรับ-รายจ่ายกดปุ่ม '+' หน้าแรก\n2. ตั้งเป้าหมายออมเงินได้ตลอดเวลา\n3. จัดสรรงบการเงินผ่านเมนู 3 ขีด ☰";
      } else if (lower.includes("สวัสดี") || lower.includes("hi") || lower.includes("hello")) {
        botReplyText = `🤖 AI วิเคราะห์คำถาม:\nสวัสดีครับคุณ ${userName || "ผู้ใช้"}! มีเรื่องไหนให้ AI ช่วยวิเคราะห์หรือสอบถามเพิ่มเติม พิมพ์บอกได้เลยครับ ยินดีให้บริการ!`;
      } else {
        botReplyText = `🤖 AI วิเคราะห์คำถาม:\nจากข้อความ "${userText}" AI ยังไม่แน่ใจว่าคุณหมายถึงเรื่องใด:\n1. วิธีใช้งานแอป\n2. วิธีสแกนสลิป\n3. ปัญหาหน้าจอ\n4. วางแผนการเงิน\n\nพิมพ์ระบุหัวข้อได้เลยครับ AI พร้อมตอบคำตอบให้ทันที!`;
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
    }
  };

  const handleSendAdminChat = async (e) => {
    e.preventDefault();
    if (!adminChatInput.trim() || !adminSelectedUserChat) return;
    const msgId = Date.now().toString();
    const adminMsg = {
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
        body: JSON.stringify(adminMsg),
      });
      setAdminChatInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    let finalCategory = category;
    if (category === "other" && customCategoryNote.trim()) {
      finalCategory = customCategoryNote.trim();
    }

    const newTx = {
      id: Date.now(),
      type,
      account,
      amount: num,
      category: finalCategory,
      date: date || todayStr(),
      time: time || new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      note: note.trim(),
    };

    setTransactions([newTx, ...transactions]);
    setAmount("");
    setNote("");
    setCustomCategoryNote("");
    setTime("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    setScanMessage("กำลังย่อและอัปโหลดรูปสลิป...");

    try {
      const { base64Data, mediaType } = await resizeImage(file, 1024);
      setScanMessage("🤖 AI กำลังอ่านข้อมูลจากสลิป...");

      const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, mediaType }),
      });

      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "Failed to parse slip");

      setPendingSlip({
        amount: parsed.amount ? String(parsed.amount) : "",
        date: parsed.date || todayStr(),
        time: parsed.time || "",
        note: parsed.note || "",
        receiverName: parsed.receiverName || "",
      });
      setSlipCategory("food");
      setSlipCustomNote("");
      setSlipTime(parsed.time || "");
    } catch (err) {
      console.error("Slip parse error:", err);
      alert("ไม่สามารถอ่านสลิปได้อัตโนมัติ กรุณากรอกข้อมูลเองครับ");
      setPendingSlip({
        amount: "",
        date: todayStr(),
        time: "",
        note: "",
        receiverName: "",
      });
    } finally {
      setScanning(false);
      setScanMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmPendingSlip = () => {
    if (!pendingSlip) return;
    const num = parseFloat(pendingSlip.amount);
    if (!num || num <= 0) {
      alert("กรุณาระบุจำนวนเงินให้ถูกต้อง");
      return;
    }

    let finalCat = slipCategory;
    if (slipCategory === "other" && slipCustomNote.trim()) {
      finalCat = slipCustomNote.trim();
    }

    const newTx = {
      id: Date.now(),
      type: "expense",
      account: "bank",
      amount: num,
      category: finalCat,
      date: pendingSlip.date || todayStr(),
      time: slipTime || pendingSlip.time || new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      note: pendingSlip.note ? `โอนให้: ${pendingSlip.receiverName} (${pendingSlip.note})` : `โอนให้: ${pendingSlip.receiverName || "ไม่ระบุ"}`,
    };

    setTransactions([newTx, ...transactions]);
    setPendingSlip(null);
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    const targetNum = parseFloat(goalTarget);
    const currentNum = parseFloat(goalCurrent) || 0;
    if (!goalName.trim() || !targetNum || targetNum <= 0) {
      alert("กรุณากรอกชื่อและเป้าหมายให้ถูกต้อง");
      return;
    }

    const newGoal = {
      id: Date.now(),
      name: goalName.trim(),
      target: targetNum,
      current: currentNum,
    };

    setSavingsGoals([...savingsGoals, newGoal]);
    setGoalName("");
    setGoalTarget("");
    setGoalCurrent("");
    setActiveModal(null);
  };

  const handleDepositGoal = () => {
    const num = parseFloat(depositAmount);
    if (!num || num <= 0 || !goalToDeposit) return;

    setSavingsGoals(
      savingsGoals.map((g) => (g.id === goalToDeposit.id ? { ...g, current: g.current + num } : g))
    );
    setGoalToDeposit(null);
    setDepositAmount("");
  };

  const handleUpdateGoal = (e) => {
    e.preventDefault();
    if (!goalToEdit) return;
    const targetNum = parseFloat(editGoalTarget);
    const currentNum = parseFloat(editGoalCurrent) || 0;
    if (!editGoalName.trim() || !targetNum || targetNum <= 0) return;

    setSavingsGoals(
      savingsGoals.map((g) =>
        g.id === goalToEdit.id
          ? { ...g, name: editGoalName.trim(), target: targetNum, current: currentNum }
          : g
      )
    );
    setGoalToEdit(null);
  };

  const handleAddDebt = (e) => {
    e.preventDefault();
    const num = parseFloat(debtAmount);
    if (!debtPerson.trim() || !num || num <= 0) {
      alert("กรุณากรอกชื่อและจำนวนเงินให้ถูกต้อง");
      return;
    }

    const newDebt = {
      id: Date.now(),
      type: debtType,
      person: debtPerson.trim(),
      amount: num,
      note: debtNote.trim(),
      dueDate: debtDueDate || "",
    };

    setDebts([...debts, newDebt]);
    setDebtPerson("");
    setDebtAmount("");
    setDebtNote("");
    setDebtDueDate("");
    setActiveModal(null);
  };

  const handleSendReport = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) return;

    const reportObj = {
      id: Date.now(),
      deviceId,
      userName: userName || "ผู้ใช้ทั่วไป",
      text: reportText.trim(),
      time: new Date().toLocaleString("th-TH"),
    };

    try {
      await fetch(`${firebaseConfig.databaseURL}/reports/${reportObj.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportObj),
      });
      alert("ส่งเรื่องแจ้งปัญหา/ข้อเสนอแนะเรียบร้อยแล้ว ขอบคุณครับ!");
      setReportText("");
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถส่งข้อมูลได้");
    }
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    const annObj = {
      id: Date.now(),
      text: announcementText.trim(),
      time: new Date().toLocaleString("th-TH"),
    };

    try {
      await fetch(`${firebaseConfig.databaseURL}/announcement.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annObj),
      });
      alert("ประกาศข้อความไปยังผู้ใช้ทุกคนเรียบร้อยแล้ว!");
      setAnnouncementText("");
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถส่งประกาศได้");
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === "admin" && adminPassword === "1234") {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setAdminUsername("");
      setAdminPassword("");
      setAdminLoginError("");
    } else {
      setAdminLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    const { type: itemType, id } = itemToDelete;

    if (itemType === "transaction") {
      setTransactions(transactions.filter((t) => t.id !== id));
    } else if (itemType === "goal") {
      setSavingsGoals(savingsGoals.filter((g) => g.id !== id));
    } else if (itemType === "debt") {
      setDebts(debts.filter((d) => d.id !== id));
    } else if (itemType === "budgetSet") {
      setBudgetSets(budgetSets.filter((s) => s.id !== id));
      if (activeBudgetSetId === id) setActiveBudgetSetId("");
    }

    setItemToDelete(null);
  };

  return (
    <div className="bg-[#F3F2ED] min-h-screen text-[#1B211E] font-sans pb-28 selection:bg-[#2F6F5E] selection:text-white">
      {/* 🚀 Onboarding Wizard สำหรับผู้ใช้ใหม่ */}
      {onboardingStep && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-[#E4E1D6]">
            <div className="w-16 h-16 bg-[#2F6F5E]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              👋
            </div>
            <h2 className="text-xl font-bold mb-2">ยินดีต้อนรับสู่ Budget Planner</h2>
            <p className="text-sm text-[#63695F] mb-6">
              แอปพลิเคชันจดบันทึกรายรับ-รายจ่าย สแกนสลิปอัจฉริยะ และวางแผนการเงินส่วนตัว
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inputName.trim()) return;
                setUserName(inputName.trim());
                setOnboardingStep(null);
                setTutorialStep(1);
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ชื่อเล่นของคุณ</label>
                <input
                  type="text"
                  placeholder="เช่น คุณการ์ฟิลด์"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] focus:outline-none focus:border-[#2F6F5E] text-sm"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition"
              >
                เริ่มใช้งานกันเลย 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 📢 หน้าต่างประกาศสำคัญจากแอดมิน (เด้งครั้งเดียวสำหรับผู้ใช้งานใหม่/ตอนประกาศ) */}
      {activeAnnouncement && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-[#E4E1D6]">
            <div className="text-3xl mb-2">📢</div>
            <h3 className="text-lg font-bold mb-2 text-[#1B211E]">ประกาศสำคัญจากผู้ดูแลระบบ</h3>
            <div className="bg-[#F3F2ED] p-3 rounded-xl text-sm text-[#333] mb-5 text-left whitespace-pre-wrap max-h-48 overflow-y-auto">
              {activeAnnouncement.text}
            </div>
            <button
              onClick={() => {
                localStorage.setItem("bp_closedAnnouncementId", String(activeAnnouncement.id));
                setActiveAnnouncement(null);
              }}
              className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition cursor-pointer"
            >
              ✕ ปิดประกาศนี้
            </button>
          </div>
        </div>
      )}

      {/* 🧭 Tutorial Tour แนะนำฟังก์ชัน */}
      {tutorialStep > 0 && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-[#E4E1D6]">
            <div className="text-3xl mb-2">
              {tutorialStep === 1 ? "📸" : tutorialStep === 2 ? "💰" : "🎯"}
            </div>
            <h3 className="text-lg font-bold mb-2">
              {tutorialStep === 1 && "สแกนสลิปอัจฉริยะ"}
              {tutorialStep === 2 && "กระเป๋าเงิน & ยอดคงเหลือ"}
              {tutorialStep === 3 && "เป้าหมายการออมเงิน"}
            </h3>
            <p className="text-sm text-[#63695F] mb-6">
              {tutorialStep === 1 && "อัปโหลดรูปสลิปโอนเงิน ระบบ AI จะทำการดึงยอดเงินและวันที่ให้อัตโนมัติทันที!"}
              {tutorialStep === 2 && "แยกบัญชีธนาคารและเงินสดชัดเจน คำนวณยอดเงินรวมให้อัตโนมัติแบบเรียลไทม์"}
              {tutorialStep === 3 && "สร้างเป้าหมายเก็บเงินในฝัน พร้อมฟังก์ชันฝากและถอนเงินสะสมได้ตลอดเวลา"}
            </p>
            <div className="flex gap-2">
              {tutorialStep < 3 ? (
                <>
                  <button
                    onClick={() => setTutorialStep(0)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-xs"
                  >
                    ข้ามคำแนะนำ
                  </button>
                  <button
                    onClick={() => setTutorialStep(tutorialStep + 1)}
                    className="flex-1 bg-[#2F6F5E] text-white py-2.5 rounded-xl font-bold text-xs"
                  >
                    ถัดไป →
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setTutorialStep(0)}
                  className="w-full bg-[#2F6F5E] text-white py-3 rounded-xl font-bold text-sm shadow-md"
                >
                  พร้อมลุยเลย! 🎉
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔔 Modal ยืนยันการลบรายการ */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl border border-[#E4E1D6]">
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-base font-bold mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-xs text-[#63695F] mb-5">คุณต้องการลบรายการนี้ใช่หรือไม่? ไม่สามารถกู้คืนได้</p>
            <div className="flex gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-xs"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs"
              >
                ลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ Modal ปรับปรุงยอดเงินจริง */}
      {activeModal === "adjustAccount" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">🛠️ ปรับปรุงยอดเงินบัญชี</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#63695F] mb-4">
              หากยอดเงินในแอปไม่ตรงกับยอดในบัญชีจริง สามารถระบุส่วนต่างเพื่อปรับยอดให้ตรงกันได้ทันที
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">
                  ยอดธนาคารจริง (ปัจจุบันในแอป: {formatMoney(calcBankTotal)})
                </label>
                <input
                  type="number"
                  placeholder="ระบุยอดเงินจริง"
                  value={bankRealInput}
                  onChange={(e) => setBankRealInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                />
                <button
                  onClick={() => {
                    const real = parseFloat(bankRealInput);
                    if (isNaN(real)) return;
                    const currentWithoutAdj = calcBankTotal - accountAdjustments.bank;
                    const diff = real - currentWithoutAdj;
                    setAccountAdjustments({ ...accountAdjustments, bank: diff });
                    setBankRealInput("");
                    alert("ปรับยอดธนาคารสำเร็จ!");
                  }}
                  className="mt-2 w-full bg-[#2F6F5E] text-white py-2 rounded-xl text-xs font-bold"
                >
                  บันทึกยอดธนาคาร
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">
                  ยอดเงินสดจริง (ปัจจุบันในแอป: {formatMoney(calcCashTotal)})
                </label>
                <input
                  type="number"
                  placeholder="ระบุยอดเงินสดจริง"
                  value={cashRealInput}
                  onChange={(e) => setCashRealInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                />
                <button
                  onClick={() => {
                    const real = parseFloat(cashRealInput);
                    if (isNaN(real)) return;
                    const currentWithoutAdj = calcCashTotal - accountAdjustments.cash;
                    const diff = real - currentWithoutAdj;
                    setAccountAdjustments({ ...accountAdjustments, cash: diff });
                    setCashRealInput("");
                    alert("ปรับยอดเงินสดสำเร็จ!");
                  }}
                  className="mt-2 w-full bg-[#2F6F5E] text-white py-2 rounded-xl text-xs font-bold"
                >
                  บันทึกยอดเงินสด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 Modal เพิ่มเป้าหมายการออม */}
      {activeModal === "addGoal" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">🎯 เพิ่มเป้าหมายการออม</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ชื่อเป้าหมาย</label>
                <input
                  type="text"
                  placeholder="เช่น ซื้อไอโฟน, เก็บเงินเที่ยว"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ยอดเป้าหมายรวม (บาท)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">เงินออมเริ่มต้น (ถ้ามี)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md mt-2"
              >
                บันทึกเป้าหมาย
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💰 Modal เติมเงินเข้าเป้าหมาย */}
      {goalToDeposit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl border border-[#E4E1D6]">
            <h3 className="text-base font-bold mb-1">💰 เติมเงินออม</h3>
            <p className="text-xs text-[#63695F] mb-4">เป้าหมาย: {goalToDeposit.name}</p>
            <input
              type="number"
              placeholder="จำนวนเงินที่ต้องการออมเพิ่ม"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm text-center mb-4 focus:outline-none focus:border-[#2F6F5E]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setGoalToDeposit(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-xs"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDepositGoal}
                className="flex-1 bg-[#2F6F5E] text-white py-2.5 rounded-xl font-bold text-xs"
              >
                ยืนยันเติมเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Modal แก้ไขเป้าหมายการออม */}
      {goalToEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">✏️ แก้ไขเป้าหมายการออม</h3>
              <button
                onClick={() => setGoalToEdit(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ชื่อเป้าหมาย</label>
                <input
                  type="text"
                  value={editGoalName}
                  onChange={(e) => setEditGoalName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ยอดเป้าหมายรวม (บาท)</label>
                <input
                  type="number"
                  value={editGoalTarget}
                  onChange={(e) => setEditGoalTarget(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">เงินออมปัจจุบันสะสม (บาท)</label>
                <input
                  type="number"
                  value={editGoalCurrent}
                  onChange={(e) => setEditGoalCurrent(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md mt-2"
              >
                บันทึกการแก้ไข
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 📌 Modal เพิ่มหนี้สินและรายการเบิก */}
      {activeModal === "addDebt" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">📌 เพิ่มหนี้สิน / รายการเบิก</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ประเภท</label>
                <select
                  value={debtType}
                  onChange={(e) => setDebtType(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm bg-white focus:outline-none focus:border-[#2F6F5E]"
                >
                  <option value="creditor">เจ้าหนี้ (เราไปยืมเขามา)</option>
                  <option value="debtor">ลูกหนี้ (เขายืมเงินเราไป)</option>
                  <option value="reimburse">รายการเบิก (สำรองจ่าย / รอเบิกคืน)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ชื่อบุคคล / คู่กรณี</label>
                <input
                  type="text"
                  placeholder="เช่น พี่สมชาย, เพื่อนร่วมงาน"
                  value={debtPerson}
                  onChange={(e) => setDebtPerson(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">รายละเอียดเพิ่มเติม</label>
                <input
                  type="text"
                  placeholder="เช่น ค่าอาหารกลางวัน, ยืมซื้อของ"
                  value={debtNote}
                  onChange={(e) => setDebtNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">กำหนดชำระคืน (ถ้ามี)</label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md mt-2"
              >
                บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💬 Modal แชทซัพพอร์ต & AI บอทอัจฉริยะ */}
      {activeModal === "chatSupport" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full h-[85vh] flex flex-col shadow-2xl border border-[#E4E1D6] overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">💬 แชทซัพพอร์ต & AI บอท</h3>
                <p className="text-[10px] text-[#C7CBC2]">สอบถามปัญหา หรือคุยกับ AI ได้ตลอด 24 ชม.</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F3F2ED]">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#63695F]">
                  ยังไม่มีข้อความสนทนา พิมพ์สอบถาม AI หรือปรึกษาปัญหาได้เลยครับ!
                </div>
              ) : (
                chatMessages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <div className="text-[10px] text-[#63695F] mb-0.5 px-1">{m.senderName}</div>
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs whitespace-pre-wrap ${
                          isUser
                            ? "bg-[#2F6F5E] text-white rounded-br-none"
                            : "bg-white text-[#1B211E] border border-[#E4E1D6] rounded-bl-none shadow-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1 px-1">{m.time}</div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendUserChat} className="p-3 bg-white border-t border-[#E4E1D6] flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์ข้อความสอบถาม AI..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
              />
              <button
                type="submit"
                className="bg-[#2F6F5E] text-white px-5 rounded-xl text-xs font-bold shadow-md hover:bg-[#255749] transition"
              >
                ส่ง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 📊 Modal รายการประวัติทั้งหมด */}
      {activeModal === "historyList" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full h-[85vh] flex flex-col shadow-2xl border border-[#E4E1D6] overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">📜 รายการประวัติทั้งหมด</h3>
                <p className="text-[10px] text-[#C7CBC2]">รวมธุรกรรมรายรับ-รายจ่าย ทั้งหมด ({transactions.length} รายการ)</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-2.5 bg-[#F3F2ED]">
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#63695F]">ยังไม่มีประวัติธุรกรรม</div>
              ) : (
                transactions.map((t) => {
                  const info = categoryInfo(t.category);
                  return (
                    <div
                      key={t.id}
                      className="bg-white p-3.5 rounded-xl border border-[#E4E1D6] flex justify-between items-center shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: info.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{info.label}</div>
                          <div className="text-[11px] text-[#63695F] truncate">
                            {t.note || "-"} · {formatDateThai(t.date)} ({ACCOUNT_LABEL[t.account] || t.account})
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`text-xs font-bold ${
                            t.type === "income" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                        </span>
                        <button
                          onClick={() => setItemToDelete({ type: "transaction", id: t.id })}
                          className="text-gray-400 hover:text-red-600 text-xs font-bold p-1"
                        >
                          ✕
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

      {/* 💳 Modal วางแผนการเงิน / จัดสรรงบเป็นเซ็ต */}
      {activeModal === "budgetPlanner" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full h-[85vh] flex flex-col shadow-2xl border border-[#E4E1D6] overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">💳 วางแผนการเงิน / จัดสรรงบเป็นเซ็ต</h3>
                <p className="text-[10px] text-[#C7CBC2]">สร้างเซ็ตงบประมาณประจำเดือน (เช่น Set 1, Set 2)</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F3F2ED]">
              {/* ฟอร์มสร้างเซ็ตใหม่ */}
              <div className="bg-white p-4 rounded-xl border border-[#E4E1D6] shadow-sm">
                <h4 className="text-xs font-bold mb-3 text-[#1B211E]">➕ สร้างเซ็ตงบประมาณใหม่</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#63695F] mb-1">ชื่อเซ็ตงบ</label>
                    <input
                      type="text"
                      placeholder="เช่น งบเดือนนี้, งบเงินเดือน"
                      value={newSetName}
                      onChange={(e) => setNewSetName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#63695F] mb-1">ยอดเงินรวมของเซ็ตนี้ (บาท)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newSetTotal}
                      onChange={(e) => setNewSetTotal(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!newSetName.trim() || !newSetTotal) return;
                      const newSet = {
                        id: Date.now().toString(),
                        name: newSetName.trim(),
                        total: parseFloat(newSetTotal),
                        allocations: { ...setAllocations },
                      };
                      setBudgetSets([...budgetSets, newSet]);
                      if (!activeBudgetSetId) setActiveBudgetSetId(newSet.id);
                      setNewSetName("");
                      setNewSetTotal("");
                      setSetAllocations({});
                      alert("สร้างเซ็ตงบประมาณสำเร็จ!");
                    }}
                    className="w-full bg-[#2F6F5E] text-white py-2.5 rounded-xl text-xs font-bold"
                  >
                    บันทึกเซ็ตงบประมาณ
                  </button>
                </div>
              </div>

              {/* รายการเซ็ตงบที่มี */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#1B211E]">📋 เซ็ตงบประมาณของคุณ</h4>
                {budgetSets.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#63695F] bg-white rounded-xl border border-[#E4E1D6]">
                    ยังไม่มีเซ็ตงบประมาณ
                  </div>
                ) : (
                  budgetSets.map((set) => {
                    const isActive = activeBudgetSetId === set.id;
                    return (
                      <div
                        key={set.id}
                        className={`p-4 rounded-xl border ${
                          isActive ? "border-[#2F6F5E] bg-[#2F6F5E]/5" : "border-[#E4E1D6] bg-white"
                        } shadow-sm`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-bold text-xs">{set.name}</div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActiveBudgetSetId(isActive ? "" : set.id)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                                isActive ? "bg-[#2F6F5E] text-white" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {isActive ? "ใช้งานอยู่" : "เลือกใช้"}
                            </button>
                            <button
                              onClick={() => setItemToDelete({ type: "budgetSet", id: set.id })}
                              className="text-gray-400 hover:text-red-600 text-xs font-bold p-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-[#2F6F5E] mb-1">
                          งบรวม: {formatMoney(set.total)} บาท
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Modal แอดมินล็อกอิน */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">🛡️ เข้าสู่ระบบผู้ดูแลระบบ (Admin)</h3>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#63695F] mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  placeholder="••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-sm focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
              {adminLoginError && <div className="text-xs text-red-600 font-bold">{adminLoginError}</div>}
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md mt-2"
              >
                เข้าสู่ระบบแอดมิน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚨 Modal แจ้งปัญหา / ข้อเสนอแนะ */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E4E1D6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">🚨 แจ้งปัญหา / ข้อเสนอแนะ</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendReport} className="space-y-3">
              <textarea
                placeholder="พิมพ์รายละเอียดปัญหาหรือข้อเสนอแนะของคุณที่นี่..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs h-32 focus:outline-none focus:border-[#2F6F5E]"
                required
              />
              <button
                type="submit"
                className="w-full bg-[#1B211E] text-white py-3 rounded-xl font-bold text-sm shadow-md"
              >
                ส่งข้อความถึงแอดมิน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ☰ เมนูด้านข้าง (Slide-out Menu) */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-80 h-full p-5 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#E4E1D6] pb-4">
              <div className="flex items-center gap-3">
                <div
                  onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
                  className="w-12 h-12 rounded-full bg-[#2F6F5E] text-white flex items-center justify-center font-bold text-lg overflow-hidden cursor-pointer shadow-inner"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    userName.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                      const { base64Data } = await resizeImage(file, 200);
                      setUserAvatar(`data:image/jpeg;base64,${base64Data}`);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
                <div>
                  <div className="font-bold text-sm">{userName || "ผู้ใช้งาน"}</div>
                  <div className="text-[10px] text-[#63695F]">ID: {deviceId.slice(0, 8)}</div>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 flex-1">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveModal("chatSupport");
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>💬</span> แชทซัพพอร์ต (พร้อม AI บอทอัจฉริยะ)
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveModal("historyList");
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>📜</span> รายการประวัติทั้งหมด ({transactions.length})
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveModal("budgetPlanner");
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>💳</span> วางแผนการเงิน / จัดสรรงบเป็นเซ็ต
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setActiveModal("adjustAccount");
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>🛠️</span> ปรับปรุงยอดเงินบัญชี
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowReportModal(true);
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>🚨</span> แจ้งปัญหา / ข้อเสนอแนะ
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setTutorialStep(1);
                }}
                className="w-full p-3 rounded-xl bg-[#F3F2ED] hover:bg-[#E4E1D6] transition flex items-center gap-3 text-xs font-bold text-left"
              >
                <span>📖</span> คู่มือการใช้งานแอป
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowAdminLogin(true);
                }}
                className="w-full p-3 rounded-xl bg-[#1B211E] text-white hover:bg-black transition flex items-center gap-3 text-xs font-bold text-left shadow-md mt-4"
              >
                <span>🛡️</span> เข้าสู่ระบบผู้ดูแลระบบ (Admin)
              </button>
            </div>

            <div className="pt-4 border-t border-[#E4E1D6] text-center text-[10px] text-[#63695F]">
              Budget Planner v2.5 · ปลอดภัยและใช้งานง่าย
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ หน้าต่างจัดการระบบ Admin (เมื่อล็อกอินแล้ว) */}
      {isAdminLoggedIn && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full h-[90vh] flex flex-col shadow-2xl border border-[#E4E1D6] overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">🛡️ ระบบจัดการผู้ดูแลระบบ (Admin Control Panel)</h3>
                <p className="text-[10px] text-[#C7CBC2]">ควบคุมระบบ ประกาศข้อความ และดูแลผู้ใช้งาน</p>
              </div>
              <button
                onClick={() => setIsAdminLoggedIn(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-6 bg-[#F3F2ED]">
              {/* บรอดแคสต์ประกาศ */}
              <div className="bg-white p-4 rounded-xl border border-[#E4E1D6] shadow-sm">
                <h4 className="text-xs font-bold mb-2 text-[#1B211E]">📢 ส่งประกาศแจ้งเตือนถึงผู้ใช้ทุกคน</h4>
                <form onSubmit={handleSendAnnouncement} className="space-y-3">
                  <textarea
                    placeholder="พิมพ์ข้อความประกาศสำคัญ..."
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs h-24 focus:outline-none focus:border-[#2F6F5E]"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-[#2F6F5E] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                  >
                    ส่งประกาศทันที
                  </button>
                </form>
              </div>

              {/* รายชื่อผู้ใช้ออนไลน์ */}
              <div className="bg-white p-4 rounded-xl border border-[#E4E1D6] shadow-sm">
                <h4 className="text-xs font-bold mb-3 text-[#1B211E]">🟢 ผู้ใช้งานทั้งหมดในระบบ ({onlineUsers.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {onlineUsers.map((u) => {
                    const status = formatUserStatus(u.lastActive);
                    return (
                      <div
                        key={u.id}
                        className="p-3 rounded-xl bg-[#F3F2ED] flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2F6F5E] text-white flex items-center justify-center font-bold text-xs">
                            {u.avatar ? (
                              <img src={u.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                            ) : (
                              u.userName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold">{u.userName}</div>
                            <div className="text-[10px] text-[#63695F]">
                              ยอดเงิน: {formatMoney(u.balance)} บาท · {status.text}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setAdminSelectedUserChat(u)}
                          className="bg-[#1B211E] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
                        >
                          แชทคุย
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* รายงานปัญหาจากผู้ใช้ */}
              <div className="bg-white p-4 rounded-xl border border-[#E4E1D6] shadow-sm">
                <h4 className="text-xs font-bold mb-3 text-[#1B211E]">🚨 รายงานปัญหา / ข้อเสนอแนะจากผู้ใช้</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reports.length === 0 ? (
                    <div className="text-center py-4 text-xs text-[#63695F]">ไม่มีรายงานปัญหา</div>
                  ) : (
                    reports.map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-[#F3F2ED] text-xs">
                        <div className="flex justify-between font-bold mb-1">
                          <span>{r.userName}</span>
                          <span className="text-[10px] text-gray-500">{r.time}</span>
                        </div>
                        <p className="text-[#333] whitespace-pre-wrap">{r.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💬 Admin Chat กับผู้ใช้รายบุคคล */}
      {adminSelectedUserChat && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full h-[80vh] flex flex-col shadow-2xl border border-[#E4E1D6] overflow-hidden">
            <div className="bg-[#1B211E] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">💬 แชทกับ: {adminSelectedUserChat.userName}</h3>
                <p className="text-[10px] text-[#C7CBC2]">ID: {adminSelectedUserChat.id}</p>
              </div>
              <button
                onClick={() => setAdminSelectedUserChat(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F3F2ED]">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#63695F]">ยังไม่มีข้อความ</div>
              ) : (
                chatMessages.map((m) => {
                  const isAdminMsg = m.sender === "admin";
                  return (
                    <div key={m.id} className={`flex flex-col ${isAdminMsg ? "items-end" : "items-start"}`}>
                      <div className="text-[10px] text-[#63695F] mb-0.5 px-1">{m.senderName}</div>
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs whitespace-pre-wrap ${
                          isAdminMsg
                            ? "bg-[#2F6F5E] text-white rounded-br-none"
                            : "bg-white text-[#1B211E] border border-[#E4E1D6] rounded-bl-none shadow-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1 px-1">{m.time}</div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendAdminChat} className="p-3 bg-white border-t border-[#E4E1D6] flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์ข้อความตอบกลับในฐานะ Admin..."
                value={adminChatInput}
                onChange={(e) => setAdminChatInput(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
              />
              <button
                type="submit"
                className="bg-[#2F6F5E] text-white px-5 rounded-xl text-xs font-bold shadow-md"
              >
                ส่ง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 หน้าจอหลัก (Main Content) */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div
              onClick={() => avatarInputRef.current && avatarInputRef.current.click()}
              className="w-12 h-12 rounded-full bg-[#2F6F5E] text-white flex items-center justify-center font-bold text-lg overflow-hidden cursor-pointer shadow-md"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                userName.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div>
              <div className="text-xs text-[#63695F]">สวัสดีครับ 👋</div>
              <div className="font-bold text-base">{userName || "ผู้ใช้งาน"}</div>
            </div>
          </div>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="w-11 h-11 rounded-2xl bg-white border border-[#E4E1D6] flex items-center justify-center font-bold text-lg shadow-sm hover:bg-gray-50 transition"
          >
            ☰
          </button>
        </div>

        {/* Hero Balance Card */}
        <div className="bg-[#1B211E] text-white rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#2F6F5E]/20 rounded-full blur-2xl pointer-events-none" />
          <div className="text-xs text-[#C7CBC2] mb-1 font-medium">ยอดคงเหลือรวมทั้งหมด</div>
          <div className="text-3xl font-extrabold tracking-tight mb-4">{formatMoney(totalBalance)} บาท</div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
            <div>
              <div className="text-[#C7CBC2] text-[11px]">ธนาคาร</div>
              <div className="font-bold text-emerald-400 text-sm">{formatMoney(calcBankTotal)}</div>
            </div>
            <div>
              <div className="text-[#C7CBC2] text-[11px]">เงินสด</div>
              <div className="font-bold text-amber-400 text-sm">{formatMoney(calcCashTotal)}</div>
            </div>
          </div>
        </div>

        {/* 📷 กล่องสแกนสลิป AI อัตโนมัติ */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-[#E4E1D6] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>📷</span> สแกนสลิปโอนเงินอัตโนมัติด้วย AI
            </h3>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="border-2 border-dashed border-[#E4E1D6] rounded-2xl p-6 text-center bg-[#F3F2ED] hover:bg-[#E4E1D6]/50 transition cursor-pointer"
          >
            {scanning ? (
              <div className="text-xs font-bold text-[#2F6F5E] animate-pulse">{scanMessage}</div>
            ) : (
              <>
                <div className="text-2xl mb-1">📤</div>
                <div className="text-xs font-bold">แตะเพื่อเลือกรูปภาพสลิปโอนเงิน</div>
                <div className="text-[10px] text-[#63695F] mt-0.5">รองรับสลิปธนาคารทุกแอปพลิเคชัน</div>
              </>
            )}
          </div>

          {/* พรีวิวข้อมูลสลิปที่ AI อ่านได้ */}
          {pendingSlip && (
            <div className="mt-4 p-4 rounded-2xl bg-[#F3F2ED] border border-[#E4E1D6] space-y-3">
              <div className="text-xs font-bold text-[#2F6F5E]">✨ ตรวจพบข้อมูลสลิปสำเร็จ! ตรวจสอบและกดยืนยัน:</div>
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  value={pendingSlip.amount}
                  onChange={(e) => setPendingSlip({ ...pendingSlip, amount: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs font-bold bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#63695F] mb-1">หมวดหมู่</label>
                  <select
                    value={slipCategory}
                    onChange={(e) => setSlipCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#63695F] mb-1">วันที่</label>
                  <input
                    type="date"
                    value={pendingSlip.date}
                    onChange={(e) => setPendingSlip({ ...pendingSlip, date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">บันทึกช่วยจำ / ผู้รับโอน</label>
                <input
                  type="text"
                  value={pendingSlip.note}
                  onChange={(e) => setPendingSlip({ ...pendingSlip, note: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E4E1D6] text-xs bg-white"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPendingSlip(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmPendingSlip}
                  className="flex-1 bg-[#2F6F5E] text-white py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  ยืนยันเพิ่มรายการ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 📝 ฟอร์มบันทึกรายรับ-รายจ่ายปกติ */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-[#E4E1D6] shadow-sm">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <span>✍️</span> บันทึกรายการใหม่
          </h3>

          <div className="flex gap-1.5 p-1 bg-[#F3F2ED] rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategory(EXPENSE_CATEGORIES[0].key);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                type === "expense" ? "bg-rose-600 text-white shadow-md" : "text-[#63695F]"
              }`}
            >
              รายจ่าย
            </button>
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategory(INCOME_CATEGORIES[0].key);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                type === "income" ? "bg-emerald-600 text-white shadow-md" : "text-[#63695F]"
              }`}
            >
              รายรับ
            </button>
          </div>

          <form onSubmit={handleAddTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">กระเป๋าเงิน</label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs bg-white focus:outline-none focus:border-[#2F6F5E]"
                >
                  {ACCOUNTS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs font-bold focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">หมวดหมู่</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs bg-white focus:outline-none focus:border-[#2F6F5E]"
                >
                  {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                  <option value="other">อื่นๆ (กำหนดเอง)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">วันที่</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs bg-white focus:outline-none focus:border-[#2F6F5E]"
                />
              </div>
            </div>

            {category === "other" && (
              <div>
                <label className="block text-[10px] font-bold text-[#63695F] mb-1">ระบุชื่อหมวดหมู่</label>
                <input
                  type="text"
                  placeholder="เช่น ซื้อของเบ็ดเตล็ด"
                  value={customCategoryNote}
                  onChange={(e) => setCustomCategoryNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[#63695F] mb-1">บันทึกช่วยจำ (ไม่บังคับ)</label>
              <input
                type="text"
                placeholder="เช่น ค่าข้าวเที่ยง, ซื้อกาแฟ"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E4E1D6] text-xs focus:outline-none focus:border-[#2F6F5E]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1B211E] text-white py-3.5 rounded-xl font-bold text-xs shadow-md hover:bg-black transition mt-1"
            >
              + บันทึกรายการ
            </button>
          </form>
        </div>

        {/* 🎯 เป้าหมายการออม */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-[#E4E1D6] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>🎯</span> เป้าหมายการออมเงิน
            </h3>
            <button
              onClick={() => setActiveModal("addGoal")}
              className="bg-[#2F6F5E] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm"
            >
              + เพิ่มเป้าหมาย
            </button>
          </div>

          <div className="space-y-3">
            {savingsGoals.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#63695F]">ยังไม่มีเป้าหมายการออม กดเพิ่มได้เลย!</div>
            ) : (
              savingsGoals.map((g) => {
                const percent = Math.min(Math.round((g.current / g.target) * 100), 100);
                return (
                  <div key={g.id} className="p-4 rounded-2xl bg-[#F3F2ED] border border-[#E4E1D6] space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-xs">{g.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGoalToEdit(g)}
                          className="text-[10px] font-bold text-gray-500 hover:text-black"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => setItemToDelete({ type: "goal", id: g.id })}
                          className="text-gray-400 hover:text-red-600 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#2F6F5E] h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#63695F]">
                        สะสมแล้ว <strong className="text-[#1B211E]">{formatMoney(g.current)}</strong> / {formatMoney(g.target)} ({percent}%)
                      </span>
                      <button
                        onClick={() => setGoalToDeposit(g)}
                        className="bg-[#2F6F5E] text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-sm"
                      >
                        + เติมเงิน
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 📌 หนี้สินและรายการเบิก */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-[#E4E1D6] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>📌</span> หนี้สินและรายการเบิก
            </h3>
            <button
              onClick={() => setActiveModal("addDebt")}
              className="bg-[#2F6F5E] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm"
            >
              + เพิ่มรายการ
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
              <div className="text-[10px] text-rose-600 font-bold mb-0.5">เจ้าหนี้</div>
              <div className="text-xs font-extrabold text-rose-700">{formatMoney(totalCreditor)}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="text-[10px] text-emerald-600 font-bold mb-0.5">ลูกหนี้</div>
              <div className="text-xs font-extrabold text-emerald-700">{formatMoney(totalDebtor)}</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <div className="text-[10px] text-amber-600 font-bold mb-0.5">รอเบิก</div>
              <div className="text-xs font-extrabold text-amber-700">{formatMoney(totalReimburse)}</div>
            </div>
          </div>

          <div className="space-y-2">
            {debts.length === 0 ? (
              <div className="text-center py-4 text-xs text-[#63695F]">ยังไม่มีรายการหนี้สินหรือรายการเบิก</div>
            ) : (
              debts.map((d) => (
                <div key={d.id} className="p-3 rounded-xl bg-[#F3F2ED] flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>{d.person}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                          d.type === "creditor"
                            ? "bg-rose-100 text-rose-700"
                            : d.type === "debtor"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {d.type === "creditor" ? "เจ้าหนี้" : d.type === "debtor" ? "ลูกหนี้" : "รอเบิก"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#63695F]">{d.note || "-"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs">{formatMoney(d.amount)}</span>
                    <button
                      onClick={() => setItemToDelete({ type: "debt", id: d.id })}
                      className="text-gray-400 hover:text-red-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 📊 กราฟสรุปสัดส่วนรายจ่าย */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-[#E4E1D6] shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <span>📊</span> สัดส่วนค่าใช้จ่ายตามหมวดหมู่
          </h3>
          {totalExpense === 0 ? (
            <div className="text-center py-8 text-xs text-[#63695F]">ยังไม่มีข้อมูลรายจ่ายสำหรับแสดงกราฟ</div>
          ) : (
            <div className="flex flex-col items-center gap-5">
              <div
                className="w-36 h-36 rounded-full shadow-inner relative"
                style={{ background: `conic-gradient(${generatePieChartGradient()})` }}
              >
                <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                  <span className="text-[10px] text-[#63695F]">รายจ่ายรวม</span>
                  <span className="text-xs font-extrabold">{formatMoney(totalExpense)}</span>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-2">
                {categoryExpenses.map((cat) => (
                  <div key={cat.key} className="flex items-center justify-between p-2 rounded-xl bg-[#F3F2ED] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium truncate max-w-[90px]">{cat.label}</span>
                    </div>
                    <span className="font-bold">{formatMoney(cat.sum)}</span>
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
