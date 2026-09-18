const { useState, useEffect, useRef } = React;

export default function AdminPanel({ firebaseConfig, onSendAnnouncement, activeAnnouncement, onClearAnnouncement, onlineUsers, onDeleteUser, onSelectUserChat }) {
  const [announcementText, setAnnouncementText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    onSendAnnouncement(announcementText.trim());
    setAnnouncementText("");
  };

  const formatUserStatus = (lastActiveTimestamp) => {
    if (!lastActiveTimestamp) return { text: "ออฟไลน์", isOnline: false };
    const timeNum = Number(lastActiveTimestamp);
    if (isNaN(timeNum)) return { text: "⚪ ไม่ระบุเวลา", isOnline: false };

    const diffSec = Math.floor((Date.now() - timeNum) / 1000);
    if (diffSec < 25 && diffSec >= 0) {
      return { text: "🟢 กำลังใช้งานอยู่", isOnline: true };
    } else {
      const dateObj = new Date(timeNum);
      if (isNaN(dateObj.getTime())) return { text: "⚪ ไม่ระบุเวลา", isOnline: false };
      const timeStr = dateObj.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const dateStr = dateObj.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      return { text: `⚪ ใช้งานล่าสุดเมื่อ ${dateStr} เวลา ${timeStr}`, isOnline: false };
    }
  };

  return (
    <div className="bg-[#FFFDF6] border-2 border-[#EADBBD] rounded-3xl p-5 space-y-5 shadow-md">
      <div className="flex justify-between items-center border-b border-[#EADBBD] pb-2">
        <h3 className="text-sm font-bold text-[#8C6D23] flex items-center gap-2">
          <span>🛡️</span> ระบบหลังบ้านผู้ดูแลระบบ (Firebase Cloud Dashboard)
        </h3>
        <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-0.5 rounded-full font-bold animate-pulse">REAL-TIME ONLINE</span>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3 shadow-sm">
        <h4 className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
          <span>📢</span> ส่งข้อความประกาศแจ้งเตือน (เด้งเฉพาะผู้ที่ออนไลน์อยู่ขณะนี้)
        </h4>
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows="2"
            placeholder="พิมพ์ข้อความประกาศ..."
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 font-medium"
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm">
              🚀 ส่งประกาศเด้งเฉพาะคนออนไลน์
            </button>
            {activeAnnouncement && (
              <button type="button" onClick={onClearAnnouncement} className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200">
                🗑️ ลบประกาศ
              </button>
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
                  <div onClick={() => onSelectUserChat(u)} className="flex items-center gap-3 flex-1 cursor-pointer">
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
                      <p className="font-extrabold text-emerald-600">{u.balance?.toLocaleString()} บ.</p>
                    </div>
                    <button onClick={() => onDeleteUser(u.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition text-sm" title="ลบผู้ใช้">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminChatRoom({ targetUserId, databaseURL }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`${databaseURL}/chats/${targetUserId}.json`);
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
  }, [targetUserId, databaseURL]);

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
