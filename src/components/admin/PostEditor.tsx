import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, AlertCircle, Loader2, ArrowLeft, Image as ImageIcon, Eye, Edit3, ListTree, Tag, X, Search, Check } from 'lucide-react';
import { marked } from 'marked';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';
import SEOScoreWidget from '../../plugins/seo/SEOScoreWidget';

interface PostEditorProps {
    filePath: string | null; // null = novo post
}

export default function PostEditor({ filePath }: PostEditorProps) {
    const isEditing = !!filePath;
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [authors, setAuthors] = useState<any[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [isPreview, setIsPreview] = useState(false);
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});
    const [QuillEditor, setQuillEditor] = useState<any>(null);
    const quillRef = useRef<any>(null);

    const handleInsertToc = () => {
        if (post.content.includes('[toc]') || post.content.includes('[ez-toc]')) {
            triggerToast('O shortcode [toc] já está no conteúdo do artigo.', 'warning');
            return;
        }

        let inserted = false;
        try {
            const editor = quillRef.current?.getEditor ? quillRef.current.getEditor() : (quillRef.current?.editor || null);
            if (editor) {
                const range = editor.getSelection(true);
                const index = (range && typeof range.index === 'number') ? range.index : editor.getLength();
                editor.insertText(index, '[toc]\n');
                editor.setSelection(index + 6);
                inserted = true;
            }
        } catch (e) {
            console.error('Erro ao inserir [toc] no cursor:', e);
        }

        if (!inserted) {
            setPost(p => ({
                ...p,
                content: p.content ? `${p.content}<p>[toc]</p>` : '<p>[toc]</p>'
            }));
        }

        triggerToast('Shortcode [toc] inserido no cursor!', 'success');
    };

    const formatDateForInput = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
            return d.toISOString().split('T')[0];
        } catch { return new Date().toISOString().split('T')[0]; }
    };

    const [post, setPost] = useState({
        title: '', slug: '', description: '', pubDate: new Date().toISOString().split('T')[0],
        updatedDate: '', heroImage: '', category: '', tags: [] as string[], author: '', draft: false, content: ''
    });
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [pendingTags, setPendingTags] = useState<string[]>([]);

    const removeTag = (tagName: string) => {
        setPost(p => ({ ...p, tags: p.tags.filter(t => t !== tagName) }));
    };

    const openTagModal = () => {
        setPendingTags([...post.tags]);
        setTagSearch('');
        setIsTagModalOpen(true);
    };

    const confirmTagModal = () => {
        setPost(p => ({ ...p, tags: pendingTags }));
        setIsTagModalOpen(false);
    };

    const togglePendingTag = (tagName: string) => {
        setPendingTags(prev =>
            prev.some(t => t.toLowerCase() === tagName.toLowerCase())
                ? prev.filter(t => t.toLowerCase() !== tagName.toLowerCase())
                : [...prev, tagName]
        );
    };

    const addCustomTag = (tagName: string) => {
        const trimmed = tagName.trim().replace(/^#/, '');
        if (!trimmed) return;
        if (!pendingTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
            setPendingTags(prev => [...prev, trimmed]);
        }
        setTagSearch('');
    };

    // Load Quill dynamically
    useEffect(() => {
        import('react-quill-new').then(mod => setQuillEditor(() => mod.default));
        import('react-quill-new/dist/quill.snow.css' as any);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [authRes, catRes, tagRes] = await Promise.allSettled([
                    githubApi('read', 'src/data/authors.json'),
                    githubApi('read', 'src/data/categories.json'),
                    githubApi('read', 'src/data/tags.json'),
                ]);
                if (authRes.status === 'fulfilled') { const p = JSON.parse(authRes.value?.content || "{}"); if (Array.isArray(p)) setAuthors(p); }
                if (catRes.status === 'fulfilled') { const p = JSON.parse(catRes.value?.content || "[]"); if (Array.isArray(p)) setDynamicCategories(p.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean)); }

                // Load tags from tags.json and also scan blog posts to discover all used tags
                let knownTags: string[] = [];
                if (tagRes.status === 'fulfilled') {
                    const p = JSON.parse(tagRes.value?.content || "[]");
                    if (Array.isArray(p)) knownTags = p.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean);
                }

                // Scan blog posts to discover additional tags (same as TagsEditor)
                try {
                    const listRes = await githubApi('list', 'src/content/blog');
                    if (Array.isArray(listRes.data)) {
                        const mds = listRes.data.filter((f: any) => f.name.endsWith('.md'));
                        const allDiscovered = new Set<string>(knownTags.map(t => t.toLowerCase()));
                        const merged = [...knownTags];
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
                                        if (cleaned && !allDiscovered.has(cleaned.toLowerCase())) {
                                            allDiscovered.add(cleaned.toLowerCase());
                                            merged.push(cleaned);
                                        }
                                    });
                                }
                            } catch { }
                        }));
                        setAvailableTags(merged.sort((a, b) => a.localeCompare(b, 'pt-BR')));
                    } else {
                        setAvailableTags(knownTags);
                    }
                } catch {
                    setAvailableTags(knownTags);
                }

                if (isEditing && filePath) {
                    const fileData = await githubApi('read', filePath);
                    setFileSha(fileData.sha);
                    const text = fileData.content;
                    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    if (match) {
                        const fm = match[1];
                        const body = match[2].trim();
                        const extract = (key: string) => { const m = fm.match(new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))`)); return m ? (m[1] || m[2] || m[3] || '').trim() : ''; };
                        const parsedHtml = await marked.parse(body);
                        const rawUpdated = extract('updatedDate');
                        
                        // Extract tags
                        const tagsMatch = fm.match(/tags:\s*(\[[^\]]*\]|(?:\n\s*-\s*.*)+)/);
                        let loadedTags: string[] = [];
                        if (tagsMatch) {
                            const raw = tagsMatch[1];
                            if (raw.startsWith('[')) {
                                try { loadedTags = JSON.parse(raw); } catch { }
                            } else {
                                loadedTags = raw.split('\n').map((l: string) => l.replace(/-\s*/, '').replace(/["']/g, '').trim()).filter(Boolean);
                            }
                        }

                        setPost({
                            title: extract('title'), slug: filePath.split('/').pop()?.replace('.md', '') || '',
                            description: extract('description'),
                            pubDate: extract('pubDate') ? formatDateForInput(extract('pubDate')) : new Date().toISOString().split('T')[0],
                            updatedDate: rawUpdated ? formatDateForInput(rawUpdated) : '',
                            heroImage: extract('heroImage'), category: extract('category') || 'Geral', tags: loadedTags, author: extract('author'),
                            draft: extract('draft') === 'true', content: parsedHtml
                        });
                    } else {
                        setPost(p => ({ ...p, content: String(marked.parse(text)), slug: filePath.split('/').pop()?.replace('.md', '') || '' }));
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [filePath, isEditing]);

    const handleTitleChange = (val: string) => {
        setPost(p => ({ ...p, title: val, slug: isEditing ? p.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') }));
    };

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        if (uiKey === 'heroImage') setPost(p => ({ ...p, heroImage: URL.createObjectURL(file) }));
        e.target.value = '';
    };

    const extractAndUploadInlineImages = async (html: string) => {
        const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
        let modifiedHtml = html;
        const matches = [...html.matchAll(imgRegex)];
        for (const m of matches) {
            const ext = m[1]; const base64Content = m[2];
            const ghPath = `public/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload imagem inline ${ghPath}` });
            modifiedHtml = modifiedHtml.replace(`data:image/${ext};base64,${base64Content}`, ghPath.replace('public', ''));
        }
        return modifiedHtml;
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!post.title || !post.slug) { setError('Título e Slug (URL) são obrigatórios.'); return; }
        setSaving(true); setError('');
        triggerToast('Processando e salvando artigo...', 'progress', 20);
        try {
            let finalHeroImage = post.heroImage;
            if (pendingUploads['heroImage']) {
                const fileObj = pendingUploads['heroImage'];
                const base64Content = await fileToBase64(fileObj);
                const fileExt = fileObj.name.split('.').pop() || 'jpg';
                const ghPath = `public/uploads/${Date.now()}-blog-cover.${fileExt}`;
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload capa blog ${ghPath}` });
                finalHeroImage = ghPath.replace('public', '');
            }
            const cleanedContent = post.content.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
            const finalHtmlContent = await extractAndUploadInlineImages(cleanedContent);
            const updatedDateLine = post.updatedDate ? `updatedDate: "${post.updatedDate}"\n` : '';
            const tagsLine = `tags: ${JSON.stringify(post.tags)}\n`;
            const markdown = `---\ntitle: "${post.title.replace(/"/g, '\\"')}"\ndescription: "${post.description.replace(/"/g, '\\"')}"\npubDate: "${post.pubDate}"\n${updatedDateLine}heroImage: "${finalHeroImage}"\ncategory: "${post.category}"\n${tagsLine}author: "${post.author}"\ndraft: ${post.draft}\n---\n${finalHtmlContent}`;
            const targetPath = `src/content/blog/${post.slug}.md`;
            const res = await githubApi('write', targetPath, { content: markdown, sha: fileSha || undefined, message: `CMS: ${isEditing ? 'Edição' : 'Criação'} do artigo ${post.slug}` });
            if (res.sha) setFileSha(res.sha);
            setPendingUploads({});
            triggerToast('Artigo salvo com sucesso!', 'success', 100);
            if (!isEditing) setTimeout(() => { window.location.href = '/admin/posts'; }, 1500);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Carregando editor...</p>
        </div>
    );

    const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm";
    const labelClass = "block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1";

    return (
        <>
        <div className="max-w-5xl pb-32">
            {/* Fixed header bar */}
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-3">
                    <a href="/admin/posts" className="text-slate-400 hover:text-violet-600 transition-colors p-1.5 rounded-lg hover:bg-violet-50"><ArrowLeft className="w-5 h-5" /></a>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{isEditing ? 'Editar Artigo' : 'Novo Artigo'}</h2>
                        {post.slug && <p className="text-xs font-mono text-slate-400">/blog/{post.slug}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setIsPreview(!isPreview)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                        {isPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {isPreview ? 'Editor' : 'Preview'}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Salvando...' : <><Save className="w-4 h-4" /> {isEditing ? 'Salvar' : 'Publicar'}</>}
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium mb-6 rounded-r-xl flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

            <div className="flex gap-6 items-start">
                {/* Main Editor Area */}
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Title */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className={labelClass}>Título do Artigo *</label>
                        <input type="text" value={post.title} onChange={e => handleTitleChange(e.target.value)} className={inputClass} placeholder="Título do artigo..." />
                        <div className="mt-3">
                            <label className={labelClass}>Slug (URL) *</label>
                            <input type="text" value={post.slug} onChange={e => setPost(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} className={`${inputClass} font-mono text-xs`} placeholder="url-do-artigo" />
                        </div>
                        <div className="mt-3">
                            <label className={labelClass}>Descrição / Meta Description</label>
                            <textarea rows={2} value={post.description} onChange={e => setPost(p => ({ ...p, description: e.target.value }))} className={`${inputClass} resize-none`} placeholder="Breve descrição do artigo..." />
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Conteúdo do Artigo</label>
                            {!isPreview && (
                                <button
                                    type="button"
                                    onClick={handleInsertToc}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200/80 transition-colors shadow-sm cursor-pointer"
                                    title="Insere a tag [toc] no artigo. No site publicado, ela será substituída automaticamente pelo Sumário (Table of Contents)."
                                >
                                    <ListTree className="w-3.5 h-3.5 text-violet-600" />
                                    Inserir [toc] (Sumário)
                                </button>
                            )}
                        </div>
                        {isPreview ? (
                            <div className="prose prose-slate max-w-none border border-slate-200 rounded-xl p-6 min-h-[300px]" dangerouslySetInnerHTML={{ __html: post.content }} />
                        ) : QuillEditor ? (
                            <>
                                <QuillEditor
                                    ref={quillRef}
                                    theme="snow"
                                    value={post.content}
                                    onChange={(val: string) => setPost(p => ({ ...p, content: val }))}
                                    style={{ minHeight: '300px' }}
                                />
                                <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                    <span>💡 O shortcode <code className="bg-slate-100 px-1.5 py-0.5 rounded text-violet-600 font-mono text-[11px]">[toc]</code> será substituído no post publicado pelo Table of Contents gerado automaticamente a partir das seções H2/H3.</span>
                                </p>
                            </>
                        ) : (
                            <div className="flex items-center justify-center p-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />Carregando editor...</div>
                        )}
                    </div>

                    {/* Tags Pills — below editor */}
                    {post.tags.length > 0 && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-slate-700 text-sm">Tags selecionadas</h3>
                                <button type="button" onClick={openTagModal} className="text-xs text-violet-600 hover:text-violet-800 font-semibold cursor-pointer">Editar</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {post.tags.map((t, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-full border border-violet-200">
                                        #{t}
                                        <button type="button" onClick={() => removeTag(t)} className="text-violet-400 hover:text-violet-700 cursor-pointer">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-72 shrink-0 space-y-4 sticky top-4">
                    {/* Publish Settings */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Publicação</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Status</label>
                                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-violet-50 transition-colors">
                                    <input type="checkbox" checked={post.draft} onChange={e => setPost(p => ({ ...p, draft: e.target.checked }))} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                                    <span className="text-sm font-medium text-slate-700">Salvar como rascunho</span>
                                </label>
                            </div>
                            <div>
                                <label className={labelClass}>Data de Publicação</label>
                                <input type="date" value={post.pubDate} onChange={e => setPost(p => ({ ...p, pubDate: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className={labelClass}>Data de Atualização</label>
                                    {post.updatedDate && (
                                        <button type="button" onClick={() => setPost(p => ({ ...p, updatedDate: '' }))} className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer">Limpar</button>
                                    )}
                                </div>
                                <input type="date" value={post.updatedDate || ''} onChange={e => setPost(p => ({ ...p, updatedDate: e.target.value }))} className={inputClass} />
                                <span className="text-[10px] text-slate-400 font-medium block mt-1">Vem em branco. Preencha apenas quando o artigo passar por atualização.</span>
                            </div>
                        </div>
                    </div>

                    {/* Category & Author */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Metadados</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Categoria</label>
                                {dynamicCategories.length > 0 ? (
                                    <select value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar categoria...</option>
                                        {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass} placeholder="Ex: Tecnologia" />
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Autor</label>
                                {authors.length > 0 ? (
                                    <select value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar autor...</option>
                                        {authors.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass} placeholder="Nome do autor" />
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Tags / Etiquetas</label>
                                <button
                                    type="button"
                                    onClick={openTagModal}
                                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-violet-200 hover:border-violet-400 bg-violet-50/50 hover:bg-violet-50 text-violet-600 hover:text-violet-700 rounded-xl px-4 py-3 text-sm font-bold transition-all cursor-pointer"
                                >
                                    <Tag className="w-4 h-4" />
                                    {post.tags.length > 0 ? `${post.tags.length} tag(s) selecionada(s)` : '+ Selecionar Tags'}
                                </button>
                                {post.tags.length > 0 && (
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">As tags aparecem abaixo do editor. Clique no botão para editar.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hero Image */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Imagem de Capa</h3>
                        <label className="group relative border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50 hover:bg-violet-50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-center overflow-hidden" style={{ minHeight: '120px' }}>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e, 'heroImage')} />
                            {post.heroImage ? (
                                <>
                                    <img src={post.heroImage} alt="Capa" className="absolute inset-0 w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/20">
                                        <ImageIcon className="w-8 h-8 text-slate-800" />
                                        <span className="text-xs font-bold text-slate-900 mt-1">Trocar imagem</span>
                                    </div>
                                </>
                            ) : (
                                <div className="py-6 flex flex-col items-center text-slate-400 group-hover:text-violet-500 transition-colors">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-bold">Enviar imagem de capa</span>
                                </div>
                            )}
                        </label>
                        {pendingUploads['heroImage'] && <span className="text-[10px] text-amber-600 font-bold block mt-2">Upload pendente — será enviado ao salvar</span>}
                    </div>

                    {/* SEO Score Widget */}
                    <SEOScoreWidget
                        title={post.title}
                        description={post.description}
                        heroImage={post.heroImage}
                        content={post.content}
                    />
                </div>
            </div>
        </div>


        {/* Tag Picker Modal */}
        {isTagModalOpen && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '92vh', height: '92vh' }}>
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-violet-600" />
                            <h3 className="font-bold text-slate-800 text-base">Selecionar Tags</h3>
                        </div>
                        <button type="button" onClick={() => setIsTagModalOpen(false)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search bar */}
                    <div className="px-5 py-3 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={tagSearch}
                                onChange={e => setTagSearch(e.target.value)}
                                onKeyDown={e => {
                                    if ((e.key === 'Enter' || e.key === ',') && tagSearch.trim()) {
                                        e.preventDefault();
                                        addCustomTag(tagSearch);
                                    }
                                }}
                                placeholder="Pesquisar ou criar nova tag..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                autoFocus
                            />
                        </div>
                        {tagSearch.trim() && !availableTags.some(t => t.toLowerCase() === tagSearch.trim().toLowerCase()) && !pendingTags.some(t => t.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                            <button type="button" onClick={() => addCustomTag(tagSearch)} className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 cursor-pointer">
                                <span className="text-base leading-none">+</span> Criar tag "<strong>{tagSearch.trim()}</strong>"
                            </button>
                        )}
                    </div>

                    {/* Selected tags preview */}
                    {pendingTags.length > 0 && (
                        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-1.5">
                            {pendingTags.map((t, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                    #{t}
                                    <button type="button" onClick={() => togglePendingTag(t)} className="text-violet-200 hover:text-white cursor-pointer">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Tag list */}
                    <div className="overflow-y-auto px-2 py-2" style={{ flex: '1 1 0', minHeight: '200px' }}>
                        {(() => {
                            const filtered = availableTags
                                .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                                .sort((a, b) => a.localeCompare(b));
                            return (
                                <>
                                    {filtered.length === 0 ? (
                                        <p className="text-center text-slate-400 text-sm py-8">Nenhuma tag encontrada.{tagSearch ? ' Pressione Enter para criar.' : ''}</p>
                                    ) : (
                                        <>
                                            <p className="text-[10px] text-slate-400 font-medium px-3 pb-2">
                                                {tagSearch ? `${filtered.length} resultado(s)` : `${filtered.length} tag(s) disponível(is)`}
                                            </p>
                                            {filtered.map(tag => {
                                                const isSelected = pendingTags.some(t => t.toLowerCase() === tag.toLowerCase());
                                                return (
                                                    <label key={tag} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-violet-50' : ''}`}>
                                                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </span>
                                                        <input type="checkbox" checked={isSelected} onChange={() => togglePendingTag(tag)} className="sr-only" />
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>#{tag}</span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 gap-3">
                        <span className="text-xs text-slate-400 font-medium">{pendingTags.length} tag(s) selecionada(s)</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsTagModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors cursor-pointer">
                                Cancelar
                            </button>
                            <button type="button" onClick={confirmTagModal} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm cursor-pointer">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
