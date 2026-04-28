import { useEffect, useState } from 'react';
import {
  Settings, Plus, Save, X, AlertCircle,
  Clock, ShieldCheck, FileText, ScrollText, CreditCard as Edit2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppUser, SystemConfig, Division, type UserRole } from '../types';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

// ── Constants ─────────────────────────────────────────────────────────────────

const SLA_KEYS = ['sla_cfa_hours', 'sla_division_hours', 'sla_final_approver_hours'];
const EMAIL_KEYS = ['supply_chain_email', 'warehouse_email', 'operations_email'];

const SLA_META: Record<string, { role: string; color: string; icon: string; desc: string }> = {
  sla_cfa_hours: {
    role: 'CFA / CNF',
    color: 'bg-warning-100 text-warning-700 border-warning-200',
    icon: '🏭',
    desc: 'Time to enter and submit an order after creation',
  },
  sla_division_hours: {
    role: 'Division Approver',
    color: 'bg-success-100 text-success-700 border-success-200',
    icon: '🔬',
    desc: 'Time to review and act on an order or RC line item',
  },
  sla_final_approver_hours: {
    role: 'Final Approver',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: '✅',
    desc: 'Time to approve or reject after division sign-off',
  },
};

const DIVISION_PERMISSION_ACTIONS = [
  { key: 'approve', label: 'Approve', desc: 'Clear the order or RC for the next stage', defaultValue: true },
  { key: 'reject', label: 'Reject', desc: 'Send the request back or stop it', defaultValue: true },
  { key: 'edit_items', label: 'Edit', desc: 'Adjust quantities or pricing during review', defaultValue: true },
  { key: 'delete_items', label: 'Delete Items', desc: 'Remove lines before taking a decision', defaultValue: true },
];

const FINAL_PERMISSION_ACTIONS = [
  { key: 'approve', label: 'Accept', desc: 'Final acceptance at the last checkpoint', defaultValue: true },
  { key: 'reject', label: 'Reject', desc: 'Final rejection at the last checkpoint', defaultValue: true },
];

const PERMISSION_RESOURCES = [
  {
    key: 'order',
    label: 'Orders',
    icon: FileText,
    roles: [
      { key: 'division', label: 'Division Approver', badge: 'bg-success-100 text-success-700', actions: DIVISION_PERMISSION_ACTIONS },
      { key: 'final', label: 'Final Approver', badge: 'bg-blue-100 text-blue-700', actions: FINAL_PERMISSION_ACTIONS },
    ],
  },
  {
    key: 'rc',
    label: 'Rate Contracts',
    icon: ScrollText,
    roles: [
      { key: 'division', label: 'Division Approver', badge: 'bg-success-100 text-success-700', actions: DIVISION_PERMISSION_ACTIONS },
      { key: 'final', label: 'Final Approver', badge: 'bg-blue-100 text-blue-700', actions: FINAL_PERMISSION_ACTIONS },
    ],
  },
];

const WORKFLOW_RULES = [
  {
    key: 'workflow_reportee_manager_auto_approval',
    label: 'Reportee Manager Auto Approval',
    description: 'Orders created by ASM / RSM / GM / Director auto-clear the reporting-manager layer and move straight into division review for the demo.',
    defaultValue: true,
  },
];

function permKey(role: string, resource: string, action: string) {
  return `perm_${role}_${resource}_${action}`;
}

type NewUserForm = {
  name: string;
  email: string;
  role: UserRole;
  division_id: string;
  status: 'active';
};

const NEW_USER_FIELDS = [
  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g., Rahul Sharma' },
  { label: 'Email *', key: 'email', type: 'email', placeholder: 'e.g., rahul@company.com' },
] as const;

