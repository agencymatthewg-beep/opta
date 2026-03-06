type JsonInit = number | ResponseInit;

function toResponseInit(init?: JsonInit): ResponseInit {
  if (typeof init === 'number') {
    return { status: init };
  }
  return init ?? {};
}

export class NextResponse extends Response {
  static json(data: unknown, init?: JsonInit): Response {
    const responseInit = toResponseInit(init);
    const headers = new Headers(responseInit.headers);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    return new Response(JSON.stringify(data), {
      ...responseInit,
      headers,
    });
  }
}
