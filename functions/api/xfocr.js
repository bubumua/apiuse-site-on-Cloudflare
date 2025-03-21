export async function onRequest(context) {
  const { request } = context;

  // 配置参数，请替换为你在控制台获取的实际值
  const config = {
    hostUrl: "https://rest-api.xfyun.cn/v2/itr",
    host: "rest-api.xfyun.cn",
    appid: "c289d671",
    apiSecret: "MWU0ODhhZWRhY2ZhZGYxNGUyNzEzNzUw",
    apiKey: "216b9d113fe87ffe01b2811601d29cfe",
    uri: "/v2/itr",
  };

  // 解析前端传入的 JSON 数据
  let clientData;
  try {
    clientData = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "无效的 JSON 数据" }), {
      status: 400,
    });
  }

  if (!clientData.image) {
    return new Response(JSON.stringify({ error: "缺少 image 字段" }), {
      status: 400,
    });
  }

  // 组装调用讯飞接口的请求体
  const postBody = {
    common: { app_id: config.appid },
    business: { ent: "teach-photo-print", aue: "raw" },
    data: { image: clientData.image },
  };

  const postBodyStr = JSON.stringify(postBody);
  const digest = await computeDigest(postBodyStr);
  const date = new Date().toUTCString();

  const authStr = await getAuthStr(config, date, digest);

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json,version=1.0",
    Host: config.host,
    Date: date,
    Digest: digest,
    Authorization: authStr,
  };

  try {
    const apiResponse = await fetch(config.hostUrl, {
      method: "POST",
      headers: headers,
      body: postBodyStr,
    });
    const result = await apiResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "调用 API 失败", details: err.toString() }),
      { status: 500 }
    );
  }
}

// 计算请求体摘要：SHA-256 后 base64 编码，并在前面加上 "SHA-256="
async function computeDigest(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64Hash = btoa(String.fromCharCode(...hashArray));
  return "SHA-256=" + base64Hash;
}

// 生成鉴权签名字符串
async function getAuthStr(config, date, digest) {
  const stringToSign = `host: ${config.host}\ndate: ${date}\nPOST ${config.uri} HTTP/1.1\ndigest: ${digest}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(config.apiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(stringToSign)
  );
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = btoa(String.fromCharCode(...signatureArray));
  return `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line digest", signature="${signature}"`;
}
