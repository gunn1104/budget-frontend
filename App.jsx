const { useState, useEffect, useRef } = React;

const EXPENSE_CATEGORIES = [
  { key: "food", label: "อาหาร", color: "#A6303B" },
  { key: "transport", label: "เดินทาง", color: "#2F6F5E" },
  { key: "housing", label: "ที่พัก", color: "#4A5A70" },
  { key: "entertainment", label: "บันเทิง", color: "#B08830" },
  { key: "shopping", label: "ช้อปปิ้ง", color: "#7A4A6B" },
  { key: "health", label: "สุขภาพ", color: "#3F7A4E" },
  { key: "education", label: "การศึกษา", color: "#6B5B3E" },
  { key: "other_expense", label: "อื่นๆ", color: "#8A8578" },
];

const INCOME_CATEGORIES = [
  { key: "salary", label: "เงินเดือน", color: "#2F6F5E" },
  { key: "business", label: "ธุรกิจ", color: "#2F6F5E" },
  { key: "gift", label: "ของขวัญ", color: "#2F6F5E" },
  { key: "other_income", label: "อื่นๆ", color: "#2F6F5E" },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const ACCOUNTS = [
  { key: "bank", label: "ธนาคาร" },
  { key: "cash", label: "เงินสด" },
];
const ACCOUNT_LABEL = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.label]));

const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";
const FIREBASE_DB_URL = "https://budget-planner-app-b6620-default-rtdb.asia-southeast1.firebasedatabase.app";

