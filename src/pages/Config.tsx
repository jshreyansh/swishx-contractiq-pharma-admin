import { useEffect, useState } from 'react';
import { Settings, Users, Plus, CreditCard as Edit2, Save, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppUser, SystemConfig, Division } from '../types';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function Config() {
  const { currentRole, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'users' | 'workflow' | 'emails'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editConfigVal, setEditConfigVal] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'cfa', division_id: '', status: 'active' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: u }, { data: c }, { data: d }] = await Promise.all([
      supabase.from('app_users').select('*, division:divisions(*)').order('name'),
      supabase.from('system_config').select('*').order('config_key'),
      supabase.from('divisions').select('*').order('name'),
    ]);
    if (u) setUsers(u as AppUser[]);
    if (c) setConfigs(c as SystemConfig[]);
    if (d) setDivisions(d as Division[]);
    setLoading(false);
  }

  async function handleAddUser() {
    if (!newUser.name || !newUser.email || !newUser.role) return;
    const { error } = await supabase.from('app_users').insert({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role as any,
      division_id: newUser.division_id || null,
      status: 'active',
    });
    if (error) {
      addToast({ type: 'error', title: 'Error', message: error.message });
    } else {
      addToast({ type: 'success', title: 'User Added', message: `${newUser.name} added successfully.` });
      setShowAddUser(false);
      setNewUser({ name: '', email: '', role: 'cfa', division_id: '', status: 'active' });
      loadData();
    }
  }

  async function handleToggleStatus(user: AppUser) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await supabase.from('app_users').update({ status: newStatus }).eq('id', user.id);
    addToast({ type: 'info', title: 'Status Updated', message: `${user.name} is now ${newStatus}.` });
    loadData();
  }

  async function handleSaveConfig(config: SystemConfig) {
    await supabase.from('system_config').update({
      config_value: editConfigVal,
      updated_by: 'Admin',
      updated_at: new Date().toISOString(),
    }).eq('id', config.id);
    addToast({ type: 'success', title: 'Config Saved', message: `${config.label} updated.` });
    setEditingConfig(null);
    loadData();
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-primary-50 text-brand-orange',
    cfa: 'bg-warning-100 text-warning-700',
    division_approver: 'bg-success-100 text-success-700',
    final_approver: 'bg-blue-100 text-brand-blue',
    viewer: 'bg-ink-100 text-ink-500',
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin / Executive',
    cfa: 'CFA / CNF',
    division_approver: 'Division Approver',
    final_approver: 'Final Approver',
    viewer: 'Viewer',
  };

  const workflowConfigs = configs.filter(c => !['supply_chain_email', 'warehouse_email', 'operations_email'].includes(c.config_key));
  const emailConfigs = configs.filter(c => ['supply_chain_email', 'warehouse_email', 'operations_email'].includes(c.config_key));

  const inputClass = "w-full border border-app-surface-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 bg-white text-ink-900";

  if (currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500 font-medium">Access Restricted</p>
          <p className="text-sm text-ink-300 mt-1">Config & User Management is only available to Admin users</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Config & User Management</h1>
        <p className="text-sm text-ink-500 mt-0.5">System configuration and user access control</p>
      </div>

      <div className="flex gap-1 bg-app-surface-dark p-1 rounded-lg w-fit">
        {(['users', 'workflow', 'emails'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${activeTab === tab ? 'bg-app-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
            {tab === 'users' ? `Users (${users.length})` : tab === 'workflow' ? 'Workflow Config' : 'Email Recipients'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={14} /> Add User
            </button>
          </div>

          <Card>
            {loading ? (
              <div className="py-12 text-center text-ink-300">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-app-bg border-b border-app-surface-dark">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Division</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-surface-dark">
                  {users.map(user => (
                    <tr key={user.id} className={user.status === 'inactive' ? 'opacity-50' : 'hover:bg-app-bg/50'}>
                      <td className="px-4 py-3 font-medium text-ink-900">{user.name}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge className={roleColors[user.role] || 'bg-app-surface-dark text-ink-700'}>{roleLabels[user.role] || user.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{(user as any).division?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={user.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-600'}>{user.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className="text-xs text-ink-500 hover:text-ink-900 border border-app-surface-dark px-2 py-1 rounded-lg transition-colors hover:bg-app-bg"
                        >
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {showAddUser && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-app-surface rounded-2xl shadow-xl p-6 w-full max-w-md border border-app-surface-dark">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-ink-900">Add New User</h3>
                  <button onClick={() => setShowAddUser(false)}><X size={16} className="text-ink-300" /></button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g., Rahul Sharma' },
                    { label: 'Email *', key: 'email', type: 'email', placeholder: 'e.g., rahul@company.com' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-ink-500 block mb-1">{f.label}</label>
                      <input type={f.type} value={(newUser as any)[f.key]} placeholder={f.placeholder}
                        onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                        className={inputClass} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-ink-500 block mb-1">Role *</label>
                    <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                      className={inputClass}>
                      <option value="admin">Admin / Executive</option>
                      <option value="cfa">CFA / CNF</option>
                      <option value="division_approver">Division Approver</option>
                      <option value="final_approver">Final Approver</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  {newUser.role === 'division_approver' && (
                    <div>
                      <label className="text-xs text-ink-500 block mb-1">Division *</label>
                      <select value={newUser.division_id} onChange={e => setNewUser(p => ({ ...p, division_id: e.target.value }))}
                        className={inputClass}>
                        <option value="">Select division</option>
                        {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowAddUser(false)} className="flex-1 py-2 text-sm border border-app-surface-dark rounded-lg text-ink-700 hover:bg-app-bg">Cancel</button>
                  <button onClick={handleAddUser} disabled={!newUser.name || !newUser.email}
                    className="flex-1 py-2 text-sm bg-brand-orange text-white rounded-lg hover:bg-brand-orange-dark font-medium disabled:opacity-50">
                    Add User
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'workflow' && (
        <Card>
          <div className="px-4 py-3 border-b border-app-surface-dark flex items-center gap-2">
            <Settings size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Workflow Configuration</h2>
          </div>
          <div className="divide-y divide-app-surface-dark">
            {workflowConfigs.map(config => (
              <div key={config.id} className="px-4 py-4 flex items-center justify-between">
                <div className="flex-1 pr-6">
                  <p className="text-sm font-medium text-ink-900">{config.label}</p>
                  {config.description && <p className="text-xs text-ink-500 mt-0.5">{config.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {editingConfig === config.id ? (
                    <>
                      <input
                        type={config.config_type === 'number' ? 'number' : 'text'}
                        value={editConfigVal}
                        onChange={e => setEditConfigVal(e.target.value)}
                        className="w-32 border border-brand-orange/40 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-orange/30"
                      />
                      <button onClick={() => handleSaveConfig(config)} className="text-success-600 hover:text-success-700 p-1">
                        <Save size={14} />
                      </button>
                      <button onClick={() => setEditingConfig(null)} className="text-ink-300 p-1">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`text-sm font-medium ${
                        config.config_value === 'true' ? 'text-success-600' :
                        config.config_value === 'false' ? 'text-danger-500' : 'text-ink-900'
                      }`}>
                        {config.config_value === 'true' ? '✓ Enabled' :
                         config.config_value === 'false' ? '✗ Disabled' : config.config_value}
                      </span>
                      <button onClick={() => { setEditingConfig(config.id); setEditConfigVal(config.config_value); }}
                        className="text-ink-300 hover:text-brand-orange p-1 transition-colors">
                        <Edit2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'emails' && (
        <Card>
          <div className="px-4 py-3 border-b border-app-surface-dark flex items-center gap-2">
            <Settings size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Email Recipients</h2>
            <p className="ml-auto text-xs text-ink-300">Changes apply to new email triggers only</p>
          </div>
          <div className="divide-y divide-app-surface-dark">
            {emailConfigs.map(config => (
              <div key={config.id} className="px-4 py-4 flex items-center justify-between">
                <div className="flex-1 pr-6">
                  <p className="text-sm font-medium text-ink-900">{config.label}</p>
                  {config.description && <p className="text-xs text-ink-500 mt-0.5">{config.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {editingConfig === config.id ? (
                    <>
                      <input type="email" value={editConfigVal} onChange={e => setEditConfigVal(e.target.value)}
                        className="w-48 border border-brand-orange/40 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-orange/30" />
                      <button onClick={() => handleSaveConfig(config)} className="text-success-600 hover:text-success-700"><Save size={14} /></button>
                      <button onClick={() => setEditingConfig(null)} className="text-ink-300"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-ink-700 font-mono">{config.config_value}</span>
                      <button onClick={() => { setEditingConfig(config.id); setEditConfigVal(config.config_value); }} className="text-ink-300 hover:text-brand-orange p-1 transition-colors">
                        <Edit2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
