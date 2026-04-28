import { useEffect, useState, useCallback } from 'react';
import { Search, X, Plus, Pencil, PackageSearch, AlertTriangle, Pill } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Division } from '../types';
import { formatINR } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/SkeletonLoader';
import Modal from '../components/ui/Modal';

// ── Form state ────────────────────────────────────────────────────────────────

interface ProductForm {
  brand_name: string;
  drug_name: string;
  strength: string;
  packing: string;
  mrp: string;
  price_to_stockist: string;
  division_id: string;
  sku: string;
}

const emptyForm = (): ProductForm => ({
  brand_name: '',
  drug_name: '',
  strength: '',
  packing: '',
  mrp: '',
  price_to_stockist: '',
  division_id: '',
  sku: '',
});

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

// ── Shared input component ────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  prefix,
  suffix,
  className = '',
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {readOnly ? (
        <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-700 font-medium min-h-[36px]">
          {value || '—'}
        </div>
      ) : (
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-sm text-slate-400 pointer-events-none select-none">{prefix}</span>
          )}
          <input
            type="text"
            value={value}
            onChange={e => onChange?.(e.target.value)}
            placeholder={placeholder}
            className={`w-full ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'} py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-all bg-white text-slate-900 placeholder:text-slate-400`}
          />
          {suffix && (
            <span className="absolute right-3 text-sm text-slate-400 pointer-events-none select-none">{suffix}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Catalogue() {
  const { currentRole, addToast } = useApp();
  const isAdmin = currentRole === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm());
  const [editSaving, setEditSaving] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<ProductForm>(emptyForm());
  const [addSaving, setAddSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodRes, divRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, division:divisions(*)')
          .eq('status', 'active')
          .order('brand_name', { ascending: true, nullsFirst: false }),
        supabase.from('divisions').select('*').order('name'),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (divRes.error) throw divRes.error;
      setProducts((prodRes.data || []) as Product[]);
      setDivisions(divRes.data || []);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'Could not load catalogue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (p.brand_name || '').toLowerCase().includes(q) ||
      (p.drug_name || p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q);
    const matchDiv = !divFilter || p.division_id === divFilter;
    return matchSearch && matchDiv;
  });

  const activeFilters = (search ? 1 : 0) + (divFilter ? 1 : 0);

  // ── Edit handlers ──────────────────────────────────────────────────────────

  function openEdit(product: Product) {
    setEditTarget(product);
    setEditForm({
      brand_name: product.brand_name || '',
      drug_name: product.drug_name || product.name || '',
      strength: product.strength || '',
      packing: product.packing || product.unit || '',
      mrp: product.mrp != null ? String(product.mrp) : '',
      price_to_stockist: product.price_to_stockist != null ? String(product.price_to_stockist) : '',
      division_id: product.division_id || '',
      sku: product.sku || '',
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('products').update({
        brand_name: editForm.brand_name || null,
        strength: editForm.strength || null,
        packing: editForm.packing || null,
        mrp: editForm.mrp ? parseFloat(editForm.mrp) : null,
        price_to_stockist: editForm.price_to_stockist ? parseFloat(editForm.price_to_stockist) : null,
        unit_price: editForm.price_to_stockist ? parseFloat(editForm.price_to_stockist) : 0,
      }).eq('id', editTarget.id);
      if (error) throw error;
      addToast({ type: 'success', title: 'Product Updated', message: `${editForm.brand_name || editForm.drug_name} saved.` });
      setEditTarget(null);
      loadData();
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Save Failed', message: getErrorMessage(error, 'Could not save product.') });
    } finally {
      setEditSaving(false);
    }
  }

  // ── Add handlers ───────────────────────────────────────────────────────────

  function openAdd() {
    setAddForm(emptyForm());
    setAddOpen(true);
  }

  async function saveAdd() {
    if (!addForm.drug_name.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Drug Name is required.' });
      return;
    }
    if (!addForm.division_id) {
      addToast({ type: 'error', title: 'Required', message: 'Division is required.' });
      return;
    }
    if (!addForm.sku.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'SKU is required.' });
      return;
    }
    setAddSaving(true);
    try {
      const { error } = await supabase.from('products').insert({
        name: addForm.drug_name.trim(),
        sku: addForm.sku.trim().toUpperCase(),
        division_id: addForm.division_id,
        unit_price: addForm.price_to_stockist ? parseFloat(addForm.price_to_stockist) : 0,
        unit: addForm.packing || 'Unit',
        status: 'active',
        brand_name: addForm.brand_name || null,
        drug_name: addForm.drug_name.trim(),
        strength: addForm.strength || null,
        packing: addForm.packing || null,
        mrp: addForm.mrp ? parseFloat(addForm.mrp) : null,
        price_to_stockist: addForm.price_to_stockist ? parseFloat(addForm.price_to_stockist) : null,
      });
      if (error) throw error;
      addToast({ type: 'success', title: 'Medicine Added', message: `${addForm.brand_name || addForm.drug_name} added to catalogue.` });
      setAddOpen(false);
      loadData();
    } catch (error: unknown) {
      addToast({ type: 'error', title: 'Add Failed', message: getErrorMessage(error, 'Could not add medicine.') });
    } finally {
      setAddSaving(false);
    }
  }

  // ── Shared form body ───────────────────────────────────────────────────────

  function FormBody({
    form,
    setForm,
    drugNameReadOnly = false,
    showDivisionSku = false,
  }: {
    form: ProductForm;
    setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
    drugNameReadOnly?: boolean;
    showDivisionSku?: boolean;
  }) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Drug Name (generic) *"
            value={form.drug_name}
            onChange={drugNameReadOnly ? undefined : v => setForm(f => ({ ...f, drug_name: v }))}
            placeholder="e.g. Ferric Carboxymaltose Injection"
            readOnly={drugNameReadOnly}
          />
          <Field
            label="Product (Brand Name)"
            value={form.brand_name}
            onChange={v => setForm(f => ({ ...f, brand_name: v }))}
            placeholder="e.g. FOXIFUSE"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Strength"
            value={form.strength}
            onChange={v => setForm(f => ({ ...f, strength: v }))}
            placeholder="e.g. 10mL, 500mg"
          />
          <Field
            label="Packing"
            value={form.packing}
            onChange={v => setForm(f => ({ ...f, packing: v }))}
            placeholder="e.g. 1 Vial, 10 Tablets"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="MRP (₹)"
            value={form.mrp}
            onChange={v => setForm(f => ({ ...f, mrp: v }))}
            placeholder="100"
            prefix="₹"
          />
          <Field
            label="Price to Stockist (₹)"
            value={form.price_to_stockist}
            onChange={v => setForm(f => ({ ...f, price_to_stockist: v }))}
            placeholder="30"
            prefix="₹"
          />
        </div>

        {showDivisionSku && (
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Division *
              </label>
              <select
                value={form.division_id}
                onChange={e => setForm(f => ({ ...f, division_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 bg-white text-ink-900"
              >
                <option value="">Select division…</option>
                {divisions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <Field
              label="SKU *"
              value={form.sku}
              onChange={v => setForm(f => ({ ...f, sku: v }))}
              placeholder="e.g. SKU-FOXI-10"
            />
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product Catalogue"
        description={`${filtered.length} medicine${filtered.length !== 1 ? 's' : ''} ${divFilter ? 'in selected division' : 'total'}`}
        badge={activeFilters > 0 ? (
          <span className="text-xs bg-primary-50 text-brand-orange font-semibold px-2 py-0.5 rounded-full">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </span>
        ) : undefined}
        actions={isAdmin ? (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-orange hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Medicine
          </button>
        ) : undefined}
      />

      <Card>
        {/* Search & filter bar */}
        <div className="p-3 border-b border-slate-100 flex gap-2.5 items-center">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search by brand name, drug name, or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-all bg-white text-ink-900 placeholder:text-ink-400"
            />
          </div>
          <select
            value={divFilter}
            onChange={e => setDivFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-colors"
          >
            <option value="">All Divisions</option>
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setDivFilter(''); }}
              className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Catalogue could not be loaded"
            description={loadError}
            action={<button onClick={loadData} className="text-sm text-brand-orange font-medium underline underline-offset-2">Retry</button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No medicines found"
            description={activeFilters > 0 ? 'Try adjusting your search or filter' : 'No products in the catalogue yet'}
            action={activeFilters > 0 ? (
              <button onClick={() => { setSearch(''); setDivFilter(''); }} className="text-sm text-brand-orange font-medium underline underline-offset-2">Clear filters</button>
            ) : isAdmin ? (
              <button onClick={openAdd} className="text-sm text-brand-orange font-medium underline underline-offset-2">Add first medicine</button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Product</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Drug Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Strength</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Packing</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">MRP</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Price to Stockist</th>
                  {isAdmin && <th className="w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <span className="font-bold text-ink-900 text-[13px] tracking-wide">
                          {product.brand_name || <span className="text-ink-300 font-normal text-xs">No brand</span>}
                        </span>
                        <div className="text-[10px] text-ink-400 font-mono mt-0.5">{product.sku}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-700 text-xs">{product.drug_name || product.name}</span>
                      {product.division && (
                        <div className="text-[10px] text-ink-400 mt-0.5">{product.division.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-ink-700 font-medium">{product.strength || <span className="text-ink-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-ink-700">{product.packing || product.unit || <span className="text-ink-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-xs font-semibold text-ink-900 tabular-nums">
                        {product.mrp != null && product.mrp > 0 ? formatINR(product.mrp) : <span className="text-ink-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-xs text-ink-700 tabular-nums">
                        {product.price_to_stockist != null && product.price_to_stockist > 0 ? formatINR(product.price_to_stockist) : <span className="text-ink-300">—</span>}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => openEdit(product)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-500 hover:text-brand-orange border border-transparent hover:border-brand-orange/30 hover:bg-orange-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit — ${editTarget?.brand_name || editTarget?.drug_name || 'Product'}`}
        size="lg"
        footer={(
          <div className="flex justify-end gap-2.5">
            <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 text-sm font-semibold bg-brand-orange hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-60">
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      >
        <FormBody form={editForm} setForm={setEditForm} drugNameReadOnly showDivisionSku={false} />
      </Modal>

      {/* ── Add Medicine Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Medicine"
        size="lg"
        footer={(
          <div className="flex justify-end gap-2.5">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={saveAdd} disabled={addSaving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-brand-orange hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-60">
              <Pill size={13} />
              {addSaving ? 'Adding…' : 'Add Medicine'}
            </button>
          </div>
        )}
      >
        <FormBody form={addForm} setForm={setAddForm} drugNameReadOnly={false} showDivisionSku />
      </Modal>
    </div>
  );
}
