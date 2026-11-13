export default function TeacherDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subject Teacher Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Assignments</h2>
        <p className="text-gray-600">No assignments loaded yet.</p>
      </div>
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Actions</h2>
        <p className="text-gray-600">No pending actions.</p>
      </div>
    </div>
  );
}
