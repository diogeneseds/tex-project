import React, { useState, useEffect } from 'react';
import { Home, Type, Save, Loader2, AlertCircle, RefreshCw, Images, List, Square, ToggleLeft } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type PostMeta = { slug: string; title: string; path: string };

type HomeSections = {
    offers: boolean;      // Seção Produtos/Ofertas
    categories: boolean;  // Seção Categorias
    videos: boolean;      // Seção Vídeos
    newsletter: boolean;  // Bloco Newsletter
    whatsapp: boolean;    // Bloco WhatsApp
};

type HomeConfig = {
    sectionTitles: {
        latestPosts: string;
    };
    // Seção Hero: 5 slides + 3 lista + 1 card
    hero: {
        sliderSlugs: string[];  // 5 posts
        listSlugs: string[];    // 3 posts
        cardSlug: string;       // 1 post
    };
    latestPosts: { limit: number; btnText: string; btnLink: string };
    sections: HomeSections;
};

const DEFAULT_SECTIONS: HomeSections = {
    offers: true,
    categories: true,
    videos: true,
    newsletter: true,
    whatsapp: true,
};

const DEFAULT: HomeConfig = {
    sectionTitles: {
        latestPosts: 'Lista de Posts Recentes',
    },
    hero: {
        sliderSlugs: ['', '', '', '', ''],
        listSlugs: ['', '', ''],
        cardSlug: '',
    },
    latestPosts: { limit: 9, btnText: 'Ver Todos os Posts', btnLink: '/blog' },
    sections: DEFAULT_SECTIONS,
};

function parseFrontmatterTitle(content: string): string {
    const m = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
    return m ? m[1].trim() : '';
}

function humanize(slug: string) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function mergeConfig(partial: any): HomeConfig {
    const sliderSlugs = Array.isArray(partial.hero?.sliderSlugs)
        ? [...partial.hero.sliderSlugs, '', '', '', '', ''].slice(0, 5)
        : ['', '', '', '', ''];

    const listSlugs = Array.isArray(partial.hero?.listSlugs)
        ? [...partial.hero.listSlugs, '', '', ''].slice(0, 3)
        : ['', '', ''];

    const ps = partial.sections || {};
    const sections: HomeSections = {
        offers:     ps.offers     !== false,
        categories: ps.categories !== false,
        videos:     ps.videos     !== false,
        newsletter: ps.newsletter !== false,
        whatsapp:   ps.whatsapp   !== false,
    };

    return {
        sectionTitles: {
            latestPosts: partial.sectionTitles?.latestPosts || DEFAULT.sectionTitles.latestPosts,
        },
        hero: {
            sliderSlugs,
            listSlugs,
            cardSlug: partial.hero?.cardSlug || '',
        },
        latestPosts: {
            limit: partial.latestPosts?.limit ?? 9,
            btnText: partial.latestPosts?.btnText || 'Ver Todos os Posts',
            btnLink: partial.latestPosts?.btnLink || '/blog',
        },
        sections,
    };
}

