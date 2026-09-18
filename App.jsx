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

  // Onboarding Wizard State (1: ใส่ชื่อ, 2: ใส่รูปโปรไฟล์, 3: ถามเรื่องสอนใช้งาน, null: จบกระบวนการ)
  const [onboardingStep, setOnboardingStep] = useState(() => {
    return !localStorage.getItem("bp_userName") ? 1 : null;
  });
  const [inputName, setInputName] = useState("");

  // Tutorial Tour State (0: ไม่เปิด, 1-6: 6 ขั้นตอนการทัวร์)
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

  // Lock body scroll
  useEffect(() => {
    if (activeModal || isMenuOpen || showPrivacyNotice || showAdminLogin || showReportModal || goalToDeposit || goalToEdit || pendingSlip || itemToDelete || onboardingStep || tutorialStep > 0) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [activeModal, isMenuOpen, showPrivacyNotice, showAdminLogin, showReportModal, goalToDeposit, goalToEdit, pendingSlip, itemToDelete, onboardingStep, tutorialStep]);

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

  useEffect(() => {
    if (!isAdminLoggedIn) return;
    const fetchAdminData = async () => {
      try {
        const userRes = await fetch(`${firebaseConfig.databaseURL}/users.json`);
        const userData = await userRes.json();
        if (userData) {
          const usersList = Object.entries(userData).map(([key, val]) => ({ id: key, ...val }));
          setOnlineUsers(usersList);
        } else {
          setOnlineUsers([]);
        }

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

  // ฟังก์ชันให้ Admin ลบผู้ใช้งานออกจาก Firebase
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
      alert("ไม่สามารถลบผู้ใช้งานได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ฟังก์ชันให้ผู้ใช้รีเซ็ตบัญชีและลบข้อมูลของตนเองเหมือนเพิ่งใช้งานครั้งแรก
  const handleResetMyAccount = async () => {
    if (!confirm("⚠️ คำเตือน: คุณต้องการลบข้อมูลทั้งหมดและเริ่มใช้งานใหม่ใช่หรือไม่? ข้อมูลประวัติ ยอดเงิน และโปรไฟล์ของคุณจะถูกลบทั้งหมด")) return;
    
    try {
      await fetch(`${firebaseConfig.databaseURL}/users/${deviceId}.json`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Firebase Reset Error:", err);
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
      prev.map((g) => {
        if (g.id === goalToDeposit.id) {
          return { ...g, current: (g.current || 0) + Number(depositAmount) };
        }
        return g;
      })
    );
    setGoalToDeposit(null);
    setDepositAmount("");
  };

  const handleUpdateGoal = (e) => {
    e.preventDefault();
    if (!goalToEdit || !editGoalName || !editGoalTarget || Number(editGoalTarget) <= 0) return;
    setSavingsGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalToEdit.id) {
          return {
            ...g,
            name: editGoalName.trim(),
            target: Number(editGoalTarget),
            current: Number(editGoalCurrent) || 0,
          };
        }
        return g;
      })
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
          setScanMessage("อ่านสลิปสำเร็จ แต่ไม่พบยอดเงิน กรุณาตรวจสอบรูปภาพ");
        }
      } else {
        setScanMessage("ไม่สามารถประมวลผลสลิปนี้ได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err) {
      console.error("Slip Scan Error:", err);
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
      {
        id: Date.now().toString(),
        name: goalName,
        target: Number(goalTarget),
        current: Number(goalCurrent) || 0,
      },
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

      {/* 🚀 ONBOARDING WIZARD (สำหรับผู้ใช้ใหม่ครั้งแรก 3 หน้าต่าง) */}
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
              <button
                onClick={() => setOnboardingStep(3)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl text-xs font-bold"
              >
                ข้ามขั้นตอนนี้
              </button>
              <button
                onClick={() => setOnboardingStep(3)}
                className="flex-1 py-3 bg-[#1E1E1E] text-white rounded-2xl text-xs font-bold"
              >
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
                onClick={() => {
                  setOnboardingStep(null);
                  setTutorialStep(1);
                }}
                className="w-full py-3 bg-[#1B5E20] text-white rounded-2xl text-xs font-bold shadow-md"
              >
                ✨ เริ่มทัวร์แนะนำการใช้งาน (6 ขั้นตอน)
              </button>
              <button
                onClick={() => setOnboardingStep(null)}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl text-xs font-bold"
              >
                ข้ามไปหน้าหลักเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ ระบบสอนใช้งานแบบทัวร์ 6 ขั้นตอนครอบคลุมทุกระบบ */}
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
                <p className="text-xs text-gray-300 leading-relaxed">
                  แอปนี้ออกแบบมาให้คุณจัดการเงิน เก็บออม และตรวจสอบสถานะทางการเงินได้อย่างรวดเร็วในหน้าจอเดียว!
                </p>
              </div>
            )}
            {tutorialStep === 2 && (
              <div className="space-y-2">
                <div className="text-2xl">📊</div>
                <h4 className="text-sm font-bold text-emerald-400">2. ยอดเงินคงเหลือและกราฟวงกลม</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  การ์ดสีดำด้านซ้ายจะสรุปยอดเงินทั้งหมดของคุณ และมีกราฟวงกลมแสดงสัดส่วนรายจ่ายให้เห็นชัดเจนว่าเงินเดือนนี้หมดไปกับค่าอะไรบ้าง
                </p>
              </div>
            )}
            {tutorialStep === 3 && (
              <div className="space-y-2">
                <div className="text-2xl">📸</div>
                <h4 className="text-sm font-bold text-emerald-400">3. สแกนสลิปอัจฉริยะ</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  ไม่ต้องพิมพ์เอง! แค่เลือกรูปสลิปโอนเงิน ระบบจะดึงยอดเงินและวันที่ให้อัตโนมัติ พร้อมให้คุณเลือกหมวดหมู่ หรือพิมพ์ระบุ <b>"ค่าอะไร"</b> ได้เอง
                </p>
              </div>
            )}
            {tutorialStep === 4 && (
              <div className="space-y-2">
                <div className="text-2xl">➕</div>
                <h4 className="text-sm font-bold text-emerald-400">4. บันทึกข้อมูล & เจ้าหนี้/ลูกหนี้</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  ใช้ปุ่มเพิ่มข้อมูลด้านล่างเพื่อจดรายรับ-รายจ่าย หรือบันทึกรายการเจ้าหนี้/ลูกหนี้/ยอดเบิกคืน เพื่อไม่ให้ลืมว่าใครติดเงินเราหรือเราติดใคร
                </p>
              </div>
            )}
            {tutorialStep === 5 && (
              <div className="space-y-2">
                <div className="text-2xl">🎯</div>
                <h4 className="text-sm font-bold text-emerald-400">5. เป้าหมายการออม & วางแผนงบ</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  ตั้งเป้าหมายเก็บเงิน (เช่น ซื้อของ, เที่ยว) และจัดสรรงบเป็นเซ็ตล่วงหน้า (เช่น Set 1, Set 2) พร้อมกดแก้ไขหรือเติมเงินได้ตลอดเวลา
                </p>
              </div>
            )}
            {tutorialStep === 6 && (
              <div className="space-y-2">
                <div className="text-2xl">☰</div>
                <h4 className="text-sm font-bold text-emerald-400">6. เมนูเพิ่มเติม (3 ขีดซ้ายบน)</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  กดปุ่ม 3 ขีดเพื่อเปิดดูประวัติย้อนหลังทั้งหมด, ดูสรุปหมวดหมู่ละเอียดยิบ (พร้อมเวลา), หรือปรับยอดเงินสด/ธนาคารให้ตรงกับความเป็นจริง พร้อมลุยแล้ว! 🎉
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-3">
              {tutorialStep > 1 && (
                <button
                  onClick={() => setTutorialStep((prev) => prev - 1)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold"
                >
                  ← ย้อนกลับ
                </button>
              )}
              {tutorialStep < 6 ? (
                <button
                  onClick={() => setTutorialStep((prev) => prev + 1)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  ถัดไป ➔
                </button>
              ) : (
                <button
                  onClick={() => setTutorialStep(0)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  🎉 จบการแนะนำ เริ่มใช้งานเลย
                </button>
              )}
            </div>
            <div className="text-center pt-1">
              <button
                onClick={() => setTutorialStep(0)}
                className="text-[11px] text-gray-400 hover:text-white underline"
              >
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
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 text-xl font-bold">
                  ✕
                </button>
              </div>

              <div className="space-y-2 pt-2">
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
                <button
                  onClick={() => { setTutorialStep(1); setIsMenuOpen(false); }}
                  className="w-full text-left text-xs text-emerald-600 hover:text-emerald-800 py-2 font-semibold"
                >
                  💡 เปิดดูคู่มือแนะนำการใช้งาน (6 ขั้นตอน)
                </button>
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

            {/* 🗑️ ปุ่มลบข้อมูลและรีเซ็ตบัญชีของผู้ใช้ซ่อนไว้ด้านล่างเมนู 3 ขีด */}
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

      {/* ⚠️ Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <h3 className="text-base font-bold text-gray-800">ยืนยันการลบเซ็ตแผนการเงินนี้?</h3>
            <p className="text-xs text-gray-500">ข้อมูลการวางแผนในเซ็ตนี้จะถูกลบออกทั้งหมด</p>
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

      {/* 🖼️ Popup ยืนยันหมวดหมู่และรายละเอียดหลังสแกนสลิป */}
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
                <select
                  value={slipCategory}
                  onChange={(e) => setSlipCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl bg-gray-50 font-bold"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              {slipCategory === "other_exp" && (
                <div>
                  <label className="text-gray-500 block mb-1">ระบุรายละเอียด (ค่าอะไร?)</label>
                  <input
                    type="text"
                    placeholder="เช่น ค่าซ่อมรถ, ค่าอุปกรณ์"
                    value={slipCustomNote}
                    onChange={(e) => setSlipCustomNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 block mb-1">วันที่</label>
                  <input
                    type="date"
                    value={pendingSlip.date}
                    onChange={(e) => setPendingSlip({ ...pendingSlip, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium"
                  />
                </div>
                <div>
                  <label className="text-gray-500 block mb-1">เวลา (ไม่บังคับ)</label>
                  <input
                    type="text"
                    placeholder="เช่น 14:30"
                    value={slipTime}
                    onChange={(e) => setSlipTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl font-bold">
                ✓ บันทึกรายการนี้
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🪙 Modal เติมเงินเข้าเป้าหมายการออม */}
      {goalToDeposit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-gray-800">💰 เติมเงินออม: {goalToDeposit.name}</h3>
              <button onClick={() => setGoalToDeposit(null)} className="text-gray-400 text-lg">✕</button>
            </div>
            <form onSubmit={handleDepositGoal} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">จำนวนเงินที่ต้องการออมเพิ่ม (บาท)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-xl text-xs font-bold">
                ยืนยันการเติมเงิน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal แก้ไขเป้าหมายการออม */}
      {goalToEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">✏️ แก้ไขเป้าหมายการออม</h3>
              <button onClick={() => setGoalToEdit(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateGoal} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-500 block mb-1">ชื่อเป้าหมาย</label>
                <input
                  type="text"
                  value={editGoalName}
                  onChange={(e) => setEditGoalName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 block mb-1">ยอดเป้าหมาย (บาท)</label>
                  <input
                    type="number"
                    value={editGoalTarget}
                    onChange={(e) => setEditGoalTarget(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-500 block mb-1">ยอดสะสมปัจจุบัน (บาท)</label>
                  <input
                    type="number"
                    value={editGoalCurrent}
                    onChange={(e) => setEditGoalCurrent(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-semibold"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-xl font-bold">
                💾 บันทึกการแก้ไข
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🗺️ Modal หน้าวางแผนการเงิน */}
      {activeModal === "budget_planner" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="p-5 border-b flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900">🗺️ ระบบวางแผนการเงิน (Budget Sets)</h3>
                <p className="text-xs text-gray-500">เลือกหรือสร้างเซ็ตการใช้จ่ายล่วงหน้าตามสถานการณ์</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-xl font-bold p-2">✕</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {budgetSets.length === 0 ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-800 font-medium">
                    👋 ยินดีต้อนรับสู่ระบบวางแผนการเงิน! เริ่มต้นสร้างเซ็ตแรกของคุณด้านล่างนี้ได้เลย
                  </div>
                  <form onSubmit={handleSaveNewBudgetSet} id="budget-form" className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="ชื่อเซ็ต (เช่น Set 1: งบปกติ 700 บาท)"
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        className="px-3 py-2 border rounded-xl text-xs bg-white"
                        required
                      />
                      <input
                        type="number"
                        placeholder="งบตั้งต้นทั้งหมด (บาท)"
                        value={newSetTotal}
                        onChange={(e) => setNewSetTotal(e.target.value)}
                        className="px-3 py-2 border rounded-xl text-xs bg-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-600 block">จัดสรรงบแยกตามหมวดหมู่:</label>
                      <div className="space-y-2">
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <div key={cat.key} className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            {cat.key === "other_exp" ? (
                              <input
                                type="text"
                                placeholder="ตั้งชื่อเอง (แทนคำว่าอื่นๆ)"
                                value={setCustomLabels[cat.key] || ""}
                                onChange={(e) => setSetCustomLabels({ ...setCustomLabels, [cat.key]: e.target.value })}
                                className="flex-1 px-2 py-1 border rounded-lg text-xs bg-gray-50 text-gray-800 font-medium"
                              />
                            ) : (
                              <span className="text-xs text-gray-700 font-medium flex-1 truncate">{cat.label}</span>
                            )}
                            <input
                              type="number"
                              placeholder="0"
                              value={setAllocations[cat.key] || ""}
                              onChange={(e) => setSetAllocations({ ...setAllocations, [cat.key]: e.target.value })}
                              className="w-24 px-2.5 py-1.5 border rounded-xl text-xs bg-gray-50 text-right font-bold"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 text-xs font-bold text-gray-600 px-1">
                      <span>จัดสรรแล้ว: {formatMoney(newSetTotalAllocated)} / {formatMoney(newSetTotal)} บ.</span>
                      <span className={newSetRemaining < 0 ? "text-rose-600" : "text-emerald-600"}>
                        เหลือสำรอง: {formatMoney(newSetRemaining)} บ.
                      </span>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-700 block">🎮 เลือกเซ็ตแผนการเงินที่ใช้งานอยู่:</label>
                      {activeBudgetSet && (
                        <button
                          onClick={() => setItemToDelete({ type: "budgetSet", id: activeBudgetSet.id })}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50 rounded-lg border border-rose-100"
                        >
                          🗑️ ลบเซ็ตนี้ทิ้ง
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {budgetSets.map((set) => (
                        <button
                          key={set.id}
                          onClick={() => setActiveBudgetSetId(set.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                            activeBudgetSetId === set.id
                              ? "bg-[#1E1E1E] text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          <span>🛡️ {set.name}</span>
                          <span className="text-[10px] opacity-85">({formatMoney(set.totalBudget)} บ.)</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeBudgetSet && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold px-1">
                        <span className="text-gray-800">📋 รายละเอียด: {activeBudgetSet.name}</span>
                        <span className="text-gray-500">งบตั้งต้น: <b className="text-gray-900">{formatMoney(activeBudgetSet.totalBudget)}</b> บาท</span>
                      </div>

                      <div className="space-y-2">
                        {EXPENSE_CATEGORIES.map((cat) => {
                          const allocated = activeBudgetSet.items[cat.key] || 0;
                          if (allocated === 0) return null;
                          const percent = activeBudgetSet.totalBudget > 0 ? ((allocated / activeBudgetSet.totalBudget) * 100).toFixed(0) : 0;
                          const labelName = cat.key === "other_exp" && activeBudgetSet.customLabels?.[cat.key] ? activeBudgetSet.customLabels[cat.key] : cat.label;
                          return (
                            <div key={cat.key} className="flex justify-between items-center py-2.5 px-3 bg-white border border-gray-100 rounded-2xl text-xs shadow-sm">
                              <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="font-semibold text-gray-800">{labelName}</span>
                              </div>
                              <div>
                                <span className="font-bold text-rose-600">{formatMoney(allocated)} บ.</span>
                                <span className="text-[10px] text-gray-400 ml-2">({percent}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between text-xs font-bold pt-1 px-1 text-gray-600">
                        <span>จัดสรรรวม: <span className="text-rose-600">{formatMoney(totalAllocated)} บ.</span></span>
                        <span>เงินเหลือสำรอง/ฉุกเฉิน: <span className="text-emerald-600">{formatMoney(remainingBudget)} บ.</span></span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-xs font-bold text-gray-800">➕ สร้างเซ็ตแผนการเงินเพิ่ม (เช่น Set 2, Set 3)</h4>
                    <form onSubmit={handleSaveNewBudgetSet} id="budget-form" className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="ชื่อเซ็ต (เช่น Set 2: งบวันหยุด)"
                          value={newSetName}
                          onChange={(e) => setNewSetName(e.target.value)}
                          className="px-3 py-2 border rounded-xl text-xs bg-white"
                          required
                        />
                        <input
                          type="number"
                          placeholder="งบตั้งต้นทั้งหมด (บาท)"
                          value={newSetTotal}
                          onChange={(e) => setNewSetTotal(e.target.value)}
                          className="px-3 py-2 border rounded-xl text-xs bg-white"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-600 block">จัดสรรงบแยกตามหมวดหมู่:</label>
                        <div className="space-y-2">
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <div key={cat.key} className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              {cat.key === "other_exp" ? (
                                <input
                                  type="text"
                                  placeholder="ตั้งชื่อเอง (แทนคำว่าอื่นๆ)"
                                  value={setCustomLabels[cat.key] || ""}
                                  onChange={(e) => setSetCustomLabels({ ...setCustomLabels, [cat.key]: e.target.value })}
                                  className="flex-1 px-2 py-1 border rounded-lg text-xs bg-gray-50 text-gray-800 font-medium"
                                />
                              ) : (
                                <span className="text-xs text-gray-700 font-medium flex-1 truncate">{cat.label}</span>
                              )}
                              <input
                                type="number"
                                placeholder="0"
                                value={setAllocations[cat.key] || ""}
                                onChange={(e) => setSetAllocations({ ...setAllocations, [cat.key]: e.target.value })}
                                className="w-24 px-2.5 py-1.5 border rounded-xl text-xs bg-gray-50 text-right font-bold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1 text-xs font-bold text-gray-600 px-1">
                        <span>จัดสรรแล้ว: {formatMoney(newSetTotalAllocated)} / {formatMoney(newSetTotal)} บ.</span>
                        <span className={newSetRemaining < 0 ? "text-rose-600" : "text-emerald-600"}>
                          เหลือสำรอง: {formatMoney(newSetRemaining)} บ.
                        </span>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-white shrink-0">
              <button
                type="submit"
                form="budget-form"
                className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl text-xs font-bold hover:bg-black transition shadow-sm"
              >
                💾 บันทึกเซ็ตแผนการเงินนี้
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🪟 Modals อื่นๆ */}
      {activeModal === "add_tx" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">➕ เพิ่มรายการรายรับ / รายจ่าย</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
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

              {category === "other_exp" && (
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">ระบุรายละเอียด (ค่าอะไร?)</label>
                  <input
                    type="text"
                    placeholder="เช่น ค่าซ่อมรถ, ค่าอุปกรณ์"
                    value={customCategoryNote}
                    onChange={(e) => setCustomCategoryNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50 font-semibold"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">เวลา (ไม่บังคับ)</label>
                  <input
                    type="text"
                    placeholder="เช่น 14:30"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">หมายเหตุเพิ่มเติม</label>
                  <input
                    type="text"
                    placeholder="เช่น ร้านโปรด"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-3 rounded-2xl font-bold text-xs">
                + บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {activeModal === "add_debt" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">🤝 เพิ่ม เจ้าหนี้ / ลูกหนี้ / รายการเบิก</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleAddDebt} className="space-y-3">
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setDebtType("creditor")}
                  className={`py-1.5 font-semibold rounded-lg ${debtType === "creditor" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"}`}
                >
                  เจ้าหนี้ (เราติด)
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

              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-2.5 rounded-xl text-xs font-bold">
                + บันทึกรายการ
              </button>
            </form>
          </div>
        </div>
      )}

      {activeModal === "add_goal" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">🎯 เพิ่มเป้าหมายการออมเงิน</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-3">
              <input
                type="text"
                placeholder="ชื่อเป้าหมาย (เช่น ซื้อคอม, เที่ยวญี่ปุ่น)"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="ยอดเป้าหมาย (บาท)"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                  required
                />
                <input
                  type="number"
                  placeholder="มีสะสมอยู่แล้ว (บาท)"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-gray-50"
                />
              </div>
              <button type="submit" className="w-full bg-[#1E1E1E] text-white py-2.5 rounded-xl text-xs font-bold">
                + บันทึกเป้าหมาย
              </button>
            </form>
          </div>
        </div>
      )}

      {/* หน้าต่าง 3 ขีด แสดงประวัติทั้งหมด */}
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
                  const displayLabel = tx.category === "other_exp" && tx.customCategoryNote ? tx.customCategoryNote : info.label;
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-8 rounded-full" style={{ backgroundColor: info.color }} />
                        <div>
                          <p className="font-semibold text-gray-800">{displayLabel}</p>
                          <p className="text-[10px] text-gray-400">
                            {formatDateThai(tx.date)} {tx.time && `• ${tx.time}`} • {ACCOUNT_LABEL[tx.account]}
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
                          className="text-gray-400 hover:text-rose-600 p-1 text-sm"
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

      {activeModal === "categories_detail" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-800">📊 สรุปใช้จ่ายตามหมวดหมู่ (ละเอียดยิบ)</h3>
                <p className="text-[11px] text-gray-400">ยอดรวมรายจ่ายทั้งหมด: {formatMoney(totalExpense)} บาท</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {categoryExpenses.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีข้อมูลรายจ่ายในระบบ</p>
              ) : (
                categoryExpenses.map((cat) => {
                  const percent = totalExpense > 0 ? ((cat.sum / totalExpense) * 100).toFixed(2) : 0;
                  return (
                    <div key={cat.key} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span>{cat.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-rose-600">-{formatMoney(cat.sum)} บาท</span>
                          <span className="text-gray-400 text-[11px] ml-2">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            backgroundColor: cat.color,
                            width: `${Math.min(100, (cat.sum / totalExpense) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === "goals_detail" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-800">🎯 รายละเอียดเป้าหมายการออมทั้งหมด</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 text-lg font-bold">✕</button>
            </div>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {savingsGoals.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีเป้าหมายการออมในระบบ</p>
              ) : (
                savingsGoals.map((g) => {
                  const progress = g.target > 0 ? Math.min(100, ((g.current || 0) / g.target) * 100).toFixed(1) : 0;
                  return (
                    <div key={g.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800">{g.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setGoalToEdit(g);
                              setEditGoalName(g.name);
                              setEditGoalTarget(g.target);
                              setEditGoalCurrent(g.current || 0);
                            }}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded-xl text-[10px] font-bold"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => setGoalToDeposit(g)}
                            className="bg-emerald-600 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold"
                          >
                            + เติมเงิน
                          </button>
                          <button
                            onClick={() => setItemToDelete({ type: "goal", id: g.id })}
                            className="text-gray-400 hover:text-rose-600"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>เก็บได้แล้ว: <b className="text-emerald-600">{formatMoney(g.current || 0)} บ.</b></span>
                        <span>เป้าหมาย: <b className="text-gray-800">{formatMoney(g.target)} บ.</b></span>
                      </div>
                      <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-right text-[11px] text-gray-400 font-semibold">
                        สำเร็จแล้ว {progress}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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

        {/* Admin Real-time Dashboard with Delete User feature */}
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
                  {onlineUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-200 shadow-sm text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 overflow-hidden border">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{u.userName}</p>
                          <p className="text-[10px] text-gray-400">เข้าล่าสุด: {u.lastActive}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">เงินคงเหลือ</p>
                          <p className="font-extrabold text-emerald-600">{formatMoney(u.balance)} บ.</p>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition text-sm"
                          title="ลบผู้ใช้นี้ออกจากระบบ"
                        >
                          🗑️
                        </button>
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{userName || "ผู้ใช้ทั่วไป"}</span>
                    <button onClick={() => setUserName(prompt("เปลี่ยนชื่อผู้ใช้:", userName) || userName)} className="text-xs text-gray-400">✏️ แก้ไข</button>
                  </div>
                </div>
              </div>
            </div>

            {/* 🎮 คงเหลือทั้งหมด + กราฟวงกลม */}
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
                      <div
                        className="w-full h-full rounded-full shadow-inner"
                        style={{
                          background: `conic-gradient(${generatePieChartGradient()})`,
                        }}
                      />
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
                <div><span className="text-gray-400">ธนาคาร </span><span className="font-bold text-gray-200">{formatMoney(calcBankTotal)} บาท</span></div>
                <div><span className="text-gray-400">เงินสด </span><span className="font-bold text-gray-200">{formatMoney(calcCashTotal)} บาท</span></div>
              </div>
            </div>

            {/* 🎯 ปุ่มกดเปิด Modal เพิ่มข้อมูล */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setActiveModal("add_tx")}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                ➕ เพิ่มรายรับ/รายจ่าย
              </button>
              <button
                onClick={() => setActiveModal("add_debt")}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                🤝 เพิ่มเจ้าหนี้/ลูกหนี้
              </button>
              <button
                onClick={() => setActiveModal("add_goal")}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                🎯 เพิ่มเป้าหมายออม
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* 1. 🤝 สรุป เจ้าหนี้ / ลูกหนี้ / รายการเบิก */}
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

              {debts.length > 0 ? (
                <div className="space-y-2 pt-2 border-t max-h-48 overflow-y-auto">
                  {debts.map((d) => (
                    <div key={d.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl text-xs">
                      <div>
                        <span className={`font-bold mr-1.5 ${d.type === "creditor" ? "text-rose-600" : d.type === "debtor" ? "text-emerald-600" : "text-blue-600"}`}>
                          [{d.type === "creditor" ? "เจ้าหนี้" : d.type === "debtor" ? "ลูกหนี้" : "รอเบิก"}]
                        </span>
                        <span className="font-bold text-gray-900">{d.note}</span>
                        {d.person && <span className="text-gray-500 font-medium"> ({d.person})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-gray-900">{formatMoney(d.amount)} บ.</span>
                        <button
                          onClick={() => setItemToDelete({ type: "debt", id: d.id })}
                          className="text-gray-400 hover:text-rose-600 p-1 text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">ไม่มีรายการค้างชำระ</p>
              )}
            </div>

            {/* 2. 🎯 เป้าหมายการออมเงิน */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-[#1E1E1E]">🎯 เป้าหมายการออมเงิน</h2>
                {savingsGoals.length > 0 && (
                  <button
                    onClick={() => setActiveModal("goals_detail")}
                    className="text-[11px] text-emerald-600 font-bold hover:underline"
                  >
                    ดูทั้งหมด ({savingsGoals.length})
                  </button>
                )}
              </div>

              {savingsGoals.length === 0 ? (
                <p className="text-xs text-gray-400">ยังไม่มีเป้าหมายการออมเงิน</p>
              ) : (
                <div className="space-y-3">
                  {savingsGoals.map((g) => {
                    const progress = g.target > 0 ? Math.min(100, ((g.current || 0) / g.target) * 100).toFixed(0) : 0;
                    return (
                      <div key={g.id} className="p-3.5 bg-gray-50 rounded-2xl border text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-900 text-sm">{g.name}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setGoalToEdit(g);
                                setEditGoalName(g.name);
                                setEditGoalTarget(g.target);
                                setEditGoalCurrent(g.current || 0);
                              }}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-1 rounded-xl text-[10px] font-bold"
                            >
                              ✏️ แก้ไข
                            </button>
                            <button
                              onClick={() => setGoalToDeposit(g)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-sm transition"
                            >
                              + เติมเงิน
                            </button>
                            <button
                              onClick={() => setItemToDelete({ type: "goal", id: g.id })}
                              className="text-gray-400 hover:text-rose-600 p-1"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full transition-all" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                          <span>เก็บได้แล้ว: <b className="text-emerald-700">{formatMoney(g.current || 0)} / {formatMoney(g.target)} บ.</b></span>
                          <span className="text-emerald-600 font-extrabold">สำเร็จ {progress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleSingleFileUpload}
                  disabled={scanning}
                />
              </div>

              {scanning && (
                <div className="bg-[#FFFDF6] border border-[#EADBBD] p-3 rounded-2xl text-center">
                  <p className="text-xs font-bold text-[#8C6D23] animate-pulse">⏳ กำลังสแกนสลิป กรุณารอสักครู่...</p>
                </div>
              )}

              {scanMessage && (
                <p className="text-xs text-center font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  {scanMessage}
                </p>
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
