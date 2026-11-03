import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isInternalRole } from "@/lib/auth";
import { obterEvidenciaPrivada } from "@/lib/avarias-drive";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();if(!user)return new NextResponse("Não autenticado",{status:401});
 const {id}=await params;const file=await obterEvidenciaPrivada(id);if(!file)return new NextResponse("Não encontrado",{status:404});
 if(!isInternalRole(user.role)&&file.info.appProperties?.transportadoraId!==user.transportadoraId)return new NextResponse("Sem permissão",{status:403});
 const type=["image/jpeg","image/png","application/pdf"].includes(file.info.mimeType)?file.info.mimeType:"application/octet-stream";
 return new NextResponse(file.bytes,{headers:{"Content-Type":type,"Content-Disposition":"attachment; filename=evidencia","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
