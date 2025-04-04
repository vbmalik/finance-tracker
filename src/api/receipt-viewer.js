export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const fileName = url.pathname.slice(1); // Remove leading '/'
    
    if (!fileName) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Get the object from R2
    const object = await env.RECEIPTS.get(fileName);
    
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Return the file with appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return new Response(object.body, {
      headers
    });
  }
};
