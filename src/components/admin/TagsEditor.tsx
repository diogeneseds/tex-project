import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Hash, X, Edit2, Search, RefreshCw, Globe } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export interface TagItem {
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

export default function TagsEditor() {
    const [tags, setTags] = useState<TagItem[]>([]);
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

    const loadTagsAndUsage = async () => {
        setLoading(true);
        try {
            // Load tags.json
            let definedTags: TagItem[] = [];
            let sha = '';
            try {
                const data = await githubApi('read', 'src/data/tags.json');
                const parsed = JSON.parse(data?.content || "[]");
                if (Array.isArray(parsed)) {
                    definedTags = parsed.map((item: any) => {
                        if (typeof item === 'string') {
                            return { name: item, slug: slugify(item), description: '' };
                        }
                        return {
                            name: item.name || '',
                            slug: item.slug || slugify(item.name || ''),
                            description: item.description || ''
                        };
                    }).filter(t => t.name);
                }
                sha = data.sha;
            } catch (err: any) {
                if (!err.message.includes('404')) setError(err.message);
            }
            setFileSha(sha);

            // Scan blog posts to count tag usage
            const counts: Record<string, number> = {};
            try {
                const listRes = await githubApi('list', 'src/content/blog');
                if (Array.isArray(listRes.data)) {
                    const mds = listRes.data.filter((f: any) => f.name.endsWith('.md'));
                    await Promise.all(mds.map(async (f: any) => {
                        try {
                            const fileData = f.content !== undefined ? f : await githubApi('read', f.path);
                            const text = fileData.content || '';
                            const match = text.match(/tags:\s*(\[[^\]]*\]|(?:\n\s*-\s*.*)+)/);
                            if (match) {
                                let postTags: string[] = [];
                                const raw = match[1];
                                if (raw.startsWith('[')) {
                                    try { postTags = JSON.parse(raw); } catch { }
                                } else {
                                    postTags = raw.split('\n').map((l: string) => l.replace(/-\s*/, '').replace(/["']/g, '').trim()).filter(Boolean);
                                }
                                postTags.forEach((t: string) => {
                                    const cleaned = t.trim();
                                    if (cleaned) {
                                        const slug = slugify(cleaned);
                                        counts[slug] = (counts[slug] || 0) + 1;
                                        // Auto discover if not in definedTags
                                        if (!definedTags.some(dt => dt.slug === slug || dt.name.toLowerCase() === cleaned.toLowerCase())) {
                                            definedTags.push({ name: cleaned, slug, description: '' });
                                        }
                                    }
                                });
                            }
                        } catch { }
                    }));
                }
            } catch { }

            definedTags.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            setTags(definedTags);
            setTagCounts(counts);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTagsAndUsage();
    }, []);

    const saveToGithub = async (newList: TagItem[]) => {
        setSaving(true); setError('');
        triggerToast('Sincronizando tags...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/tags.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update tags.json'
            });
            setFileSha(data.sha);
            triggerToast('Tags salvas com sucesso!', 'success', 100);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSyncArticles = async () => {
        setSyncing(true);
        triggerToast('Escaneando artigos do blog em busca de tags...', 'progress', 20);
        await loadTagsAndUsage();
        await saveToGithub(tags);
        setSyncing(false);
        triggerToast('Tags dos artigos sincronizadas!', 'success');
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
        const item = tags[idx];
        setFormName(item.name);
        setFormSlug(item.slug);
        setFormDescription(item.description || '');
        setIsSlugManuallyEdited(true);
        setEditingIndex(idx);
        setIsModalOpen(true);
    };

    const handleNameChange = (val: string) => {
        const cleanName = val.replace(/^#/, '');
        setFormName(cleanName);
        if (!isSlugManuallyEdited) {
            setFormSlug(slugify(cleanName));
        }
    };

    const handleSlugChange = (val: string) => {
        setFormSlug(slugify(val));
        setIsSlugManuallyEdited(true);
    };

    const saveModalTag = async () => {
        if (!formName.trim()) { alert('O nome da tag é obrigatório!'); return; }
        const finalSlug = formSlug.trim() || slugify(formName);
        if (!finalSlug) { alert('O slug da tag é obrigatório!'); return; }

        const newItem: TagItem = {
            name: formName.trim().replace(/^#/, ''),
            slug: finalSlug,
            description: formDescription.trim()
        };

        const arr = [...tags];
        if (editingIndex === null) {
            if (arr.some(t => t.slug === finalSlug || t.name.toLowerCase() === newItem.name.toLowerCase())) {
                alert('Uma tag com este nome ou slug já existe!');
                return;
            }
            arr.push(newItem);
        } else {
            arr[editingIndex] = newItem;
        }

        arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setTags(arr);
        setIsModalOpen(false);
        await saveToGithub(arr);
    };

    const removeTag = async (index: number) => {
        const item = tags[index];
        const count = tagCounts[item.slug] || 0;
        let msg = `Excluir a tag "#${item.name}"?`;
        if (count > 0) msg += ` Ela é utilizada em ${count} artigo(s).`;
        if (!confirm(msg)) return;
        const arr = [...tags];
        arr.splice(index, 1);
        setTags(arr);
        await saveToGithub(arr);
    };

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        t.slug.toLowerCase().includes(search.toLowerCase().trim())
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Carregando tags e escaneando artigos...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            {/* Header Sticky Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Gerenciador de Tags / Etiquetas</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-violet-500"></span>
                        {tags.length} Tags Cadastradas
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleSyncArticles}
                        disabled={syncing || saving}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer"
                        title="Escaneia todos os artigos do blog para encontrar e cadastrar tags automaticamente"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
                        Sincronizar Artigos
                    </button>
                    <button
                        onClick={openModalForNew}
                        disabled={saving}
                        className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 transition-all text-xs cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Nova Tag
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {/* Search filter bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou slug da tag..."
                    className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2">Limpar</button>
                )}
            </div>

            {/* Tags Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTags.length === 0 ? (
                    <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                        <Hash className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma tag encontrada!</h3>
                        <p className="text-slate-500 mb-6">Crie novas tags para categorizar e impulsionar o SEO do blog.</p>
                        <button onClick={openModalForNew} className="bg-violet-600 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:bg-violet-700 transition-colors">
                            Criar primeira tag
                        </button>
                    </div>
                ) : filteredTags.map((tagItem) => {
                    const originalIndex = tags.findIndex(t => t.slug === tagItem.slug);
                    const usage = tagCounts[tagItem.slug] || 0;
                    return (
                        <div key={tagItem.slug} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold shrink-0">
                                        <Hash className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-800 text-base leading-snug truncate">#{tagItem.name}</h4>
                                        <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                            <Globe className="w-3 h-3 text-slate-300 shrink-0" />
                                            /tag/{tagItem.slug}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => openModalForEdit(originalIndex)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => removeTag(originalIndex)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                    {usage > 0 ? `${usage} artigo${usage > 1 ? 's' : ''}` : 'Sem artigos'}
                                </span>
                            </div>

                            {tagItem.description ? (
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    {tagItem.description}
                                </p>
                            ) : (
                                <p className="text-[11px] text-slate-300 italic">Sem descrição SEO definida.</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">{editingIndex !== null ? 'Editar Tag' : 'Nova Tag'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nome da Tag *</label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-4 font-bold text-violet-500 text-base">#</span>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => handleNameChange(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                                        placeholder="Ex: Hardware, ChatGPT, Placa de Vídeo..."
                                        autoFocus
                                    />
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">Nome de exibição da tag no site.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Slug (URL) *</label>
                                <input
                                    type="text"
                                    value={formSlug}
                                    onChange={e => handleSlugChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                                    placeholder="ex: hardware"
                                />
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">O slug amigável usado na URL (`/tag/slug`).</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Descrição SEO (Meta Description)</label>
                                <textarea
                                    rows={3}
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                                    placeholder="Escreva uma breve descrição SEO para esta tag..."
                                />
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">Utilizada para indexação no Google e exibida no cabeçalho da página da tag. Pode ser deixada em branco.</span>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl text-sm">Cancelar</button>
                            <button onClick={saveModalTag} className="px-6 py-2.5 font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-md transition-all text-sm">Salvar Tag</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
