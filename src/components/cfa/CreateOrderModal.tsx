import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Package, ChevronDown, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Hospital, Stockist, FieldRep, Division, Product } from '../../types';
import { formatINR } from '../../utils/formatters';

interface LineItem {
  productId: string;
  product: Product | null;
  quantity: number;
  unitPrice: number;
}

interface Prefill {
  hospitalId: string;
  stockistId: string;
  repId: string;
  notes: string;
}

interface Props {
  hospitals: Hospital[];
  stockists: Stockist[];
  reps: FieldRep[];
  divisions: Division[];
  prefill?: Prefill;
  onClose: () => void;
  onSubmit: (params: {
    hospitalId: string;
    stockistId: string;
    repId: string;
    notes: string;
    items: { productId: string; productName: string; divisionId: string; quantity: number; unitPrice: number }[];
  }) => Promise<void>;
}

export default function CreateOrderModal({ hospitals, stockists, reps, divisions, prefill, onClose, onSubmit }: Props) {
  const [hospitalId, setHospitalId] = useState(prefill?.hospitalId || '');
  const [stockistId, setStockistId] = useState(prefill?.stockistId || '');
  const [repId, setRepId] = useState(prefill?.repId || '');
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterDivision, setFilterDivision] = useState('');
  const [search, setSearch] = useState('');
  const [productPickerFor, setProductPickerFor] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*, division:divisions(*)')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => { if (data) setProducts(data as Product[]); });
  }, []);

  const filteredProducts = products.filter(p => {
    const matchDiv = !filterDivision || p.division_id === filterDivision;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchDiv && matchSearch;
  });

  function addLine() {
    setLineItems(prev => [...prev, { productId: '', product: null, quantity: 1, unitPrice: 0 }]);
    setProductPickerFor(lineItems.length);
  }

  function removeLine(i: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== i));
    if (productPickerFor === i) setProductPickerFor(null);
  }

  function selectProduct(i: number, product: Product) {
    setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, productId: product.id, product, unitPrice: product.unit_price } : l));
    setProductPickerFor(null);
    setSearch('');
    setFilterDivision('');
  }

  function updateQty(i: number, qty: number) {
    setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, quantity: Math.max(1, qty) } : l));
  }

  function updatePrice(i: number, price: number) {
    setLineItems(prev => prev.map((l, idx) => idx === i ? { ...l, unitPrice: Math.max(0, price) } : l));
  }

  const totalValue = lineItems.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const isValid = hospitalId && stockistId && repId && lineItems.length > 0 && lineItems.every(l => l.productId);

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    await onSubmit({
      hospitalId,
      stockistId,
      repId,
      notes,
      items: lineItems.map(l => ({
        productId: l.productId,
        productName: l.product!.name,
        divisionId: l.product!.division_id,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create Manual Order</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {prefill ? 'Pre-filled from failed ERP sync. Add products to complete.' : 'Fill order details and add product line items'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Hospital *</label>
              <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400">
                <option value="">Select hospital</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Stockist *</label>
              <select value={stockistId} onChange={e => setStockistId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400">
                <option value="">Select stockist</option>
                {stockists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Field Rep *</label>
              <select value={repId} onChange={e => setRepId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400">
                <option value="">Select rep</option>
                {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Reason for manual entry..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-none" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Product Line Items</p>
                <p className="text-xs text-slate-400">Add products to this order</p>
              </div>
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium border border-sky-200 hover:border-sky-300 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Product
              </button>
            </div>

            {lineItems.length === 0 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center">
                <Package size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No products added yet</p>
                <p className="text-xs text-slate-300 mt-0.5">Click "Add Product" to get started</p>
              </div>
            )}

            <div className="space-y-2">
              {lineItems.map((line, i) => (
                <div key={i} className="border border-slate-200 rounded-xl overflow-visible">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      {line.product ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{line.product.name}</p>
                            <p className="text-xs text-slate-400">{line.product.sku} &middot; {(line.product.division as unknown as { name: string })?.name}</p>
                          </div>
                          <button
                            onClick={() => { setProductPickerFor(i); setSearch(''); setFilterDivision(''); }}
                            className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 flex-shrink-0"
                          >
                            <ChevronDown size={12} /> Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setProductPickerFor(i); setSearch(''); setFilterDivision(''); }}
                          className="flex items-center gap-2 text-sm text-slate-400 hover:text-sky-600 transition-colors w-full text-left"
                        >
                          <Package size={14} />
                          <span>Click to select product</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-400">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e => updateQty(i, parseInt(e.target.value) || 1)}
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-400">Price</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.unitPrice}
                          onChange={e => updatePrice(i, parseFloat(e.target.value) || 0)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-20 text-right">
                        {formatINR(line.quantity * line.unitPrice)}
                      </span>
                      <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {productPickerFor === i && (
                    <div className="border-t border-slate-100 bg-slate-50 p-3">
                      <div className="flex gap-2 mb-2">
                        <div className="relative flex-1">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search product name or SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                          />
                        </div>
                        <select
                          value={filterDivision}
                          onChange={e => setFilterDivision(e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                        >
                          <option value="">All Divisions</option>
                          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button onClick={() => setProductPickerFor(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredProducts.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-3">No products found</p>
                        )}
                        {filteredProducts.map(p => (
                          <button
                            key={p.id}
                            onClick={() => selectProduct(i, p)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white rounded-lg transition-colors text-left group"
                          >
                            <div>
                              <span className="font-medium text-slate-800 group-hover:text-sky-700">{p.name}</span>
                              <span className="text-slate-400 ml-2">{p.sku}</span>
                              <span className="text-slate-400 ml-2">&middot; {(p.division as unknown as { name: string })?.name}</span>
                            </div>
                            <span className="text-slate-600 font-medium">{formatINR(p.unit_price)}/{p.unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {lineItems.length > 0 && (
              <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Order Value</p>
                  <p className="text-lg font-bold text-slate-900">{formatINR(totalValue)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Creating...' : `Create Order${lineItems.length > 0 ? ` (${lineItems.length} item${lineItems.length > 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
