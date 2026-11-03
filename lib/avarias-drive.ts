import "server-only";
import * as XLSX from "xlsx";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";

const API = "https://www.googleapis.com/drive/v3/files";
const MAX = 10 * 1024 * 1024;
export const AVARIA_MAX_BYTES = MAX;
export type Evidencia = { id:string; pedido:string; nome:string; tipo:string; tamanho:number; criadoEm:string; transportadoraId:string };
function norm(s:unknown) { return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase(); }
function campo(row:Record<string,unknown>, name:string) { const key=Object.keys(row).find(k=>norm(k)===norm(name)); return key ? String(row[key]??"").trim():""; }
function safe(s:string){ return s.replace(/\\/g,"\\\\").replace(/'/g,"\\'"); }
async function driveFetch(url:string, init:RequestInit={}) { const token=await obterGoogleDriveAccessToken(); return fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},cache:"no-store"}); }
async function files(q:string, fields="nextPageToken,files(id,name,mimeType,size,createdTime,appProperties)") {
 const out:any[]=[]; let page:string|undefined;
 do { const u=new URL(API);u.searchParams.set("q",q);u.searchParams.set("fields",fields);u.searchParams.set("pageSize","1000"); if(page)u.searchParams.set("pageToken",page);
 const r=await driveFetch(u.toString());if(!r.ok)throw new Error(`Falha na listagem privada (${r.status})`);
 const j=await r.json();out.push(...(j.files??[]));page=j.nextPageToken; }while(page);return out;
}
export async function pedidosComAvaria(transportadoraId:string):Promise<string[]> {
 const q=`trashed = false and appProperties has { key='formsTranspTipo' and value='base_transportadora' } and appProperties has { key='formsTranspKey' and value='${safe(`transportadora:${transportadoraId}`)}' }`;
 const bases=await files(q,"nextPageToken,files(id,name)"); const pedidos=new Set<string>();
 for(const base of bases){const r=await driveFetch(`${API}/${encodeURIComponent(base.id)}?alt=media`);if(!r.ok)throw new Error("Falha ao consultar base de avarias");
 const workbook=XLSX.read(Buffer.from(await r.arrayBuffer()),{type:"buffer"});const sheet=workbook.Sheets[workbook.SheetNames[0]];if(!sheet)continue;
 for(const row of XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:"",raw:false})){
 const micro=campo(row,"MICRO STATUS")||campo(row,"MICROSTATUS")||campo(row,"ÚLTIMA OCORRÊNCIA MICRO")||campo(row,"ULTIMA OCORRENCIA MICRO");
 const raw=[micro,campo(row,"STATUS TRANSPORTADOR"),campo(row,"STATUS ATUAL"),campo(row,"OCORRÊNCIA")];
 if(raw.some(x=>norm(x)==="AVARIA CONFIRMADA")){const id=campo(row,"PEDIDO")||campo(row,"PEDIDO DE VENDA");if(id)pedidos.add(id);}
 }
 }return [...pedidos].sort();
}
export async function listarEvidencias(transportadoraId?:string):Promise<Evidencia[]> {
 const q="trashed = false and appProperties has { key='formsTranspTipo' and value='evidencia_avaria' }";
 const entries=await files(q);return entries.filter(x=>!transportadoraId||x.appProperties?.transportadoraId===transportadoraId).map(x=>({
 id:x.id,pedido:x.appProperties?.pedido??"",nome:x.appProperties?.nomeOriginal??x.name,tipo:x.mimeType??"",tamanho:Number(x.size??0),criadoEm:x.createdTime??"",transportadoraId:x.appProperties?.transportadoraId??""
 })).sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm));
}
export async function enviarEvidencia(args:{transportadoraId:string;pedido:string;arquivo:File;usuarioId:string}):Promise<Evidencia>{
 const {transportadoraId,pedido,arquivo,usuarioId}=args;
 if(!arquivo.size||arquivo.size>MAX)throw new Error("Arquivo deve ter até 10 MB.");
 const tipos=["image/jpeg","image/png","application/pdf"];
 if(!tipos.includes(arquivo.type))throw new Error("Envie somente JPG, PNG ou PDF.");
 const bytes=Buffer.from(await arquivo.arrayBuffer());
 const magic=arquivo.type==="application/pdf"?bytes.subarray(0,5).toString()==="%PDF-":arquivo.type==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!magic)throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
 const allowed=await pedidosComAvaria(transportadoraId);
 if(!allowed.includes(pedido))throw new Error("Pedido não possui AVARIA CONFIRMADA na base atual desta transportadora.");
 const folder=process.env.GOOGLE_DRIVE_EVIDENCIAS_FOLDER_ID?.trim();
 if(!folder)throw new Error("Pasta privada de evidências ainda não configurada.");
 const id=crypto.randomUUID();const filename=`avaria_${pedido.replace(/[^a-zA-Z0-9_-]/g,"_")}_${id}`;
 const metadata={name:filename,parents:[folder],appProperties:{formsTranspTipo:"evidencia_avaria",transportadoraId,pedido,nomeOriginal:arquivo.name.slice(0,120),usuarioId}};
 const token=await obterGoogleDriveAccessToken();const boundary=`forms-${id}`;
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${arquivo.type}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
 const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,mimeType",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":`multipart/related; boundary=${boundary}`},body,cache:"no-store"});
 if(!r.ok)throw new Error(`Falha no armazenamento privado (${r.status}).`);const file=await r.json();
 return {id:file.id,pedido,nome:arquivo.name,tipo:arquivo.type,tamanho:arquivo.size,criadoEm:file.createdTime??new Date().toISOString(),transportadoraId};
}
export async function obterEvidenciaPrivada(id:string){
 const meta=await driveFetch(`${API}/${encodeURIComponent(id)}?fields=id,name,mimeType,appProperties`);
 if(!meta.ok)return null;const info=await meta.json();if(info.appProperties?.formsTranspTipo!=="evidencia_avaria")return null;
 const response=await driveFetch(`${API}/${encodeURIComponent(id)}?alt=media`);if(!response.ok)return null;
 return {info,bytes:await response.arrayBuffer()};
}
