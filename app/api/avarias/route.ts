import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isCarrierRole, isInternalRole } from "@/lib/auth";
import { enviarEvidencia, listarEvidencias, pedidosComAvaria } from "@/lib/avarias-drive";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=300;
export async function GET(){
 const user=await getCurrentUser();if(!user)return NextResponse.json({erro:"Não autenticado"},{status:401});
 try {if(isInternalRole(user.role))return NextResponse.json({evidencias:await listarEvidencias()},{headers:{"Cache-Control":"no-store"}});
 if(!isCarrierRole(user.role)||!user.transportadoraId)return NextResponse.json({erro:"Sem permissão"},{status:403});
 const [pedidos,evidencias]=await Promise.all([pedidosComAvaria(user.transportadoraId),listarEvidencias(user.transportadoraId)]);
 return NextResponse.json({pedidos,evidencias},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({erro:e instanceof Error?e.message:"Erro ao consultar"},{status:500});}
}
export async function POST(request:NextRequest){
 const user=await getCurrentUser();if(!user)return NextResponse.json({erro:"Não autenticado"},{status:401});
 if(!isCarrierRole(user.role)||!user.transportadoraId)return NextResponse.json({erro:"Sem permissão"},{status:403});
 try {const data=await request.formData();const pedido=data.get("pedido");const arquivo=data.get("arquivo");
 if(typeof pedido!=="string"||!(arquivo instanceof File))return NextResponse.json({erro:"Pedido e arquivo obrigatórios"},{status:400});
 const item=await enviarEvidencia({transportadoraId:user.transportadoraId,pedido,arquivo,usuarioId:user.id});return NextResponse.json({evidencia:item},{status:201});
 }catch(e){return NextResponse.json({erro:e instanceof Error?e.message:"Falha no envio"},{status:400});}
}
