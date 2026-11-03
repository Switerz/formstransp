"use client";
import "./black-friday-challenge.css";
interface BlackFridayChallengeProps {transportadoraNome:string;slaOperacional:string;totalPedidos:number;pendentes:number;respondidos:number;}
const format = (n:number)=>n.toLocaleString("pt-BR");
export function BlackFridayChallenge({transportadoraNome,slaOperacional,totalPedidos,pendentes,respondidos}:BlackFridayChallengeProps){
const initials=transportadoraNome.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
return <div className="shell" id="inicio">
<aside className="sidebar" aria-label="Navegação GOBLACK"><div className="brand">Forms <span>Transp.</span></div><div className="campaign">✦ BLACK FRIDAY 2026</div><nav className="nav"><div className="nav-label">SUA OPERAÇÃO</div><a className="active" href="#inicio">◈ &nbsp; Black Friday</a><a href="#indicadores">▥ &nbsp; Indicadores</a><a href="#missoes">◎ &nbsp; Missões</a><a href="#acoes">↗ &nbsp; Ações rápidas</a></nav><div className="side-bottom">◉ &nbsp; Portal da transportadora</div></aside>
<main className="main"><header className="topbar"><div className="crumb">Portal &nbsp; / &nbsp; Minha Base &nbsp; / &nbsp; <b>Black Friday</b></div><div className="profile"><span>Transportadora <b>{transportadoraNome}</b></span><span className="avatar">{initials}</span></div></header>
<section className="hero" aria-labelledby="hero-title"><div className="eyebrow"><i/> Black Friday Transportes Challenge</div><h1 id="hero-title">Sua operação.<br/><span>Seu próximo nível.</span></h1><p>A corrida pela liderança começou. Mantenha a base em dia, acompanhe seus indicadores e prepare-se para conquistar o topo.</p><div className="speed-label">GOBLACK EXPRESS · EM MOVIMENTO</div><div className="road" aria-hidden="true"/><div className="motion-truck" aria-hidden="true"><svg viewBox="0 0 220 112" xmlns="http://www.w3.org/2000/svg">
<defs><lineargradient id="goblack-v3-cargo" x1="0" x2="1"><stop stopColor="#b91c32"></stop><stop offset="1" stopColor="#f3394f"></stop></lineargradient><lineargradient id="goblack-v3-cab" x1="0" x2="1"><stop stopColor="#f54a5d"></stop><stop offset="1" stopColor="#a9172b"></stop></lineargradient></defs>
<g className="trail" stroke="#fa6576" strokeLinecap="round" strokeWidth="3"><path d="M-34 53H-6"></path><path d="M-51 65H-13"></path><path d="M-28 77H-4"></path></g>
<rect fill="url(#goblack-v3-cargo)" height="66" rx="9" stroke="#ff8a96" strokeWidth="1.5" width="133" x="8" y="20"></rect>
<path d="M141 41H175L197 65V86H141Z" fill="url(#goblack-v3-cab)" stroke="#ff9ca6" strokeWidth="1.5"></path>
<path d="M151 46H172L187 64H151Z" fill="#182736" stroke="#a5b8c8" strokeWidth="1.5"></path>
<path d="M9 76H197V88H9Z" fill="#26252c"></path><rect className="headlight" fill="#fff2b1" height="7" rx="2" width="11" x="188" y="72"></rect>
<g fill="#fff"><text fontFamily="Arial,sans-serif" fontSize="18" fontWeight="900" letterSpacing=".2" x="22" y="48">GO</text><text fontFamily="Arial,sans-serif" fontSize="18" fontWeight="900" letterSpacing=".2" x="22" y="67">BLACK</text></g>
<path d="M22 73H112" opacity=".65" stroke="#ff9ba5" strokeWidth="2"></path>
<g className="wheel"><circle cx="44" cy="87" fill="#090a0e" r="17" stroke="#737782" strokeWidth="3"></circle><circle cx="44" cy="87" fill="#c9cbd0" r="9"></circle><path d="M44 78V96M35 87H53" stroke="#52565e" strokeWidth="3"></path></g>
<g className="wheel"><circle cx="166" cy="87" fill="#090a0e" r="17" stroke="#737782" strokeWidth="3"></circle><circle cx="166" cy="87" fill="#c9cbd0" r="9"></circle><path d="M166 78V96M157 87H175" stroke="#52565e" strokeWidth="3"></path></g>
</svg></div><div className="track-copy">A ENTREGA NÃO PARA · 2026</div></section>
<div className="section-kicker" id="indicadores">Visão geral da operação</div>
<section className="metrics" aria-label="Indicadores da operação">
<div className="metric accent"><div className="label">Seus pontos</div><strong>—</strong><small>Aguardando apuração</small></div>
<div className="metric"><div className="label">SLA com Base Completa</div><strong>{slaOperacional}%</strong><small>Indicador operacional · não é SLA oficial</small></div>
<div className="metric"><div className="label">Missões completas</div><strong>—</strong><small>Aguardando apuração</small></div>
<div className="metric"><div className="label">Sequência</div><strong>—</strong><small>Aguardando apuração</small></div>
<div className="metric"><div className="label">Avarias confirmadas</div><strong>—</strong><small>Status: AVARIA CONFIRMADA · integração pendente</small></div>
</section>
<div className="content"><div className="stack">
<section className="panel"><div className="panel-head"><div><h2>🏁 Corrida pela liderança</h2><p className="sub">Seu desempenho na competição.</p></div><span className="tag">Em preparação</span></div><div style={{fontSize:17,fontWeight:800}}>{transportadoraNome}</div><p className="note">Sua pontuação e a distância até a liderança aparecerão após a apuração oficial.</p><div className="track"><div/></div><div className="note">Sem resultados publicados até o momento.</div></section>
<section className="panel" id="missoes"><div className="panel-head"><div><h2>🎯 Missões da Black Friday</h2><p className="sub">Três objetivos para acelerar sua operação.</p></div><span className="tag">A apurar</span></div>
<div className="mission"><div className="mission-icon">🎯</div><div className="mission-text"><b>SLA impecável</b><small>Manter SLA ≥ 96% no fechamento da rodada.</small></div><span className="status">A apurar</span></div>
<div className="mission"><div className="mission-icon">📦</div><div className="mission-text"><b>Base em dia</b><small>Realizar uma atualização operacional válida.</small></div><span className="status">A apurar</span></div>
<div className="mission"><div className="mission-icon">📷</div><div className="mission-text"><b>Zero avaria pendente</b><small>Enviar evidências dos pedidos com AVARIA CONFIRMADA.</small></div><span className="status">A apurar</span></div></section>
<section className="panel" id="acoes"><div className="panel-head"><div><h2>⚡ Ações que movem sua operação</h2><p className="sub">Tudo o que você precisa, sem sair da Minha Base.</p></div></div><div className="action-grid">
<div className="action"><b>📥 Minha Base</b><p>Trabalhe sempre com a versão mais recente.</p><a className="btn red" href="/portal/minha-base/download">Baixar base</a></div>
<div className="action"><b>↥ Atualizar operação</b><p>Selecione a planilha preenchida para devolução.</p><button className="btn red" type="button" onClick={()=>{window.dispatchEvent(new Event("goblack-open-upload"));document.getElementById("bf-base-operacional")?.scrollIntoView({behavior:"smooth",block:"start"});}}>Enviar atualização</button></div>
<div className="action"><b>📸 Evidências</b><p>Anexe comprovantes de avarias confirmadas.</p><button className="btn" type="button" disabled>Em desenvolvimento</button></div>
</div></section></div>
<div className="stack"><section className="panel"><div className="panel-head"><div><h2>🏆 Ranking Black Friday</h2><p className="sub">Classificação da competição.</p></div><span className="tag">Em preparação</span></div><div className="ranking-empty"><div className="trophy">🏆</div><strong>O pódio está sendo preparado.</strong><p>O ranking aparecerá aqui assim que a apuração oficial estiver disponível.</p></div></section>
<section className="panel"><div className="panel-head"><div><h2>📊 Sua operação</h2><p className="sub">Indicadores reais da Minha Base.</p></div></div><div className="mission"><div className="mission-text"><small>Total de pedidos</small><b>{format(totalPedidos)}</b></div></div><div className="mission"><div className="mission-text"><small>Pendentes</small><b>{format(pendentes)}</b></div></div><div className="mission"><div className="mission-text"><small>Respondidos</small><b>{format(respondidos)}</b></div></div></section></div></div>
<p className="footnote">Indicadores operacionais da base · Pontuação, ranking e avarias aguardam integração oficial.</p>
</main></div>;
}
