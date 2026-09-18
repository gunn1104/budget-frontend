const { useState, useEffect, useRef, useMemo } = React;

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

const API_BASE_URL = "https://budget-backend-o7fq.onrender.com";
const STORAGE_KEY = "budget-planner-data-compact-v1";

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

export default function BudgetPlanner() {
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Form Transaction
  const [formType, setFormType] = useState("expense");
  const [formAccount, setFormAccount] = useState("bank");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(todayStr());

  // Goals
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ name: "", target: "", saved: "0" });
  const [contributionDrafts, setContributionDrafts] = useState({});

  // Slips
  const [pendingSlips, setPendingSlips] = useState([]);
  const slipInputRef = useRef(null);

  // Debts
  const [debtForm, setDebtForm] = useState({ kind: "debt", description: "", amount: "", counterparty: "" });

  // Load & Save LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setGoals(parsed.goals || []);
        setDebts(parsed.debts || []);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, goals, debts }));
    } catch (e) {}
  }, [transactions, goals, debts, loaded]);

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
      note: formNote.trim(), date: formDate || todayStr(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    setFormAmount("");
    setFormNote("");
  }

  function deleteTx(id) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  // Goal handlers
  function saveGoal() {
    const target = parseFloat(goalDraft.target) || 0;
    const saved = parseFloat(goalDraft.saved) || 0;
    const name = goalDraft.name.trim() || "เป้าหมายการออม";
    setGoals((prev) => [...prev, { id: Date.now(), name, target, saved, history: [] }]);
    setAddingGoal(false);
    setGoalDraft({ name: "", target: "", saved: "0" });
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
        return { ...g, saved: newSaved, history: [entry, ...(g.history || [])].slice(0, 5) };
      })
    );
    setContributionDrafts((prev) => ({ ...prev, [goalId]: { type: "deposit", amount: "" } }));
  }

  // Slip handlers
  function handleSlipFiles(files) {
    Array.from(files || []).forEach((file) => {
      const id = Date.now() + Math.random();
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const base64Data = String(dataUrl).split(",")[1];
        setPendingSlips((prev) => [
          { id, imageData: dataUrl, amount: "", date: todayStr(), note: "", type: "expense", category: EXPENSE_CATEGORIES[0].key, status: "reading" },
          ...prev,
        ]);
        try {
          const res = await fetch(`${API_BASE_URL}/api/parse-slip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data, mediaType: file.type || "image/jpeg" }),
          });
          const parsed = await res.json();
          setPendingSlips((prev) =>
            prev.map((s) => (s.id === id ? {
              ...s,
              amount: parsed.amount != null ? String(parsed.amount) : "",
              date: parsed.date || todayStr(),
              note: parsed.note || "",
              status: parsed.amount != null ? "ready" : "manual",
            } : s))
          );
        } catch (e) {
          setPendingSlips((prev) => prev.map((s) => (s.id === id ? { ...s, status: "manual" } : s)));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function confirmSlip(id) {
    const slip = pendingSlips.find((s) => s.id === id);
    if (!slip) return;
    const amt = parseFloat(slip.amount);
    if (!amt || amt <= 0) return;
    setTransactions((prev) => [{
      id: Date.now(), type: slip.type, account: "bank", amount: amt, category: slip.category,
      note: (slip.note || "").trim(), date: slip.date || todayStr(),
    }, ...prev]);
    setPendingSlips((prev) => prev.filter((s) => s.id !== id));
  }

  // Debt handlers
  function handleAddDebt(e) {
    e.preventDefault();
    const amt = parseFloat(debtForm.amount);
    if (!amt || amt <= 0) return;
    setDebts((prev) => [{
      id: Date.now(), kind: debtForm.kind, description: debtForm.description.trim(), amount: amt,
      counterparty: debtForm.counterparty.trim(), status: "unpaid",
    }, ...prev]);
    setDebtForm({ kind: debtForm.kind, description: "", amount: "", counterparty: "" });
  }

  function toggleDebtStatus(id) {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, status: d.status === "paid" ? "unpaid" : "paid" } : d)));
  }

  function deleteDebt(id) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', sans-serif", background: "#F3F2ED", color: "#1B211E", minHeight: "100vh", padding: "16px 12px 40px", maxWidth: "800px", margin: "0 auto", boxSizing: "border-box" }}>
      <h2 style={{ textAlign: "center", marginBottom: "16px" }}>งบประมาณของฉัน</h2>

      {/* Hero Balance Card */}
      <div style={{ background: "#1B211E", color: "#F3F2ED", padding: "20px", borderRadius: "14px", marginBottom: "16px", textAlign: "center" }}>
        <div style={{ fontSize: "13px", color: "#C7CBC2" }}>ยอดคงเหลือทั้งหมด</div>
        <div style={{ fontSize: "32px", fontWeight: "bold", margin: "6px 0" }}>{formatMoney(balance)} บาท</div>
        <div style={{ display: "flex", justifyContent: "space-around", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "10px", marginTop: "10px" }}>
          <span style={{ color: "#8FD3B8" }}>รายรับ: {formatMoney(totalIncome)}</span>
          <span style={{ color: "#E6A199" }}>รายจ่าย: {formatMoney(totalExpense)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "8px", fontSize: "12px", color: "#C7CBC2" }}>
          <span>ธนาคาร: {formatMoney(bankBalance)}</span>
          <span>เงินสด: {formatMoney(cashBalance)}</span>
        </div>
      </div>

      {/* Slip Reader Card */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", marginBottom: "16px", border: "1px solid #E4E1D6" }}>
        <h3 style={{ fontSize: "14px", margin: "0 0 10px" }}>📷 อ่านสลิปโอนเงินอัตโนมัติ</h3>
        <input ref={slipInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleSlipFiles(e.target.files); e.target.value = ""; }} />
        <div onClick={() => slipInputRef.current && slipInputRef.current.click()} style={{ padding: "16px", border: "1.5px dashed #E4E1D6", borderRadius: "10px", textAlign: "center", cursor: "pointer", background: "#F3F2ED" }}>
          <div style={{ fontWeight: "600", fontSize: "13.5px" }}>แตะเพื่อเลือกรูปสลิป</div>
          <div style={{ fontSize: "11.5px", color: "#63695F", marginTop: "2px" }}>เลือกได้หลายรูปพร้อมกัน</div>
        </div>
        {pendingSlips.length > 0 && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {pendingSlips.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: "10px", padding: "10px", background: "#F3F2ED", borderRadius: "10px", alignItems: "center" }}>
                <img src={s.imageData} alt="สลิป" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.status === "reading" ? (
                    <div style={{ fontSize: "12px", color: "#63695F" }}>⏳ กำลังอ่านยอดเงิน...</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input type="number" placeholder="จำนวนเงิน" value={s.amount} onChange={(e) => setPendingSlips(pendingSlips.map(item => item.id === s.id ? { ...item, amount: e.target.value } : item))} style={{ flex: 1, padding: "6px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
                        <select value={s.category} onChange={(e) => setPendingSlips(pendingSlips.map(item => item.id === s.id ? { ...item, category: e.target.value } : item))} style={{ padding: "6px", fontSize: "12px", borderRadius: "6px", border: "1px solid #E4E1D6" }}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => confirmSlip(s.id)} style={{ flex: 1, background: "#1B211E", color: "#fff", border: "none", borderRadius: "6px", padding: "6px", fontSize: "12px", fontWeight: "600" }}>ยืนยันเพิ่มรายการ</button>
                        <button onClick={() => setPendingSlips(pendingSlips.filter(item => item.id !== s.id))} style={{ background: "#fff", border: "1px solid #E4E1D6", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}>ยกเลิก</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Form */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", marginBottom: "16px", border: "1px solid #E4E1D6" }}>
        <div style={{ display: "flex", marginBottom: "10px", background: "#F3F2ED", borderRadius: "8px", padding: "3px" }}>
          <button style={{ flex: 1, padding: "8px", border: "none", borderRadius: "6px", background: formType === "expense" ? "#A6303B" : "transparent", color: formType === "expense" ? "#fff" : "#63695F", fontWeight: "bold" }} onClick={() => handleTypeSwitch("expense")}>รายจ่าย</button>
          <button style={{ flex: 1, padding: "8px", border: "none", borderRadius: "6px", background: formType === "income" ? "#2F6F5E" : "transparent", color: formType === "income" ? "#fff" : "#63695F", fontWeight: "bold" }} onClick={() => handleTypeSwitch("income")}>รายรับ</button>
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
          {ACCOUNTS.map(a => (
            <button key={a.key} onClick={() => setFormAccount(a.key)} style={{ flex: 1, padding: "6px", fontSize: "12.5px", borderRadius: "6px", border: "1px solid #E4E1D6", background: formAccount === a.key ? "#1B211E" : "#fff", color: formAccount === a.key ? "#fff" : "#63695F", fontWeight: "600" }}>{a.label}</button>
          ))}
        </div>
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input type="number" placeholder="จำนวนเงิน" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "8px", border: "1px solid #E4E1D6" }} required />
          <div style={{ display: "flex", gap: "8px" }}>
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #E4E1D6", fontSize: "14px" }}>
              {currentCategoryOptions.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #E4E1D6", fontSize: "14px" }} />
          </div>
          <input type="text" placeholder="รายละเอียด (ไม่บังคับ)" value={formNote} onChange={(e) => setFormNote(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #E4E1D6", fontSize: "14px" }} />
          <button type="submit" style={{ padding: "10px", background: formType === "expense" ? "#A6303B" : "#2F6F5E", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "bold" }}>บันทึกรายการ</button>
        </form>
      </div>

      {/* Savings Goals */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", marginBottom: "16px", border: "1px solid #E4E1D6" }}>
        <h3 style={{ fontSize: "14px", margin: "0 0 10px" }}>🎯 เป้าหมายการออม</h3>
        {goals.length === 0 && !addingGoal && <p style={{ fontSize: "13px", color: "#9A9C90" }}>ยังไม่มีเป้าหมาย</p>}
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
          return (
            <div key={g.id} style={{ padding: "10px 0", borderBottom: "1px solid #E4E1D6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>
                <span>{g.name}</span>
                <button onClick={() => deleteGoal(g.id)} style={{ background: "none", border: "none", color: "#9A9C90", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ height: "8px", background: "#F3ECDA", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "#B08830", borderRadius: "999px" }} />
              </div>
              <div style={{ fontSize: "12px", color: "#63695F", margin: "4px 0 8px" }}>ออมแล้ว {formatMoney(g.saved)} จาก {formatMoney(g.target)} บาท ({pct.toFixed(0)}%)</div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input type="number" placeholder="จำนวนเงิน" value={contributionDrafts[g.id]?.amount || ""} onChange={(e) => setContributionDrafts({ ...contributionDrafts, [g.id]: { type: contributionDrafts[g.id]?.type || "deposit", amount: e.target.value } })} style={{ flex: 1, padding: "6px", fontSize: "12px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
                <button onClick={() => addGoalContribution(g.id, contributionDrafts[g.id]?.amount, "deposit")} style={{ background: "#2F6F5E", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}>ฝาก</button>
                <button onClick={() => addGoalContribution(g.id, contributionDrafts[g.id]?.amount, "withdraw")} style={{ background: "#A6303B", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}>ถอน</button>
              </div>
            </div>
          );
        })}
        {addingGoal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
            <input type="text" placeholder="ชื่อเป้าหมาย" value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} style={{ padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="number" placeholder="เป้าหมาย (บาท)" value={goalDraft.target} onChange={(e) => setGoalDraft({ ...goalDraft, target: e.target.value })} style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
              <input type="number" placeholder="เริ่มต้น (บาท)" value={goalDraft.saved} onChange={(e) => setGoalDraft({ ...goalDraft, saved: e.target.value })} style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={saveGoal} style={{ flex: 1, background: "#2F6F5E", color: "#fff", border: "none", borderRadius: "6px", padding: "8px", fontSize: "13px", fontWeight: "bold" }}>บันทึกเป้าหมาย</button>
              <button onClick={() => setAddingGoal(false)} style={{ background: "#fff", border: "1px solid #E4E1D6", borderRadius: "6px", padding: "8px 12px", fontSize: "13px" }}>ยกเลิก</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingGoal(true)} style={{ width: "100%", background: "none", border: "1px dashed #E4E1D6", borderRadius: "8px", padding: "8px", fontSize: "13px", color: "#63695F", cursor: "pointer", marginTop: "10px" }}>+ เพิ่มเป้าหมายใหม่</button>
        )}
      </div>

      {/* Debt and Claims Management */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", marginBottom: "16px", border: "1px solid #E4E1D6" }}>
        <h3 style={{ fontSize: "14px", margin: "0 0 10px" }}>📌 หนี้สินและรายการเบิก</h3>
        <div style={{ display: "flex", marginBottom: "10px", background: "#F3F2ED", borderRadius: "8px", padding: "3px" }}>
          <button style={{ flex: 1, padding: "6px", border: "none", borderRadius: "6px", background: debtForm.kind === "debt" ? "#A6303B" : "transparent", color: debtForm.kind === "debt" ? "#fff" : "#63695F", fontWeight: "bold", fontSize: "13px" }} onClick={() => setDebtForm({ ...debtForm, kind: "debt" })}>หนี้ที่ติดอยู่</button>
          <button style={{ flex: 1, padding: "6px", border: "none", borderRadius: "6px", background: debtForm.kind === "claim" ? "#2F6F5E" : "transparent", color: debtForm.kind === "claim" ? "#fff" : "#63695F", fontWeight: "bold", fontSize: "13px" }} onClick={() => setDebtForm({ ...debtForm, kind: "claim" })}>รายการเบิก</button>
        </div>
        <form onSubmit={handleAddDebt} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input type="text" placeholder="รายละเอียด" value={debtForm.description} onChange={(e) => setDebtForm({ ...debtForm, description: e.target.value })} style={{ padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} required />
          <div style={{ display: "flex", gap: "6px" }}>
            <input type="number" placeholder="จำนวนเงิน" value={debtForm.amount} onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })} style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} required />
            <input type="text" placeholder="กับใคร (ไม่บังคับ)" value={debtForm.counterparty} onChange={(e) => setDebtForm({ ...debtForm, counterparty: e.target.value })} style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #E4E1D6" }} />
          </div>
          <button type="submit" style={{ padding: "8px", background: debtForm.kind === "debt" ? "#A6303B" : "#2F6F5E", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "bold" }}>เพิ่มรายการหนี้/เบิก</button>
        </form>
        {debts.length > 0 && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {debts.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #E4E1D6" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", textDecoration: d.status === "paid" ? "line-through" : "none" }}>{d.description}</div>
                  <div style={{ fontSize: "11px", color: "#9A9C90" }}>{d.counterparty} {d.status === "paid" ? "· ชำระแล้ว" : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: d.kind === "debt" ? "#A6303B" : "#2F6F5E" }}>{formatMoney(d.amount)}</span>
                  <button onClick={() => toggleDebtStatus(d.id)} style={{ background: d.status === "paid" ? "#2F6F5E" : "#fff", color: d.status === "paid" ? "#fff" : "#63695F", border: "1px solid #E4E1D6", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer" }}>✓</button>
                  <button onClick={() => deleteDebt(d.id)} style={{ background: "none", border: "none", color: "#9A9C90", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", border: "1px solid #E4E1D6" }}>
        <h3 style={{ fontSize: "14px", margin: "0 0 10px" }}>📜 รายการทั้งหมด ({transactions.length})</h3>
        {transactions.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#9A9C90" }}>ยังไม่มีรายการ</p>
        ) : (
          transactions.map((t) => {
            const info = categoryInfo(t.category);
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #E4E1D6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: info.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13.5px", fontWeight: "600" }}>{info.label}</div>
                    <div style={{ fontSize: "11.5px", color: "#63695F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note || "-"} · {formatDateThai(t.date)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: t.type === "income" ? "#2F6F5E" : "#A6303B" }}>
                    {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                  </span>
                  <button onClick={() => deleteTx(t.id)} style={{ background: "none", border: "none", color: "#9A9C90", cursor: "pointer", fontSize: "14px" }}>✕</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
