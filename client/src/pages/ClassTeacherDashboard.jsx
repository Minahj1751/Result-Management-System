export default function ClassTeacherDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Class Teacher Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Class Assignment</h2>
        <p className="text-gray-600">No class assignment loaded yet.</p>
      </div>
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Attendance Status</h2>
        <p className="text-gray-600">No attendance data loaded yet.</p>
      </div>
    </div>
  );
}
