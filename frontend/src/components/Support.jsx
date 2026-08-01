const Support = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Need Help?</h1>
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-bold">📧 Email</h3>
          <p>support@spms.com</p>
        </div>
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-bold">📞 Phone</h3>
          <p>+855 12 345 678</p>
        </div>
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-bold">📚 Documentation</h3>
          <a href="/docs">Read Documentation</a>
        </div>
        <div className="border rounded-lg p-6">
          <h3 className="text-xl font-bold">💬 Live Chat</h3>
          <p>Available 9AM - 5PM</p>
        </div>
      </div>
    </div>
  );
};