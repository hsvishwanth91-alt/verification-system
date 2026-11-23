import {
  AlertCircle,
  Edit3,
  KeyRound,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { StudentRecord } from '../types/index.ts';

export function AdminStudentsPage() {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Registration form
  const [fullName, setFullName] = useState('');
  const [usn, setUsn] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [graduationYear, setGraduationYear] = useState('2026');
  const [portalPassword, setPortalPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Password modal
  const [pwTarget, setPwTarget] = useState<StudentRecord | null>(null);
  const [newStudentPw, setNewStudentPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const loadStudents = useCallback(
    async (query = '') => {
      setLoading(true);
      try {
        const res = await apiFetch<{ students: StudentRecord[] }>(
          `/api/admin/students${query ? `?q=${encodeURIComponent(query)}` : ''}`,
        );
        setStudents(res.students);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to load students', 'error');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, showToast],
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents(search);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (portalPassword && portalPassword.length < 8) {
      setFormError('Student portal password must be at least 8 characters (or leave blank).');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          usn,
          email,
          department,
          course,
          academicYear,
          graduationYear: Number(graduationYear),
          portalPassword: portalPassword.trim(),
        }),
      });
      showToast(`Registered student ${fullName} (${usn.toUpperCase()}).`, 'success');
      setFullName('');
      setUsn('');
      setEmail('');
      setDepartment('');
      setCourse('');
      setPortalPassword('');
      await loadStudents(search);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/admin/students/${encodeURIComponent(editingStudent.student_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editingStudent.full_name,
          usn: editingStudent.usn,
          email: editingStudent.email,
          department: editingStudent.department,
          course: editingStudent.course,
          academicYear: editingStudent.academic_year,
          graduationYear: Number(editingStudent.graduation_year),
        }),
      });
      showToast('Student record updated.', 'success');
      setEditingStudent(null);
      await loadStudents(search);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    if (newStudentPw.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    setSavingPw(true);
    try {
      await apiFetch(`/api/admin/students/${encodeURIComponent(pwTarget.student_id)}/set-password`, {
        method: 'POST',
        body: JSON.stringify({ password: newStudentPw }),
      });
      showToast(`Portal password configured for ${pwTarget.full_name}.`, 'success');
      setPwTarget(null);
      setNewStudentPw('');
      await loadStudents(search);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to set password', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <AdminLayout title="Student Registration & Directory" breadcrumb="CertiTrust / Students">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Registration Form */}
        <section className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-navy-900">
            <UserPlus className="h-5 w-5 text-teal-600" />
            <h2 className="font-display text-base font-bold">Register New Student</h2>
          </div>
          <p className="text-xs text-slate-500">
            Duplicate USN or email addresses are automatically rejected.
          </p>

          <form onSubmit={handleRegister} className="space-y-3.5">
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Student Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Priya Sharma"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  University Seat Number (USN)
                </label>
                <input
                  type="text"
                  required
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  placeholder="1MS22CS042"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya.sharma@university.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Computer Science & Engineering"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Course / Program</label>
              <input
                type="text"
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="B.Tech in Computer Science"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2025-2026"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Graduation Year
                </label>
                <input
                  type="number"
                  required
                  min={1980}
                  max={2100}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Student Portal Password (optional, 8+ chars)
              </label>
              <input
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Enable immediate student login"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Registering...' : 'Register Student'}
            </button>
          </form>
        </section>

        {/* Student Directory Table */}
        <section className="xl:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-navy-800" />
              <h2 className="font-display text-base font-bold text-navy-900">
                Registered Students ({students.length})
              </h2>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, USN, email..."
                  className="rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-sm focus:border-teal-600 focus:outline-none w-52 sm:w-64"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No students match your query. Use the form to register a student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Department / Course</th>
                    <th className="py-3 px-4">Grad</th>
                    <th className="py-3 px-4">Portal</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {students.map((st) => (
                    <tr key={st.student_id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-navy-900">
                          {st.full_name}
                          {Boolean(st.is_demo) && (
                            <span className="ml-2 text-xs font-medium text-amber-700">· Demo</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{st.email}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {st.usn}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-slate-800">{st.department}</p>
                        <p className="text-xs text-slate-500">{st.course}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {st.graduation_year}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {st.password_reset_requested ? (
                          <span className="text-amber-700 font-semibold">Reset Requested</span>
                        ) : st.owner_user_id ? (
                          <span className="text-emerald-700 font-medium">Active</span>
                        ) : (
                          <span className="text-slate-400">No password</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingStudent({ ...st })}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPwTarget(st);
                            setNewStudentPw('');
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>Set Login</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy-900">Edit Student Record</h2>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.full_name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, full_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">USN</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.usn}
                    onChange={(e) => setEditingStudent({ ...editingStudent, usn: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingStudent.email}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={editingStudent.department}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, department: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
                <input
                  type="text"
                  required
                  value={editingStudent.course}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, course: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.academic_year}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, academic_year: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="number"
                    required
                    value={editingStudent.graduation_year}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        graduation_year: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Student Portal Password Modal */}
      {pwTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy-900">
                Configure Student Portal Login
              </h2>
              <button
                type="button"
                onClick={() => setPwTarget(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Set or reset the portal password for <strong>{pwTarget.full_name}</strong> ({pwTarget.email}).
            </p>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <input
                type="password"
                required
                minLength={8}
                value={newStudentPw}
                onChange={(e) => setNewStudentPw(e.target.value)}
                placeholder="Enter password (min. 8 characters)"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPwTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {savingPw ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
