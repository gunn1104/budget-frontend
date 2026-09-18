const { useState } = React;

export default function BudgetPlanner() {
  const [balance, setBalance] = useState(0);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", textAlign: "center", background: "#F3F2ED", minHeight: "100vh" }}>
      <h2>งบประมาณของฉัน</h2>
      <div style={{ background: "#1B211E", color: "#fff", padding: "20px", borderRadius: "10px", margin: "20px 0" }}>
        <h3>ยอดคงเหลือ</h3>
        <p style={{ fontSize: "28px", fontWeight: "bold" }}>{balance} บาท</p>
      </div>
      <p style={{ color: "#63695F" }}>ระบบโหลดสำเร็จและพร้อมใช้งานแล้ว!</p>
    </div>
  );
}
