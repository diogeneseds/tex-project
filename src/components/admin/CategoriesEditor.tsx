import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Tag, X, Edit2, Globe } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export interface CategoryItem {
    name: string;
    slug: string;
    description?: string;
}

function slugify(text: string) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export default function CategoriesEditor() {
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

    useEffect(() => {
        githubApi('read', 'src/data/categories.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || "[]");
                if (Array.isArray(parsed)) {
                    const normalized: CategoryItem[] = parsed.map((item: any) => {
                        if (typeof item === 'string') {
                            return { name: item, slug: slugify(item), description: '' };
                        }
                        return {
                            name: item.name || '',
                            slug: item.slug || slugify(item.name || ''),
                            description: item.description || ''
                        };
                    }).filter(c => c.name);
                    setCategories(normalized);
                } else {
                    setCategories([]);
                }
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setCategories([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const saveToGithub = async (newList: CategoryItem[]) => {
        setSaving(true); setError('');
        triggerToast('Sincronizando categorias...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/categories.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update categories.json'
            });
            setFileSha(data.sha);
            triggerToast('Categorias atualizadas!', 'success', 100);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const openModalForNew = () => {
        setFormName('');
        setFormSlug('');
        setFormDescription('');
        setIsSlugManuallyEdited(false);
        setEditingIndex(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (idx: number) => {
        const item = categories[idx];
        setFormName(item.name);
        setFormSlug(item.slug);
        setFormDescription(item.description || '');
        setIsSlugManuallyEdited(true);
        setEditingIndex(idx);
        setIsModalOpen(true);
    };

    const handleNameChange = (val: string) => {
        setFormName(val);
        if (!isSlugManuallyEdited) {
            setFormSlug(slugify(val));
        }
    };

    const handleSlugChange = (val: string) => {
        setFormSlug(slugify(val));
        setIsSlugManuallyEdited(true);
    };

    const saveModalCategory = async () => {
        if (!formName.trim()) { alert('O nome da categoria é obrigatório!'); return; }
        const finalSlug = formSlug.trim() || slugify(formName);
        if (!finalSlug) { alert('O slug da categoria é obrigatório!'); return; }

        const newItem: CategoryItem = {
            name: formName.trim(),
            slug: finalSlug,
            description: formDescription.trim()
        };

        const arr = [...categories];
        if (editingIndex === null) {
            if (arr.some(c => c.slug === finalSlug || c.name.toLowerCase() === newItem.name.toLowerCase())) {
                alert('Uma categoria com este nome ou slug já existe!');
                return;
            }
            arr.push(newItem);
        } else {
            arr[editingIndex] = newItem;
        }

        setCategories(arr);
        setIsModalOpen(false);
        await saveToGithub(arr);
    };

    const removeCategory = async (index: number) => {
        const item = categories[index];
        if (!confirm(`Excluir a categoria "${item.name}"?`)) return;
        const arr = [...categories];
        arr.splice(index, 1);
        setCategories(arr);
        await saveToGithub(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Lendo categorias...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Gerenciador de Categorias</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-violet-500"></span>
                        {categories.length} Categorias Definidas
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold mr-2"><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</div>}
                    <button onClick={openModalForNew} disabled={saving}
                        className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 transition-all text-xs cursor-pointer">
                        <Plus className="w-4 h-4" /> Nova Categoria
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                    <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                        <Tag className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma categoria!</h3>
                        <p className="text-slate-500 mb-6">Crie categorias para organizar seus artigos do blog.</p>
                        <button onClick={openModalForNew} className="bg-violet-600 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:bg-violet-700 transition-colors">
                            Criar minha primeira categoria
                        </button>
                    </div>
                ) : categories.map((cat, idx) => (
                    <div key={cat.slug} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold shrink-0">
                                    <Tag className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-base leading-snug">{cat.name}</h4>
                                    <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                                        <Globe className="w-3 h-3 text-slate-300" />
                                        /categoria/{cat.slug}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => openModalForEdit(idx)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => removeCategory(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {cat.description ? (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                {cat.description}
                            </p>
                        ) : (
                            <p className="text-[11px] text-slate-300 italic">Sem descrição SEO definida.</p>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">{editingIndex !== null ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nome da Categoria *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => handleNameChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                                    placeholder="Ex: Apps e Software"
                                    autoFocus
                                />
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">O nome da categoria como aparecerá no site.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Slug (URL) *</label>
                                <input
                                    type="text"
                                    value={formSlug}
                                    onChange={e => handleSlugChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                                    placeholder="ex: apps-e-software"
                                />
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">O slug amigável usado na URL (`/categoria/slug`).</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Descrição SEO (Meta Description)</label>
                                <textarea
                                    rows={3}
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                                    placeholder="Escreva uma breve descrição SEO para esta categoria..."
                                />
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">Utilizada para indexação no Google e exibida no cabeçalho da página de categoria. Pode ser deixada em branco.</span>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl text-sm">Cancelar</button>
                            <button onClick={saveModalCategory} className="px-6 py-2.5 font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-md transition-all text-sm">Salvar Categoria</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
