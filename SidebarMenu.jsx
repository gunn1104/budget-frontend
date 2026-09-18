export default function SidebarMenu({ isOpen, onClose, onOpenModal, onResetAccount, onStartTutorial, onReportProblem, transactionsCount }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex">
      <div className="w-4/5 max-w-sm bg-white h-full p-6 space-y-4 shadow-2xl overflow-y-auto flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-lg font-bold text-[#1E1E1E]">เมนูและเครื่องมือ</h2>
            <button onClick={onClose} className="text-gray-400 text-xl font-bold">✕</button>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => { onOpenModal("chat_admin"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-blue-50 hover:bg-blue-100 rounded-2xl text-xs font-bold text-blue-800 border border-blue-200"
            >
              <span>💬 แชทซัพพอร์ต (พร้อม AI บอทอัจฉริยะ)</span>
              <span>➔</span>
            </button>

            <button
              onClick={() => { onOpenModal("transactions"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
            >
              <span>📜 รายการประวัติทั้งหมด ({transactionsCount})</span>
              <span>➔</span>
            </button>

            <button
              onClick={() => { onOpenModal("budget_planner"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-emerald-50 hover:bg-emerald-100 rounded-2xl text-xs font-bold text-emerald-800 border border-emerald-200"
            >
              <span>🗺️ วางแผนการเงิน / จัดสรรงบ (เซ็ต Set 1, 2...)</span>
              <span>➔</span>
            </button>

            <button
              onClick={() => { onOpenModal("categories_detail"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
            >
              <span>📊 สรุปใช้จ่ายตามหมวดหมู่ (ละเอียดยิบ)</span>
              <span>➔</span>
            </button>

            <button
              onClick={() => { onOpenModal("goals_detail"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
            >
              <span>🎯 เป้าหมายการออม (รายละเอียดทั้งหมด)</span>
              <span>➔</span>
            </button>

            <button
              onClick={() => { onOpenModal("adjust"); onClose(); }}
              className="w-full flex justify-between items-center p-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold text-gray-800 border"
            >
              <span>⚖️ ปรับยอดให้ตรงกับบัญชีจริง</span>
              <span>➔</span>
            </button>
          </div>

          <div className="pt-4 border-t space-y-2">
            <button onClick={() => { onStartTutorial(); onClose(); }} className="w-full text-left text-xs text-emerald-600 hover:text-emerald-800 py-2 font-semibold">
              💡 เปิดดูคู่มือแนะนำการใช้งาน (6 ขั้นตอน)
            </button>
            <button onClick={() => { onReportProblem(); onClose(); }} className="w-full text-left text-xs text-rose-600 hover:text-rose-800 py-2 font-semibold">
              🚨 แจ้งปัญหาการใช้งาน
            </button>
          </div>
        </div>

        <div className="pt-4 border-t shrink-0">
          <button
            onClick={onResetAccount}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold border border-rose-200 transition flex items-center justify-center gap-2 shadow-sm"
          >
            <span>🗑️</span>
            <span>รีเซ็ตบัญชีและลบข้อมูลทั้งหมด (เริ่มต้นใหม่)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
