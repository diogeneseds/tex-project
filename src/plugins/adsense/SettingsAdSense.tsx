/**
 * SettingsAdSense.tsx — Plugin Google AdSense
 *
 * Suporta caixas de texto multilinha (textarea) para colar o código HTML/JS completo do AdSense
 * ou de qualquer outra rede de anúncios para cada posição do site.
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Sparkles, LayoutGrid, ToggleLeft, ToggleRight, ShieldAlert, Code2 } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

type SlotConfig = {
  enabled: boolean;
  code: string;
  slotId?: string;
};

type SlotsState = {
  top: SlotConfig;
  homeOffers: SlotConfig;
  sidebar1: SlotConfig;
  sidebar2: SlotConfig;
  footer: SlotConfig;
};

const DEFAULT_SLOTS: SlotsState = {
  top: { enabled: true, code: '' },
  homeOffers: { enabled: true, code: '' },
  sidebar1: { enabled: true, code: '' },
  sidebar2: { enabled: true, code: '' },
  footer: { enabled: true, code: '' },
};

export default function SettingsAdSense() {
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('manual');
  const [publisherId, setPublisherId] = useState('');
  const [autoAdsCode, setAutoAdsCode] = useState('');
  const [autoAdsEnabled, setAutoAdsEnabled] = useState(true);
  const [manualAdsEnabled, setManualAdsEnabled] = useState(true);
  const [slots, setSlots] = useState<SlotsState>(DEFAULT_SLOTS);

  const [fileSha, setFileSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    githubApi('read', CONFIG_PATH)
      .then(data => {
        const config = JSON.parse(data.content);
        setFullConfig(config);
        setFileSha(data.sha);

        const adConf = config?.adsense || {};
        setPublisherId(adConf.publisherId || '');
        setAutoAdsCode(adConf.autoAdsCode || '');
        setAutoAdsEnabled(adConf.autoAdsEnabled !== false);
        setManualAdsEnabled(adConf.manualAdsEnabled !== false);

        setSlots({
          top: {
            enabled: adConf.slots?.top?.enabled !== false,
            code: adConf.slots?.top?.code || adConf.slots?.top?.slotId || '',
          },
          homeOffers: {
            enabled: adConf.slots?.homeOffers?.enabled !== false,
            code: adConf.slots?.homeOffers?.code || adConf.slots?.homeOffers?.slotId || '',
          },
          sidebar1: {
            enabled: adConf.slots?.sidebar1?.enabled !== false,
            code: adConf.slots?.sidebar1?.code || adConf.slots?.sidebar1?.slotId || '',
          },
          sidebar2: {
            enabled: adConf.slots?.sidebar2?.enabled !== false,
            code: adConf.slots?.sidebar2?.code || adConf.slots?.sidebar2?.slotId || '',
          },
          footer: {
            enabled: adConf.slots?.footer?.enabled !== false,
            code: adConf.slots?.footer?.code || adConf.slots?.footer?.slotId || '',
          },
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    triggerToast('Salvando códigos de anúncios...', 'progress', 30);

    // Tentar extrair publisherId se o usuário coleu o código no autoAdsCode
    let finalPublisherId = publisherId.trim();
    if (!finalPublisherId && autoAdsCode) {
      const match = autoAdsCode.match(/ca-pub-\d+/);
      if (match) finalPublisherId = match[0];
    }

    try {
      const updated = {
        ...fullConfig,
        adsense: {
          publisherId: finalPublisherId,
          autoAdsCode: autoAdsCode.trim(),
          autoAdsEnabled,
          manualAdsEnabled,
          slots,
        },
      };

      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update AdSense code blocks and textareas',
      });

      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      setPublisherId(finalPublisherId);
      setSaved(true);
      triggerToast('Códigos do AdSense salvos com sucesso!', 'success', 100);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = (key: keyof SlotsState, field: 'enabled' | 'code', value: any) => {
    setSlots(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const textareaClass = 'w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-3.5 text-xs font-mono focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-inner min-h-[110px] resize-y leading-relaxed';
  const labelClass = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5';

  const sampleAdSnippet = `<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>`;

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
      <p className="font-medium animate-pulse">Carregando configuração de anúncios...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Resumo da configuração */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 text-lg mb-1">Google AdSense & Banners de Anúncios</h3>
        <p className="text-sm text-slate-500">
          Cole o código completo fornecido pelo AdSense (ou qualquer outra rede de anúncios) na caixa de texto do local desejado.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${activeTab === 'manual'
              ? 'border-violet-600 text-violet-600 bg-violet-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Caixas de Texto por Posição (Blocos Manuais)
        </button>

        <button
          onClick={() => setActiveTab('auto')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${activeTab === 'auto'
              ? 'border-violet-600 text-violet-600 bg-violet-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          Anúncios Automáticos (Header Code)
        </button>
      </div>

      {/* Tab 1: Manual Slots por Posição */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-800">Anúncios por Posição (Caixas de Código)</h4>
                <p className="text-xs text-slate-500">
                  Cole o código HTML/JavaScript completo do bloco de anúncio na posição onde deseja exibi-lo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualAdsEnabled(!manualAdsEnabled)}
                className="text-violet-600 hover:text-violet-700 transition-colors"
              >
                {manualAdsEnabled ? (
                  <ToggleRight className="w-10 h-10 text-violet-600" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-300" />
                )}
              </button>
            </div>

            {/* Aviso de rótulo obrigatório "Publicidade" */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-900 font-medium">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Todos os blocos configurados abaixo exibirão automaticamente a palavra <strong>"PUBLICIDADE"</strong> em cima.</span>
            </div>

            {/* Configuração de cada posição com TEXTAREA */}
            <div className="space-y-5 pt-2">

              {/* 1. Topo */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-violet-600" /> 1. Topo do Site (Após o Menu)
                    </span>
                    <p className="text-xs text-slate-500">Exibido após o menu em todo o site. <strong>Oculto em páginas LGPD</strong> (Privacidade, Termos, Contato, etc).</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{slots.top.enabled ? 'Ativo' : 'Desativado'}</span>
                    <input
                      type="checkbox"
                      checked={slots.top.enabled}
                      onChange={e => updateSlot('top', 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {slots.top.enabled && (
                  <div>
                    <label className={labelClass}>Cole o código do AdSense aqui</label>
                    <textarea
                      value={slots.top.code}
                      onChange={e => updateSlot('top', 'code', e.target.value)}
                      placeholder={sampleAdSnippet}
                      className={textareaClass}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* 2. Produtos */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-violet-600" /> 2. Após Produtos (Apenas na Home)
                    </span>
                    <p className="text-xs text-slate-500">Exibido na Página Inicial logo após o bloco de ofertas/produtos TecExtreme.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{slots.homeOffers.enabled ? 'Ativo' : 'Desativado'}</span>
                    <input
                      type="checkbox"
                      checked={slots.homeOffers.enabled}
                      onChange={e => updateSlot('homeOffers', 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {slots.homeOffers.enabled && (
                  <div>
                    <label className={labelClass}>Cole o código do AdSense aqui</label>
                    <textarea
                      value={slots.homeOffers.code}
                      onChange={e => updateSlot('homeOffers', 'code', e.target.value)}
                      placeholder={sampleAdSnippet}
                      className={textareaClass}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* 3. Sidebar 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-violet-600" /> 3. Sidebar 1 (Primeiro Anúncio da Lateral)
                    </span>
                    <p className="text-xs text-slate-500">Exibido no topo da barra lateral (Sidebar).</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{slots.sidebar1.enabled ? 'Ativo' : 'Desativado'}</span>
                    <input
                      type="checkbox"
                      checked={slots.sidebar1.enabled}
                      onChange={e => updateSlot('sidebar1', 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {slots.sidebar1.enabled && (
                  <div>
                    <label className={labelClass}>Cole o código do AdSense aqui</label>
                    <textarea
                      value={slots.sidebar1.code}
                      onChange={e => updateSlot('sidebar1', 'code', e.target.value)}
                      placeholder={sampleAdSnippet}
                      className={textareaClass}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* 4. Sidebar 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-violet-600" /> 4. Sidebar 2 (Segundo Anúncio da Lateral)
                    </span>
                    <p className="text-xs text-slate-500">Exibido no meio da barra lateral (entre as mais lidas e os shorts).</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{slots.sidebar2.enabled ? 'Ativo' : 'Desativado'}</span>
                    <input
                      type="checkbox"
                      checked={slots.sidebar2.enabled}
                      onChange={e => updateSlot('sidebar2', 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {slots.sidebar2.enabled && (
                  <div>
                    <label className={labelClass}>Cole o código do AdSense aqui</label>
                    <textarea
                      value={slots.sidebar2.code}
                      onChange={e => updateSlot('sidebar2', 'code', e.target.value)}
                      placeholder={sampleAdSnippet}
                      className={textareaClass}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

              {/* 5. Rodapé */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-violet-600" /> 5. Antes do Rodapé (Acima do Footer)
                    </span>
                    <p className="text-xs text-slate-500">Exibido antes do rodapé em todo o site. <strong>Oculto em páginas LGPD</strong>.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{slots.footer.enabled ? 'Ativo' : 'Desativado'}</span>
                    <input
                      type="checkbox"
                      checked={slots.footer.enabled}
                      onChange={e => updateSlot('footer', 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {slots.footer.enabled && (
                  <div>
                    <label className={labelClass}>Cole o código do AdSense aqui</label>
                    <textarea
                      value={slots.footer.code}
                      onChange={e => updateSlot('footer', 'code', e.target.value)}
                      placeholder={sampleAdSnippet}
                      className={textareaClass}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Auto Ads Code */}
      {activeTab === 'auto' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800">Código Global / Auto Ads (&lt;head&gt;)</h4>
                <p className="text-xs text-slate-500">
                  Cole aqui o script global fornecido pelo Google AdSense para ativar anúncios automáticos no site todo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoAdsEnabled(!autoAdsEnabled)}
                className="text-violet-600 hover:text-violet-700 transition-colors"
              >
                {autoAdsEnabled ? (
                  <ToggleRight className="w-10 h-10 text-violet-600" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-300" />
                )}
              </button>
            </div>

            {autoAdsEnabled && (
              <div>
                <label className={labelClass}>Script do Cabeçalho (&lt;script async src="https://pagead2..."&gt;&lt;/script&gt;)</label>
                <textarea
                  value={autoAdsCode}
                  onChange={e => setAutoAdsCode(e.target.value)}
                  placeholder={`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>`}
                  className={textareaClass}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensagem de Erro / Sucesso e Botão Salvar */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Códigos de Anúncios'}
      </button>
    </div>
  );
}
