import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CalendarDays, Check, CheckCircle2, ChevronDown, Circle, Clock3, Leaf, ListTodo, LogOut, MoreHorizontal, Plus, Search, Settings2, Sparkles, Target, Trash2, X } from 'lucide-react';

const emptyTask = { title: '', notes: '', dueDate: '', type: 'Task', priority: 'Medium' };
const savedToken = () => localStorage.getItem('daymark-token');

async function request(path, options = {}) {
  const token = savedToken();
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(savedToken()));
  const [authMode, setAuthMode] = useState('login');
  const [filter, setFilter] = useState('All tasks');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!savedToken()) return;
    request('/api/auth/me').then(({ user: current }) => {
      setUser(current);
      return loadTasks();
    }).catch(() => localStorage.removeItem('daymark-token')).finally(() => setLoading(false));
  }, []);

  async function loadTasks() {
    const { tasks: list } = await request('/api/tasks');
    setTasks(list);
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function signIn(authData) {
    localStorage.setItem('daymark-token', authData.token);
    setUser(authData.user);
    await loadTasks();
  }

  function signOut() {
    localStorage.removeItem('daymark-token');
    setUser(null);
    setTasks([]);
  }

  async function saveTask(values) {
    if (editing) {
      const { task } = await request(`/api/tasks/${editing.id}`, { method: 'PUT', body: JSON.stringify(values) });
      setTasks((items) => items.map((item) => item.id === task.id ? task : item));
      notify('Changes saved');
    } else {
      const { task } = await request('/api/tasks', { method: 'POST', body: JSON.stringify(values) });
      setTasks((items) => [task, ...items]);
      notify(values.type === 'Habit' ? 'Habit added' : 'Task added');
    }
    setEditing(null);
    setShowForm(false);
  }

  async function toggleTask(task) {
    const { task: updated } = await request(`/api/tasks/${task.id}`, {
      method: 'PUT', body: JSON.stringify({ ...task, completed: !task.completed }),
    });
    setTasks((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  async function removeTask(task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
    setTasks((items) => items.filter((item) => item.id !== task.id));
    notify('Task deleted');
  }

  async function updateAccount(values) {
    const result = await request('/api/auth/account', { method: 'PUT', body: JSON.stringify(values) });
    localStorage.setItem('daymark-token', result.token);
    setUser(result.user);
    setShowAccount(false);
    notify('Account updated');
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your account and all its tasks? This cannot be undone.')) return;
    await request('/api/auth/account', { method: 'DELETE' });
    signOut();
  }

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = activeTasks.filter((task) => task.due_date === today).length;
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.notes}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === 'Today') return !task.completed && task.due_date === today;
    if (filter === 'Upcoming') return !task.completed && task.due_date && task.due_date > today;
    if (filter === 'Completed') return Boolean(task.completed);
    if (filter === 'Habits') return task.type === 'Habit';
    return !task.completed;
  }), [tasks, filter, query, today]);

  if (loading) return <div className="loading-screen"><div className="brand-mark"><Leaf size={19} /></div><span>Getting your day ready…</span></div>;
  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onSignIn={signIn} />;

  const navItems = [
    { label: 'All tasks', icon: ListTodo, count: activeTasks.length },
    { label: 'Today', icon: CalendarDays, count: dueToday },
    { label: 'Upcoming', icon: Clock3 },
    { label: 'Habits', icon: Leaf },
    { label: 'Completed', icon: CheckCircle2, count: completedTasks.length },
  ];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark"><Leaf size={19} /></span><span>daymark<span className="brand-dot">.</span></span></a>
      <button className="workspace-switch" onClick={() => setShowAccount(true)}><span className="avatar">{user.name[0].toUpperCase()}</span><span className="workspace-copy"><b>{user.name}</b><small>Personal space</small></span><ChevronDown size={15} /></button>
      <div className="side-label">YOUR SPACE</div>
      <nav className="navigation">{navItems.map(({ label, icon: Icon, count }) => <button key={label} className={`nav-item ${filter === label ? 'selected' : ''}`} onClick={() => setFilter(label)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count > 0 && <small>{count}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="side-tip"><span className="tip-icon"><Sparkles size={15} /></span><b>A little progress<br />goes a long way.</b><span>Keep showing up for yourself.</span><div className="tip-flower">✳</div></div><button className="profile-button" onClick={() => setShowAccount(true)}><span className="avatar avatar-small">{user.name[0].toUpperCase()}</span><span><b>{user.name}</b><small>My account</small></span><MoreHorizontal size={18} /></button></div>
    </aside>

    <main className="main-content" id="top">
      <header className="topbar"><div className="crumb">My space <span>/</span> <b>{filter}</b></div><div className="top-actions"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label><button className="icon-button" title="Account settings" onClick={() => setShowAccount(true)}><Settings2 size={18} /></button><button className="header-avatar" title="Sign out" onClick={signOut}>{user.name[0].toUpperCase()}</button></div></header>
      <section className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="sun-dot" /> YOUR PERSONAL DASHBOARD</div><h1>{greeting}, {user.name.split(' ')[0]} <span className="wave">✳</span></h1><p className="welcome-sub">A fresh day is a fresh start. Let’s make it count.</p></div><div className="date-chip"><CalendarDays size={16} /><span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div></div>

        <div className="summary-grid"><div className="summary-card summary-primary"><div className="summary-heading"><span>IN YOUR LIST</span><span className="summary-icon"><ListTodo size={16} /></span></div><div className="summary-number">{activeTasks.length}<span> active</span></div><div className="summary-foot"><div className="mini-avatars"><i>{user.name[0].toUpperCase()}</i><i className="avatar-two">✦</i></div><span>One step at a time</span></div></div><div className="summary-card"><div className="summary-heading"><span>DUE TODAY</span><span className="summary-icon soft-peach"><CalendarDays size={16} /></span></div><div className="summary-number">{dueToday}<span> {dueToday === 1 ? 'item' : 'items'}</span></div><div className="summary-foot"><span className="status-dot" />A good day to focus</div></div><div className="summary-card"><div className="summary-heading"><span>COMPLETED</span><span className="summary-icon soft-green"><Check size={17} /></span></div><div className="summary-number">{completedTasks.length}<span> done</span></div><div className="summary-foot"><div className="progress-track"><span style={{ width: `${tasks.length ? completedTasks.length / tasks.length * 100 : 0}%` }} /></div><span>{tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0}% of all</span></div></div></div>

        <section className="tasks-panel"><div className="panel-header"><div><div className="eyebrow panel-eyebrow"><span className="tiny-sparkle">✳</span> YOUR FOCUS</div><h2>{filter === 'All tasks' ? 'The task list' : filter}</h2><p>Small steps make meaningful progress.</p></div><button className="primary-button" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={17} /> Add a task</button></div><div className="list-toolbar"><div className="list-count">{filteredTasks.length} {filteredTasks.length === 1 ? 'item' : 'items'} <span>to focus on</span></div><button className="sort-label" onClick={() => setTasks((items) => [...items].reverse())}><ArrowDownUp size={14} /> Sort by date</button></div>
          {filteredTasks.length ? <div className="task-list">{filteredTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => { setEditing(task); setShowForm(true); }} onDelete={() => removeTask(task)} />)}</div> : <div className="empty-state"><div className="empty-icon"><Target size={23} /></div><b>{query ? 'No matches found' : filter === 'Completed' ? 'Nothing completed just yet' : 'Your list is clear'}</b><span>{query ? 'Try another search.' : 'Add a task or habit to get started.'}</span>{!query && filter !== 'Completed' && <button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={15} /> Add your first task</button>}</div>}
        </section>
        <footer className="page-footer"><span>Made for the days that matter <span className="footer-flower">✳</span></span><span>YOUR PACE. YOUR PROGRESS.</span></footer>
      </section>
    </main>
    {showForm && <TaskModal task={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSave={saveTask} />}
    {showAccount && <AccountModal user={user} onClose={() => setShowAccount(false)} onSave={updateAccount} onDelete={deleteAccount} onSignOut={signOut} />}
    {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}

function AuthScreen({ mode, setMode, onSignIn }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request(`/api/auth/${isSignup ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(form) });
      await onSignIn(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-brand"><a className="brand" href="#"><span className="brand-mark"><Leaf size={19} /></span><span>daymark<span className="brand-dot">.</span></span></a><div className="auth-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><div className="art-sun">✳</div><div className="art-leaf"><Leaf size={58} strokeWidth={1.15} /></div></div><div className="art-star star-one">✳</div><div className="art-star star-two">✦</div><div className="art-dot dot-one" /><div className="art-dot dot-two" /></div><div className="auth-quote"><span>“</span><p>A little progress each day adds up to big results.</p><small>— YOUR GENTLE REMINDER</small></div></div><div className="auth-form-side"><div className="auth-form-wrap"><div className="eyebrow"><span className="sun-dot" /> A SPACE TO MAKE YOURS</div><h1>{isSignup ? 'Start fresh.' : 'Welcome back.'}</h1><p className="auth-description">{isSignup ? 'Create an account and make a little room for what matters.' : 'Pick up right where you left off.'}</p><form onSubmit={submit} className="auth-form">{isSignup && <label>Your name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="How should we call you?" required /></label>}<label>Email address<input autoComplete="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required /></label><label>Password<input autoComplete={isSignup ? 'new-password' : 'current-password'} type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'One moment…' : isSignup ? 'Create my account' : 'Sign in'}<span>→</span></button></form><div className="auth-switch">{isSignup ? 'Already have an account?' : 'New around here?'} <button onClick={() => { setError(''); setMode(isSignup ? 'login' : 'signup'); }}>{isSignup ? 'Sign in' : 'Create an account'}</button></div><div className="auth-safe"><span><Check size={12} /></span>Your tasks are private to your account.</div></div><div className="auth-foot">A calmer way to keep track of your day <i>✳</i></div></div></main>;
}

function TaskRow({ task, onToggle, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !task.completed;
  return <article className={`task-row ${task.completed ? 'task-done' : ''}`}><button className={`task-check ${task.completed ? 'checked' : ''}`} onClick={onToggle} aria-label={task.completed ? 'Mark as active' : 'Mark as complete'}>{task.completed && <Check size={14} />}</button><div className="task-main"><div className="task-title-line"><h3>{task.title}</h3><span className={`priority priority-${task.priority.toLowerCase()}`}><i />{task.priority}</span></div>{task.notes && <p>{task.notes}</p>}<div className="task-meta">{task.due_date && <span className={isOverdue ? 'overdue' : ''}><CalendarDays size={13} />{isOverdue ? 'Overdue' : new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}<span className={`task-type ${task.type === 'Habit' ? 'habit-type' : ''}`}>{task.type === 'Habit' ? <Leaf size={12} /> : <Circle size={10} />}{task.type}</span></div></div><div className="row-menu-wrap"><button className="row-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Task options"><MoreHorizontal size={19} /></button>{menuOpen && <><button className="menu-dismiss" onClick={() => setMenuOpen(false)} /><div className="row-menu-pop"><button onClick={() => { setMenuOpen(false); onEdit(); }}>Edit task</button><button className="delete-action" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={13} />Delete</button></div></>}</div></article>;
}

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(task ? { title: task.title, notes: task.notes || '', dueDate: task.due_date || '', type: task.type, priority: task.priority } : emptyTask);
  const [error, setError] = useState('');
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave(form); } catch (err) { setError(err.message); } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card"><header className="modal-header"><div><span className="modal-kicker">{task ? 'A LITTLE TWEAK' : 'MAKE A LITTLE PLAN'}</span><h2>{task ? 'Edit your item' : 'Add to your day'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit} className="task-form"><label>What would you like to do?<input autoFocus value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Go for a morning walk" required maxLength={120} /></label><label>A few details <span className="optional">(optional)</span><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Add a note to help you remember..." rows="3" maxLength={500} /></label><div className="field-row"><label>Due date<input type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} /></label><label>Type<select value={form.type} onChange={(e) => update('type', e.target.value)}><option>Task</option><option>Habit</option></select></label></div><label>Priority<div className="priority-options">{['Low', 'Medium', 'High'].map((priority) => <button type="button" key={priority} className={form.priority === priority ? 'priority-choice active' : 'priority-choice'} onClick={() => update('priority', priority)}><i className={`priority-dot priority-dot-${priority.toLowerCase()}`} />{priority}</button>)}</div></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} />{task ? 'Save changes' : 'Add to my list'}</button></div></form></section></div>;
}

function AccountModal({ user, onClose, onSave, onDelete, onSignOut }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, password: '' });
  const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave(form); } catch (err) { setError(err.message); } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card account-modal"><header className="modal-header"><div><span className="modal-kicker">YOUR SPACE</span><h2>Account settings</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit} className="task-form"><label>Your name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email address<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>New password <span className="optional">(leave blank to keep current)</span><input type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button account-save" type="submit">Save account</button><div className="account-links"><button type="button" className="text-button" onClick={onSignOut}><LogOut size={14} />Sign out</button><button type="button" className="danger-link" onClick={onDelete}>Delete account</button></div></form></section></div>;
}

export default App;
