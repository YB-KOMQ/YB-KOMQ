
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Users, 
  QrCode, 
  RefreshCw, 
  Settings, 
  LogOut, 
  Search, 
  PlusCircle, 
  Trash2, 
  ExternalLink, 
  Lock,
  Share2,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  Link2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { Asset, User, ViewType, USERS, AssetType, SecurityLevel, Team } from './types';
import { geminiService } from './geminiService';

const STORAGE_KEY = "komq-genai-assets";
const ADMIN_PASSWORD = "komq5522!!";
const COLORS = ['#38bdf8', '#fbbf24', '#f87171', '#a78bfa', '#4ade80'];

const App: React.FC = () => {
  // --- State ---
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isForcedReadonly, setIsForcedReadonly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [secFilter, setSecFilter] = useState<string>('ALL');
  
  // Modals
  const [showLogin, setShowLogin] = useState(true);
  const [loginUserSelect, setLoginUserSelect] = useState('신윤복');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Asset Form
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<AssetType>('GPTs');
  const [newTeam, setNewTeam] = useState<Team>('교육');
  const [newSec, setNewSec] = useState<SecurityLevel>('Internal');
  const [newTags, setNewTags] = useState('');
  const [isAiTagging, setIsAiTagging] = useState(false);

  // Sync / GS Config
  const [gsUrl, setGsUrl] = useState('');
  const [gsToken, setGsToken] = useState('');
  const [syncStatus, setSyncStatus] = useState({ text: '연결 대기 중', color: 'text-slate-400' });
  const [isSyncing, setIsSyncing] = useState(false);

  // Dashboard Summary (AI)
  const [aiSummary, setAiSummary] = useState('통계를 분석 중입니다...');

  // --- Effects ---
  useEffect(() => {
    // Check URL for share payload
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(shareData)));
        if (decoded.assets) {
          setAssets(decoded.assets);
          setIsForcedReadonly(true);
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {
        console.error("Invalid share link", e);
      }
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAssets(JSON.parse(stored));
    }

    const storedGs = localStorage.getItem('komq-gs-config');
    if (storedGs) {
      const cfg = JSON.parse(storedGs);
      setGsUrl(cfg.url || '');
      setGsToken(cfg.token || '');
    }
  }, []);

  useEffect(() => {
    if (!isForcedReadonly) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    }
  }, [assets, isForcedReadonly]);

  useEffect(() => {
    if (activeView === 'dashboard' && assets.length > 0) {
      const stats = {
        total: assets.length,
        byTeam: assets.reduce((acc: any, a) => { acc[a.team] = (acc[a.team] || 0) + 1; return acc; }, {}),
        bySec: assets.reduce((acc: any, a) => { acc[a.security] = (acc[a.security] || 0) + 1; return acc; }, {})
      };
      geminiService.getDashboardSummary(stats).then(setAiSummary);
    }
  }, [activeView, assets]);

  // --- Helpers ---
  const handleLogin = () => {
    if (loginUserSelect === '신윤복' && loginPw !== ADMIN_PASSWORD) {
      setLoginError('비밀번호가 틀렸습니다.');
      return;
    }
    const user = USERS[loginUserSelect];
    setCurrentUser(user);
    setShowLogin(false);
    setActiveView(user.role === 'admin' ? 'dashboard' : 'teamview');
  };

  const addAsset = async () => {
    if (!currentUser?.canCRUD) return;
    if (!newName || !newUrl) {
      alert("이름과 URL은 필수입니다.");
      return;
    }
    
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      name: newName,
      url,
      type: newType,
      team: newTeam,
      security: newSec,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString()
    };

    setAssets(prev => [newAsset, ...prev]);
    setNewName('');
    setNewUrl('');
    setNewTags('');
    setNewSec('Internal');
  };

  const deleteAsset = (id: string) => {
    if (!currentUser?.canCRUD) return;
    if (confirm("정말 삭제하시겠습니까?")) {
      setAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleAiTags = async () => {
    if (!newName || !newUrl) return;
    setIsAiTagging(true);
    const tags = await geminiService.suggestTags(newName, newUrl);
    setNewTags(tags.join(', '));
    setIsAiTagging(false);
  };

  const createShareLink = () => {
    const payload = { mode: 'readonly', assets: assets.filter(a => a.security === 'Public') };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const link = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    setShareLink(link);
    setShowShareModal(true);
  };

  const testGsConnection = async () => {
    if (!gsUrl) {
      setSyncStatus({ text: 'URL을 입력하세요', color: 'text-red-400' });
      return;
    }
    setIsSyncing(true);
    setSyncStatus({ text: '연결 확인 중...', color: 'text-sky-400' });
    try {
      // Mocking a fetch to the web app
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSyncStatus({ text: '연결 성공 (Mock)', color: 'text-green-400' });
      localStorage.setItem('komq-gs-config', JSON.stringify({ url: gsUrl, token: gsToken }));
    } catch (e) {
      setSyncStatus({ text: '연결 실패', color: 'text-red-400' });
    } finally {
      setIsSyncing(false);
    }
  };

  const uploadToGs = async () => {
    if (!gsUrl) return;
    setIsSyncing(true);
    setSyncStatus({ text: '데이터 업로드 중...', color: 'text-sky-400' });
    try {
      // Logic for Google Apps Script integration
      // fetch(gsUrl, { method: 'POST', body: JSON.stringify({ token: gsToken, assets }) })
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSyncStatus({ text: '업로드 완료 (Mock)', color: 'text-green-400' });
    } catch (e) {
      setSyncStatus({ text: '업로드 실패', color: 'text-red-400' });
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Filtering Logic ---
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      // Role & Forced Readonly overrides
      if (isForcedReadonly || currentUser?.role === 'trainee') {
        if (a.security !== 'Public') return false;
      }
      
      const matchesSearch = 
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        a.url.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTeam = teamFilter === 'ALL' || a.team === teamFilter;
      const matchesType = typeFilter === 'ALL' || a.type === typeFilter;
      const matchesSec = secFilter === 'ALL' || a.security === secFilter;

      return matchesSearch && matchesTeam && matchesType && matchesSec;
    });
  }, [assets, searchQuery, teamFilter, typeFilter, secFilter, isForcedReadonly, currentUser]);

  // --- Stats Logic ---
  const statsData = useMemo(() => {
    const byTeam = [
      { name: '교육', value: assets.filter(a => a.team === '교육').length },
      { name: '컨설팅', value: assets.filter(a => a.team === '컨설팅').length },
      { name: '연구', value: assets.filter(a => a.team === '연구').length }
    ];
    const byType = [
      { name: 'GPTs', value: assets.filter(a => a.type === 'GPTs').length },
      { name: 'GEM', value: assets.filter(a => a.type === 'GEM').length },
      { name: 'External', value: assets.filter(a => a.type === 'External').length }
    ];
    const bySec = [
      { name: 'Public', value: assets.filter(a => a.security === 'Public').length },
      { name: 'Internal', value: assets.filter(a => a.security === 'Internal').length },
      { name: 'Restricted', value: assets.filter(a => a.security === 'Restricted').length }
    ];
    return { byTeam, byType, bySec };
  }, [assets]);

  // --- Render Functions ---
  const renderSidebarItem = (view: ViewType, label: string, Icon: any) => {
    const isAllowed = currentUser?.allowedViews.includes(view);
    if (!isAllowed) return null;
    return (
      <button
        onClick={() => setActiveView(view)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          activeView === view 
            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold' 
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
        }`}
      >
        <Icon size={20} />
        <span className="text-sm">{label}</span>
      </button>
    );
  };

  if (showLogin) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-50">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-white tracking-tight">KoGenOne</h2>
            <p className="text-slate-400 text-sm mt-2">KOMQ GEN AI One Platform</p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">사용자 선택</label>
              <select 
                value={loginUserSelect}
                onChange={(e) => {
                  setLoginUserSelect(e.target.value);
                  setLoginError('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="신윤복">신윤복 (Admin)</option>
                <option value="교육생">교육생 (Trainee)</option>
              </select>
            </div>

            {loginUserSelect === '신윤복' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">관리자 암호</label>
                <input 
                  type="password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder="Password"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
            )}

            {loginError && <p className="text-red-400 text-xs font-semibold">{loginError}</p>}

            <button 
              onClick={handleLogin}
              className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20"
            >
              플랫폼 시작하기
            </button>
          </div>

          <div className="mt-8 p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1">권한 요약</p>
            {loginUserSelect === '신윤복' 
              ? '• 모든 화면 접근 가능 / 자산 관리 전권 / Restricted 열람 가능'
              : '• 팀별 뷰 + 설정 접근 가능 / Public 자산만 조회 가능'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-6 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-8 p-4 bg-slate-950 border border-slate-800 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-amber-500 opacity-50"></div>
          <h1 className="text-2xl font-black text-white">KoGenOne</h1>
          <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-widest uppercase">KOMQ Research Unit</p>
        </div>

        <nav className="flex-1 space-y-2">
          {renderSidebarItem('dashboard', '대시보드', LayoutDashboard)}
          {renderSidebarItem('assets', '자산 관리', Database)}
          {renderSidebarItem('teamview', '팀별 뷰', Users)}
          {renderSidebarItem('qrshare', 'QR 공유', QrCode)}
          {renderSidebarItem('sync', '백업 / 동기화', RefreshCw)}
          {renderSidebarItem('settings', '설정 및 고지', Settings)}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                {currentUser?.role}{isForcedReadonly ? ' · RO' : ''}
              </p>
            </div>
            <button 
              onClick={() => {
                if (confirm("로그아웃 하시겠습니까?")) setShowLogin(true);
              }}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
          
          <button 
            onClick={createShareLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-800 text-xs font-bold hover:bg-slate-800 transition-all text-slate-400"
          >
            <Share2 size={14} /> 공유 링크 생성
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-black text-white capitalize tracking-tight">
                {activeView === 'qrshare' ? 'QR Share' : activeView}
              </h2>
              {isForcedReadonly && (
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black rounded-full uppercase">
                  ReadOnly Mode
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm max-w-md">
              {activeView === 'dashboard' && '플랫폼 전체 자산 현황과 분석을 한눈에 확인합니다.'}
              {activeView === 'assets' && '신규 GEN AI 자산을 등록하고 메타데이터를 관리합니다.'}
              {activeView === 'teamview' && '조직 내 팀별로 자산을 구분하여 탐색합니다.'}
              {activeView === 'sync' && '로컬 데이터 백업 및 구글 시트와의 실시간 동기화를 지원합니다.'}
              {activeView === 'qrshare' && '자산 모음을 QR 코드로 생성하여 편리하게 공유합니다.'}
              {activeView === 'settings' && '저작권 및 법적 고지 사항을 확인합니다.'}
            </p>
          </div>

          {['dashboard', 'assets', 'teamview'].includes(activeView) && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text"
                  placeholder="검색: 이름, 태그, URL"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-sky-500/50 outline-none"
                />
              </div>
              <select 
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm outline-none cursor-pointer"
              >
                <option value="ALL">팀(전체)</option>
                <option value="교육">교육</option>
                <option value="컨설팅">컨설팅</option>
                <option value="연구">연구</option>
              </select>
              <select 
                value={secFilter}
                onChange={(e) => setSecFilter(e.target.value)}
                disabled={currentUser?.role === 'trainee' || isForcedReadonly}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm outline-none disabled:opacity-50 cursor-pointer"
              >
                <option value="ALL">보안(전체)</option>
                <option value="Public">Public</option>
                <option value="Internal">Internal</option>
                <option value="Restricted">Restricted</option>
              </select>
            </div>
          )}
        </header>

        {/* View Content */}
        {activeView === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '전체 자산', value: assets.length, desc: '등록된 전체 개수', color: 'text-sky-400' },
                { label: 'Public', value: assets.filter(a => a.security === 'Public').length, desc: '외부 공유 가능', color: 'text-green-400' },
                { label: 'Internal', value: assets.filter(a => a.security === 'Internal').length, desc: '내부 전용 자산', color: 'text-amber-400' },
                { label: 'Restricted', value: assets.filter(a => a.security === 'Restricted').length, desc: '보안 등급 자산', color: 'text-red-400' }
              ].map((kpi, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl transition-transform hover:scale-[1.02]">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</p>
                  <p className={`text-4xl font-black mt-2 ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">{kpi.desc}</p>
                </div>
              ))}
            </div>

            {/* AI Summary Banner */}
            <div className="bg-gradient-to-r from-sky-900/30 to-indigo-900/30 border border-sky-500/20 p-6 rounded-2xl flex items-center gap-4">
              <div className="bg-sky-500/20 p-3 rounded-full text-sky-400">
                <Info size={24} />
              </div>
              <div>
                <p className="text-xs font-black text-sky-400 uppercase tracking-widest mb-1">AI INSIGHT</p>
                <p className="text-slate-200 font-medium">{aiSummary}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl">
                <h3 className="text-lg font-black text-white mb-8">팀별 자산 분포</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.byTeam}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {statsData.byTeam.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl">
                <h3 className="text-lg font-black text-white mb-8">보안 등급별 비중</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statsData.bySec}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statsData.bySec.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'assets' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {currentUser?.canCRUD && (
              <section className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-sky-500/10 p-2 rounded-lg text-sky-500">
                    <PlusCircle size={20} />
                  </div>
                  <h3 className="text-xl font-black text-white">신규 자산 등록</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">자산 이름</label>
                    <input 
                      type="text" value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. DOE 자동화 봇"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL</label>
                    <input 
                      type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">유형</label>
                    <select value={newType} onChange={e => setNewType(e.target.value as AssetType)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none cursor-pointer">
                      <option value="GPTs">GPTs</option>
                      <option value="GEM">GEM</option>
                      <option value="External">External</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">담당 팀</label>
                    <select value={newTeam} onChange={e => setNewTeam(e.target.value as Team)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none cursor-pointer">
                      <option value="교육">교육</option>
                      <option value="컨설팅">컨설팅</option>
                      <option value="연구">연구</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">보안 등급</label>
                    <select value={newSec} onChange={e => setNewSec(e.target.value as SecurityLevel)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none cursor-pointer">
                      <option value="Public">Public (공개)</option>
                      <option value="Internal">Internal (내부)</option>
                      <option value="Restricted">Restricted (제한)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between items-center">
                      태그 (쉼표 구분)
                      <button 
                        onClick={handleAiTags} 
                        disabled={isAiTagging || !newName}
                        className="text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50 text-[10px] font-bold"
                      >
                        {isAiTagging ? '생성 중...' : 'AI 추천 태그'}
                      </button>
                    </label>
                    <input 
                      type="text" value={newTags} onChange={e => setNewTags(e.target.value)}
                      placeholder="DOE, 통계분석, 시각화"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={addAsset}
                    className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-10 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 active:scale-95"
                  >
                    자산 추가
                  </button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <div key={asset.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group hover:border-sky-500/40 transition-all flex flex-col h-full relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{asset.type}</span>
                        <h4 className="text-xl font-bold text-white group-hover:text-sky-400 transition-colors">{asset.name}</h4>
                      </div>
                      <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase border ${
                        asset.security === 'Public' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                        asset.security === 'Internal' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                        'bg-red-500/10 border-red-500/30 text-red-500'
                      }`}>
                        {asset.security}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 truncate mb-4 font-mono">{asset.url}</p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-700">
                        {asset.team}
                      </span>
                      {asset.tags.map((t, idx) => (
                        <span key={idx} className="bg-slate-950 text-slate-400 px-2 py-1 rounded-md text-[10px] border border-slate-800">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-slate-800 pt-4">
                      <a 
                        href={asset.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sky-400 hover:text-sky-300 font-bold text-sm"
                      >
                        <ExternalLink size={14} /> 자산 열기
                      </a>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(asset.url);
                            alert("URL이 복사되었습니다.");
                          }}
                          className="text-slate-500 hover:text-sky-400 p-2 rounded-lg hover:bg-sky-400/10 transition-all"
                          title="URL 복사"
                        >
                          <Link2 size={16} />
                        </button>
                        {currentUser?.canCRUD && (
                          <button 
                            onClick={() => deleteAsset(asset.id)}
                            className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-all"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-slate-900/50 border border-slate-800 border-dashed rounded-3xl">
                  <AlertCircle size={48} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500 font-medium">검색 조건에 맞는 자산이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'teamview' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl group hover:border-indigo-500/40 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl font-bold text-white">{asset.name}</h4>
                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-950 px-2 py-1 rounded-md border border-slate-800">{asset.team}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6 h-12 overflow-hidden content-start">
                    {asset.tags.map((t, idx) => (
                      <span key={idx} className="bg-slate-800/50 text-slate-400 px-2 py-1 rounded-md text-[10px]">#{t}</span>
                    ))}
                  </div>
                  <a 
                    href={asset.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-black rounded-xl transition-all"
                  >
                    <ExternalLink size={16} /> 리소스 바로가기
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'qrshare' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-slate-900 border border-slate-800 p-12 rounded-[40px] shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[64px]"></div>
               <div className="space-y-6">
                <h3 className="text-2xl font-black text-white">QR 자산 공유</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  현재 조회 가능한 Public 자산들을 모아 공유용 QR 코드를 생성합니다. 
                  스캔하면 자동으로 'ReadOnly' 모드로 접속되어 안전하게 자산을 전달할 수 있습니다.
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">공유 링크 (Read-only)</label>
                  <div className="relative">
                    <textarea 
                      readOnly
                      value={shareLink || '생성 버튼을 누르세요'}
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-400 outline-none pr-12"
                    />
                    {shareLink && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(shareLink);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className="absolute right-4 top-4 p-2 text-slate-500 hover:text-sky-400 transition-colors"
                      >
                        {copySuccess ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  onClick={createShareLink}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  공유용 QR 생성하기
                </button>
               </div>

               <div className="flex flex-col items-center justify-center bg-slate-950/50 border border-slate-800 border-dashed rounded-[32px] p-8 min-h-[300px]">
                 {shareLink ? (
                   <div className="bg-white p-4 rounded-3xl shadow-2xl animate-in zoom-in duration-300">
                     <QRCodeSVG value={shareLink} size={220} />
                   </div>
                 ) : (
                   <div className="text-center space-y-4">
                     <QrCode size={64} className="mx-auto text-slate-800" />
                     <p className="text-slate-600 text-sm font-medium">QR 코드가 아직 생성되지 않았습니다.</p>
                   </div>
                 )}
                 {shareLink && (
                   <p className="mt-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Share with Public Assets only</p>
                 )}
               </div>
            </div>
          </div>
        )}

        {activeView === 'sync' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                  <Database size={24} />
                </div>
                <h3 className="text-xl font-black text-white">JSON 백업 및 복구</h3>
              </div>
              <p className="text-slate-400 text-sm mb-8">로컬 브라우저에 저장된 데이터를 JSON 파일로 내보내거나, 기존 백업 파일을 불러와 복원할 수 있습니다.</p>
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => {
                    const data = JSON.stringify({ app: 'KoGenOne', assets, exportedAt: new Date().toISOString() }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kogenone_backup_${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                  }}
                  className="flex-1 flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all border border-slate-700"
                >
                  JSON 내보내기
                </button>
                <label className="flex-1 flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all border border-slate-700 cursor-pointer">
                  JSON 가져오기
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        try {
                          const parsed = JSON.parse(re.target?.result as string);
                          if (parsed.assets) {
                            setAssets(parsed.assets);
                            alert("복원 완료!");
                          }
                        } catch (e) { alert("잘못된 파일 형식입니다."); }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-green-500/10 p-2 rounded-lg text-green-400">
                  <RefreshCw size={24} />
                </div>
                <h3 className="text-xl font-black text-white">Google Sheets 실시간 동기화</h3>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apps Script Web App URL</label>
                    <input 
                      type="text" value={gsUrl} onChange={e => setGsUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">동기화 토큰 (선택)</label>
                    <input 
                      type="text" value={gsToken} onChange={e => setGsToken(e.target.value)}
                      placeholder="e.g. KOMQ-2025"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${syncStatus.color.includes('green') ? 'animate-pulse' : ''} bg-current ${syncStatus.color}`}></div>
                    <span className={`text-xs font-bold ${syncStatus.color}`}>{syncStatus.text}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={testGsConnection}
                      disabled={isSyncing}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase rounded-lg disabled:opacity-50"
                    >
                      테스트
                    </button>
                    <button 
                      onClick={uploadToGs}
                      disabled={isSyncing || !gsUrl}
                      className="px-4 py-2 bg-green-500 text-slate-950 text-[10px] font-black uppercase rounded-lg shadow-lg shadow-green-500/20 disabled:opacity-50"
                    >
                      {isSyncing ? '진행 중...' : '업로드'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="max-w-3xl animate-in fade-in duration-500">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[40px] shadow-2xl space-y-8">
              <section className="space-y-4">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Lock className="text-sky-500" size={20} /> 저작권 및 법적 고지
                </h3>
                <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl space-y-6 text-sm leading-relaxed text-slate-400">
                  <p><strong className="text-slate-200">저작권 :</strong> 한국경영품질연구원(KOMQ), <strong className="text-slate-200">개발자 :</strong> 신윤복(YB SHIN)</p>
                  <p>
                    <strong className="text-slate-200 uppercase tracking-widest text-[10px] block mb-1">문의처</strong>
                    ybshinimqr@ajou.ac.kr / ssyb@nate.com
                  </p>
                  <hr className="border-slate-800" />
                  <div className="space-y-2 text-xs">
                    <p className="font-medium italic text-slate-300">"본 저작물은 저작권법 제136조에 따라 보호받으며, 권리자의 허락 없는 무단 전재 및 재배포를 금합니다."</p>
                    <p>"본 프로그램을 무단으로 배포, 수정, 사용할 경우 관련 법령에 따라 처벌받을 수 있습니다."</p>
                    <p>"비인가 사용자가 본 프로그램을 사용하는 것은 불법이며, 발견 시 법적 조치가 취해질 수 있습니다."</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Share Modal Backdrop */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white mb-4">공유 링크가 생성되었습니다</h3>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              아래 링크를 복사하여 공유하세요. 수신자는 자동으로 <b>Public 자산만 조회 가능한 Read-only</b> 모드로 접속하게 됩니다.
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-8">
              <p className="text-[10px] font-mono text-slate-500 break-all">{shareLink}</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
                className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {copySuccess ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copySuccess ? '복사됨' : '링크 복사하기'}
              </button>
              <button 
                onClick={() => setShowShareModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