function categoryInfo(key) {
  return ALL_CATEGORIES.find((c) => c.key === key) || { label: key, color: "#8A8578" };
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateThai(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

function resizeImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function budgetSetStats(s) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const dailyPlanned = s.monthlyAmount / daysInMonth;
  const remaining = s.monthlyAmount - (Number(s.spentThisMonth) || 0);
  const dailyRemaining = remaining / daysLeft;
  return { daysInMonth, daysLeft, dailyPlanned, remaining, dailyRemaining };
}

const CONSENT_KEY = "budget-planner-consent-v1";
const SCOPE_KEY = "budget-planner-scope-v2";
const DATA_KEY_PRIVATE = "budget-planner-data-v4";
const DATA_KEY_SHARED = "budget-planner-data-shared-v4";

export default function BudgetPlanner() {
  const sessionStartRef = useRef(Date.now());

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const [profile, setProfile] = useState({ name: "", avatar: null });
  const profileFirstLoad = useRef(true);
  const avatarInputRef = useRef(null);

  const [showAdminView, setShowAdminView] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [canCloseAnnouncement, setCanCloseAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const chatScrollRef = useRef(null);

  const [deviceId] = useState(() => {
    let id = localStorage.getItem("bp_deviceId");
    if (!id) {
      id = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("bp_deviceId", id);
    }
    return id;
  });

  const [dataScope, setDataScope] = useState("private");
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);
  const [budgetSets, setBudgetSets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const firstLoad = useRef(true);

  const [formType, setFormType] = useState("expense");
  const [formAccount, setFormAccount] = useState("bank");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(todayStr());

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [goalDraft, setGoalDraft] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [contributionDrafts, setContributionDrafts] = useState({});

  const [reconcileDraft, setReconcileDraft] = useState({ bank: "", cash: "" });

  const [pendingSlips, setPendingSlips] = useState([]);
  const slipInputRef = useRef(null);

  const [debtForm, setDebtForm] = useState({ kind: "debt", description: "", amount: "", counterparty: "", dueDate: "" });
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [debtEditDraft, setDebtEditDraft] = useState(null);

  const [budgetSetForm, setBudgetSetForm] = useState({ name: "", monthlyAmount: "" });
  const [editingBudgetSetId, setEditingBudgetSetId] = useState(null);
  const [budgetSetDraft, setBudgetSetDraft] = useState(null);
  const [quickSpendDraft, setQuickSpendDraft] = useState({});

  async function loadData(scope) {
    const key = scope === "shared" ? DATA_KEY_SHARED : DATA_KEY_PRIVATE;
    const shared = scope === "shared";
    try {
      const result = await window.storage.get(key, shared);
      if (result && result.value) {
        const parsed = JSON.parse(result.value);
        setTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : []);
        setGoals(Array.isArray(parsed.goals) ? parsed.goals : []);
        setDebts(Array.isArray(parsed.debts) ? parsed.debts : []);
        setBudgetSets(Array.isArray(parsed.budgetSets) ? parsed.budgetSets : []);
        return;
      }
    } catch (e) {}
    setTransactions([]);
    setGoals([]);
    setDebts([]);
    setBudgetSets([]);
  }

  const totalsByAccount = useMemo(() => {
    const sums = { bank: { income: 0, expense: 0 }, cash: { income: 0, expense: 0 } };
    transactions.forEach((t) => {
      const acc = t.account === "cash" ? "cash" : "bank";
      sums[acc][t.type] = (sums[acc][t.type] || 0) + Number(t.amount);
    });
    return sums;
  }, [transactions]);

  const bankBalance = totalsByAccount.bank.income - totalsByAccount.bank.expense;
  const cashBalance = totalsByAccount.cash.income - totalsByAccount.cash.expense;
  const totalIncome = totalsByAccount.bank.income + totalsByAccount.cash.income;
  const totalExpense = totalsByAccount.bank.expense + totalsByAccount.cash.expense;
  const balance = totalIncome - totalExpense;

  useEffect(() => {
    (async () => {
      let consent = false;
      try {
        const c = await window.storage.get(CONSENT_KEY, false);
        consent = !!(c && c.value === "true");
      } catch (e) {}
      setConsentGiven(consent);
      setConsentChecked(true);

      let scope = "private";
      try {
        const r = await window.storage.get(SCOPE_KEY, false);
        if (r && r.value === "shared") scope = "shared";
      } catch (e) {}
      setDataScope(scope);
      await loadData(scope);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!profile.name) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(`${FIREBASE_DB_URL}/users/${deviceId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, userName: profile.name, avatar: profile.avatar, balance, lastActive: Date.now() }),
        });
      } catch (err) {}
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12000);
    return () => clearInterval(interval);
  }, [profile.name, profile.avatar, balance, deviceId]);

  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        const userRes = await fetch(`${FIREBASE_DB_URL}/users.json`);
        const userData = await userRes.json();
        setOnlineUsers(userData ? Object.entries(userData).map(([key, val]) => ({ id: key, ...val })) : []);

        const annRes = await fetch(`${FIREBASE_DB_URL}/announcement.json`);
        const annData = await annRes.json();
        if (annData && annData.text && annData.timestamp > sessionStartRef.current) {
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
          const chatRes = await fetch(`${FIREBASE_DB_URL}/chats/${deviceId}.json`);
          const chatData = await chatRes.json();
          setChatMessages(chatData ? Object.values(chatData) : []);
        }
      } catch (err) {}
    };
    fetchCloudData();
    const interval = setInterval(fetchCloudData, 4000);
    return () => clearInterval(interval);
  }, [deviceId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  const formatUserStatus = (lastActiveTimestamp) => {
    const ts = Number(lastActiveTimestamp);
    if (!ts || isNaN(ts)) return { text: "ออฟไลน์", isOnline: false };
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 25 && diffSec >= 0) {
      return { text: "🟢 กำลังใช้งานอยู่", isOnline: true };
    } else {
      const dateObj = new Date(ts);
      if (isNaN(dateObj.getTime())) return { text: "⚪ ออฟไลน์", isOnline: false };
      const timeStr = dateObj.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const dateStr = dateObj.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      return { text: `⚪ ล่าสุด ${dateStr} ${timeStr}`, isOnline: false };
    }
  };

  const handleSendAnnouncementFromAdmin = async (text) => {
    const annPayload = { id: Date.now().toString(), text, time: new Date().toLocaleString("th-TH"), timestamp: Date.now() };
    await fetch(`${FIREBASE_DB_URL}/announcement.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annPayload),
    });
    alert("ส่งประกาศแจ้งเตือนเรียบร้อยแล้ว!");
    setAnnouncementText("");
  };

  const handleSendUserChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    const msgId = Date.now().toString();
    const userMsg = {
      id: msgId, sender: "user", senderName: profile.name || "ผู้ใช้",
      text: userText, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      await fetch(`${FIREBASE_DB_URL}/chats/${deviceId}/${msgId}.json`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userMsg),
      });
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput("");

      const recentHistory = [...chatMessages, userMsg].slice(-10).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const aiRes = await fetch(`${API_BASE_URL}/api/chat-assist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: profile.name || "ผู้ใช้", history: recentHistory }),
      });
      if (!aiRes.ok) throw new Error("chat-assist failed");
      const { reply } = await aiRes.json();

      const botMsgId = (Date.now() + 1).toString();
      const botMsg = {
        id: botMsgId, sender: "admin", senderName: "AI ผู้ช่วย 🤖",
        text: reply || "รับเรื่องไว้แล้วครับ แอดมินจะติดต่อกลับเร็วๆ นี้",
        time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      await fetch(`${FIREBASE_DB_URL}/chats/${deviceId}/${botMsgId}.json`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(botMsg),
      });
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {}
  };

  async function handleAcceptConsent() {
    setConsentGiven(true);
    try {
      await window.storage.set(CONSENT_KEY, "true", false);
    } catch (e) {}
  }

  async function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 240);
      setProfile((p) => ({ ...p, avatar: dataUrl }));
    } catch (err) {}
  }

  async function switchScope(newScope) {
    setLoaded(false);
    setDataScope(newScope);
    try {
      await window.storage.set(SCOPE_KEY, newScope, false);
    } catch (e) {}
    await loadData(newScope);
    firstLoad.current = true;
    setLoaded(true);
  }

  useEffect(() => {
    if (!loaded) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const key = dataScope === "shared" ? DATA_KEY_SHARED : DATA_KEY_PRIVATE;
    const shared = dataScope === "shared";
    (async () => {
      try {
        const res = await window.storage.set(key, JSON.stringify({ transactions, goals, debts, budgetSets }), shared);
        setSaveError(!res);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [transactions, goals, debts, budgetSets, loaded, dataScope]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    const rows = Object.entries(map).map(([key, amount]) => ({ key, amount, ...categoryInfo(key) }));
    rows.sort((a, b) => b.amount - a.amount);
    return rows;
  }, [transactions]);
  const maxCategoryAmount = categoryBreakdown.length ? categoryBreakdown[0].amount : 0;

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    [transactions]
  );

  const totalDebtUnpaid = useMemo(
    () => debts.filter((d) => d.kind === "debt" && d.status === "unpaid").reduce((s, d) => s + Number(d.amount), 0),
    [debts]
  );
  const totalClaimUnpaid = useMemo(
    () => debts.filter((d) => d.kind === "claim" && d.status === "unpaid").reduce((s, d) => s + Number(d.amount), 0),
    [debts]
  );
  const sortedDebts = useMemo(() => [...debts].sort((a, b) => b.id - a.id), [debts]);
  const debtsByPerson = useMemo(() => {
    const map = {};
    debts
      .filter((d) => d.status === "unpaid" && d.counterparty && d.counterparty.trim())
      .forEach((d) => {
        const key = d.counterparty.trim();
        if (!map[key]) map[key] = { debt: 0, claim: 0 };
        map[key][d.kind] += Number(d.amount);
      });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [debts]);

  const currentCategoryOptions = formType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function handleTypeSwitch(type) {
    setFormType(type);
    setFormCategory(type === "expense" ? EXPENSE_CATEGORIES[0].key : INCOME_CATEGORIES[0].key);
  }

  function handleAdd(e) {
    e.preventDefault();
    const amt = parseFloat(formAmount);
    if (!amt || amt <= 0) return;
    const newTx = {
      id: Date.now(), type: formType, account: formAccount, amount: amt, category: formCategory,
      note: formNote.trim(), date: formDate || todayStr(), addedBy: profile.name || "",
    };
    setTransactions((prev) => [newTx, ...prev]);
    setFormAmount("");
    setFormNote("");
  }

  function startEdit(tx) {
    setEditingId(tx.id);
    setEditDraft({ account: "bank", ...tx });
  }
  function saveEdit() {
    const amt = parseFloat(editDraft.amount);
    if (!amt || amt <= 0) return;
    setTransactions((prev) => prev.map((t) => (t.id === editingId ? { ...editDraft, amount: amt } : t)));
    setEditingId(null);
    setEditDraft(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }
  function deleteTx(id) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  function startAddGoal() {
    setAddingGoal(true);
    setEditingGoalId(null);
    setGoalDraft({ name: "", target: "", saved: "0" });
  }
  function startEditGoal(g) {
    setEditingGoalId(g.id);
    setAddingGoal(false);
    setGoalDraft({ name: g.name, target: g.target, saved: g.saved });
  }
  function cancelGoalDraft() {
    setAddingGoal(false);
    setEditingGoalId(null);
    setGoalDraft(null);
  }
  function saveGoalDraft() {
    const target = parseFloat(goalDraft.target) || 0;
    const saved = parseFloat(goalDraft.saved) || 0;
    const name = goalDraft.name.trim() || "เป้าหมายการออม";
    if (editingGoalId) {
      setGoals((prev) => prev.map((g) => (g.id === editingGoalId ? { ...g, name, target, saved } : g)));
    } else {
      setGoals((prev) => [...prev, { id: Date.now(), name, target, saved, history: [] }]);
    }
    cancelGoalDraft();
  }
  function deleteGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }
  function addGoalContribution(goalId, amountStr, type) {
    const amt = parseFloat(amountStr);
    if (!amt || amt <= 0) return;
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const delta = type === "withdraw" ? -amt : amt;
        const newSaved = Math.max(0, (Number(g.saved) || 0) + delta);
        const entry = { id: Date.now(), amount: amt, type, date: todayStr() };
        const history = [entry, ...(g.history || [])].slice(0, 8);
        return { ...g, saved: newSaved, history };
      })
    );
    setContributionDrafts((prev) => ({ ...prev, [goalId]: { ...(prev[goalId] || { type: "deposit" }), amount: "" } }));
  }

  function handleReconcile(acc) {
    const actual = parseFloat(reconcileDraft[acc]);
    if (isNaN(actual)) return;
    const current = acc === "bank" ? bankBalance : cashBalance;
    const diff = actual - current;
    if (Math.abs(diff) >= 0.005) {
      const newTx = {
        id: Date.now(), type: diff > 0 ? "income" : "expense", account: acc, amount: Math.abs(diff),
        category: diff > 0 ? "other_income" : "other_expense", note: "ปรับยอดให้ตรงกับยอดจริง",
        date: todayStr(), addedBy: profile.name || "",
      };
      setTransactions((prev) => [newTx, ...prev]);
    }
    setReconcileDraft((prev) => ({ ...prev, [acc]: "" }));
  }

  function handleSlipFiles(fileList) {
    const files = Array.from(fileList || []);
    files.forEach((file) => {
      const id = Date.now() + Math.random();
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const base64Data = String(dataUrl).split(",")[1];
        const mediaType = file.type || "image/jpeg";

        setPendingSlips((prev) => [
          { id, imageData: dataUrl, amount: "", date: todayStr(), note: "", type: "expense", category: EXPENSE_CATEGORIES[0].key, status: "reading" },
          ...prev,
        ]);

        try {
          const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data, mediaType }),
          });
          const parsed = await res.json();
          setPendingSlips((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    amount: parsed.amount != null ? String(parsed.amount) : "",
                    date: parsed.date || todayStr(),
                    note: parsed.note || "",
                    status: parsed.amount != null ? "ready" : "manual",
                  }
                : s
            )
          );
        } catch (e) {
          setPendingSlips((prev) => prev.map((s) => (s.id === id ? { ...s, status: "manual" } : s)));
        }
      };
      reader.readAsDataURL(file);
    });
  }
  function updateSlip(id, patch) {
    setPendingSlips((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function confirmSlip(id) {
    const slip = pendingSlips.find((s) => s.id === id);
    if (!slip) return;
    const amt = parseFloat(slip.amount);
    if (!amt || amt <= 0) return;
    const newTx = {
      id: Date.now(), type: slip.type, account: "bank", amount: amt, category: slip.category,
      note: (slip.note || "").trim(), date: slip.date || todayStr(), addedBy: profile.name || "",
    };
    setTransactions((prev) => [newTx, ...prev]);
    setPendingSlips((prev) => prev.filter((s) => s.id !== id));
  }
  function discardSlip(id) {
    setPendingSlips((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAddDebt(e) {
    e.preventDefault();
    const amt = parseFloat(debtForm.amount);
    if (!amt || amt <= 0) return;
    const newDebt = {
      id: Date.now(), kind: debtForm.kind, description: debtForm.description.trim(), amount: amt,
      counterparty: debtForm.counterparty.trim(), dueDate: debtForm.dueDate || "", status: "unpaid",
      dateAdded: todayStr(), addedBy: profile.name || "",
    };
    setDebts((prev) => [newDebt, ...prev]);
    setDebtForm({ kind: debtForm.kind, description: "", amount: "", counterparty: "", dueDate: "" });
  }
  function toggleDebtStatus(id) {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, status: d.status === "paid" ? "unpaid" : "paid" } : d)));
  }
  function deleteDebt(id) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }
  function startEditDebt(d) {
    setEditingDebtId(d.id);
    setDebtEditDraft({ ...d });
  }
  function saveDebtEdit() {
    const amt = parseFloat(debtEditDraft.amount);
    if (!amt || amt <= 0) return;
    setDebts((prev) => prev.map((d) => (d.id === editingDebtId ? { ...debtEditDraft, amount: amt } : d)));
    setEditingDebtId(null);
    setDebtEditDraft(null);
  }
  function cancelDebtEdit() {
    setEditingDebtId(null);
    setDebtEditDraft(null);
  }

  function handleAddBudgetSet(e) {
    e.preventDefault();
    const amt = parseFloat(budgetSetForm.monthlyAmount);
    if (!amt || amt <= 0 || !budgetSetForm.name.trim()) return;
    setBudgetSets((prev) => [...prev, { id: Date.now(), name: budgetSetForm.name.trim(), monthlyAmount: amt, spentThisMonth: 0 }]);
    setBudgetSetForm({ name: "", monthlyAmount: "" });
  }
  function startEditBudgetSet(s) {
    setEditingBudgetSetId(s.id);
    setBudgetSetDraft({ name: s.name, monthlyAmount: s.monthlyAmount });
  }
  function saveBudgetSetEdit() {
    const amt = parseFloat(budgetSetDraft.monthlyAmount);
    if (!amt || amt <= 0) return;
    setBudgetSets((prev) => prev.map((s) => (s.id === editingBudgetSetId ? { ...s, name: budgetSetDraft.name.trim() || s.name, monthlyAmount: amt } : s)));
    setEditingBudgetSetId(null);
    setBudgetSetDraft(null);
  }
  function cancelBudgetSetEdit() {
    setEditingBudgetSetId(null);
    setBudgetSetDraft(null);
  }
  function deleteBudgetSet(id) {
    setBudgetSets((prev) => prev.filter((s) => s.id !== id));
  }
  function quickSpend(id) {
    const amt = parseFloat(quickSpendDraft[id]);
    if (!amt || amt <= 0) return;
    setBudgetSets((prev) => prev.map((s) => (s.id === id ? { ...s, spentThisMonth: (Number(s.spentThisMonth) || 0) + amt } : s)));
    setQuickSpendDraft((prev) => ({ ...prev, [id]: "" }));
  }
  function resetBudgetSet(id) {
    setBudgetSets((prev) => prev.map((s) => (s.id === id ? { ...s, spentThisMonth: 0 } : s)));
  }

  return (
    <div className="bp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@500;600&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

        .bp-root {
          --bg: #F3F2ED; --surface: #FFFFFF; --ink: #1B211E; --ink-soft: #63695F; --ink-faint: #9A9C90;
          --line: #E4E1D6; --income: #2F6F5E; --income-bg: #E7F0EC; --expense: #A6303B; --expense-bg: #F7E9E8;
          --gold: #B08830; --gold-bg: #F3ECDA; --radius: 14px;
          font-family: 'Noto Sans Thai', sans-serif; background: var(--bg); color: var(--ink);
          min-height: 100%; padding: 20px 14px 40px; box-sizing: border-box; max-width: 980px; margin: 0 auto;
          position: relative;
        }
        .bp-root * { box-sizing: border-box; }

        .bp-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
        .bp-title { font-family: 'Noto Serif Thai', serif; font-weight: 600; font-size: 20px; margin: 0; letter-spacing: 0.01em; }
        .bp-header-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .bp-scope-btn {
          display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface);
          border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft);
          cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; flex-shrink: 0; white-space: nowrap;
        }
        .bp-scope-btn.shared { color: var(--income); border-color: var(--income-bg); background: var(--income-bg); }
        .bp-scope-note { font-size: 12px; color: var(--ink-soft); margin: 8px 0 0; line-height: 1.5; }
        .bp-link-row { display: flex; gap: 16px; margin: 8px 0 16px; }
        .bp-policy-link { border: none; background: none; color: var(--ink-faint); font-size: 11.5px; text-decoration: underline; cursor: pointer; padding: 0; font-family: 'Noto Sans Thai', sans-serif; }

        .bp-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; margin-bottom: 14px; }
        .bp-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .bp-admin-card { border: 1.5px solid var(--gold); background: var(--gold-bg); }
        .bp-admin-note { font-size: 12px; color: var(--ink-soft); line-height: 1.5; margin: 0 0 12px; }
        .bp-admin-row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 7px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .bp-admin-row:last-child { border-bottom: none; }

        .bp-hero { background: var(--ink); color: #F3F2ED; border: none; box-shadow: 0 8px 24px -12px rgba(27, 33, 30, 0.45); }
        .bp-hero-label { font-size: 13px; color: #C7CBC2; margin: 0 0 6px; }
        .bp-hero-balance { font-family: 'Noto Serif Thai', serif; font-weight: 600; font-size: 36px; line-height: 1.1; margin: 0 0 14px; font-variant-numeric: tabular-nums; }
        .bp-hero-balance small { font-family: 'Noto Sans Thai', sans-serif; font-size: 15px; font-weight: 400; color: #C7CBC2; margin-left: 6px; }
        .bp-hero-row { display: flex; flex-wrap: wrap; gap: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.14); }
        .bp-hero-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #E4E5DF; }
        .bp-hero-stat b { font-variant-numeric: tabular-nums; font-weight: 600; }
        .bp-hero-stat.in b { color: #8FD3B8; }
        .bp-hero-stat.out b { color: #E6A199; }
        .bp-hero-accounts { display: flex; gap: 16px; margin-top: 10px; font-size: 12.5px; color: #C7CBC2; }
        .bp-hero-accounts b { color: #F3F2ED; font-variant-numeric: tabular-nums; }

        .bp-profile-row { display: flex; align-items: center; gap: 14px; }
        .bp-avatar-wrap { position: relative; width: 56px; height: 56px; border-radius: 50%; cursor: pointer; flex-shrink: 0; }
        .bp-avatar-img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 1px solid var(--line); }
        .bp-avatar-placeholder { width: 56px; height: 56px; border-radius: 50%; background: var(--bg); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-family: 'Noto Serif Thai', serif; font-size: 20px; color: var(--ink-soft); text-transform: uppercase; }
        .bp-avatar-edit-badge { position: absolute; bottom: -2px; right: -2px; background: var(--ink); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--surface); }

        .bp-grid { display: block; }
        @media (min-width: 760px) { .bp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; } }

        .bp-section-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--ink); }

        .bp-goal-item { padding: 10px 0; border-bottom: 1px solid var(--line); }
        .bp-goal-item:last-of-type { border-bottom: none; }
        .bp-goal-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; gap: 8px; }
        .bp-goal-name { font-size: 14px; font-weight: 600; }
        .bp-goal-item-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .bp-goal-track { height: 10px; background: var(--gold-bg); border-radius: 999px; overflow: hidden; }
        .bp-goal-fill { height: 100%; background: var(--gold); border-radius: 999px; transition: width 0.4s ease; }
        .bp-goal-pct { margin: 8px 0 0; font-size: 12px; color: var(--ink-soft); }
        .bp-goal-form { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 10px; }
        .bp-goal-form input { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-family: 'Noto Sans Thai', sans-serif; font-size: 14px; background: var(--bg); width: 100%; }
        .bp-goal-actions { display: flex; gap: 8px; margin-top: 2px; }
        .bp-add-goal-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; border: 1px dashed var(--line); background: var(--bg); border-radius: 10px; padding: 10px; font-size: 13.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; margin-top: 8px; font-family: 'Noto Sans Thai', sans-serif; }

        .bp-contrib-row { display: flex; gap: 6px; margin-top: 8px; align-items: center; flex-wrap: wrap; }
        .bp-contrib-type { border: 1px solid var(--line); background: var(--surface); border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 600; color: var(--ink-soft); cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; }
        .bp-contrib-type.active.deposit { background: var(--income-bg); color: var(--income); border-color: var(--income-bg); }
        .bp-contrib-type.active.withdraw { background: var(--expense-bg); color: var(--expense); border-color: var(--expense-bg); }
        .bp-contrib-row input { flex: 1; min-width: 90px; border: 1px solid var(--line); border-radius: 7px; padding: 6px 8px; font-size: 13px; font-family: 'Noto Sans Thai', sans-serif; }
        .bp-contrib-add { border: none; background: var(--ink); color: #fff; border-radius: 7px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; }
        .bp-goal-history { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .bp-goal-hist-item { font-size: 11px; color: var(--ink-soft); background: var(--bg); border-radius: 6px; padding: 3px 7px; }
        .bp-goal-hist-item.withdraw { color: var(--expense); }
        .bp-goal-hist-item.deposit { color: var(--income); }

        .bp-budgetset-stats { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--ink-soft); margin: 8px 0 4px; }
        .bp-budgetset-stats b { font-variant-numeric: tabular-nums; color: var(--ink); }

        .bp-reconcile-row { padding: 10px 0; border-bottom: 1px solid var(--line); }
        .bp-reconcile-row:last-child { border-bottom: none; }
        .bp-reconcile-label { font-size: 13.5px; font-weight: 600; margin-bottom: 2px; }
        .bp-reconcile-current { font-size: 12px; color: var(--ink-soft); margin-bottom: 8px; font-variant-numeric: tabular-nums; }
        .bp-reconcile-input-row { display: flex; gap: 8px; }
        .bp-reconcile-input-row input { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-family: 'Noto Sans Thai', sans-serif; font-size: 14px; font-variant-numeric: tabular-nums; }
        .bp-reconcile-input-row button { border: none; background: var(--ink); color: #fff; border-radius: 8px; padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; }

        .bp-type-toggle { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; margin-bottom: 10px; }
        .bp-type-btn { flex: 1; border: none; background: transparent; padding: 9px 0; border-radius: 8px; font-family: 'Noto Sans Thai', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--ink-soft); transition: background 0.15s, color 0.15s; }
        .bp-type-btn.active.expense { background: var(--expense-bg); color: var(--expense); }
        .bp-type-btn.active.income { background: var(--income-bg); color: var(--income); }

        .bp-account-toggle { display: flex; gap: 8px; margin-bottom: 14px; }
        .bp-account-btn { flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 7px 0; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink-soft); font-family: 'Noto Sans Thai', sans-serif; }
        .bp-account-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); }

        .bp-form-grid { display: flex; flex-direction: column; gap: 10px; }
        .bp-field-label { font-size: 12px; color: var(--ink-soft); margin-bottom: 4px; display: block; }
        .bp-input, .bp-select { width: 100%; border: 1px solid var(--line); border-radius: 9px; padding: 10px 11px; font-family: 'Noto Sans Thai', sans-serif; font-size: 15px; background: var(--surface); color: var(--ink); }
        .bp-input:focus, .bp-select:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
        .bp-amount-input { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 18px; }
        .bp-row-2 { display: flex; gap: 10px; }
        .bp-row-2 > div { flex: 1; }

        .bp-add-btn { margin-top: 4px; border: none; border-radius: 10px; padding: 12px; font-family: 'Noto Sans Thai', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; color: #fff; transition: opacity 0.15s; }
        .bp-add-btn.expense { background: var(--expense); }
        .bp-add-btn.income { background: var(--income); }
        .bp-add-btn:hover { opacity: 0.9; }
        .bp-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .bp-cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .bp-cat-row:last-child { margin-bottom: 0; }
        .bp-cat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .bp-cat-label { font-size: 13px; width: 78px; flex-shrink: 0; }
        .bp-cat-bar-track { flex: 1; height: 8px; background: var(--bg); border-radius: 999px; overflow: hidden; }
        .bp-cat-bar-fill { height: 100%; border-radius: 999px; }
        .bp-cat-amt { font-size: 12.5px; color: var(--ink-soft); width: 66px; text-align: right; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .bp-empty { font-size: 13px; color: var(--ink-faint); padding: 6px 0; }

        .bp-debt-stats { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .bp-debt-stat { flex: 1; min-width: 140px; border-radius: 10px; padding: 10px 12px; }
        .bp-debt-stat.expense { background: var(--expense-bg); }
        .bp-debt-stat.income { background: var(--income-bg); }
        .bp-debt-stat span { display: block; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 2px; }
        .bp-debt-stat b { font-size: 16px; font-variant-numeric: tabular-nums; }
        .bp-debt-stat.expense b { color: var(--expense); }
        .bp-debt-stat.income b { color: var(--income); }
        .bp-overdue-badge { margin-left: 6px; color: #fff; background: var(--expense); font-size: 10px; padding: 1px 6px; border-radius: 999px; }

        .bp-tx-list { display: flex; flex-direction: column; }
        @media (min-width: 760px) { .bp-tx-list.bp-tx-cols { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; } }
        .bp-tx-item { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--line); }
        .bp-tx-item:last-child { border-bottom: none; }
        .bp-tx-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .bp-tx-main { flex: 1; min-width: 0; }
        .bp-tx-cat { font-size: 14px; font-weight: 600; }
        .bp-tx-note { font-size: 12.5px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bp-tx-date { font-size: 11.5px; color: var(--ink-faint); margin-top: 1px; }
        .bp-tx-amt { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; flex-shrink: 0; white-space: nowrap; }
        .bp-tx-amt.income { color: var(--income); }
        .bp-tx-amt.expense { color: var(--expense); }
        .bp-tx-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .bp-icon-btn { border: none; background: none; cursor: pointer; padding: 6px; border-radius: 7px; color: var(--ink-faint); display: flex; align-items: center; justify-content: center; }
        .bp-icon-btn:hover { background: var(--bg); color: var(--ink); }

        .bp-edit-row { display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 6px 0; }
        .bp-edit-line { display: flex; gap: 8px; }
        .bp-edit-line input, .bp-edit-line select { border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font-size: 13.5px; font-family: 'Noto Sans Thai', sans-serif; flex: 1; min-width: 0; }
        .bp-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }

        .bp-save-note { font-size: 11px; color: var(--ink-faint); text-align: center; margin-top: 4px; }

        .bp-slip-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 22px 12px; border: 1.5px dashed var(--line); border-radius: 12px; cursor: pointer; text-align: center; background: var(--bg); transition: border-color 0.15s; }
        .bp-slip-drop:hover { border-color: var(--ink-faint); }
        .bp-slip-drop span.bp-slip-cta { font-size: 14px; font-weight: 600; color: var(--ink); }
        .bp-slip-drop span.bp-slip-sub { font-size: 12px; color: var(--ink-soft); }
        .bp-slip-hint { font-size: 11.5px; color: var(--ink-faint); margin: 10px 2px 0; line-height: 1.5; }

        .bp-slip-card { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .bp-slip-card:last-child { border-bottom: none; }
        .bp-slip-thumb { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--line); }
        .bp-slip-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .bp-slip-status { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-soft); }
        .bp-slip-fields { display: flex; flex-direction: column; gap: 6px; }
        .bp-slip-line { display: flex; gap: 6px; }
        .bp-slip-line input, .bp-slip-line select { border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font-size: 13.5px; font-family: 'Noto Sans Thai', sans-serif; flex: 1; min-width: 0; }
        .bp-slip-type-toggle { display: flex; gap: 6px; }
        .bp-slip-type-btn { flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 6px 0; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink-soft); }
        .bp-slip-type-btn.active.expense { background: var(--expense-bg); color: var(--expense); border-color: var(--expense-bg); }
        .bp-slip-type-btn.active.income { background: var(--income-bg); color: var(--income); border-color: var(--income-bg); }
        .bp-slip-actions { display: flex; gap: 6px; }
        .bp-slip-confirm { flex: 1; border: none; background: var(--ink); color: #fff; border-radius: 8px; padding: 8px 0; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .bp-slip-confirm:disabled { opacity: 0.35; cursor: not-allowed; }
        .bp-slip-discard { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--ink-soft); cursor: pointer; }
        .bp-spin { animation: bp-spin 0.9s linear infinite; }
        @keyframes bp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .bp-modal-overlay { position: fixed; inset: 0; background: rgba(27,33,30,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .bp-modal-card { background: var(--surface); border-radius: 16px; padding: 22px; max-width: 420px; width: 100%; max-height: 85vh; overflow-y: auto; }
        .bp-modal-title { font-family: 'Noto Serif Thai', serif; font-size: 18px; font-weight: 600; margin: 0 0 12px; }
        .bp-modal-body { font-size: 13.5px; color: var(--ink-soft); line-height: 1.6; margin-bottom: 16px; }
        .bp-modal-body ul { padding-left: 18px; margin: 8px 0; }
        .bp-modal-body li { margin-bottom: 4px; }
      `}</style>

      {activeAnnouncement && (
        <div className="bp-modal-overlay" style={{ zIndex: 300 }}>
          <div className="bp-modal-card" style={{ border: "2px solid var(--gold)" }}>
            <h3 className="bp-modal-title">📢 ประกาศสำคัญจากผู้ดูแลระบบ</h3>
            <div className="bp-modal-body" style={{ background: "var(--gold-bg)", padding: 12, borderRadius: 10 }}>{activeAnnouncement.text}</div>
            <p style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 12 }}>ส่งเมื่อ: {activeAnnouncement.time}</p>
            {canCloseAnnouncement ? (
              <button className="bp-add-btn income" onClick={() => { localStorage.setItem("bp_closedAnnouncementId", activeAnnouncement.id); setActiveAnnouncement(null); }}>✕ ปิดประกาศนี้</button>
            ) : (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", padding: 10 }}>⏳ กรุณารอสักครู่ (สามารถปิดได้ใน 3 วินาที)...</div>
            )}
          </div>
        </div>
      )}

      {!consentGiven && consentChecked && (
        <div className="bp-modal-overlay">
          <div className="bp-modal-card">
            <h2 className="bp-modal-title">การเก็บข้อมูลของคุณ</h2>
            <div className="bp-modal-body">
              <p>แอปนี้จะเก็บข้อมูลรายรับ-รายจ่าย เป้าหมาย และชื่อโปรไฟล์ของคุณ</p>
            </div>
            <button className="bp-add-btn income" style={{ width: "100%" }} onClick={handleAcceptConsent}>ยอมรับและเข้าใช้งาน</button>
          </div>
        </div>
      )}

      <div className="bp-header-row">
        <h1 className="bp-title">งบประมาณของฉัน</h1>
        <div className="bp-header-btns">
          <button className={`bp-scope-btn ${showAdminView ? "shared" : ""}`} onClick={() => setShowAdminView((v) => !v)}>
            ผู้ดูแลระบบ
          </button>
          <button className={`bp-scope-btn ${dataScope === "shared" ? "shared" : ""}`} onClick={() => switchScope(dataScope === "shared" ? "private" : "shared")}>
            {dataScope === "shared" ? "ใช้ร่วมกัน" : "ส่วนตัว"}
          </button>
        </div>
      </div>
      {dataScope === "shared" && (
        <p className="bp-scope-note" style={{ marginBottom: 14 }}>
          โหมดนี้เปิดอยู่: ทุกคนที่เปิดหน้านี้ร่วมกันจะเห็นข้อมูลชุดเดียวกัน
        </p>
      )}

      {showAdminView && (
        <div className="bp-card bp-admin-card">
          <div className="bp-card-head"><span className="bp-section-title">ระบบหลังบ้านผู้ดูแลระบบ (Firebase Cloud Dashboard)</span></div>
          <p className="bp-admin-note">จัดการระบบ ประกาศแจ้งเตือน และดูรายชื่อผู้ใช้งานออนไลน์แบบ Real-time</p>

          <div style={{ background: "#fff", padding: 12, borderRadius: 12, marginBottom: 14, border: "1px solid var(--line)" }}>
            <p className="bp-section-title" style={{ marginBottom: 8 }}>ส่งข้อความประกาศแจ้งเตือน (เด้งเฉพาะผู้ที่ออนไลน์อยู่)</p>
            <textarea rows="2" placeholder="พิมพ์ข้อความประกาศ..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="bp-input" style={{ marginBottom: 8, fontSize: 13 }} />
            <button className="bp-add-btn income" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => handleSendAnnouncementFromAdmin(announcementText)}>🚀 ส่งประกาศเด้งเฉพาะคนออนไลน์</button>
          </div>

          <p className="bp-section-title" style={{ marginBottom: 8 }}>รายชื่อผู้ใช้งานออนไลน์ ({onlineUsers.length} คน)</p>
          {onlineUsers.length === 0 ? (
            <p className="bp-empty">ยังไม่มีข้อมูลผู้ใช้งานซิงก์เข้ามา</p>
          ) : (
            onlineUsers.map((u) => {
              const statusInfo = formatUserStatus(u.lastActive);
              return (
                <div className="bp-admin-row" key={u.id}>
                  <div>
                    <b>{u.userName || "ไม่ระบุชื่อ"}</b>
                    <div style={{ fontSize: 11, color: statusInfo.isOnline ? "var(--income)" : "var(--ink-faint)" }}>{statusInfo.text}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>คงเหลือ</div>
                    <div style={{ fontWeight: 700, color: "var(--income)" }}>{formatMoney(u.balance)} บ.</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="bp-card">
        <div className="bp-card-head"><span className="bp-section-title">โปรไฟล์</span></div>
        <div className="bp-profile-row">
          <div className="bp-avatar-wrap" onClick={() => avatarInputRef.current && avatarInputRef.current.click()}>
            {profile.avatar ? (<img src={profile.avatar} className="bp-avatar-img" alt="รูปโปรไฟล์" />) : (<div className="bp-avatar-placeholder">{(profile.name || "?").slice(0, 1)}</div>)}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
          <div style={{ flex: 1 }}>
            <label className="bp-field-label">ชื่อที่แสดง</label>
            <input className="bp-input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="เช่น Gun" />
          </div>
        </div>
      </div>

      <div className="bp-card bp-hero">
        <p className="bp-hero-label">คงเหลือทั้งหมด</p>
        <p className="bp-hero-balance">{formatMoney(balance)}<small>บาท</small></p>
        <div className="bp-hero-row">
          <div className="bp-hero-stat in">รายรับ <b>{formatMoney(totalIncome)}</b></div>
          <div className="bp-hero-stat out">รายจ่าย <b>{formatMoney(totalExpense)}</b></div>
        </div>
        <div className="bp-hero-accounts">
          <span>ธนาคาร <b>{formatMoney(bankBalance)}</b> บาท</span>
          <span>เงินสด <b>{formatMoney(cashBalance)}</b> บาท</span>
        </div>
      </div>

      <div className="bp-card">
        <div className="bp-card-head"><span className="bp-section-title">จัดสรรงบประมาณเป็นเซ็ต</span></div>
        {budgetSets.length === 0 && <p className="bp-empty">ยังไม่มีเซ็ตงบประมาณ เพิ่มเซ็ตแรกได้เลย</p>}
        {budgetSets.map((s) => {
          if (editingBudgetSetId === s.id) {
            return (
              <div className="bp-goal-form" key={s.id}>
                <div><label className="bp-field-label">ชื่อเซ็ต</label><input value={budgetSetDraft.name} onChange={(e) => setBudgetSetDraft({ ...budgetSetDraft, name: e.target.value })} /></div>
                <div><label className="bp-field-label">วงเงินต่อเดือน (บาท)</label><input type="number" value={budgetSetDraft.monthlyAmount} onChange={(e) => setBudgetSetDraft({ ...budgetSetDraft, monthlyAmount: e.target.value })} /></div>
                <div className="bp-goal-actions">
                  <button className="bp-add-btn income" style={{ flex: 1, padding: "9px" }} onClick={saveBudgetSetEdit}>บันทึก</button>
                  <button className="bp-slip-discard" onClick={cancelBudgetSetEdit}>ยกเลิก</button>
                </div>
              </div>
            );
          }
          const stats = budgetSetStats(s);
          const pct = s.monthlyAmount > 0 ? Math.min((s.spentThisMonth / s.monthlyAmount) * 100, 100) : 0;
          return (
            <div className="bp-goal-item" key={s.id}>
              <div className="bp-goal-row">
                <span className="bp-goal-name">{s.name}</span>
                <div className="bp-goal-item-actions">
                  <button className="bp-icon-btn" onClick={() => startEditBudgetSet(s)}>แก้ไข</button>
                  <button className="bp-icon-btn" onClick={() => deleteBudgetSet(s.id)}>ลบ</button>
                </div>
              </div>
              <div className="bp-goal-track"><div className="bp-goal-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--expense)" : "var(--gold)" }} /></div>
              <p className="bp-goal-pct">ใช้ไปแล้ว {formatMoney(s.spentThisMonth)} จาก {formatMoney(s.monthlyAmount)} บาท/เดือน</p>
              <div className="bp-budgetset-stats">
                <span>งบต่อวัน <b>{formatMoney(stats.dailyPlanned)}</b> บาท</span>
                <span>เหลือใช้เฉลี่ย <b style={{ color: stats.dailyRemaining < 0 ? "var(--expense)" : "var(--income)" }}>{formatMoney(stats.dailyRemaining)}</b> บาท/วัน</span>
              </div>
              <div className="bp-contrib-row">
                <input type="number" placeholder="ใช้ไปเท่าไหร่" value={quickSpendDraft[s.id] || ""} onChange={(e) => setQuickSpendDraft((prev) => ({ ...prev, [s.id]: e.target.value }))} />
                <button type="button" className="bp-contrib-add" onClick={() => quickSpend(s.id)}>ใช้ไป</button>
                <button type="button" className="bp-slip-discard" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => resetBudgetSet(s.id)}>รีเซ็ต</button>
              </div>
            </div>
          );
        })}
        <form className="bp-form-grid" onSubmit={handleAddBudgetSet} style={{ marginTop: budgetSets.length ? 14 : 0 }}>
          <div className="bp-row-2">
            <div><label className="bp-field-label">ชื่อเซ็ตใหม่</label><input className="bp-input" value={budgetSetForm.name} onChange={(e) => setBudgetSetForm({ ...budgetSetForm, name: e.target.value })} placeholder="เช่น เซ็ตค่ากิน" /></div>
            <div><label className="bp-field-label">วงเงิน/เดือน (บาท)</label><input className="bp-input" type="number" value={budgetSetForm.monthlyAmount} onChange={(e) => setBudgetSetForm({ ...budgetSetForm, monthlyAmount: e.target.value })} /></div>
          </div>
          <button className="bp-add-btn income" type="submit">เพิ่มเซ็ตงบประมาณ</button>
        </form>
      </div>

      <div className="bp-grid">
        <div>
          <div className="bp-card">
            <div className="bp-card-head"><span className="bp-section-title">เป้าหมายการออม</span></div>
            {goals.length === 0 && !addingGoal && <p className="bp-empty">ยังไม่มีเป้าหมาย</p>}
            {goals.map((g) =>
              editingGoalId === g.id ? (
                <div className="bp-goal-form" key={g.id}>
                  <div><label className="bp-field-label">ชื่อเป้าหมาย</label><input value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} /></div>
                  <div className="bp-row-2">
                    <div><label className="bp-field-label">เป้าหมาย (บาท)</label><input type="number" value={goalDraft.target} onChange={(e) => setGoalDraft({ ...goalDraft, target: e.target.value })} /></div>
                    <div><label className="bp-field-label">ออมแล้ว (บาท)</label><input type="number" value={goalDraft.saved} onChange={(e) => setGoalDraft({ ...goalDraft, saved: e.target.value })} /></div>
                  </div>
                  <div className="bp-goal-actions">
                    <button className="bp-add-btn income" style={{ flex: 1, padding: "9px" }} onClick={saveGoalDraft}>บันทึก</button>
                    <button className="bp-slip-discard" onClick={cancelGoalDraft}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div className="bp-goal-item" key={g.id}>
                  <div className="bp-goal-row">
                    <span className="bp-goal-name">{g.name}</span>
                    <div className="bp-goal-item-actions">
                      <button className="bp-icon-btn" onClick={() => startEditGoal(g)}>แก้ไข</button>
                      <button className="bp-icon-btn" onClick={() => deleteGoal(g.id)}>ลบ</button>
                    </div>
                  </div>
                  <div className="bp-goal-track"><div className="bp-goal-fill" style={{ width: `${g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0}%` }} /></div>
                  <p className="bp-goal-pct">{formatMoney(g.saved)} บาท จาก {formatMoney(g.target)} บาท</p>
                  <div className="bp-contrib-row">
                    <button type="button" className={`bp-contrib-type ${(contributionDrafts[g.id]?.type || "deposit") === "deposit" ? "active deposit" : ""}`} onClick={() => setContributionDrafts((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] || { amount: "" }), type: "deposit" } }))}>ฝาก</button>
                    <button type="button" className={`bp-contrib-type ${contributionDrafts[g.id]?.type === "withdraw" ? "active withdraw" : ""}`} onClick={() => setContributionDrafts((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] || { amount: "" }), type: "withdraw" } }))}>ถอน</button>
                    <input type="number" placeholder="จำนวนเงิน" value={contributionDrafts[g.id]?.amount || ""} onChange={(e) => setContributionDrafts((prev) => ({ ...prev, [g.id]: { ...(prev[g.id] || { type: "deposit" }), amount: e.target.value } }))} />
                    <button type="button" className="bp-contrib-add" onClick={() => addGoalContribution(g.id, contributionDrafts[g.id]?.amount, contributionDrafts[g.id]?.type || "deposit")}>เพิ่ม</button>
                  </div>
                </div>
              )
            )}
            {addingGoal ? (
              <div className="bp-goal-form">
                <div><label className="bp-field-label">ชื่อเป้าหมาย</label><input value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} /></div>
                <div className="bp-row-2">
                  <div><label className="bp-field-label">เป้าหมาย (บาท)</label><input type="number" value={goalDraft.target} onChange={(e) => setGoalDraft({ ...goalDraft, target: e.target.value })} /></div>
                  <div><label className="bp-field-label">ออมแล้ว (บาท)</label><input type="number" value={goalDraft.saved} onChange={(e) => setGoalDraft({ ...goalDraft, saved: e.target.value })} /></div>
                </div>
                <div className="bp-goal-actions">
                  <button className="bp-add-btn income" style={{ flex: 1, padding: "9px" }} onClick={saveGoalDraft}>บันทึก</button>
                  <button className="bp-slip-discard" onClick={cancelGoalDraft}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <button className="bp-add-goal-btn" onClick={startAddGoal}>+ เพิ่มเป้าหมายใหม่</button>
            )}
          </div>

          <div className="bp-card">
            <div className="bp-card-head"><span className="bp-section-title">ปรับยอดให้ตรงกับบัญชีจริง</span></div>
            {ACCOUNTS.map((a) => (
              <div className="bp-reconcile-row" key={a.key}>
                <div className="bp-reconcile-label">{a.label}</div>
                <div className="bp-reconcile-current">ในระบบตอนนี้: {formatMoney(a.key === "bank" ? bankBalance : cashBalance)} บาท</div>
                <div className="bp-reconcile-input-row">
                  <input type="number" placeholder="ยอดจริงที่มี" value={reconcileDraft[a.key]} onChange={(e) => setReconcileDraft({ ...reconcileDraft, [a.key]: e.target.value })} />
                  <button onClick={() => handleReconcile(a.key)}>ปรับยอด</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="bp-card">
            <p className="bp-section-title" style={{ marginBottom: 12 }}>นำเข้าจากสลิปโอนเงิน</p>
            <input ref={slipInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleSlipFiles(e.target.files); e.target.value = ""; }} />
            <div className="bp-slip-drop" onClick={() => slipInputRef.current && slipInputRef.current.click()}>
              <span className="bp-slip-cta">เลือกรูปสลิป</span>
              <span className="bp-slip-sub">เลือกได้หลายรูปพร้อมกัน</span>
            </div>
            {pendingSlips.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {pendingSlips.map((s) => {
                  const opts = s.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
                  return (
                    <div className="bp-slip-card" key={s.id}>
                      <img className="bp-slip-thumb" src={s.imageData} alt="สลิปโอนเงิน" />
                      <div className="bp-slip-body">
                        {s.status === "reading" ? (
                          <div className="bp-slip-status">กำลังอ่านยอดเงินจากรูป...</div>
                        ) : (
                          <>
                            {s.status === "manual" && <div className="bp-slip-status">อ่านยอดจากรูปไม่ได้ กรุณากรอกเอง</div>}
                            <div className="bp-slip-type-toggle">
                              <button type="button" className={`bp-slip-type-btn expense ${s.type === "expense" ? "active expense" : ""}`} onClick={() => updateSlip(s.id, { type: "expense", category: EXPENSE_CATEGORIES[0].key })}>รายจ่าย</button>
                              <button type="button" className={`bp-slip-type-btn income ${s.type === "income" ? "active income" : ""}`} onClick={() => updateSlip(s.id, { type: "income", category: INCOME_CATEGORIES[0].key })}>รายรับ</button>
                            </div>
                            <div className="bp-slip-fields">
                              <div className="bp-slip-line">
                                <input type="number" placeholder="จำนวนเงิน" value={s.amount} onChange={(e) => updateSlip(s.id, { amount: e.target.value })} />
                                <select value={s.category} onChange={(e) => updateSlip(s.id, { category: e.target.value })}>
                                  {opts.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                                </select>
                              </div>
                              <div className="bp-slip-line">
                                <input type="text" placeholder="รายละเอียด" value={s.note} onChange={(e) => updateSlip(s.id, { note: e.target.value })} />
                                <input type="date" value={s.date} onChange={(e) => updateSlip(s.id, { date: e.target.value })} />
                              </div>
                            </div>
                            <div className="bp-slip-actions">
                              <button className="bp-slip-confirm" disabled={!s.amount || parseFloat(s.amount) <= 0} onClick={() => confirmSlip(s.id)}>เพิ่มรายการนี้</button>
                              <button className="bp-slip-discard" onClick={() => discardSlip(s.id)}>ยกเลิก</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bp-card">
            <p className="bp-section-title" style={{ marginBottom: 12 }}>เพิ่มรายการ</p>
            <div className="bp-type-toggle">
              <button className={`bp-type-btn expense ${formType === "expense" ? "active expense" : ""}`} onClick={() => handleTypeSwitch("expense")} type="button">รายจ่าย</button>
              <button className={`bp-type-btn income ${formType === "income" ? "active income" : ""}`} onClick={() => handleTypeSwitch("income")} type="button">รายรับ</button>
            </div>
            <div className="bp-account-toggle">
              {ACCOUNTS.map((a) => (
                <button key={a.key} type="button" className={`bp-account-btn ${formAccount === a.key ? "active" : ""}`} onClick={() => setFormAccount(a.key)}>{a.label}</button>
              ))}
            </div>
            <form className="bp-form-grid" onSubmit={handleAdd}>
              <div><label className="bp-field-label">จำนวนเงิน (บาท)</label><input className="bp-input bp-amount-input" type="number" inputMode="decimal" placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} required /></div>
              <div className="bp-row-2">
                <div><label className="bp-field-label">หมวดหมู่</label>
                  <select className="bp-select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {currentCategoryOptions.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                  </select>
                </div>
                <div><label className="bp-field-label">วันที่</label><input className="bp-input" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} /></div>
              </div>
              <div><label className="bp-field-label">รายละเอียด (ไม่บังคับ)</label><input className="bp-input" type="text" placeholder="เช่น ข้าวเที่ยง" value={formNote} onChange={(e) => setFormNote(e.target.value)} /></div>
              <button className={`bp-add-btn ${formType}`} type="submit">เพิ่มรายการ</button>
            </form>
          </div>
        </div>
      </div>

      <div className="bp-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p className="bp-section-title">แชทซัพพอร์ต & AI ผู้ช่วย</p>
          <button className="bp-scope-btn" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "ซ่อนแชท" : "💬 เปิดแชท"}</button>
        </div>
        {chatOpen && (
          <div style={{ display: "flex", flexDirection: "column", height: 320, background: "var(--bg)", borderRadius: 12, padding: 12 }}>
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              {chatMessages.length === 0 ? (
                <p className="bp-empty" style={{ textAlign: "center", margin: "auto" }}>พิมพ์ข้อความสอบถามหรือปรึกษาการเงินได้เลยครับ</p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "admin" ? "flex-start" : "flex-end" }}>
                    <span style={{ fontSize: 10, color: "var(--ink-faint)", marginBottom: 2 }}>{msg.senderName} · {msg.time}</span>
                    <div style={{ padding: "8px 12px", borderRadius: 12, fontSize: 13, maxWidth: "85%", background: msg.sender === "admin" ? "#fff" : "var(--ink)", color: msg.sender === "admin" ? "var(--ink)" : "#fff", border: msg.sender === "admin" ? "1px solid var(--line)" : "none" }}>{msg.text}</div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendUserChat} style={{ display: "flex", gap: 6 }}>
              <input type="text" className="bp-input" style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} placeholder="พิมพ์ข้อความ..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} required />
              <button type="submit" className="bp-add-btn income" style={{ padding: "8px 14px", fontSize: 13, marginTop: 0 }}>ส่ง</button>
            </form>
          </div>
        )}
      </div>

      <div className="bp-card">
        <p className="bp-section-title" style={{ marginBottom: 12 }}>ใช้จ่ายตามหมวดหมู่</p>
        {categoryBreakdown.length === 0 ? (
          <p className="bp-empty">ยังไม่มีรายจ่าย</p>
        ) : (
          categoryBreakdown.map((c) => (
            <div className="bp-cat-row" key={c.key}>
              <span className="bp-cat-dot" style={{ background: c.color }} />
              <span className="bp-cat-label">{c.label}</span>
              <span className="bp-cat-bar-track"><span className="bp-cat-bar-fill" style={{ width: `${maxCategoryAmount ? (c.amount / maxCategoryAmount) * 100 : 0}%`, background: c.color }} /></span>
              <span className="bp-cat-amt">{formatMoney(c.amount)}</span>
            </div>
          ))
        )}
      </div>

      <div className="bp-card">
        <p className="bp-section-title" style={{ marginBottom: 12 }}>หนี้สินและรายการเบิก</p>
        <div className="bp-debt-stats">
          <div className="bp-debt-stat expense"><span>ติดหนี้ค้างอยู่</span><b>{formatMoney(totalDebtUnpaid)} บาท</b></div>
          <div className="bp-debt-stat income"><span>รอเบิกคืน</span><b>{formatMoney(totalClaimUnpaid)} บาท</b></div>
        </div>
        <div className="bp-type-toggle">
          <button type="button" className={`bp-type-btn expense ${debtForm.kind === "debt" ? "active expense" : ""}`} onClick={() => setDebtForm({ ...debtForm, kind: "debt" })}>หนี้ที่ติดอยู่</button>
          <button type="button" className={`bp-type-btn income ${debtForm.kind === "claim" ? "active income" : ""}`} onClick={() => setDebtForm({ ...debtForm, kind: "claim" })}>รายการเบิก</button>
        </div>
        <form className="bp-form-grid" onSubmit={handleAddDebt}>
          <div><label className="bp-field-label">รายละเอียด</label><input className="bp-input" value={debtForm.description} onChange={(e) => setDebtForm({ ...debtForm, description: e.target.value })} placeholder="เช่น ยืมเพื่อน" required /></div>
          <div className="bp-row-2">
            <div><label className="bp-field-label">จำนวนเงิน (บาท)</label><input className="bp-input bp-amount-input" type="number" value={debtForm.amount} onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })} required /></div>
            <div><label className="bp-field-label">กับใคร (ไม่บังคับ)</label><input className="bp-input" value={debtForm.counterparty} onChange={(e) => setDebtForm({ ...debtForm, counterparty: e.target.value })} /></div>
          </div>
          <button className={`bp-add-btn ${debtForm.kind === "debt" ? "expense" : "income"}`} type="submit">เพิ่มรายการ</button>
        </form>
        {sortedDebts.length > 0 && (
          <div className="bp-tx-list" style={{ marginTop: 14 }}>
            {sortedDebts.map((d) => (
              <div className="bp-tx-item" key={d.id}>
                <span className="bp-tx-dot" style={{ background: d.kind === "debt" ? "var(--expense)" : "var(--income)" }} />
                <div className="bp-tx-main">
                  <div className="bp-tx-cat">{d.description}</div>
                  <div className="bp-tx-note">{d.counterparty}{d.status === "paid" ? " · ชำระแล้ว" : ""}</div>
                </div>
                <span className={`bp-tx-amt ${d.kind === "debt" ? "expense" : "income"}`}>{formatMoney(d.amount)}</span>
                <div className="bp-tx-actions">
                  <button className="bp-icon-btn" onClick={() => toggleDebtStatus(d.id)}>✓</button>
                  <button className="bp-icon-btn" onClick={() => deleteDebt(d.id)}>ลบ</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bp-card">
        <p className="bp-section-title" style={{ marginBottom: 12 }}>รายการทั้งหมด ({transactions.length})</p>
        {sortedTransactions.length === 0 ? (
          <p className="bp-empty">ยังไม่มีรายการ</p>
        ) : (
          <div className="bp-tx-list bp-tx-cols">
            {sortedTransactions.map((t) => {
              const info = categoryInfo(t.category);
              const account = t.account === "cash" ? "cash" : "bank";
              if (editingId === t.id) {
                const opts = editDraft.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
                return (
                  <div className="bp-tx-item" key={t.id}>
                    <div className="bp-edit-row">
                      <div className="bp-edit-line">
                        <input type="number" value={editDraft.amount} onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })} />
                        <select value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}>
                          {opts.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                        </select>
                      </div>
                      <div className="bp-edit-actions">
                        <button className="bp-icon-btn" onClick={saveEdit}>บันทึก</button>
                        <button className="bp-icon-btn" onClick={cancelEdit}>ยกเลิก</button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bp-tx-item" key={t.id}>
                  <span className="bp-tx-dot" style={{ background: info.color }} />
                  <div className="bp-tx-main">
                    <div className="bp-tx-cat">{info.label}</div>
                    {t.note && <div className="bp-tx-note">{t.note}</div>}
                    <div className="bp-tx-date">{formatDateThai(t.date)}{account === "cash" ? ` · ${ACCOUNT_LABEL.cash}` : ""}</div>
                  </div>
                  <span className={`bp-tx-amt ${t.type}`}>{t.type === "income" ? "+" : "−"}{formatMoney(t.amount)}</span>
                  <div className="bp-tx-actions">
                    <button className="bp-icon-btn" onClick={() => startEdit(t)}>แก้ไข</button>
                    <button className="bp-icon-btn" onClick={() => deleteTx(t.id)}>ลบ</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {saveError && <p className="bp-save-note">บันทึกข้อมูลอัตโนมัติไม่สำเร็จ</p>}
    </div>
  );
}
