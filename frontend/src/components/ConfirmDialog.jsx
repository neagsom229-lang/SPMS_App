// components/ConfirmDialog.jsx
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
          {title || 'Are you sure?'}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          {message || 'This action cannot be undone.'}
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Use it everywhere:
const handleDelete = (id) => {
  setConfirmDialog({
    open: true,
    title: 'Delete Customer',
    message: 'Are you sure you want to delete this customer?',
    onConfirm: () => deleteCustomer(id)
  });
};