function PostPicker({ value, posts, onChange, placeholder }: {
    value: string; posts: PostMeta[]; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        >
            <option value="">{placeholder || '— Auto (mais recente) —'}</option>
            {posts.map(p => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
        </select>
    );
}

type Tab = 'hero' | 'titles' | 'latest' | 'sections';

export default function HomeEditor() {
    const [config, setConfig] = useState<HomeConfig>(DEFAULT);
    const [fileSha, setFileSha] = useState('');
    const [posts, setPosts] = useState<PostMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('hero');

    useEffect(() => {
        async function load() {
            try {
                // Load home.json config
                const configData = await githubApi('read', 'src/data/home.json').catch(() => null);
                if (configData) {
                    setConfig(mergeConfig(JSON.parse(configData?.content || "{}")));
                    setFileSha(configData.sha);
                }

                // Load all blog posts and read titles in parallel
                const fileList = await githubApi('list', 'src/content/blog').catch(() => ({ data: [] }));
                const mdFiles = ((fileList.data || fileList) as any[]).filter(f => f.name.endsWith('.md'));

                const metas = await Promise.all(
                    mdFiles.map(async (f: any) => {
                        const slug = f.name.replace('.md', '');
                        try {
                            const content = f.content !== undefined ? f.content : (await githubApi('read', f.path)).content;
                            const title = parseFrontmatterTitle(content || '') || humanize(slug);
                            return { slug, title, path: f.path } as PostMeta;
                        } catch {
                            return { slug, title: humanize(slug), path: f.path } as PostMeta;
                        }
                    })
                );
                setPosts(metas.sort((a, b) => a.title.localeCompare(b.title)));
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function save() {
        setSaving(true);
        try {
            await githubApi('write', 'src/data/home.json', {
                content: JSON.stringify(config, null, 4),
                sha: fileSha,
            });
            const fresh = await githubApi('read', 'src/data/home.json');
            setFileSha(fresh.sha);
            triggerToast('Homepage atualizada!', 'success');
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    }

    // Hero setters
    const setHeroSlider = (i: number, slug: string) =>
        setConfig(c => {
            const s = [...c.hero.sliderSlugs];
            s[i] = slug;
            return { ...c, hero: { ...c.hero, sliderSlugs: s } };
        });

    const setHeroList = (i: number, slug: string) =>
        setConfig(c => {
            const s = [...c.hero.listSlugs];
            s[i] = slug;
            return { ...c, hero: { ...c.hero, listSlugs: s } };
        });

    const setHeroCard = (slug: string) =>
        setConfig(c => ({ ...c, hero: { ...c.hero, cardSlug: slug } }));

    // Sections setter
    const setSection = (key: keyof HomeSections, value: boolean) =>
        setConfig(c => ({ ...c, sections: { ...c.sections, [key]: value } }));

    const setTitle = (key: keyof HomeConfig['sectionTitles'], value: string) =>
        setConfig(c => ({ ...c, sectionTitles: { ...c.sectionTitles, [key]: value } }));

    const setLatest = (key: keyof HomeConfig['latestPosts'], value: any) =>
        setConfig(c => ({ ...c, latestPosts: { ...c.latestPosts, [key]: value } }));

    if (loading) return (
        <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            <span className="text-sm">Carregando artigos e configuração...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200 max-w-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
        </div>
    );

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'hero', label: 'Hero', icon: Home },
        { id: 'titles', label: 'Títulos', icon: Type },
        { id: 'latest', label: 'Lista de Posts', icon: RefreshCw },
        { id: 'sections', label: 'Seções', icon: ToggleLeft },
    ];

    return (
        <div className="max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <Home className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Homepage</h2>
                        <p className="text-sm text-slate-500">Curadoria de seções e títulos</p>
                    </div>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 disabled:opacity-60 transition-all shadow-sm"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {tabs.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                tab === t.id
                                    ? 'bg-white text-violet-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ─────────────────────────────────────────────────────── */}
            {/* Tab: Hero (5 Slides + 3 Lista + 1 Card)                */}
            {/* ─────────────────────────────────────────────────────── */}
            {tab === 'hero' && (
                <div className="space-y-5">
                    <p className="text-sm text-slate-500">
                        Configure os 9 posts da seção Hero da homepage: 5 no slider, 3 na lista lateral e 1 no card de destaque.
                        Deixe em <span className="font-semibold text-slate-600">Auto</span> para usar os mais recentes automaticamente.
                    </p>

                    {/* SLIDES (5 posts) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Images className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">Slider</h3>
                            <span className="text-xs text-slate-400 ml-auto">5 posts em slides</span>
                        </div>
                        <div className="space-y-2">
                            {config.hero.sliderSlugs.map((slug, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                                    <PostPicker
                                        value={slug}
                                        posts={posts}
                                        onChange={v => setHeroSlider(i, v)}
                                        placeholder="— Auto (mais recente) —"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LISTA (3 posts) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <List className="w-4 h-4 text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">Lista Lateral</h3>
                            <span className="text-xs text-slate-400 ml-auto">3 posts em lista</span>
                        </div>
                        <div className="space-y-2">
                            {config.hero.listSlugs.map((slug, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                                    <PostPicker
                                        value={slug}
                                        posts={posts}
                                        onChange={v => setHeroList(i, v)}
                                        placeholder="— Auto (mais recente) —"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CARD (1 post) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Square className="w-4 h-4 text-orange-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">Card de Destaque</h3>
                            <span className="text-xs text-slate-400 ml-auto">1 post com imagem</span>
                        </div>
                        <PostPicker
                            value={config.hero.cardSlug}
                            posts={posts}
                            onChange={setHeroCard}
                            placeholder="— Auto (mais recente) —"
                        />
                    </div>
                </div>
            )}

            {/* Tab: Títulos */}
            {tab === 'titles' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <p className="text-sm text-slate-500 mb-2">Edite os títulos exibidos em cada seção da homepage.</p>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Seção: Posts Recentes
                        </label>
                        <input
                            type="text"
                            value={config.sectionTitles.latestPosts}
                            onChange={e => setTitle('latestPosts', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Tab: Recentes */}
            {tab === 'latest' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <p className="text-sm text-slate-500">
                        Configura a listagem de posts abaixo do Hero na homepage. Os posts exibidos são sempre os mais recentes (ordenados por data), a partir do 10º post.
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Quantidade de Posts
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={config.latestPosts.limit}
                            onChange={e => setLatest('limit', parseInt(e.target.value) || 9)}
                            className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Texto do Botão
                        </label>
                        <input
                            type="text"
                            value={config.latestPosts.btnText}
                            onChange={e => setLatest('btnText', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Link do Botão
                        </label>
                        <input
                            type="text"
                            value={config.latestPosts.btnLink}
                            onChange={e => setLatest('btnLink', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Tab: Seções */}
            {tab === 'sections' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Ative ou desative seções da homepage. As seções desativadas ficam ocultas para os visitantes.
                    </p>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                        {([
                            { key: 'offers'     as const, label: 'Produtos / Ofertas',   desc: 'Vitrine de produtos e afiliados' },
                            { key: 'categories' as const, label: 'Categorias',            desc: 'Bloco "Continue por Aqui" com as categorias do blog' },
                            { key: 'videos'     as const, label: 'Vídeos',               desc: 'Seção de vídeos do canal' },
                            { key: 'newsletter' as const, label: 'Newsletter',            desc: 'Formulário de inscrição na newsletter' },
                            { key: 'whatsapp'   as const, label: 'Canal WhatsApp',        desc: 'Card com link para o canal do WhatsApp' },
                        ]).map(s => (
                            <label
                                key={s.key}
                                className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">{s.label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={config.sections[s.key]}
                                    onChange={e => setSection(s.key, e.target.checked)}
                                    className="w-4 h-4 shrink-0 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
