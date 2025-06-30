// pages/api/backend-api.ts
import type {NextApiRequest, NextApiResponse} from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.method) {
    return res.status(405).end(`request method is null`);
  } else if (!req.body.requestUri) {
    return res.status(405).end(`request uri is null`);
  }

  try {
    // API header 정보
    const body = req.body;

    const requestHeader = {
      method: body.requestParam.method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body.requestParam.method === 'GET' ? {} : {body: JSON.stringify(body.requestParam)})
    };

    // API 전달 URL (BACK-END API 주소 개발자모드에서 노출되지 않도록 한번 더 가공)
    const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:3010`;

    // API REQUEST
    const backendRes = await fetch(`${backendUrl}${body.requestUri}`, requestHeader);

    // API 결과 성공이든 실패든 return.
    return res.status(backendRes.status).json(await backendRes?.json());
  } catch (e) {
    console.error(e)
    return res.status(500).json({message: '서버 호출 중 에러가 발생했습니다.'})
  }
}