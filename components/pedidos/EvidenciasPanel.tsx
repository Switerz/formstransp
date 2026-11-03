"use client";
import { useEffect, useState } from "react";
type Evidencia={id:string;pedido:string;nome:string;criadoEm:string;tamanho:number};
export function EvidenciasPanel(){
 const [pedidos,setPedidos]=useState<string[]>([]);const [evidencias,setEvidencias]=useState<Evidencia[]>([]);
 const [pedido,setPedido]=useState("");const [arquivo,setArquivo]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function carregar(){const r=await fetch("/api/avarias",{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.erro??"Falha ao consultar avarias");setPedidos(data.pedidos??[]);setEvidencias(data.evidencias??[]);}
 useEffect(()=>{carregar().catch(e=>setMessage(e.message));},[]);
 async function enviar(e:React.FormEvent){e.preventDefault();if(!pedido||!arquivo)return;setBusy(true);setMessage("");try{const data=new FormData();data.set("pedido",pedido);data.set("arquivo",arquivo);const r=await fetch("/api/avarias",{method:"POST",body:data});const j=await r.json();if(!r.ok)throw new Error(j.erro??"Falha no envio");setMessage("Evidência salva no Drive privado.");setArquivo(null);const input=document.getElementById("avaria-arquivo") as HTMLInputElement|null;if(input)input.value="";await carregar();}catch(err){setMessage(err instanceof Error?err.message:"Falha no envio");}finally{setBusy(false);}}
 return <section id="bf-evidencias" className="goblack-evidencias"><h2>📸 Evidências de avarias confirmadas</h2><p>Somente pedidos com status original AVARIA CONFIRMADA. JPG, PNG ou PDF, até 10 MB. Cada envio fica registrado separadamente.</p>
 <form onSubmit={enviar}><label>Pedido<select value={pedido} onChange={e=>setPedido(e.target.value)} required><option value="">Selecione um pedido</option>{pedidos.map(p=><option key={p} value={p}>{p}</option>)}</select></label><label>Comprovante<input id="avaria-arquivo" type="file" accept="image/jpeg,image/png,application/pdf" required onChange={e=>setArquivo(e.target.files?.[0]??null)}/></label><button disabled={busy||!pedido||!arquivo}>{busy?"Enviando...":"Enviar evidência"}</button></form>
 {message&&<p role="status">{message}</p>}{pedidos.length===0&&<p>Nenhuma avaria confirmada encontrada na base atual.</p>}
 <h3>Histórico de envios</h3>{evidencias.length===0?<p>Sem evidências enviadas.</p>:<ul>{evidencias.map(item=><li key={item.id}><strong>{item.pedido}</strong> · {item.nome} · {new Date(item.criadoEm).toLocaleString("pt-BR")} · <a href={`/api/avarias/${encodeURIComponent(item.id)}`}>Baixar</a></li>)}</ul>}</section>;
}