function emptyNewUser(): NewUserForm {
  return { name: '', email: '', role: 'cfa', division_id: '', status: 'active' };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
        checked ? 'bg-brand-orange' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Config() {
  const { currentRole, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'users' | 'workflow' | 'emails'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(emptyNewUser());

  // SLA editing state
  const [editingSla, setEditingSla] = useState<string | null>(null);
  const [slaVal, setSlaVal] = useState('');

  // General config editing state
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editConfigVal, setEditConfigVal] = useState('');

  // Permission save loading
  const [permSaving, setPermSaving] = useState<string | null>(null);

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

  function getConfig(key: string) {
    return configs.find(c => c.config_key === key);
  }
  function getVal(key: string) {
    return getConfig(key)?.config_value ?? '';
  }

  function getBooleanConfig(key: string, defaultValue = false) {
    const value = getVal(key);
    if (!value) return defaultValue;
    return value === 'true';
  }

  // ── Persist a single config value ──────────────────────────────────────────

  async function saveConfig(
    key: string,
    value: string,
    meta?: { configType?: string; label?: string; description?: string }
  ) {
    const existing = getConfig(key);
    if (existing) {
      const { error } = await supabase.from('system_config').update({
        config_value: value,
        updated_by: 'Admin',
        updated_at: new Date().toISOString(),
      }).eq('config_key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('system_config').insert({
        config_key: key,
        config_value: value,
        config_type: meta?.configType || 'text',
        label: meta?.label || key,
        description: meta?.description || '',
        updated_by: 'Admin',
      });
      if (error) throw error;
    }
    await loadData();
  }

  // ── SLA save ───────────────────────────────────────────────────────────────

  async function saveSla(key: string) {
    try {
      await saveConfig(key, slaVal);
      addToast({ type: 'success', title: 'SLA Updated', message: `${SLA_META[key]?.role} SLA set to ${slaVal} hours.` });
      setEditingSla(null);
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Save Failed', message: getErrorMessage(error, 'Could not update SLA.') });
    }
  }

  // ── Permission toggle ──────────────────────────────────────────────────────

  async function togglePerm(key: string, newValue: boolean, label: string, description: string) {
    setPermSaving(key);
    try {
      await saveConfig(key, newValue ? 'true' : 'false', {
        configType: 'boolean',
        label,
        description,
      });
      addToast({ type: 'success', title: 'Permission Updated', message: `Setting saved.` });
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Save Failed', message: getErrorMessage(error, 'Could not update permission.') });
    } finally {
      setPermSaving(null);
    }
  }

  async function toggleWorkflowRule(key: string, newValue: boolean, label: string, description: string) {
    setPermSaving(key);
    try {
      await saveConfig(key, newValue ? 'true' : 'false', {
        configType: 'boolean',
        label,
        description,
      });
      addToast({ type: 'success', title: 'Workflow Rule Updated', message: 'Demo rule saved.' });
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Save Failed', message: getErrorMessage(error, 'Could not update workflow rule.') });
    } finally {
      setPermSaving(null);
    }
  }

  // ── General config save ────────────────────────────────────────────────────

  async function handleSaveConfig(config: SystemConfig) {
    try {
      await saveConfig(config.config_key, editConfigVal);
      addToast({ type: 'success', title: 'Config Saved', message: `${config.label} updated.` });
      setEditingConfig(null);
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Save Failed', message: getErrorMessage(error, 'Could not save config.') });
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async function handleAddUser() {
    if (!newUser.name || !newUser.email || !newUser.role) return;
    const { error } = await supabase.from('app_users').insert({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      division_id: newUser.division_id || null,
      status: 'active',
    });
    if (error) {
      addToast({ type: 'error', title: 'Error', message: error.message });
    } else {
      addToast({ type: 'success', title: 'User Added', message: `${newUser.name} added successfully.` });
      setShowAddUser(false);
      setNewUser(emptyNewUser());
      loadData();
    }
  }

  async function handleToggleStatus(user: AppUser) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await supabase.from('app_users').update({ status: newStatus }).eq('id', user.id);
    addToast({ type: 'info', title: 'Status Updated', message: `${user.name} is now ${newStatus}.` });
    loadData();
  }

  // ── Derived config lists ───────────────────────────────────────────────────

  const generalConfigs = configs.filter(c =>
    !SLA_KEYS.includes(c.config_key) &&
    !EMAIL_KEYS.includes(c.config_key) &&
    !c.config_key.startsWith('perm_') &&
    !WORKFLOW_RULES.some(rule => rule.key === c.config_key)
  );
  const emailConfigs = configs.filter(c => EMAIL_KEYS.includes(c.config_key));

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
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              activeTab === tab ? 'bg-app-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
            }`}>
            {tab === 'users' ? `Users (${users.length})` : tab === 'workflow' ? 'Workflow Config' : 'Email Recipients'}
          </button>
        ))}
      </div>

      {/* ── Users Tab ────────────────────────────────────────────────────────── */}
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
                      <td className="px-4 py-3 text-ink-500 text-xs">{user.division?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={user.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-600'}>{user.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleToggleStatus(user)} className="text-xs text-ink-500 hover:text-ink-900 border border-app-surface-dark px-2 py-1 rounded-lg transition-colors hover:bg-app-bg">
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
                  {NEW_USER_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="text-xs text-ink-500 block mb-1">{field.label}</label>
                      <input type={field.type} value={newUser[field.key]} placeholder={field.placeholder}
                        onChange={e => setNewUser(p => ({ ...p, [field.key]: e.target.value }))}
                        className={inputClass} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-ink-500 block mb-1">Role *</label>
                    <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className={inputClass}>
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
                      <select value={newUser.division_id} onChange={e => setNewUser(p => ({ ...p, division_id: e.target.value }))} className={inputClass}>
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

      {/* ── Workflow Config Tab ───────────────────────────────────────────────── */}
      {activeTab === 'workflow' && (
        <div className="space-y-6">

          {/* ── SLA Timings ────────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                <Clock size={14} className="text-amber-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-900">SLA Breach Thresholds</h2>
                <p className="text-[11px] text-ink-400">Max hours each role has to act before an SLA breach is flagged</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SLA_KEYS.map(key => {
                const meta = SLA_META[key];
                const current = getVal(key) || '—';
                const isEditing = editingSla === key;
                return (
                  <Card key={key} padding="none">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                          {meta.role}
                        </span>
                        {!isEditing && (
                          <button
                            onClick={() => { setEditingSla(key); setSlaVal(getVal(key)); }}
                            className="text-ink-300 hover:text-brand-orange p-1 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="720"
                              value={slaVal}
                              onChange={e => setSlaVal(e.target.value)}
                              className="w-full border border-brand-orange/40 rounded-lg px-3 py-2 text-2xl font-bold text-center text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 tabular-nums"
                            />
                            <span className="text-sm text-ink-500 font-medium shrink-0">hrs</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveSla(key)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-brand-orange text-white rounded-lg hover:bg-orange-600 transition-colors"
                            >
                              <Save size={11} /> Save
                            </button>
                            <button
                              onClick={() => setEditingSla(null)}
                              className="px-2.5 py-1.5 text-xs text-ink-500 hover:text-ink-800 border border-slate-200 rounded-lg transition-colors"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1.5 mb-1">
                            <span className="text-3xl font-black text-ink-900 tabular-nums">{current}</span>
                            <span className="text-sm text-ink-400 font-medium">hours</span>
                          </div>
                          <p className="text-[11px] text-ink-400 leading-relaxed">{meta.desc}</p>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ── Role Permissions ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                <Settings size={14} className="text-slate-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-900">Demo Workflow Rules</h2>
                <p className="text-[11px] text-ink-400">Configurable defaults used to tell the updated order story in the demo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {WORKFLOW_RULES.map(rule => {
                const enabled = getBooleanConfig(rule.key, rule.defaultValue);
                const saving = permSaving === rule.key;
                return (
                  <Card key={rule.key} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-ink-900">{rule.label}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Default {rule.defaultValue ? 'On' : 'Off'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-500">{rule.description}</p>
                      </div>
                      <div className={`shrink-0 transition-opacity ${saving ? 'opacity-40 pointer-events-none' : ''}`}>
                        <Toggle
                          checked={enabled}
                          onChange={value => toggleWorkflowRule(rule.key, value, rule.label, rule.description)}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-blue-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-900">Role Permissions</h2>
                <p className="text-[11px] text-ink-400">Division can approve, reject, edit, and delete items. Final can only accept or reject.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {PERMISSION_RESOURCES.map(resource => (
                <Card key={resource.key} padding="none">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <resource.icon size={14} className="text-ink-400" />
                    <h3 className="text-sm font-semibold text-ink-900">{resource.label}</h3>
                  </div>

                  <div className="space-y-3 p-4">
                    {resource.roles.map(role => (
                      <div key={role.key} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role.badge}`}>
                            {role.label}
                          </span>
                          <span className="text-[11px] text-ink-400">
                            {role.key === 'division' ? 'Editable control point' : 'Decision only'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {role.actions.map(action => {
                            const key = permKey(role.key, resource.key, action.key);
                            const val = getBooleanConfig(key, action.defaultValue);
                            const saving = permSaving === key;
                            const label = `${role.label}: ${action.label} ${resource.label}`;
                            return (
                              <div key={action.key} className="rounded-xl border border-white bg-white px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-ink-900">{action.label}</p>
                                    <p className="mt-0.5 text-[11px] text-ink-400">{action.desc}</p>
                                  </div>
                                  <div className={`shrink-0 transition-opacity ${saving ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <Toggle
                                      checked={val}
                                      onChange={value => togglePerm(key, value, label, action.desc)}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-50 bg-slate-50/60 rounded-b-2xl">
                    <p className="text-[10px] text-ink-400">
                      Changes take effect immediately on new actions. Existing in-progress items are unaffected.
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ── General workflow configs (existing key-value pairs) ──────────── */}
          {generalConfigs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <Settings size={14} className="text-slate-500" />
                </div>
                <h2 className="text-sm font-bold text-ink-900">General Config</h2>
              </div>
              <Card>
                <div className="divide-y divide-app-surface-dark">
                  {generalConfigs.map(config => (
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
                            <button
                              onClick={() => { setEditingConfig(config.id); setEditConfigVal(config.config_value); }}
                              className="text-ink-300 hover:text-brand-orange p-1 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── Emails Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'emails' && (
        <Card>
          <div className="px-4 py-3 border-b border-app-surface-dark flex items-center gap-2">
            <Settings size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Email Recipients</h2>
            <p className="ml-auto text-xs text-ink-300">Changes apply to new email triggers only</p>
          </div>
          <div className="divide-y divide-app-surface-dark">
            {emailConfigs.length === 0 && (
              <div className="py-8 text-center text-ink-300 text-sm">No email configs found.</div>
            )}
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
