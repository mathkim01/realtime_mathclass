export default function Notifications({ toast, confirmDialog, setConfirmDialog, busy }) {
  return <>
    {confirmDialog && <div role="dialog" aria-modal="true" aria-label={confirmDialog.title} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl w-80 text-center shadow-xl border">
        <h3 className="font-bold text-sm mb-2">{confirmDialog.title}</h3>
        <p className="text-xs text-slate-600 mb-5 leading-relaxed">{confirmDialog.message}</p>
        <div className="flex gap-2 text-xs font-bold"><button disabled={busy} onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-200 py-2 rounded-xl">취소</button><button disabled={busy} onClick={confirmDialog.onConfirm} className="flex-1 bg-blue-600 text-white py-2 rounded-xl">확인</button></div>
      </div>
    </div>}
    {toast && <div role="status" className={`fixed bottom-5 right-5 text-white text-xs px-4 py-3 rounded-xl shadow-lg z-[60] ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>{toast.message}</div>}
  </>;
}
