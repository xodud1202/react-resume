interface PressOrderModalProps {
  isOpen: boolean;
  orderIds: string[];
  pressNameById: Map<string, string>;
  selectedPressId: string;
  onSelectPress: (pressId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
  onSave: () => void;
}

function PressOrderModal({
  isOpen,
  orderIds,
  pressNameById,
  selectedPressId,
  onSelectPress,
  onMoveUp,
  onMoveDown,
  onClose,
  onSave,
}: PressOrderModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="bg-white rounded-lg shadow-xl w-80 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="언론사 순서변경"
      >
        <h2 className="px-4 py-3 border-b text-base font-semibold text-gray-800">
          언론사 순서변경
        </h2>
        <div className="flex gap-3 p-4 flex-1 overflow-hidden min-h-0">
          <ul className="flex-1 overflow-y-auto border rounded divide-y">
            {orderIds.map((pressId) => {
              const isSelected = selectedPressId === pressId;
              const pressName = pressNameById.get(pressId) || pressId;
              return (
                <li key={pressId}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-100 font-medium text-blue-800"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                    onClick={() => onSelectPress(pressId)}
                  >
                    {pressName}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2 justify-center">
            <button
              type="button"
              className="px-3 py-2 text-sm border rounded hover:bg-gray-100 text-gray-700 transition-colors"
              onClick={onMoveUp}
            >
              위로
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm border rounded hover:bg-gray-100 text-gray-700 transition-colors"
              onClick={onMoveDown}
            >
              아래로
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button
            type="button"
            className="px-4 py-2 text-sm border rounded hover:bg-gray-100 text-gray-700 transition-colors"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={onSave}
          >
            저장
          </button>
        </div>
      </section>
    </div>
  );
}

export default PressOrderModal;
