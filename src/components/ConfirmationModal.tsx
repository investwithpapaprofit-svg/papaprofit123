interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationModal({ 
    isOpen, 
    title, 
    message, 
    confirmText = 'Confirm', 
    cancelText = 'Cancel', 
    isDangerous = false,
    isLoading = false,
    onConfirm, 
    onCancel 
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200">
                <div className={`p-5 pb-4 border-b ${isDangerous ? 'border-red-100 bg-red-50/50' : 'border-gray-100'}`}>
                    <h3 className={`font-semibold text-lg ${isDangerous ? 'text-red-700' : 'text-gray-900'}`}>{title}</h3>
                </div>
                <div className="p-5 text-sm text-gray-600 leading-relaxed">
                    {message}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl border-t border-gray-100">
                    <button 
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2
                            ${isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-forest hover:bg-deep'}
                        `}
                    >
                        {isLoading && (
                            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
