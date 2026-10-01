/**
 * AffiliateManager.tsx — Plugin Amazon Affiliates Manager
 *
 * CRUD de produtos afiliados + configurações do plugin.
 * Salva em src/data/affiliateProducts.json e src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import {
  Save, Loader2, AlertCircle, Plus, Trash2, Edit2,
  ToggleLeft, ToggleRight, ShoppingCart, Copy, Settings, Package, Tag, Store, Globe,
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const PRODUCTS_PATH = 'src/data/affiliateProducts.json';
const CONFIG_PATH = 'src/data/pluginsConfig.json';
const CATEGORIES_PATH = 'src/data/productCategories.json';
const MERCHANTS_PATH = 'src/data/productMerchants.json';

interface ExtraLink {
  label: string;
  url: string;
}

interface Product {
  id: string;
  slug: string;
  title: string;
  category?: string;
  description?: string;
  image: string;
  amazonUrl: string; // Link de Afiliado do Produto (Amazon, Shopee, Mercado Livre, etc.)
  reviewUrl?: string; // Link de Ver Review (Opcional - se vazio, exibe o botão inativado)
  merchant?: string; // Loja (ex: amazon.com.br, mercadolivre.com.br, shopee.com.br)
  extraLinks?: ExtraLink[];
  price?: string;
  originalPrice?: string;
  rating?: number;
  pros?: string[];
  cons?: string[];
  badge?: string;
  buttonText?: string;
  enabled: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

interface MerchantItem {
  id: string;
  name: string;
  domain: string;
}

interface AffiliateConfig {
  enabled: boolean;
  amazonTag: string;
  defaultButtonText: string;
  buttonColor: string;
  showPrices: boolean;
  showRatings: boolean;
  showProscons: boolean;
  showBadges: boolean;
  disclaimer: string;
  showDisclaimer: boolean;
}

const defaultConfig: AffiliateConfig = {
  enabled: true,
  amazonTag: '',
  defaultButtonText: 'Ver Produto',
  buttonColor: '#2222D3',
  showPrices: true,
  showRatings: true,
  showProscons: true,
  showBadges: true,
  disclaimer: 'Este artigo contém links de afiliado. Podemos receber uma comissão por compras feitas através deles.',
  showDisclaimer: true,
};

const emptyProduct = (): Omit<Product, 'id'> => ({
  slug: '',
  title: '',
  category: 'Geral',
  description: '',
  image: '',
  amazonUrl: '',
  reviewUrl: '',
  merchant: 'amazon.com.br',
  extraLinks: [],
  price: '',
  originalPrice: '',
  rating: 5,
  pros: [],
  cons: [],
  badge: '',
  buttonText: 'Ver Produto',
  enabled: true,
});

const BADGE_OPTIONS = ['', 'Melhor Escolha', 'Mais Vendido', 'Melhor Custo-Benefício', 'Recomendado', 'Editor\'s Choice', 'Premium', 'Orçamento'];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

export default function AffiliateManager() {
  const [tab, setTab] = useState<'products' | 'categories' | 'merchants' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsSha, setProductsSha] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesSha, setCategoriesSha] = useState('');
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [merchantsSha, setMerchantsSha] = useState('');
  const [configSha, setConfigSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [config, setConfig] = useState<AffiliateConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');

  // States de produto
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct());
  const [prosText, setProsText] = useState('');
  const [consText, setConsText] = useState('');
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');

  // States de categoria
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '' });
  const [showCatForm, setShowCatForm] = useState(false);

  // States de loja/plataforma
  const [editingMerchId, setEditingMerchId] = useState<string | null>(null);
  const [merchForm, setMerchForm] = useState({ name: '', domain: '' });
  const [showMerchForm, setShowMerchForm] = useState(false);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setForm(f => ({ ...f, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    Promise.all([
      githubApi('read', PRODUCTS_PATH).catch(() => null),
      githubApi('read', CONFIG_PATH).catch(() => null),
      githubApi('read', CATEGORIES_PATH).catch(() => null),
      githubApi('read', MERCHANTS_PATH).catch(() => null),
    ]).then(([prodData, cfgData, catData, merchData]) => {
      if (prodData) {
        const arr = JSON.parse(prodData.content);
        setProducts(Array.isArray(arr) ? arr : []);
        setProductsSha(prodData.sha);
      }
      if (cfgData) {
        const cfg = JSON.parse(cfgData.content);
        setFullConfig(cfg);
        setConfigSha(cfgData.sha);
        if (cfg.affiliates) {
          setConfig({ ...defaultConfig, ...cfg.affiliates });
        }
      }
      if (catData) {
        const arr = JSON.parse(catData.content);
        setCategories(Array.isArray(arr) ? arr : []);
        setCategoriesSha(catData.sha);
      } else {
        setCategories([
          { id: 'cat-1', name: 'Smart Home', slug: 'smart-home' },
          { id: 'cat-2', name: 'Celulares', slug: 'celulares' },
          { id: 'cat-3', name: 'Áudio', slug: 'audio' },
          { id: 'cat-4', name: 'Hardware', slug: 'hardware' },
          { id: 'cat-5', name: 'Periféricos', slug: 'perifericos' },
          { id: 'cat-6', name: 'Geral', slug: 'geral' },
        ]);
      }
      if (merchData) {
        const arr = JSON.parse(merchData.content);
        setMerchants(Array.isArray(arr) ? arr : []);
        setMerchantsSha(merchData.sha);
      } else {
        setMerchants([
          { id: 'm-1', name: 'Amazon', domain: 'amazon.com.br' },
          { id: 'm-2', name: 'Mercado Livre', domain: 'mercadolivre.com.br' },
          { id: 'm-3', name: 'Shopee', domain: 'shopee.com.br' },
          { id: 'm-4', name: 'Magalu', domain: 'magazineluiza.com.br' },
          { id: 'm-5', name: 'Outra Loja', domain: 'loja-parceira.com.br' },
        ]);
      }
    }).finally(() => setLoading(false));
  }, []);

  const saveProducts = async (newList: Product[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await githubApi('write', PRODUCTS_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: productsSha || undefined,
        message: 'CMS: Update affiliate products',
      });
      setProductsSha(res.sha || productsSha);
      setProducts(newList);
      triggerToast('Produtos salvos com sucesso!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveCategories = async (newList: CategoryItem[]) => {
    setSaving(true);
    try {
      const res = await githubApi('write', CATEGORIES_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: categoriesSha || undefined,
        message: 'CMS: Update product categories',
      });
      setCategoriesSha(res.sha || categoriesSha);
      setCategories(newList);
      triggerToast('Categorias salvas com sucesso!', 'success', 100);
    } catch (err: any) {
      triggerToast(`Erro ao salvar categorias: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMerchants = async (newList: MerchantItem[]) => {
    setSaving(true);
    try {
      const res = await githubApi('write', MERCHANTS_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: merchantsSha || undefined,
        message: 'CMS: Update product merchants',
      });
      setMerchantsSha(res.sha || merchantsSha);
      setMerchants(newList);
      triggerToast('Lojas salvas com sucesso!', 'success', 100);
    } catch (err: any) {
      triggerToast(`Erro ao salvar lojas: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!fullConfig) return;
    setSavingConfig(true);
    setError('');
    try {
      const newFullConfig = { ...fullConfig, affiliates: config };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(newFullConfig, null, 4),
        sha: configSha || undefined,
        message: 'CMS: Update affiliates config',
      });
      setConfigSha(res.sha || configSha);
      setFullConfig(newFullConfig);
      triggerToast('Configurações salvas!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Handlers de Categoria
  const handleAddCat = () => {
    setEditingCatId(null);
    setCatForm({ name: '', slug: '' });
    setShowCatForm(true);
  };

  const handleEditCat = (cat: CategoryItem) => {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, slug: cat.slug });
    setShowCatForm(true);
  };

  const handleSaveCat = () => {
    if (!catForm.name.trim()) {
      triggerToast('Informe o nome da categoria', 'error');
      return;
    }
    const slug = catForm.slug.trim() || slugify(catForm.name);
    const item: CategoryItem = {
      id: editingCatId || `cat_${Date.now()}`,
      name: catForm.name.trim(),
      slug,
    };
    let newList: CategoryItem[];
    if (editingCatId) {
      newList = categories.map(c => c.id === editingCatId ? item : c);
    } else {
      newList = [...categories, item];
    }
    setShowCatForm(false);
    setEditingCatId(null);
    saveCategories(newList);
  };

  const handleDeleteCat = (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    saveCategories(categories.filter(c => c.id !== id));
  };

  // Handlers de Loja/Plataforma
  const handleAddMerch = () => {
    setEditingMerchId(null);
    setMerchForm({ name: '', domain: '' });
    setShowMerchForm(true);
  };

  const handleEditMerch = (m: MerchantItem) => {
    setEditingMerchId(m.id);
    setMerchForm({ name: m.name, domain: m.domain });
    setShowMerchForm(true);
  };

  const handleSaveMerch = () => {
    if (!merchForm.name.trim()) {
      triggerToast('Informe o nome da loja', 'error');
      return;
    }
    if (!merchForm.domain.trim()) {
      triggerToast('Informe o domínio da loja', 'error');
      return;
    }
    const item: MerchantItem = {
      id: editingMerchId || `m_${Date.now()}`,
      name: merchForm.name.trim(),
      domain: merchForm.domain.trim().toLowerCase(),
    };
    let newList: MerchantItem[];
    if (editingMerchId) {
      newList = merchants.map(m => m.id === editingMerchId ? item : m);
    } else {
      newList = [...merchants, item];
    }
    setShowMerchForm(false);
    setEditingMerchId(null);
    saveMerchants(newList);
  };

  const handleDeleteMerch = (id: string) => {
    if (!confirm('Excluir esta loja?')) return;
    saveMerchants(merchants.filter(m => m.id !== id));
  };

  const handleAdd = () => {
    setEditingId(null);
    const p = emptyProduct();
    if (categories.length > 0) p.category = categories[0].name;
    if (merchants.length > 0) p.merchant = merchants[0].domain;
    setForm(p);
    setProsText('');
    setConsText('');
    setExtraLinks([]);
    setImageMode('url');
    setShowForm(true);
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      title: p.title,
      category: p.category || (categories[0]?.name || 'Geral'),
      description: p.description || '',
      image: p.image || '',
      amazonUrl: p.amazonUrl || '',
      reviewUrl: p.reviewUrl || '',
      merchant: p.merchant || (merchants[0]?.domain || 'amazon.com.br'),
      extraLinks: p.extraLinks || [],
      price: p.price || '',
      originalPrice: p.originalPrice || '',
      rating: p.rating || 5,
      pros: p.pros || [],
      cons: p.cons || [],
      badge: p.badge || '',
      buttonText: p.buttonText || 'Ver Produto',
      enabled: p.enabled !== false,
    });
    setProsText((p.pros || []).join('\n'));
    setConsText((p.cons || []).join('\n'));
    setExtraLinks(p.extraLinks || []);
    setImageMode(p.image && p.image.startsWith('data:') ? 'upload' : 'url');
    setShowForm(true);
  };

  const handleFormSave = () => {
    if (!form.title.trim()) {
      triggerToast('Preencha o título do produto', 'error');
      return;
    }
    if (!form.amazonUrl.trim()) {
      triggerToast('Preencha o link do produto / afiliado', 'error');
      return;
    }

    const finalSlug = form.slug.trim() || slugify(form.title);
    const finalPros = prosText.split('\n').map(s => s.trim()).filter(Boolean);
    const finalCons = consText.split('\n').map(s => s.trim()).filter(Boolean);

    const product: Product = {
      ...form,
      slug: finalSlug,
      pros: finalPros,
      cons: finalCons,
      extraLinks: extraLinks.filter(l => l.label.trim() && l.url.trim()),
      id: editingId || `p_${Date.now()}`,
    };

    let newList: Product[];
    if (editingId) {
      newList = products.map(p => p.id === editingId ? product : p);
    } else {
      newList = [...products, product];
    }

    setShowForm(false);
    setEditingId(null);
    saveProducts(newList);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este produto?')) return;
    saveProducts(products.filter(p => p.id !== id));
  };

  const handleToggle = (id: string) => {
    saveProducts(products.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const copyShortcode = (slug: string) => {
    navigator.clipboard.writeText(`[produto:${slug}]`);
    triggerToast(`Shortcode [produto:${slug}] copiado!`, 'success', 100);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
      <p className="font-medium animate-pulse">Carregando...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'products' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Package className="w-4 h-4" /> Produtos
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'categories' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Tag className="w-4 h-4" /> Categorias de Produtos
        </button>
        <button
          onClick={() => setTab('merchants')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'merchants' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Store className="w-4 h-4" /> Lojas / Plataformas
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Settings className="w-4 h-4" /> Configurações
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</p>
            <button
              onClick={handleAdd}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-5">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
              <div className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Título do Produto *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => {
                        const title = e.target.value;
                        setForm(f => ({ ...f, title, slug: f.slug || slugify(title) }));
                      }}
                      className={inputClass}
                      placeholder="Smartphone Motorola Moto G Max 5G 256GB"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slug (Auto / Identificador)</label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                      className={`${inputClass} font-mono`}
                      placeholder="smartphone-moto-g"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass + ' mb-0'}>Categoria</label>
                      <button
                        type="button"
                        onClick={() => setTab('categories')}
                        className="text-xs text-amber-600 font-bold hover:underline"
                      >
                        + Gerenciar
                      </button>
                    </div>
                    <select
                      value={form.category || (categories[0]?.name || 'Geral')}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className={inputClass}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass + ' mb-0'}>Loja / Plataforma</label>
                      <button
                        type="button"
                        onClick={() => setTab('merchants')}
                        className="text-xs text-amber-600 font-bold hover:underline"
                      >
                        + Gerenciar
                      </button>
                    </div>
                    <select
                      value={form.merchant || (merchants[0]?.domain || 'amazon.com.br')}
                      onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))}
                      className={inputClass}
                    >
                      {merchants.map(m => (
                        <option key={m.id} value={m.domain}>{m.name} ({m.domain})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Imagem do Produto (URL ou Upload) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className={labelClass + ' mb-0'}>Imagem do Produto *</label>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Tamanho recomendado: Proporção 4:3 (ex: 500x375px ou 280x186px), mínimo 300px.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setImageMode('url')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${imageMode === 'url' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        URL Externa
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode('upload')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${imageMode === 'upload' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Upload do PC
                      </button>
                    </div>
                  </div>

                  {imageMode === 'url' ? (
                    <div>
                      <input
                        type="url"
                        value={form.image}
                        onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                        className={inputClass}
                        placeholder="https://images.unsplash.com/... ou URL da imagem"
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer border border-slate-200 rounded-xl p-2 bg-white"
                      />
                    </div>
                  )}

                  {form.image && (
                    <div className="flex items-center gap-3 pt-1">
                      <img src={form.image} alt="preview" className="h-14 w-14 object-contain rounded-lg border border-slate-200 bg-white" />
                      <div className="text-xs">
                        <span className="text-emerald-600 font-bold block">✓ Imagem pronta</span>
                        <span className="text-slate-400">Exibição confirmada no card.</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Link do Produto / Afiliado (Botão "Ver Produto") *</label>
                  <input
                    type="url"
                    value={form.amazonUrl}
                    onChange={e => setForm(f => ({ ...f, amazonUrl: e.target.value }))}
                    className={`${inputClass} font-mono`}
                    placeholder="https://amazon.com.br/dp/... ou https://shopee.com.br/..."
                  />
                  <p className="text-xs text-slate-400 mt-1">Este link será aberto em uma nova aba (target="_blank") para não tirar o usuário do blog.</p>
                </div>

                <div>
                  <label className={labelClass}>Link de Review ("Ver Review") — Opcional</label>
                  <input
                    type="text"
                    value={form.reviewUrl || ''}
                    onChange={e => setForm(f => ({ ...f, reviewUrl: e.target.value }))}
                    className={`${inputClass} font-mono`}
                    placeholder="/review-monitor-gamer-curvo (ou deixe em branco)"
                  />
                  <p className="text-xs text-slate-400 mt-1">Se preenchido, ativa o botão "Ver Review". Se deixado em branco, o botão fica inativado no layout sem quebrar a estrutura.</p>
                </div>

                <div>
                  <label className={labelClass}>Texto do Botão de Compra</label>
                  <input
                    type="text"
                    value={form.buttonText || ''}
                    onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                    className={inputClass}
                    placeholder="Ver Produto"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors w-fit">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium text-slate-700">Ativo</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleFormSave}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar Produto'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Products list */}
          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Nenhum produto cadastrado</p>
              <p className="text-slate-400 text-sm mt-1">Clique em "Novo Produto" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(p => (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 ${!p.enabled ? 'opacity-50' : ''}`}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-14 h-14 object-contain rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <code className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">[produto:{p.slug}]</code>
                      {p.merchant && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">{p.merchant}</span>
                      )}
                      {p.category && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{p.category}</span>
                      )}
                      {p.reviewUrl ? (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">Review Ativo</span>
                      ) : (
                        <span className="text-xs bg-slate-50 text-slate-400 px-2 py-0.5 rounded font-medium">Review Inativo</span>
                      )}
                      {p.price && (
                        <span className="text-xs text-slate-500 font-medium">{p.price}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyShortcode(p.slug)}
                      title="Copiar shortcode"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggle(p.id)} className="text-slate-400 hover:text-amber-600 transition-colors p-1.5">
                      {p.enabled
                        ? <ToggleRight className="w-5 h-5 text-amber-500" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shortcode help */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Como usar nos artigos</p>
            <ul className="space-y-1.5 text-sm text-amber-800">
              <li>• Use <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">[produto:slug]</code> ou <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">[produto id="slug"]</code> no texto do artigo para exibir o card do produto.</li>
              <li>• O shortcode pode ser colado em uma linha própria do markdown do seu post.</li>
              <li>• Clique no ícone <Copy className="w-3 h-3 inline" /> de cada produto para copiar seu shortcode de forma rápida.</li>
            </ul>
          </div>
        </>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Categorias de Produtos</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cadastre as categorias para organizar os produtos nos cards e filtros.</p>
            </div>
            <button
              onClick={handleAddCat}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Nova Categoria
            </button>
          </div>

          {showCatForm && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3 shadow-sm">
              <h4 className="font-bold text-slate-800">{editingCatId ? 'Editar Categoria' : 'Nova Categoria'}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome *</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={e => {
                      const name = e.target.value;
                      setCatForm(f => ({ ...f, name, slug: f.slug || slugify(name) }));
                    }}
                    className={inputClass}
                    placeholder="Smart Home, Hardware, etc."
                  />
                </div>
                <div>
                  <label className={labelClass}>Slug / ID</label>
                  <input
                    type="text"
                    value={catForm.slug}
                    onChange={e => setCatForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    className={`${inputClass} font-mono`}
                    placeholder="smart-home"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveCat}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> Salvar Categoria
                </button>
                <button
                  onClick={() => { setShowCatForm(false); setEditingCatId(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white rounded-xl border border-slate-200 p-3 px-4 flex items-center justify-between shadow-sm">
                <div>
                  <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                  <code className="ml-3 text-xs text-slate-400 font-mono">slug: {cat.slug}</code>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditCat(cat)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCat(cat.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MERCHANTS TAB ── */}
      {tab === 'merchants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Lojas / Plataformas de Produtos</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cadastre as lojas parceiras exibidas nos cards dos produtos.</p>
            </div>
            <button
              onClick={handleAddMerch}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Nova Loja
            </button>
          </div>

          {showMerchForm && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3 shadow-sm">
              <h4 className="font-bold text-slate-800">{editingMerchId ? 'Editar Loja' : 'Nova Loja'}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome da Loja *</label>
                  <input
                    type="text"
                    value={merchForm.name}
                    onChange={e => setMerchForm(f => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Aliexpress, Kabum, etc."
                  />
                </div>
                <div>
                  <label className={labelClass}>Domínio (ex: aliexpress.com) *</label>
                  <input
                    type="text"
                    value={merchForm.domain}
                    onChange={e => setMerchForm(f => ({ ...f, domain: e.target.value }))}
                    className={`${inputClass} font-mono`}
                    placeholder="aliexpress.com"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveMerch}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> Salvar Loja
                </button>
                <button
                  onClick={() => { setShowMerchForm(false); setEditingMerchId(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {merchants.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-3 px-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{m.domain}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditMerch(m)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMerch(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amazon Associate Tag ID</label>
              <input
                type="text"
                value={config.amazonTag}
                onChange={e => setConfig(c => ({ ...c, amazonTag: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="meublog-20"
              />
              <p className="text-xs text-slate-400 mt-1.5 ml-1">Será adicionado automaticamente em todos os links (<code className="font-mono">?tag=...</code>)</p>
            </div>
            <div>
              <label className={labelClass}>Texto padrão do botão</label>
              <input
                type="text"
                value={config.defaultButtonText}
                onChange={e => setConfig(c => ({ ...c, defaultButtonText: e.target.value }))}
                className={inputClass}
                placeholder="Ver na Amazon"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cor do botão CTA</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.buttonColor}
                  onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                  className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={config.buttonColor}
                  onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                  className={`${inputClass} font-mono`}
                  placeholder="#FF9900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Texto do Disclaimer</label>
            <textarea
              value={config.disclaimer}
              onChange={e => setConfig(c => ({ ...c, disclaimer: e.target.value }))}
              rows={2}
              className={inputClass}
              placeholder="Este artigo contém links de afiliado..."
            />
          </div>

          <div className="space-y-3 pt-1">
            <p className={labelClass}>Visibilidade dos elementos</p>
            {([
              ['showPrices', 'Mostrar preços'],
              ['showRatings', 'Mostrar avaliações (★)'],
              ['showProscons', 'Mostrar prós e contras'],
              ['showBadges', 'Mostrar badges (ex: "Melhor Escolha")'],
              ['showDisclaimer', 'Mostrar disclaimer no topo do post'],
              ['enabled', 'Plugin ativo'],
            ] as [keyof AffiliateConfig, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors w-fit">
                <input
                  type="checkbox"
                  checked={!!config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}
    </div>
  );
}
