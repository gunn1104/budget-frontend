const { useState } = React;

export default function App() {
  const [text, setText] = useState("ระบบกำลังทำงานปกติ");

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}>
      <h2>ทดสอบระบบหน้าจอ</h2>
      <p>{text}</p>
      <button 
        onClick={() => setText("กดปุ่มสำเร็จ!")}
        style={{ padding: "10px 20px", background: "#2F6F5E", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px" }}
      >
        คลิกทดสอบ
      </button>
    </div>
  );
}
