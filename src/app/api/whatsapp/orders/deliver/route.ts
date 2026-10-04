import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse,apiFailure,apiSuccess,createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { z } from '@/platform/validation/zod';
import { drainOrderDeliveries } from '@/application/use-cases/pedido-delivery-runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const requestId=createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed=await parseJsonRequest(request,z.object({ orderId:z.string().uuid() }).strict(),2048);
    if (!parsed.success) return apiFailure(parsed.status,parsed.code,parsed.message,requestId);
    return apiSuccess(await drainOrderDeliveries(parsed.data.orderId,request.headers.get('authorization') ?? ''),requestId);
  } catch(error) { return apiErrorResponse('OrderDelivery',requestId,error); }
}
