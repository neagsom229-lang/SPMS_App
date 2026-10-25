// frontend/src/pages/Reports.jsx
const ExportButtons = ({ data, type }) => {
  const exportCSV = () => {
    // CSV export logic
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
  };

  const exportExcel = async () => {
    // Excel export (using existing backend endpoint)
    try {
      const res = await apiClient.get(`/reports/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Excel export failed', e);
      alert('Excel export failed');
    }
  };

  const exportPDF = () => {
    // PDF export using window.print()
    window.print();
  };

  return (
    <div className="flex gap-2">
      <button onClick={exportCSV} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
        📄 CSV
      </button>
      <button onClick={exportExcel} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        📊 Excel
      </button>
      <button onClick={exportPDF} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
        📑 PDF
      </button>
    </div>
  );
};